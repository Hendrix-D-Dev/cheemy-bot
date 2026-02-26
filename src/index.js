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

// Auth cleanup function - checks if auth is stale and clears it
async function checkAndCleanAuth() {
    const authFolder = path.join(process.cwd(), 'auth_info');
    
    try {
        // Check if FORCE_NEW_AUTH environment variable is set
        if (process.env.FORCE_NEW_AUTH === 'true') {
            console.log(chalk.yellow('⚠️ FORCE_NEW_AUTH is enabled - clearing auth folder...'));
            await fs.remove(authFolder);
            await fs.ensureDir(authFolder);
            console.log(chalk.green('✅ Auth folder cleared for new QR code!'));
            
            // Remove the env var so it doesn't keep clearing
            process.env.FORCE_NEW_AUTH = 'false';
            return true;
        }
        
        // Check if auth folder exists
        if (await fs.pathExists(authFolder)) {
            const files = await fs.readdir(authFolder);
            
            if (files.length === 0) {
                console.log(chalk.blue('📱 Auth folder is empty - ready for new QR code'));
                return false;
            }
            
            // Get the most recent file modification time
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
            
            console.log(chalk.blue(`📱 Auth last used: ${hoursSinceLastUse.toFixed(1)} hours ago`));
            
            // If inactive for more than 12 hours, clear auth
            if (hoursSinceLastUse > 12) {
                console.log(chalk.yellow(`🧹 Auth inactive for ${hoursSinceLastUse.toFixed(1)} hours, clearing...`));
                await fs.remove(authFolder);
                await fs.ensureDir(authFolder);
                console.log(chalk.green('✅ Auth folder cleared. New QR code will be generated.'));
                return true;
            }
        } else {
            console.log(chalk.blue('📱 No auth folder found - creating new one'));
            await fs.ensureDir(authFolder);
        }
    } catch (error) {
        console.error('Error checking auth:', error);
    }
    return false;
}

// Force clear auth function (can be called from commands)
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

// Self-ping function to keep bot alive
function startSelfPing() {
    console.log(chalk.cyan('🔄 Starting self-ping system to keep bot alive...'));
    
    // Ping every 3 minutes (180000 ms)
    setInterval(async () => {
        try {
            // Ping Google to keep network connection alive
            https.get('https://www.google.com', (res) => {
                // Just keep connection alive
            }).on('error', () => {});
            
            // Ping our own health endpoint if running on server
            if (process.env.RAILWAY_STATIC_URL) {
                https.get(`https://${process.env.RAILWAY_STATIC_URL}/ping`, () => {})
                    .on('error', () => {});
            }
            
            // Send presence update to keep WhatsApp connection alive
            if (botInstance && config.ownerNumber[0]) {
                const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
                await botInstance.sendPresenceUpdate('available', ownerJid);
            }
            
            console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] 💓 Self-ping sent`));
        } catch (err) {
            // Silently fail - this is just a keep-alive
        }
    }, 180000); // 3 minutes
}

// Speed optimization function
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
        // Check and clean auth if needed
        await checkAndCleanAuth();
        
        // Initialize database
        await initializeDatabase();
        
        // Initialize sudo table
        await initSudoTable();
        
        // Create required directories
        await fs.ensureDir('./temp');
        await fs.ensureDir('./media');
        await fs.ensureDir('./media/viewonce');
        await fs.ensureDir('./logs');
        await fs.ensureDir('./backups');
        
        // Clean old temp files
        await cleanupTemp();
        
        // Connect to WhatsApp
        botInstance = await connectToWhatsApp();
        
        if (!botInstance) {
            console.error(chalk.red('Failed to create bot instance'));
            return;
        }
        
        // Start the web server for uptime monitoring
        startServer();
        
        // Start self-ping system
        startSelfPing();
        
        // Set up message handler
        botInstance.ev.on('message.new', async (msg) => {
            stats.incrementTotal();
            await handleMessage(botInstance, msg);
        });
        
        // Schedule cleanup tasks
        cron.schedule('*/30 * * * *', async () => {
            await cleanupTemp();
            console.log(chalk.blue('🧹 Cleaned up temporary files'));
        });
        
        // Backup database daily
        cron.schedule('0 0 * * *', async () => {
            await backupDatabase();
        });
        
        // Reset message stats hourly
        cron.schedule('0 * * * *', () => {
            stats.resetHourlyStats();
        });
        
        // Check auth every 6 hours
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
        
        // Send startup message to owner
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
            } catch (err) {
                // Ignore errors
            }
        }, 5000);
        
    } catch (error) {
        console.error(chalk.red('Failed to start bot:'), error);
        process.exit(1);
    }
}

// Backup database function
async function backupDatabase() {
    try {
        const date = new Date().toISOString().split('T')[0];
        const backupPath = `./backups/bot-${date}.db`;
        await fs.copy('./database/bot.db', backupPath);
        console.log(chalk.green(`💾 Database backed up to ${backupPath}`));
        
        // Keep only last 7 backups
        const backups = await fs.readdir('./backups');
        if (backups.length > 7) {
            const sorted = backups.sort();
            await fs.remove(`./backups/${sorted[0]}`);
        }
    } catch (error) {
        console.error('Backup failed:', error);
    }
}

// Get bot stats
function getStats() {
    return stats.getStats();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n👋 Shutting down...'));
    await cleanupTemp();
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error(chalk.red('Unhandled rejection:'), error);
    stats.incrementErrors();
});

startBot();

// Export for commands
module.exports = { 
    botInstance: () => botInstance, 
    speedOptimize, 
    getStats,
    forceClearAuth
};