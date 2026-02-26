const config = require('../../config');
const { getJidNumber } = require('../utils/helpers');
const chalk = require('chalk');

let pairingHandler = null;
let generatedCode = null;

function setGeneratedCode(code) {
    generatedCode = code;
}

async function handlePairCommand(sock, sender, command, args, senderId) {
    const isOwner = config.ownerNumber.includes(getJidNumber(senderId));
    
    // Only owner can use pairing commands
    if (!isOwner) {
        await sock.sendMessage(sender, { 
            text: '👑 Only Master Cheema can use pairing commands.' 
        });
        return;
    }

    switch(command) {
        case 'pair':
        case 'paircode':
            const phoneNumber = args[0] || config.ownerNumber[0];
            
            await sock.sendMessage(sender, { text: '🔄 Generating pairing code...' });
            
            try {
                // Request pairing code from WhatsApp
                const code = await sock.requestPairingCode(phoneNumber);
                const formattedCode = code.match(/.{1,4}/g).join('-');
                
                // Store the generated code
                setGeneratedCode(formattedCode);
                
                const message = `✅ *Pairing Code Generated!*\n\n` +
                               `📱 *Phone:* ${phoneNumber}\n` +
                               `🔑 *Code:* \`${formattedCode}\`\n\n` +
                               `⏰ Code expires in 5 minutes\n\n` +
                               `Open WhatsApp → Linked Devices → Link with phone number`;
                
                await sock.sendMessage(sender, { text: message });
                
                // Also log to console
                console.log(chalk.green('\n🔐 ==========================================='));
                console.log(chalk.green('🔐 NEW PAIRING CODE GENERATED'));
                console.log(chalk.green('==========================================='));
                console.log(chalk.cyan(`📱 Phone: ${phoneNumber}`));
                console.log(chalk.yellow(`🔑 Code: ${formattedCode}`));
                console.log(chalk.green('===========================================\n'));
                
            } catch (error) {
                await sock.sendMessage(sender, { 
                    text: `❌ Failed to generate code: ${error.message}` 
                });
            }
            break;

        case 'pairstatus':
            if (generatedCode) {
                await sock.sendMessage(sender, { 
                    text: `🔐 *Current Pairing Code:* \`${generatedCode}\`\n\nUse it within 5 minutes.` 
                });
            } else {
                await sock.sendMessage(sender, { 
                    text: '❌ No active pairing code. Generate one with `.pair`' 
                });
            }
            break;

        case 'pairhelp':
            const helpText = `🔐 *Phone Number Pairing Help*\n\n` +
                `*Commands:*\n` +
                `└ .pair [number] - Generate pairing code\n` +
                `└ .pairstatus - Show current code\n\n` +
                `*How to use:*\n` +
                `1. Send \`.pair ${config.ownerNumber[0]}\`\n` +
                `2. Get 8-digit code\n` +
                `3. Open WhatsApp → Linked Devices → Link with phone number\n` +
                `4. Enter the code\n\n` +
                `*Note:* Code auto-generates on every deploy!`;
            
            await sock.sendMessage(sender, { text: helpText });
            break;

        default:
            await sock.sendMessage(sender, { 
                text: 'Unknown pairing command. Try `.pairhelp`' 
            });
    }
}

module.exports = { handlePairCommand, setGeneratedCode };