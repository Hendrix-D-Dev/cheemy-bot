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
const logger = pino({ level: 'error' });
const msgRetryCounterCache = new NodeCache();

// Authentication folder
const authFolder = path.join(process.cwd(), 'auth_info');

async function connectToWhatsApp() {
    try {
        // Ensure auth folder exists
        await fs.ensureDir(authFolder);

        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);

        // Fetch latest version
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(chalk.blue(`📱 Using WA v${version.join('.')}, isLatest: ${isLatest}`));

        // Create socket
        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            browser: ['CHEEMY-BOT', 'Chrome', '1.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: false, // Don't show online status
            emitOwnEvents: true,
            
            // Generate high quality link preview
            generateHighQualityLinkPreview: false,
            
            // Important: Don't retry requests on failure
            shouldRetryRequest: () => false
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
                
                console.log(chalk.red(`❌ Connection closed: ${errorMessage}`));
                
                // Check if it's a conflict (device_removed)
                if (errorMessage.includes('conflict') || errorMessage.includes('device_removed')) {
                    console.log(chalk.yellow('⚠️  Another device is connected to this WhatsApp number.'));
                    console.log(chalk.yellow('📱 Please go to WhatsApp > Linked Devices and remove all devices.'));
                    console.log(chalk.yellow('🔄 Then restart the bot.'));
                    
                    // Don't auto-reconnect on conflict, wait for user action
                    setTimeout(() => {
                        console.log(chalk.yellow('\n🔄 Retrying connection in 30 seconds...'));
                        console.log(chalk.yellow('   Make sure you have removed all linked devices first.'));
                        setTimeout(() => connectToWhatsApp(), 30000);
                    }, 5000);
                    return;
                }
                
                // For other errors, reconnect
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(chalk.yellow('🔄 Reconnecting in 5 seconds...'));
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
                
                // Send startup message to owner
                setTimeout(() => {
                    const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
                    sock.sendMessage(ownerJid, { 
                        text: `🤖 *CHEEMY-BOT* is now online!\n\n` +
                              `👑 *Master:* Cheema\n` +
                              `📱 *Status:* Active\n` +
                              `⏰ *Time:* ${new Date().toLocaleString()}\n` +
                              `🔧 *Prefix:* ${config.prefix}`
                    }).catch(() => {});
                }, 2000);
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const msg of messages) {
                    if (!msg.key.fromMe && msg.message) {
                        sock.ev.emit('message.new', msg);
                    }
                }
            }
        });

        return sock;

    } catch (error) {
        console.error(chalk.red('Failed to connect:'), error);
        console.log(chalk.yellow('🔄 Retrying in 10 seconds...'));
        setTimeout(() => connectToWhatsApp(), 10000);
    }
}

module.exports = { connectToWhatsApp };
