const { connectToWhatsApp } = require('./client');
const { initializeDatabase } = require('./utils/database');
const { handleMessage } = require('./handlers/messageHandler');
const { cleanupTemp } = require('./features/downloader');
const { initSudoTable } = require('./features/sudo');
const { startServer } = require('./server');
const stats = require('./utils/stats');
const chalk = require('chalk');
const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const antiBan = require('./utils/antiban');
const https = require('https');

let botInstance = null;
let currentSpeedMode = 'normal';
let messageQueue = [];
let processingQueue = false;

// Process message queue efficiently
async function processMessageQueue() {
    if (processingQueue || messageQueue.length === 0) return;
    
    processingQueue = true;
    
    while (messageQueue.length > 0) {
        const { sock, msg } = messageQueue.shift();
        try {
            stats.incrementTotal();
            await handleMessage(sock, msg);
        } catch (error) {
            console.error('Error processing message:', error);
        }
        // Small delay between messages to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    processingQueue = false;
}

// Auth cleanup function
async function checkAndCleanAuth() {
    const authFolder = path.join(process.cwd(), 'auth_info');
    
    try {
        if (process.env.FORCE_NEW_AUTH === 'true') {
            console.log(chalk.yellow('⚠️ FORCE_NEW_AUTH is enabled - clearing auth folder...'));
            await fs.remove(authFolder);
            await fs.ensureDir(authFolder);
            console.log(chalk.green('✅ Auth folder cleared for new QR code!'));
            process.env.FORCE_NEW_AUTH = 'false';
            return true;
        }
        
        if (await fs.pathExists(authFolder)) {
            const files = await fs.readdir(authFolder);
            
            if (files.length === 0) {
                console.log(chalk.blue('📱 Auth folder is empty - ready for new QR code'));
                return false;
            }
            
            let lastModified = 0;
            for (const file of files) {
                const filePath = path.join(authFolder, file);
                const stats = await fs.stat(filePath);
                if (stats.mtimeMs > lastModified) {
                    lastModified = stats.mtimeMs;
                }
            }
            
            const now = Date.now();
            const hoursSinceLastUse = (now - lastModified) / (1000 * 60 * 60);
            
            if (hoursSinceLastUse > 12) {
                console.log(chalk.yellow(`🧹 Auth inactive for ${hoursSinceLastUse.toFixed(1)} hours, clearing...`));
                await fs.remove(authFolder);
                await fs.ensureDir(authFolder);
                console.log(chalk.green('✅ Auth folder cleared. New QR code will be generated.'));
                return true;
            }
        } else {
            await fs.ensureDir(authFolder);
        }
    } catch (error) {
        console.error('Error checking auth:', error);
    }
    return false;
}

// Force clear auth function
async function forceClearAuth() {
    const authFolder = path.join(process.cwd(), 'auth_info');
    try {
        console.log(chalk.yellow('🧹 Force clearing auth folder...'));
        await fs.remove(authFolder);
        await fs.ensureDir(authFolder);
        console.log(chalk.green('✅ Auth folder cleared!'));
        return true;
    } catch (error) {
        console.error('Error clearing auth:', error);
        return false;
    }
}

// Self-ping function
function startSelfPing() {
    console.log(chalk.cyan('🔄 Starting self-ping system to keep bot alive...'));
    
    setInterval(async () => {
        try {
            https.get('https://www.google.com', () => {}).on('error', () => {});
            
            if (process.env.RAILWAY_STATIC_URL) {
                https.get(`https://${process.env.RAILWAY_STATIC_URL}/ping`, () => {})
                    .on('error', () => {});
            }
            
            if (botInstance && config.ownerNumber[0]) {
                const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
                await botInstance.sendPresenceUpdate('available', ownerJid);
            }
            
            console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] 💓 Self-ping sent`));
        } catch (err) {}
    }, 180000);
}

// Speed optimization
async function speedOptimize(mode = 'normal') {
    switch(mode) {
        case 'turbo':
            antiBan.messageInterval = 500;
            antiBan.maxMessagesPerMinute = 50;
            console.log(chalk.yellow('⚡ Turbo mode activated'));
            currentSpeedMode = 'turbo';
            break;
        case 'normal':
            antiBan.messageInterval = 1000;
            antiBan.maxMessagesPerMinute = 30;
            console.log(chalk.blue('⚡ Normal mode activated'));
            currentSpeedMode = 'normal';
            break;
        case 'stealth':
            antiBan.messageInterval = 2000;
            antiBan.maxMessagesPerMinute = 15;
            console.log(chalk.green('⚡ Stealth mode activated'));
            currentSpeedMode = 'stealth';
            break;
    }
}

async function startBot() {
    console.log(chalk.cyan('╔════════════════════════════════════╗'));
    console.log(chalk.cyan('║     🤖 CHEEMY-BOT v2.0            ║'));
    console.log(chalk.cyan('║    🛡️ Anti-Ban Protection Active   ║'));
    console.log(chalk.cyan('║    ⏰ 24/7 Keep-Alive System       ║'));
    console.log(chalk.cyan('║    🧹 Auto Auth Cleanup (12h)      ║'));
    console.log(chalk.cyan('╚════════════════════════════════════╝\n'));

    try {
        await checkAndCleanAuth();
        await initializeDatabase();
        await initSudoTable();
        
        await fs.ensureDir('./temp');
        await fs.ensureDir('./media');
        await fs.ensureDir('./media/viewonce');
        await fs.ensureDir('./logs');
        await fs.ensureDir('./backups');
        
        await cleanupTemp();
        
        botInstance = await connectToWhatsApp();
        
        if (!botInstance) {
            console.error(chalk.red('Failed to create bot instance'));
            return;
        }
        
        startServer();
        startSelfPing();
        
        // Efficient message handling with queue
        botInstance.ev.on('message.new', async (msg) => {
            messageQueue.push({ sock: botInstance, msg });
            processMessageQueue();
        });
        
        // Schedule cleanup tasks
        cron.schedule('*/30 * * * *', async () => {
            await cleanupTemp();
            console.log(chalk.blue('🧹 Cleaned up temporary files'));
        });
        
        cron.schedule('0 0 * * *', async () => {
            await backupDatabase();
        });
        
        cron.schedule('0 * * * *', () => {
            stats.resetHourlyStats();
        });
        
        cron.schedule('0 */6 * * *', async () => {
            await checkAndCleanAuth();
        });
        
        console.log(chalk.green('\n✅ CHEEMY-BOT is ready!'));
        console.log(chalk.yellow(`📝 Prefix: ${config.prefix}`));
        console.log(chalk.yellow(`🤖 AI: ${config.ai.enabled ? 'Enabled' : 'Disabled'}`));
        console.log(chalk.yellow(`🛡️ Anti-Ban: Active`));
        console.log(chalk.yellow(`⚡ Speed Mode: ${currentSpeedMode}`));
        console.log(chalk.magenta(`👑 Master: Cheema`));
        console.log(chalk.green(`🌐 Web Server: Running on port ${process.env.PORT || 3000}`));
        
        // Send startup message
        setTimeout(async () => {
            try {
                const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
                await antiBan.humanDelay();
                await botInstance.sendMessage(ownerJid, { 
                    text: `🤖 *CHEEMY-BOT* is online!\n\n` +
                          `📊 *Stats:*\n` +
                          `• Uptime: Just started\n` +
                          `• Anti-Ban: Active ✅\n` +
                          `• 24/7 Keep-Alive: Active 🔄\n` +
                          `• Auto Auth Cleanup: 12h ⏰\n` +
                          `• Sudo Users: Enabled\n` +
                          `• Prefix: ${config.prefix}\n\n` +
                          `Type ${config.prefix}help to see commands.\n` +
                          `👑 Master: Cheema`
                });
            } catch (err) {}
        }, 5000);
        
    } catch (error) {
        console.error(chalk.red('Failed to start bot:'), error);
        process.exit(1);
    }
}

// Backup database
async function backupDatabase() {
    try {
        const date = new Date().toISOString().split('T')[0];
        const backupPath = `./backups/bot-${date}.db`;
        await fs.copy('./database/bot.db', backupPath);
        console.log(chalk.green(`💾 Database backed up to ${backupPath}`));
        
        const backups = await fs.readdir('./backups');
        if (backups.length > 7) {
            const sorted = backups.sort();
            await fs.remove(`./backups/${sorted[0]}`);
        }
    } catch (error) {
        console.error('Backup failed:', error);
    }
}

function getStats() {
    return stats.getStats();
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n👋 Shutting down...'));
    await cleanupTemp();
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    // Silently ignore most errors
    if (!error.message?.includes('decrypt') && !error.message?.includes('session')) {
        console.error(chalk.red('Unhandled rejection:'), error);
        stats.incrementErrors();
    }
});

startBot();

module.exports = { 
    botInstance: () => botInstance, 
    speedOptimize, 
    getStats,
    forceClearAuth
};