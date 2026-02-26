const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const NodeCache = require('node-cache');
const pino = require('pino');
const config = require('../config');
const qrcode = require('qrcode-terminal');

// Create logger
const logger = pino({ 
    level: 'warn',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss'
        }
    }
});

const msgRetryCounterCache = new NodeCache();

// Authentication folder
const authFolder = path.join(process.cwd(), 'auth_info');

// Store pairing handler reference
let pairingHandler = null;

async function connectToWhatsApp() {
    try {
        await fs.ensureDir(authFolder);
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            msgRetryCounterCache,
            browser: ['CHEEMY-BOT', 'Chrome', '1.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: false,
            emitOwnEvents: true,
            generateHighQualityLinkPreview: false,
            
            // Add this to ignore decryption errors
            shouldIgnoreJid: (jid) => {
                return jid === 'status@broadcast' || jid.includes('@lid');
            }
        });

        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                // Show both QR and instructions for phone pairing
                console.log(chalk.green('\n📲 ==========================================='));
                console.log(chalk.green('📲 OPTION 1: SCAN QR CODE'));
                console.log(chalk.green('==========================================='));
                qrcode.generate(qr, { small: true });
                
                console.log(chalk.cyan('\n📱 ==========================================='));
                console.log(chalk.cyan('📱 OPTION 2: USE PHONE NUMBER'));
                console.log(chalk.cyan('==========================================='));
                console.log(chalk.yellow('1. Send .pair command to bot (once connected)'));
                console.log(chalk.yellow('2. Or wait for bot to connect via QR first'));
                console.log(chalk.yellow('3. Then use phone number for future connections'));
                console.log(chalk.cyan('===========================================\n'));
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(chalk.yellow('🔄 Connection reconnecting...'));
                
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(), 5000);
                } else {
                    console.log(chalk.red('🚫 Logged out. Use .pair command to reconnect with phone number.'));
                }
            } else if (connection === 'open') {
                console.log(chalk.green('✅ CHEEMY-BOT connected successfully!'));
                console.log(chalk.magenta(`👑 Master: Cheema`));
                console.log(chalk.cyan(`🤖 Bot Name: CHEEMY-BOT`));
                console.log(chalk.cyan(`📱 Bot Number: ${sock.user?.id?.split(':')[0] || 'Unknown'}`));
                console.log(chalk.cyan(`🔧 Prefix: ${config.prefix}`));
                
                // Show phone pairing instructions now that bot is connected
                console.log(chalk.green('\n📱 ==========================================='));
                console.log(chalk.green('📱 PHONE NUMBER PAIRING READY'));
                console.log(chalk.green('==========================================='));
                console.log(chalk.yellow('Send this command to the bot:'));
                console.log(chalk.cyan(`.pair ${config.ownerNumber[0]}`));
                console.log(chalk.green('===========================================\n'));
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                if (type === 'notify') {
                    for (const msg of messages) {
                        if (!msg.key.fromMe && msg.message) {
                            sock.ev.emit('message.new', msg);
                        }
                    }
                }
            } catch (err) {
                // Silently ignore decryption errors
            }
        });

        // Ignore decryption errors
        sock.ev.on('messages.update', () => {});
        sock.ev.on('message-receipt.update', () => {});
        sock.ev.on('messages.reaction', () => {});

        return sock;

    } catch (error) {
        console.error(chalk.red('Failed to connect:'), error);
        setTimeout(() => connectToWhatsApp(), 10000);
    }
}

module.exports = { connectToWhatsApp };