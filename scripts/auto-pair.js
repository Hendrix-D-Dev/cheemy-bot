#!/usr/bin/env node

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
require('dotenv').config();

const PHONE_NUMBER = process.env.BOT_NUMBER || '2349043650490';
const AUTH_FOLDER = path.join(process.cwd(), 'auth_info');

async function autoPair() {
    console.log(chalk.cyan('\n🔐 ==========================================='));
    console.log(chalk.cyan('🔐 AUTO PAIRING SYSTEM'));
    console.log(chalk.cyan('===========================================\n'));

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
            printQRInTerminal: true,
            browser: ['CHEEMY-BOT', 'Chrome', '1.0.0']
        });

        // Handle connection
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;
            
            if (qr) {
                console.log(chalk.green('\n📱 OPTION 1: SCAN QR CODE'));
                console.log(chalk.green('==========================================='));
                
                // Generate QR in terminal
                const qrcode = require('qrcode-terminal');
                qrcode.generate(qr, { small: true });
                
                console.log(chalk.cyan('\n📱 OPTION 2: USE PHONE NUMBER'));
                console.log(chalk.cyan('==========================================='));
                
                // Try to generate pairing code
                try {
                    console.log(chalk.yellow('🔄 Generating pairing code...'));
                    
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
                    
                    // Write code to a file for reference
                    await fs.writeFile('./pairing-code.txt', 
                        `Pairing Code for ${PHONE_NUMBER}: ${formattedCode}\nGenerated: ${new Date().toISOString()}`);
                    
                } catch (pairError) {
                    console.log(chalk.yellow('\n⚠️ Could not auto-generate pairing code.'));
                    console.log(chalk.yellow('Please use QR code or wait for bot to connect.'));
                    console.log(chalk.yellow(`Error: ${pairError.message}`));
                }
            }

            if (connection === 'open') {
                console.log(chalk.green('\n✅ Bot connected successfully!'));
                console.log(chalk.magenta(`📱 Bot Number: ${sock.user?.id?.split(':')[0]}`));
                process.exit(0);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Timeout after 30 seconds
        setTimeout(() => {
            console.log(chalk.yellow('\n⏰ Connection timeout. Exiting...'));
            process.exit(1);
        }, 30000);

    } catch (error) {
        console.error(chalk.red('Auto-pair failed:'), error);
        process.exit(1);
    }
}

autoPair();