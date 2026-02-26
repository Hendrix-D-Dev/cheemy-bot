const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

async function clearAuth() {
    console.log(chalk.cyan('🧹 CHEEMY-BOT Pre-Start Cleanup'));
    console.log(chalk.cyan('================================'));
    
    const foldersToClear = [
        'auth_info',
        'auth_info_creds', 
        'auth_info_default',
        'auth_test',
        'temp'
    ];
    
    let cleared = 0;
    
    for (const folder of foldersToClear) {
        const folderPath = path.join(process.cwd(), folder);
        
        try {
            if (await fs.pathExists(folderPath)) {
                console.log(chalk.yellow(`   Removing ${folder}...`));
                await fs.remove(folderPath);
                console.log(chalk.green(`   ✅ ${folder} cleared`));
                cleared++;
            } else {
                console.log(chalk.gray(`   ⏺️ ${folder} not found`));
            }
            
            // Recreate empty folder
            await fs.ensureDir(folderPath);
            
        } catch (error) {
            console.error(chalk.red(`   ❌ Error clearing ${folder}:`, error.message));
        }
    }
    
    console.log(chalk.cyan('================================'));
    
    if (cleared > 0) {
        console.log(chalk.green(`✅ Cleared ${cleared} auth folder(s). Ready for fresh QR code!`));
    } else {
        console.log(chalk.blue(`📱 No auth folders found - ready for new connection`));
    }
    
    console.log(chalk.cyan('================================\n'));
}

// Run the cleanup
clearAuth().catch(err => {
    console.error(chalk.red('Fatal error during cleanup:'), err);
    process.exit(1);
});
