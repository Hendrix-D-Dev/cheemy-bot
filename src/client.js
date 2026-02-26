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
const authFolder = path.join(process.cwd(), 'auth_info');
let pairingCodeGenerated = false;
let pairingCode = null;

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
            
            shouldIgnoreJid: (jid) => {
                return jid === 'status@broadcast' || jid.includes('@lid');
            }
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && !pairingCodeGenerated) {
                // Show both QR and pairing code
                console.log(chalk.green('\n📲 ==========================================='));
                console.log(chalk.green('📲 OPTION 1: SCAN QR CODE'));
                console.log(chalk.green('==========================================='));
                qrcode.generate(qr, { small: true });
                
                console.log(chalk.cyan('\n📱 ==========================================='));
                console.log(chalk.cyan('📱 OPTION 2: USE PHONE NUMBER'));
                console.log(chalk.cyan('==========================================='));
                
                // Generate pairing code automatically
                try {
                    console.log(chalk.yellow('🔄 Generating pairing code...'));
                    
                    // Get owner's phone number from config
                    const phoneNumber = config.ownerNumber[0];
                    
                    if (phoneNumber) {
                        // Request pairing code from WhatsApp
                        const code = await sock.requestPairingCode(phoneNumber);
                        pairingCode = code.match(/.{1,4}/g).join('-');
                        
                        console.log(chalk.green('\n🔐 ==========================================='));
                        console.log(chalk.green('🔐 PAIRING CODE READY'));
                        console.log(chalk.green('==========================================='));
                        console.log(chalk.cyan(`📱 Phone: ${phoneNumber}`));
                        console.log(chalk.yellow(`🔑 Code: ${pairingCode}`));
                        console.log(chalk.green('===========================================\n'));
                        console.log(chalk.white('Open WhatsApp → Linked Devices → Link with phone number'));
                        console.log(chalk.white(`Enter code: ${pairingCode}\n`));
                        
                        pairingCodeGenerated = true;
                    }
                } catch (pairError) {
                    console.log(chalk.red('❌ Failed to generate pairing code:'), pairError.message);
                    console.log(chalk.yellow('Please use QR code or send .pair command after connection.'));
                }
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
                
                // Show pairing code again if it was generated
                if (pairingCode) {
                    console.log(chalk.green('\n🔐 ==========================================='));
                    console.log(chalk.green('🔐 PAIRING CODE (Still valid)'));
                    console.log(chalk.green('==========================================='));
                    console.log(chalk.cyan(`📱 Phone: ${config.ownerNumber[0]}`));
                    console.log(chalk.yellow(`🔑 Code: ${pairingCode}`));
                    console.log(chalk.green('===========================================\n'));
                }
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

        sock.ev.on('messages.update', () => {});
        sock.ev.on('message-receipt.update', () => {});
        sock.ev.on('messages.reaction', () => {});

        return sock;

    } catch (error) {
        console.error(chalk.red('Failed to connect:'), error);
        setTimeout(() => connectToWhatsApp(), 10000);
    }
}

// Function to get the generated pairing code (for other modules)
function getPairingCode() {
    return pairingCode;
}

module.exports = { connectToWhatsApp, getPairingCode };