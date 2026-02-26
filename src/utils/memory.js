
const NodeCache = require('node-cache');
const config = require('../../config');

// Create memory cache with TTL
const memoryCache = new NodeCache({ 
    stdTTL: config.memory.duration * 60, // Convert to seconds
    checkperiod: 120 
});

class ChatMemory {
    constructor(chatId) {
        this.chatId = chatId;
        this.load();
    }

    load() {
        this.memory = memoryCache.get(this.chatId) || {
            messages: [],
            context: '',
            personality: null,
            lastAccess: Date.now()
        };
    }

    save() {
        this.memory.lastAccess = Date.now();
        memoryCache.set(this.chatId, this.memory);
    }

    addMessage(role, content) {
        this.memory.messages.push({
            role,
            content,
            timestamp: Date.now()
        });

        // Limit memory size
        if (this.memory.messages.length > config.memory.maxSize) {
            this.memory.messages = this.memory.messages.slice(-config.memory.maxSize);
        }

        this.save();
    }

    getContext() {
        return this.memory.messages.map(m => `${m.role}: ${m.content}`).join('\n');
    }

    setPersonality(personality) {
        this.memory.personality = personality;
        this.save();
    }

    clear() {
        memoryCache.del(this.chatId);
    }

    static getMemory(chatId) {
        return new ChatMemory(chatId);
    }

    static clearAll() {
        memoryCache.flushAll();
    }
}

module.exports = ChatMemory;
