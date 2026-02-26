#!/usr/bin/env node

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// Format phone number function
function formatPhoneNumber(number) {
    if (!number) return '2349043650490';
    // Remove any non-numeric characters
    let cleaned = number.replace(/\D/g, '');
    // If it starts with 0, remove it and add 234
    if (cleaned.startsWith('0')) {
        cleaned = '234' + cleaned.substring(1);
    }
    // If it's 10 digits, add 234
    if (cleaned.length === 10) {
        cleaned = '234' + cleaned;
    }
    return cleaned;
}

const RAW_PHONE = process.env.BOT_NUMBER || '09043650490';
const PHONE_NUMBER = formatPhoneNumber(RAW_PHONE);
const AUTH_FOLDER = path.join(process.cwd(), 'auth_info');

console.log(chalk.cyan('\n🔐 ==========================================='));
console.log(chalk.cyan('🔐 AUTO PAIRING SYSTEM'));
console.log(chalk.cyan('==========================================='));
console.log(chalk.yellow(`📱 Raw number from env: ${RAW_PHONE}`));
console.log(chalk.green(`📱 Formatted number: ${PHONE_NUMBER}`));
console.log(chalk.cyan('===========================================\n'));

async function autoPair() {
    try {
        // Clear old auth
        if (await fs.pathExists(AUTH_FOLDER)) {
            await fs.remove(AUTH_FOLDER);
            console.log(chalk.yellow('🧹 Cleared old auth folder'));
        }
        await fs.ensureDir(AUTH_FOLDER);

        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

        // Create socket
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['CHEEMY-BOT', 'Chrome', '1.0.0']
        });

        let pairingAttempts = 0;
        const maxAttempts = 3;

        // Handle connection
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr) {
                console.log(chalk.green('\n📱 OPTION 1: SCAN QR CODE'));
                console.log(chalk.green('==========================================='));
                qrcode.generate(qr, { small: true });
                
                console.log(chalk.cyan('\n📱 OPTION 2: USE PHONE NUMBER'));
                console.log(chalk.cyan('==========================================='));
                
                // Try to generate pairing code
                while (pairingAttempts < maxAttempts) {
                    try {
                        pairingAttempts++;
                        console.log(chalk.yellow(`🔄 Generating pairing code (Attempt ${pairingAttempts}/${maxAttempts})...`));
                        
                        // Wait a moment for the socket to be ready
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Request pairing code
                        const code = await sock.requestPairingCode(PHONE_NUMBER);
                        const formattedCode = code.match(/.{1,4}/g).join('-');
                        
                        console.log(chalk.green('\n🔐 ==========================================='));
                        console.log(chalk.green('🔐 PAIRING CODE READY'));
                        console.log(chalk.green('==========================================='));
                        console.log(chalk.cyan(`📱 Phone: ${PHONE_NUMBER}`));
                        console.log(chalk.yellow(`🔑 Code: ${formattedCode}`));
                        console.log(chalk.green('===========================================\n'));
                        console.log(chalk.white('Open WhatsApp → Linked Devices → Link with phone number'));
                        console.log(chalk.white(`Enter code: ${formattedCode}\n`));
                        
                        // Write code to a file
                        await fs.writeFile('./pairing-code.txt', 
                            `Pairing Code for ${PHONE_NUMBER}: ${formattedCode}\nGenerated: ${new Date().toISOString()}`);
                        
                        // Success - break out of loop
                        break;
                        
                    } catch (pairError) {
                        console.log(chalk.red(`❌ Attempt ${pairingAttempts} failed: ${pairError.message}`));
                        if (pairingAttempts >= maxAttempts) {
                            console.log(chalk.yellow('\n⚠️ Could not auto-generate pairing code after multiple attempts.'));
                            console.log(chalk.yellow('Please use QR code or try these commands after connection:'));
                            console.log(chalk.cyan(`.pair ${PHONE_NUMBER}`));
                        }
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(chalk.yellow(`🔄 Connection closed (${statusCode})`));
                
                // Don't exit on close, let it retry
            }

            if (connection === 'open') {
                console.log(chalk.green('\n✅ Bot connected successfully!'));
                console.log(chalk.magenta(`📱 Bot Number: ${sock.user?.id?.split(':')[0] || 'Unknown'}`));
                
                // If we have a stored pairing code, show it again
                const storedCode = await fs.readFile('./pairing-code.txt', 'utf8').catch(() => null);
                if (storedCode) {
                    console.log(chalk.cyan('\n📱 Stored Pairing Code:'));
                    console.log(chalk.yellow(storedCode));
                }
                
                process.exit(0);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Timeout after 60 seconds
        setTimeout(() => {
            console.log(chalk.yellow('\n⏰ Connection timeout. Exiting...'));
            console.log(chalk.cyan('\n📱 You can still generate a pairing code with:'));
            console.log(chalk.white(`.pair ${PHONE_NUMBER}`));
            process.exit(1);
        }, 60000);

    } catch (error) {
        console.error(chalk.red('Auto-pair failed:'), error);
        process.exit(1);
    }
}

autoPair();