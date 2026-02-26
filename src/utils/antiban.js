const config = require('../../config');
const { sleep } = require('./helpers');

class AntiBan {
    constructor() {
        this.messageCount = new Map();
        this.lastReset = Date.now();
        this.blockedTemp = new Map();
        this.messageInterval = 1000; // 1 second minimum between messages
        this.maxMessagesPerMinute = 30; // Max 30 messages per minute per chat
        this.maxGroupMessagesPerMinute = 20; // Max 20 messages per minute in groups
        this.globalMessageCount = 0;
        this.globalMaxPerMinute = 100; // Global limit to avoid spam detection
    }

    // Check if user is temporarily blocked
    isBlocked(jid) {
        if (this.blockedTemp.has(jid)) {
            const blockTime = this.blockedTemp.get(jid);
            if (Date.now() - blockTime < 60000) { // 1 minute block
                return true;
            } else {
                this.blockedTemp.delete(jid);
            }
        }
        return false;
    }

    // Check if we can send a message
    async canSendMessage(jid) {
        // Reset counters every minute
        if (Date.now() - this.lastReset > 60000) {
            this.messageCount.clear();
            this.globalMessageCount = 0;
            this.lastReset = Date.now();
        }

        // Check if user is blocked
        if (this.isBlocked(jid)) {
            return false;
        }

        // Get current count for this chat
        const count = this.messageCount.get(jid) || 0;
        const isGroup = jid.includes('@g.us');
        const maxLimit = isGroup ? this.maxGroupMessagesPerMinute : this.maxMessagesPerMinute;

        // Check limits
        if (count >= maxLimit) {
            this.blockedTemp.set(jid, Date.now());
            return false;
        }

        if (this.globalMessageCount >= this.globalMaxPerMinute) {
            return false;
        }

        return true;
    }

    // Increment message counter
    incrementCount(jid) {
        const count = this.messageCount.get(jid) || 0;
        this.messageCount.set(jid, count + 1);
        this.globalMessageCount++;
    }

    // Add random delay to simulate human typing
    async humanDelay() {
        const delay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms
        await sleep(delay);
    }

    // Add longer delay for media messages
    async mediaDelay() {
        const delay = Math.floor(Math.random() * 2000) + 1000; // 1000-3000ms
        await sleep(delay);
    }

    // Rotate user agent and browser fingerprint
    getRandomBrowser() {
        const browsers = [
            ['Chrome', '120.0.0.0'],
            ['Firefox', '115.0'],
            ['Edge', '118.0.0.0'],
            ['Safari', '17.0']
        ];
        const random = browsers[Math.floor(Math.random() * browsers.length)];
        return ['WhatsApp Bot', random[0], random[1]];
    }

    // Check if we're being rate limited
    checkRateLimit(error) {
        if (error?.message?.includes('rate') || error?.message?.includes('too fast')) {
            console.log('⚠️ Rate limit detected, slowing down...');
            return true;
        }
        return false;
    }
}

module.exports = new AntiBan();
