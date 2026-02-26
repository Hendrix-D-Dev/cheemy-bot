require('dotenv').config();

module.exports = {
    // Bot Settings
    botNumber: process.env.BOT_NUMBER,
    botName: 'CHEEMY-BOT', // Changed to CHEEMY-BOT
    prefix: process.env.PREFIX || '.',
    
    // Owner/Admin Settings
    ownerNumber: process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',') : ['09043650490'],
    
    // AI Settings
    ai: {
        apiKey: process.env.MISTRAL_API_KEY,
        temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
        maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 500,
        model: process.env.AI_MODEL || 'mistral-medium',
        enabled: process.env.ENABLE_AI === 'true'
    },
    
    // Memory Settings
    memory: {
        duration: parseInt(process.env.MEMORY_DURATION) || 30, // minutes
        maxSize: parseInt(process.env.MAX_MEMORY_SIZE) || 100
    },
    
    // Feature Toggles
    features: {
        downloads: process.env.ENABLE_DOWNLOADS === 'true',
        games: process.env.ENABLE_GAMES === 'true',
        stickers: process.env.ENABLE_STICKERS === 'true',
        admin: process.env.ENABLE_ADMIN_COMMANDS === 'true'
    },
    
    // Database
    database: {
        type: process.env.DATABASE_TYPE || 'sqlite',
        mongodbUri: process.env.MONGODB_URI
    },
    
    // Media Settings
    media: {
        maxSize: parseInt(process.env.MAX_FILE_SIZE) || 100, // MB
        cleanup: process.env.TEMP_FILE_CLEANUP === 'true',
        saveMedia: process.env.SAVE_MEDIA === 'true',
        savePath: './media/'
    },
    
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};
