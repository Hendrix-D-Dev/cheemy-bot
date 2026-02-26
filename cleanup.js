const fs = require('fs-extra');
const path = require('path');

async function cleanup() {
    console.log('🧹 CHEEMY-BOT Cleanup Utility\n');
    
    const authFolder = path.join(process.cwd(), 'auth_info');
    const tempFolder = path.join(process.cwd(), 'temp');
    
    try {
        // Clear auth folder
        if (await fs.pathExists(authFolder)) {
            console.log('🗑️  Removing auth folder...');
            await fs.remove(authFolder);
            console.log('   ✅ Auth folder removed');
        } else {
            console.log('   ⏺️ No auth folder found');
        }
        
        // Clear temp folder
        if (await fs.pathExists(tempFolder)) {
            console.log('🗑️  Removing temp folder...');
            await fs.remove(tempFolder);
            console.log('   ✅ Temp folder removed');
        }
        
        // Recreate empty folders
        await fs.ensureDir(authFolder);
        await fs.ensureDir(tempFolder);
        
        console.log('\n✅ Cleanup complete!');
        console.log('📱 The bot will generate a new QR code on next start.\n');
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    }
}

cleanup();