const axios = require('axios');

// Store active games
const activeGames = new Map();

async function truthOrDare(type) {
    try {
        const response = await axios.get(`https://api.truthordarebot.xyz/v1/${type}`);
        return response.data.question;
    } catch {
        const questions = {
            truth: [
                "What's your biggest fear?",
                "Have you ever lied to your best friend?",
                "What's the most embarrassing thing you've done?"
            ],
            dare: [
                "Do 10 pushups right now",
                "Send a random emoji to your last chat",
                "Sing a song and send voice note"
            ]
        };
        const list = questions[type] || questions.truth;
        return list[Math.floor(Math.random() * list.length)];
    }
}

async function wouldYouRather() {
    const questions = [
        "Would you rather be able to fly or be invisible?",
        "Would you rather be rich but unhappy, or poor but happy?",
        "Would you rather have no internet for a month or no food for a week?",
        "Would you rather be able to speak all languages or play all instruments?",
        "Would you rather live in the ocean or on the moon?"
    ];
    return questions[Math.floor(Math.random() * questions.length)];
}

async function startHangman(chatId) {
    const words = ['javascript', 'python', 'whatsapp', 'bot', 'developer', 'computer'];
    const word = words[Math.floor(Math.random() * words.length)];
    
    activeGames.set(chatId, {
        type: 'hangman',
        word: word,
        guessed: [],
        attempts: 6
    });
    
    return `🎮 Hangman started!\nWord: ${'_ '.repeat(word.length)}\nAttempts: 6`;
}

async function guessNumber(chatId, guess) {
    let game = activeGames.get(chatId);
    
    if (!game || game.type !== 'guess') {
        const number = Math.floor(Math.random() * 100) + 1;
        activeGames.set(chatId, {
            type: 'guess',
            number: number,
            attempts: 0
        });
        game = activeGames.get(chatId);
    }
    
    game.attempts++;
    const num = parseInt(guess);
    
    if (num === game.number) {
        activeGames.delete(chatId);
        return `🎉 Correct! The number was ${game.number}. You took ${game.attempts} attempts.`;
    } else if (num < game.number) {
        return `⬆️ Higher! Attempts: ${game.attempts}`;
    } else {
        return `⬇️ Lower! Attempts: ${game.attempts}`;
    }
}

module.exports = {
    truthOrDare,
    wouldYouRather,
    startHangman,
    guessNumber
};
