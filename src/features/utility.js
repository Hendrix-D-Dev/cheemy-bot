const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const config = require('../../config');

// Try to load qrcode, but don't fail if it's missing
let qrcode;
try {
    qrcode = require('qrcode');
} catch (error) {
    console.log('⚠️ QR code package not installed. QR commands will show instructions.');
}

async function generateQR(text) {
    if (!qrcode) {
        return { error: true, message: 'QR code generation is not available. Please install the qrcode package: npm install qrcode' };
    }
    
    try {
        const filePath = path.join(process.cwd(), 'temp', `qr-${Date.now()}.png`);
        await fs.ensureDir(path.dirname(filePath));
        
        await qrcode.toFile(filePath, text, {
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            width: 300
        });
        
        return { success: true, filePath };
    } catch (error) {
        console.error('QR generation error:', error);
        return { error: true, message: 'Failed to generate QR code.' };
    }
}

async function shortenUrl(url) {
    try {
        const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        return response.data;
    } catch {
        return url;
    }
}

async function getWeather(city) {
    try {
        // Using wttr.in (no API key required)
        const response = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=%t+%c+%w+%h&m`);
        return `🌤 *Weather in ${city}:*\n${response.data}`;
    } catch {
        return "❌ Couldn't fetch weather. Try: .weather London";
    }
}

async function translate(text, targetLang = 'en') {
    try {
        const response = await axios.get(`https://api.mymemory.translated.net/get`, {
            params: {
                q: text,
                langpair: `|${targetLang}`
            }
        });
        return response.data.responseData.translatedText;
    } catch {
        return text;
    }
}

async function getRandomFact() {
    try {
        const response = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random');
        return response.data.text;
    } catch {
        const facts = [
            "Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs still edible!",
            "A day on Venus is longer than a year on Venus.",
            "Octopuses have three hearts and blue blood.",
            "Bananas are berries, but strawberries aren't.",
            "The Eiffel Tower can be 15 cm taller during summer due to thermal expansion.",
            "A group of flamingos is called a 'flamboyance'.",
            "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
            "Cows have best friends and get stressed when separated."
        ];
        return facts[Math.floor(Math.random() * facts.length)];
    }
}

async function getNews(country = 'us') {
    try {
        const response = await axios.get(`https://newsapi.org/v2/top-headlines`, {
            params: {
                country: country,
                apiKey: 'your_news_api_key' // Users need to add their own key
            }
        });
        
        if (response.data.articles && response.data.articles.length > 0) {
            const article = response.data.articles[0];
            return `📰 *${article.title}*\n\n${article.description || ''}\n${article.url}`;
        }
        return "No news found.";
    } catch {
        return "❌ News API key required. Get one at newsapi.org or try later.";
    }
}

async function calculate(expression) {
    try {
        // Safe evaluation - only allow numbers and basic operators
        if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
            return "❌ Invalid characters in expression. Use only numbers and + - * / ( )";
        }
        
        // Use Function constructor as a safer alternative to eval
        const result = new Function('return ' + expression)();
        return `🧮 *Result:* ${result}`;
    } catch {
        return "❌ Invalid expression";
    }
}

async function generatePassword(length = 12) {
    // Limit length for security
    length = Math.min(Math.max(parseInt(length) || 12, 8), 32);
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure at least one of each type
    if (!/[A-Z]/.test(password)) password = 'A' + password.slice(1);
    if (!/[a-z]/.test(password)) password = 'a' + password.slice(1);
    if (!/[0-9]/.test(password)) password = '1' + password.slice(1);
    if (!/[!@#$%^&*]/.test(password)) password = '!' + password.slice(1);
    
    return `🔐 *Generated Password:*\n\`${password}\`\n_Length: ${length}_`;
}

async function getIPInfo(ip) {
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        if (response.data.status === 'success') {
            return `🌍 *IP Information*\n` +
                   `📍 Country: ${response.data.country}\n` +
                   `🏙 City: ${response.data.city}\n` +
                   `🏢 ISP: ${response.data.isp}\n` +
                   `🕒 Timezone: ${response.data.timezone}`;
        }
        return "❌ Couldn't fetch IP info";
    } catch {
        return "❌ Invalid IP or service unavailable";
    }
}

async function getTime(city) {
    try {
        const response = await axios.get(`http://worldtimeapi.org/api/timezone/${encodeURIComponent(city)}`);
        const datetime = new Date(response.data.datetime);
        return `🕐 *Time in ${city}:*\n${datetime.toLocaleString()}`;
    } catch {
        return "❌ Couldn't fetch time. Use format: .time Asia/Tokyo";
    }
}

module.exports = {
    generateQR,
    shortenUrl,
    getWeather,
    translate,
    getRandomFact,
    getNews,
    calculate,
    generatePassword,
    getIPInfo,
    getTime
};
