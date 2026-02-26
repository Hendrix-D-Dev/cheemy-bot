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

// Create logger with custom level to ignore certain errors
const logger = pino({ 
    level: 'warn', // Only show warnings and errors
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
                // Ignore decryption errors for these types
                return jid === 'status@broadcast' || jid.includes('@lid');
            }
        });

        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(chalk.green('\n📲 Scan this QR code with your WhatsApp to connect CHEEMY-BOT:'));
                console.log(chalk.yellow('   (Make sure no other device is connected)\n'));
                qrcode.generate(qr, { small: true });
                console.log(chalk.cyan('\n👑 Waiting for Master Cheema to scan...\n'));
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'unknown reason';
                
                // Don't show the full error, just a simple message
                console.log(chalk.yellow('🔄 Connection reconnecting...'));
                
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(), 5000);
                } else {
                    console.log(chalk.red('🚫 Logged out. Delete auth folder and scan again.'));
                }
            } else if (connection === 'open') {
                console.log(chalk.green('✅ CHEEMY-BOT connected successfully!'));
                console.log(chalk.magenta(`👑 Master: Cheema`));
                console.log(chalk.cyan(`🤖 Bot Name: CHEEMY-BOT`));
                console.log(chalk.cyan(`📱 Bot Number: ${sock.user?.id?.split(':')[0] || 'Unknown'}`));
                console.log(chalk.cyan(`🔧 Prefix: ${config.prefix}`));
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        // Handle messages - with error suppression
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

        // Ignore all decryption errors
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