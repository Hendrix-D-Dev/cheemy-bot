const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🧹 CHEEMY-BOT Cleanup Utility\n');
console.log('This will remove all authentication data and force a fresh start.\n');

rl.question('Have you removed all linked devices from WhatsApp? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
        console.log('\n🗑️  Removing auth folders...');
        
        const folders = ['auth_info', 'auth_info_creds', 'auth_info_default'];
        for (const folder of folders) {
            const folderPath = path.join(process.cwd(), folder);
            if (await fs.pathExists(folderPath)) {
                await fs.remove(folderPath);
                console.log(`   ✅ Removed ${folder}`);
            }
        }
        
        console.log('\n✅ Cleanup complete!');
        console.log('📱 Now run "npm start" to scan the QR code again.');
    } else {
        console.log('\n⚠️  Please remove all linked devices from WhatsApp first:');
        console.log('   1. Open WhatsApp on your phone');
        console.log('   2. Go to Settings > Linked Devices');
        console.log('   3. Remove ALL devices');
        console.log('   4. Run this script again');
    }
    
    rl.close();
});
