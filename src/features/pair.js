const { Buffer } = require('buffer');
const config = require('../../config');

class PairingHandler {
    constructor(sock) {
        this.sock = sock;
        this.pendingPairs = new Map();
    }

    // Generate pairing code for phone number
    async requestPairingCode(phoneNumber) {
        try {
            // Clean phone number (remove + and spaces)
            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            
            if (cleanNumber.length < 10 || cleanNumber.length > 15) {
                return {
                    success: false,
                    message: '❌ Invalid phone number. Please provide a valid number with country code.'
                };
            }

            console.log(`📱 Requesting pairing code for: ${cleanNumber}`);
            
            // Request pairing code from WhatsApp
            const code = await this.sock.requestPairingCode(cleanNumber);
            
            // Format code nicely (XXXX-XXXX)
            const formattedCode = code.match(/.{1,4}/g).join('-');
            
            // Store in pending pairs (expires in 5 minutes)
            this.pendingPairs.set(cleanNumber, {
                code,
                timestamp: Date.now(),
                attempts: 0
            });

            // Auto-clean after 5 minutes
            setTimeout(() => {
                this.pendingPairs.delete(cleanNumber);
            }, 300000);

            return {
                success: true,
                code: formattedCode,
                rawCode: code,
                message: `✅ Pairing code generated!\n\n📱 *Phone:* ${cleanNumber}\n🔑 *Code:* \`${formattedCode}\`\n\n⏰ Code expires in 5 minutes\n\nOpen WhatsApp → Linked Devices → Link with phone number`
            };
        } catch (error) {
            console.error('Pairing error:', error);
            return {
                success: false,
                message: `❌ Failed to generate code: ${error.message}`
            };
        }
    }

    // Verify pairing status
    async checkPairingStatus(phoneNumber) {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        const pending = this.pendingPairs.get(cleanNumber);
        
        if (!pending) {
            return {
                paired: false,
                message: 'No pending pairing request found. Generate a new code first.'
            };
        }

        // Check if expired
        if (Date.now() - pending.timestamp > 300000) {
            this.pendingPairs.delete(cleanNumber);
            return {
                paired: false,
                message: '❌ Pairing code expired. Generate a new one.'
            };
        }

        // Check if already paired (this would be detected by connection event)
        if (this.sock.user) {
            return {
                paired: true,
                message: '✅ Bot is already paired and connected!'
            };
        }

        return {
            paired: false,
            message: '⏳ Waiting for pairing... Enter the code in WhatsApp.'
        };
    }

    // Cancel pending pairing
    cancelPairing(phoneNumber) {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (this.pendingPairs.delete(cleanNumber)) {
            return {
                success: true,
                message: '✅ Pairing request cancelled.'
            };
        }
        return {
            success: false,
            message: '❌ No pending pairing request found.'
        };
    }
}

module.exports = PairingHandler;
