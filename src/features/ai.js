const config = require('../../config');
const ChatMemory = require('../utils/memory');
const { getDb } = require('../utils/database');

let MistralClient;
let mistralClient;

// Dynamic import for Mistral AI (to handle different versions)
if (config.ai.enabled && config.ai.apiKey) {
    try {
        // Try different import strategies for different package versions
        const mistralPackage = require('@mistralai/mistralai');
        
        // Check the package structure and initialize accordingly
        if (mistralPackage.MistralClient) {
            // Newer version structure
            MistralClient = mistralPackage.MistralClient;
            mistralClient = new MistralClient(config.ai.apiKey);
        } else if (typeof mistralPackage === 'function') {
            // Alternative structure
            mistralClient = new mistralPackage(config.ai.apiKey);
        } else if (mistralPackage.default) {
            // CommonJS with default export
            MistralClient = mistralPackage.default;
            mistralClient = new MistralClient(config.ai.apiKey);
        } else {
            console.log('⚠️ Mistral AI package structure not recognized, AI features may not work');
        }
        
        console.log('✅ Mistral AI client initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Mistral AI:', error.message);
    }
}

async function askMistral(chatId, userMessage, personality = null) {
    if (!mistralClient) {
        return "❌ AI is not configured. Please set MISTRAL_API_KEY in .env file and ensure @mistralai/mistralai is installed.";
    }

    try {
        // Get chat memory
        const memory = ChatMemory.getMemory(chatId);
        memory.addMessage('user', userMessage);

        // Build system prompt
        let systemPrompt = "You are a helpful WhatsApp assistant. Keep responses concise (max 2-3 sentences) and friendly. Use emojis occasionally.";
        
        if (personality) {
            systemPrompt += ` You have a ${personality} personality.`;
        }

        // Get recent context
        const context = memory.getContext();

        // Prepare messages for Mistral
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add context if available
        if (context) {
            messages.push({ role: 'user', content: `Previous conversation context: ${context}` });
        }
        
        messages.push({ role: 'user', content: userMessage });

        // Call Mistral API - try different method names based on package version
        let response;
        
        if (mistralClient.chat) {
            // Newer version
            response = await mistralClient.chat({
                model: config.ai.model || 'mistral-medium',
                messages: messages,
                temperature: config.ai.temperature || 0.7,
                maxTokens: config.ai.maxTokens || 500
            });
            
            const reply = response.choices[0].message.content;
            memory.addMessage('assistant', reply);
            return reply;
            
        } else if (mistralClient.createChatCompletion) {
            // Older version
            response = await mistralClient.createChatCompletion({
                model: config.ai.model || 'mistral-medium',
                messages: messages,
                temperature: config.ai.temperature || 0.7,
                max_tokens: config.ai.maxTokens || 500
            });
            
            const reply = response.choices[0].message.content;
            memory.addMessage('assistant', reply);
            return reply;
            
        } else {
            return "❌ Mistral AI client not properly configured. Please check the package version.";
        }

    } catch (error) {
        console.error('AI Error:', error);
        
        // Handle specific error types
        if (error.message?.includes('API key')) {
            return "❌ Invalid Mistral API key. Please check your .env file.";
        } else if (error.message?.includes('rate limit')) {
            return "⏳ AI is rate limited. Please try again in a moment.";
        } else {
            return "🤖 Sorry, I'm having trouble thinking right now. Please try again later.";
        }
    }
}

async function setPersonality(chatId, personality) {
    const memory = ChatMemory.getMemory(chatId);
    memory.setPersonality(personality);
    return `✅ AI personality set to: *${personality}*`;
}

async function clearMemory(chatId) {
    const memory = ChatMemory.getMemory(chatId);
    memory.clear();
    return "✅ Chat memory cleared.";
}

module.exports = { askMistral, setPersonality, clearMemory };
