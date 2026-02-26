const config = require('../../config');
const { getJidNumber } = require('../utils/helpers');
const PairingHandler = require('../features/pair');
const chalk = require('chalk');

let pairingHandler = null;

function initPairingHandler(sock) {
    if (!pairingHandler) {
        pairingHandler = new PairingHandler(sock);
    }
    return pairingHandler;
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

    const handler = initPairingHandler(sock);

    switch(command) {
        case 'pair':
        case 'paircode':
            if (!args[0]) {
                await sock.sendMessage(sender, { 
                    text: '❌ Please provide your phone number.\n\nExample: `.pair 2349043650490`\n\nInclude country code without +' 
                });
                return;
            }

            await sock.sendMessage(sender, { text: '🔄 Generating pairing code...' });
            const result = await handler.requestPairingCode(args[0]);
            
            if (result.success) {
                await sock.sendMessage(sender, { text: result.message });
                
                // Also log to console for visibility
                console.log(chalk.green('\n🔐 ==========================================='));
                console.log(chalk.green('🔐 PAIRING CODE GENERATED'));
                console.log(chalk.green('==========================================='));
                console.log(chalk.cyan(`📱 Phone: ${args[0]}`));
                console.log(chalk.yellow(`🔑 Code: ${result.code}`));
                console.log(chalk.green('===========================================\n'));
            } else {
                await sock.sendMessage(sender, { text: result.message });
            }
            break;

        case 'pairstatus':
            if (!args[0]) {
                await sock.sendMessage(sender, { 
                    text: '❌ Please provide your phone number.\n\nExample: `.pairstatus 2349043650490`' 
                });
                return;
            }

            const status = await handler.checkPairingStatus(args[0]);
            await sock.sendMessage(sender, { text: status.message });
            break;

        case 'cancelpair':
            if (!args[0]) {
                await sock.sendMessage(sender, { 
                    text: '❌ Please provide your phone number.\n\nExample: `.cancelpair 2349043650490`' 
                });
                return;
            }

            const cancelResult = handler.cancelPairing(args[0]);
            await sock.sendMessage(sender, { text: cancelResult.message });
            break;

        case 'pairhelp':
            const helpText = `🔐 *Phone Number Pairing Help*\n\n` +
                `*Commands:*\n` +
                `└ .pair [number] - Generate pairing code\n` +
                `└ .pairstatus [number] - Check pairing status\n` +
                `└ .cancelpair [number] - Cancel pending pairing\n\n` +
                `*How to use:*\n` +
                `1. Send \`.pair 2349043650490\` (your number with country code)\n` +
                `2. Get 8-digit code\n` +
                `3. Open WhatsApp → Linked Devices → Link with phone number\n` +
                `4. Enter the 8-digit code\n\n` +
                `*Note:* Code expires in 5 minutes`;
            
            await sock.sendMessage(sender, { text: helpText });
            break;

        default:
            await sock.sendMessage(sender, { 
                text: 'Unknown pairing command. Try `.pairhelp`' 
            });
    }
}

module.exports = { handlePairCommand, initPairingHandler };
