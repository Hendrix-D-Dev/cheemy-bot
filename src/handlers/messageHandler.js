const config = require('../../config');
const { askMistral, setPersonality, clearMemory } = require('../features/ai');
const { kickUser, promoteUser, demoteUser, muteGroup, unmuteGroup, tagAll, setWelcome, setAntiLink } = require('../features/admin');
const { truthOrDare, wouldYouRather, startHangman, guessNumber } = require('../features/games');
const { downloadYouTube, downloadInstagram, downloadTikTok } = require('../features/downloader');
const { imageToSticker, videoToSticker, textToSticker } = require('../features/stickers');
const { generateQR, shortenUrl, getWeather, translate, getRandomFact, calculate, generatePassword, getIPInfo, getTime } = require('../features/utility');
const { handleViewOnce, downloadMedia } = require('./mediaHandler');
const { isSudo, addSudo, removeSudo, getSudoList } = require('../features/sudo');
const { getDb } = require('../utils/database');
const ChatMemory = require('../utils/memory');
const antiBan = require('../utils/antiban');
const fs = require('fs-extra');
const { extractUrlFromText, isGroup, getJidNumber } = require('../utils/helpers');
const { speedOptimize, getStats } = require('../index');
const stats = require('../utils/stats');

const prefix = config.prefix;

// Anti-link cache
const linkWarnings = new Map();

// Command cooldowns
const cooldowns = new Map();

// User warning system
const userWarnings = new Map();

// Master's name
const MASTER_NAME = 'Cheema';

// Permission checker function
async function checkPermission(sock, sender, senderId, command, isSudoUser) {
    // Owner always has full permission
    if (config.ownerNumber.includes(getJidNumber(senderId))) {
        return true;
    }
    
    // List of commands that are completely restricted (only owner)
    const ownerOnlyCommands = ['setsudo', 'delsudo', 'speed', 'reboot', 'personality', 'clearmemory'];
    
    // List of commands that sudo users can access
    const sudoCommands = ['kick', 'promote', 'demote', 'mute', 'unmute', 'tagall', 'antilink', 'welcome', 'sudolist'];
    
    // List of public commands (everyone can use)
    const publicCommands = ['ai', 'ask', 'sticker', 's', 'stickertext', 'st', 'truth', 'dare', 'wyr', 'guess', 
                           'qr', 'shorten', 'weather', 'translate', 'fact', 'calc', 'password', 'ip', 'time',
                           'ping', 'help', 'menu', 'commands', 'ytaudio', 'yt', 'ytvideo'];
    
    // Check if it's a public command
    if (publicCommands.includes(command)) {
        return true;
    }
    
    // Check if it's a sudo command and user is sudo
    if (sudoCommands.includes(command) && isSudoUser) {
        return true;
    }
    
    // Check if it's an owner-only command
    if (ownerOnlyCommands.includes(command)) {
        await sock.sendMessage(sender, { 
            text: `👑 *I only answer to Master ${MASTER_NAME}* for this command.` 
        });
        return false;
    }
    
    // For any other command, block with master message
    await sock.sendMessage(sender, { 
        text: `👑 *I only answer to Master ${MASTER_NAME}*` 
    });
    return false;
}

async function handleMessage(sock, message) {
    try {
        const msg = message.message;
        const sender = message.key.remoteJid;
        const fromMe = message.key.fromMe;
        const senderId = message.key.participant || message.key.remoteJid;
        const messageType = Object.keys(msg)[0];
        const messageText = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
        
        // Anti-ban: Add human-like delay
        await antiBan.humanDelay();
        
        // Check if we can send messages (anti-spam)
        if (!await antiBan.canSendMessage(sender)) {
            return; // Silently ignore to avoid detection
        }
        
        // Handle view once media
        await handleViewOnce(sock, message, `${config.ownerNumber[0]}@s.whatsapp.net`);
        
        // Ignore messages from self
        if (fromMe) return;
        
        // Anti-link feature for groups
        if (isGroup(sender)) {
            const db = getDb();
            const groupSettings = await db.get('SELECT anti_link FROM group_settings WHERE group_jid = ?', [sender]);
            
            if (groupSettings?.anti_link && !await isSudo(senderId) && !config.ownerNumber.includes(getJidNumber(senderId))) {
                const urls = extractUrlFromText(messageText);
                if (urls && urls.length > 0) {
                    // Check if it's a WhatsApp group link (allow these)
                    const isWhatsAppLink = urls.some(url => url.includes('chat.whatsapp.com'));
                    
                    if (!isWhatsAppLink) {
                        const warnings = linkWarnings.get(senderId) || 0;
                        if (warnings >= 2) {
                            await sock.groupParticipantsUpdate(sender, [senderId], 'remove');
                            await sock.sendMessage(sender, { 
                                text: `🚫 @${getJidNumber(senderId)} was removed for sending links.`,
                                mentions: [senderId]
                            });
                            linkWarnings.delete(senderId);
                        } else {
                            linkWarnings.set(senderId, warnings + 1);
                            await sock.sendMessage(sender, { 
                                text: `⚠️ @${getJidNumber(senderId)} No links allowed! Warning ${warnings + 1}/3`,
                                mentions: [senderId]
                            });
                            
                            // Delete the message
                            await sock.sendMessage(sender, { 
                                delete: message.key 
                            });
                        }
                        antiBan.incrementCount(sender);
                        return;
                    }
                }
            }
        }
        
        // DEBUG: Log every message received
        console.log(`\n🔍 DEBUG - Raw message received:`);
        console.log(`   Sender: ${senderId}`);
        console.log(`   Sender number: ${getJidNumber(senderId)}`);
        console.log(`   Message text: "${messageText}"`);
        console.log(`   Message type: ${messageType}`);
        
        // Check if it's a command
        if (!messageText.startsWith(prefix)) {
            console.log(`❌ Not a command: "${messageText}" doesn't start with "${prefix}"`);
            return;
        }
        
        console.log(`✅ Command detected: "${messageText}"`);
        
        // Parse command
        const args = messageText.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        console.log(`📨 Command: ${command} from ${senderId}`);
        
        // DEBUG: Check owner status
        const senderNumber = getJidNumber(senderId);
        console.log(`🔍 DEBUG - Sender number: ${senderNumber}`);
        console.log(`🔍 DEBUG - Owner numbers: ${config.ownerNumber.join(', ')}`);
        console.log(`🔍 DEBUG - Is owner? ${config.ownerNumber.includes(senderNumber)}`);
        
        // Check if user is sudo
        const isSudoUser = await isSudo(senderId) || config.ownerNumber.includes(senderNumber);
        console.log(`🔍 DEBUG - Is sudo user? ${isSudoUser}`);
        
        // Check permission before executing any command
        const hasPermission = await checkPermission(sock, sender, senderId, command, isSudoUser);
        console.log(`🔍 DEBUG - Has permission? ${hasPermission}`);
        
        if (!hasPermission) {
            console.log(`❌ Command blocked: No permission for ${command}`);
            antiBan.incrementCount(sender);
            stats.incrementCommands();
            return;
        }
        
        // Check cooldown for non-sudo users (only for public commands)
        if (!isSudoUser && !config.ownerNumber.includes(senderNumber)) {
            const lastCmd = cooldowns.get(senderId) || 0;
            if (Date.now() - lastCmd < 2000) { // 2 second cooldown
                console.log(`⏱️ Cooldown active for ${senderId}`);
                return;
            }
            cooldowns.set(senderId, Date.now());
        }
        
        console.log(`✅ Executing command: ${command}`);
        
        // Execute commands
        switch(command) {
            // AI Commands
            case 'ai':
            case 'ask':
                if (!config.ai.enabled) {
                    await sock.sendMessage(sender, { text: '❌ AI features are disabled.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const question = args.join(' ');
                if (!question) {
                    await sock.sendMessage(sender, { text: '❌ Please ask a question.\nExample: .ai What is the weather today?' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                await sock.sendMessage(sender, { text: '🤔 Thinking...' });
                antiBan.incrementCount(sender);
                const answer = await askMistral(sender, question);
                await antiBan.mediaDelay();
                await sock.sendMessage(sender, { text: answer });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'personality':
                if (!config.ai.enabled) {
                    await sock.sendMessage(sender, { text: '❌ AI features are disabled.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const personality = args.join(' ');
                if (!personality) {
                    await sock.sendMessage(sender, { text: '❌ Please specify a personality.\nExample: .personality friendly and humorous' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const result = await setPersonality(sender, personality);
                await sock.sendMessage(sender, { text: result });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'clearmemory':
                if (!config.ai.enabled) {
                    await sock.sendMessage(sender, { text: '❌ AI features are disabled.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const clearResult = await clearMemory(sender);
                await sock.sendMessage(sender, { text: clearResult });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            // Sticker Commands
            case 'sticker':
            case 's':
                if (messageType === 'imageMessage' || msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                    await sock.sendMessage(sender, { text: '🔄 Creating sticker...' });
                    antiBan.incrementCount(sender);
                    
                    let imageBuffer;
                    if (messageType === 'imageMessage') {
                        imageBuffer = await downloadMedia(sock, msg.imageMessage);
                    } else {
                        const quoted = msg.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
                        imageBuffer = await downloadMedia(sock, quoted);
                    }
                    
                    if (imageBuffer) {
                        const sticker = await imageToSticker(imageBuffer);
                        await antiBan.mediaDelay();
                        await sock.sendMessage(sender, { sticker: sticker });
                        antiBan.incrementCount(sender);
                    } else {
                        await sock.sendMessage(sender, { text: '❌ Failed to download image.' });
                        antiBan.incrementCount(sender);
                    }
                } else {
                    await sock.sendMessage(sender, { text: '❌ Reply to an image with .sticker' });
                    antiBan.incrementCount(sender);
                }
                stats.incrementCommands();
                break;
                
            case 'stickertext':
            case 'st':
                const text = args.join(' ');
                if (!text) {
                    await sock.sendMessage(sender, { text: '❌ Please provide text.\nExample: .stickertext Hello World' });
                    stats.incrementCommands();
                    return;
                }
                await sock.sendMessage(sender, { text: '🔄 Creating text sticker...' });
                const stickerBuffer = await textToSticker(text);
                await sock.sendMessage(sender, { sticker: stickerBuffer });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            // Downloader Commands
            case 'yt':
            case 'ytaudio':
                const ytQuery = args.join(' ');
                if (!ytQuery) {
                    await sock.sendMessage(sender, { text: '❌ Please provide a YouTube URL or search term.' });
                    stats.incrementCommands();
                    return;
                }
                await sock.sendMessage(sender, { text: '⬇️ Downloading audio...' });
                const audio = await downloadYouTube(ytQuery, 'audio');
                if (audio && audio.filePath) {
                    await sock.sendMessage(sender, { 
                        audio: { url: audio.filePath },
                        mimetype: 'audio/mp4',
                        fileName: `${audio.title}.mp3`
                    });
                    await fs.remove(audio.filePath);
                } else {
                    await sock.sendMessage(sender, { text: '❌ Download failed.' });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'ytvideo':
                const ytVideoQuery = args.join(' ');
                if (!ytVideoQuery) {
                    await sock.sendMessage(sender, { text: '❌ Please provide a YouTube URL or search term.' });
                    stats.incrementCommands();
                    return;
                }
                await sock.sendMessage(sender, { text: '⬇️ Downloading video...' });
                const video = await downloadYouTube(ytVideoQuery, 'video');
                if (video && video.filePath) {
                    await sock.sendMessage(sender, { 
                        video: { url: video.filePath },
                        caption: video.title.substring(0, 100)
                    });
                    await fs.remove(video.filePath);
                } else {
                    await sock.sendMessage(sender, { text: '❌ Download failed.' });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            // Game Commands
            case 'truth':
                const truth = await truthOrDare('truth');
                await sock.sendMessage(sender, { text: `🤔 *Truth:*\n${truth}` });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'dare':
                const dare = await truthOrDare('dare');
                await sock.sendMessage(sender, { text: `😈 *Dare:*\n${dare}` });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'wyr':
                const wyr = await wouldYouRather();
                await sock.sendMessage(sender, { text: `🤷 *Would You Rather:*\n${wyr}` });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'guess':
                const guess = args[0];
                if (!guess) {
                    await sock.sendMessage(sender, { text: '🎮 *Guess the Number Game*\nGuess a number between 1-100\nExample: .guess 50' });
                    stats.incrementCommands();
                    return;
                }
                const guessResult = await guessNumber(sender, guess);
                await sock.sendMessage(sender, { text: guessResult });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            // Utility Commands
            case 'qr':
                const qrText = args.join(' ');
                if (!qrText) {
                    await sock.sendMessage(sender, { text: '❌ Please provide text for QR code.\nExample: .qr https://example.com' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                await sock.sendMessage(sender, { text: '🔄 Generating QR code...' });
                const qrResult = await generateQR(qrText);
                
                if (qrResult.error) {
                    await sock.sendMessage(sender, { text: qrResult.message });
                } else {
                    await sock.sendMessage(sender, { 
                        image: { url: qrResult.filePath },
                        caption: '✅ QR Code generated successfully!'
                    });
                    await fs.remove(qrResult.filePath);
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'shorten':
                const url = args[0];
                if (!url) {
                    await sock.sendMessage(sender, { text: '❌ Please provide a URL to shorten.\nExample: .shorten https://example.com' });
                    stats.incrementCommands();
                    return;
                }
                const shortUrl = await shortenUrl(url);
                await sock.sendMessage(sender, { text: `🔗 *Shortened URL:*\n${shortUrl}` });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'weather':
                const city = args.join(' ');
                if (!city) {
                    await sock.sendMessage(sender, { text: '❌ Please provide a city name.\nExample: .weather London' });
                    stats.incrementCommands();
                    return;
                }
                const weather = await getWeather(city);
                await sock.sendMessage(sender, { text: weather });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'translate':
                const lang = args[0];
                const translateText = args.slice(1).join(' ');
                if (!lang || !translateText) {
                    await sock.sendMessage(sender, { text: '❌ Usage: .translate [lang] [text]\nExample: .translate es Hello' });
                    stats.incrementCommands();
                    return;
                }
                const translated = await translate(translateText, lang);
                await sock.sendMessage(sender, { text: `🌐 *Translated to ${lang}:*\n${translated}` });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'fact':
                const fact = await getRandomFact();
                await sock.sendMessage(sender, { text: `💡 *Random Fact:*\n${fact}` });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'calc':
                const expression = args.join(' ');
                if (!expression) {
                    await sock.sendMessage(sender, { text: '❌ Please provide an expression.\nExample: .calc 2+2*3' });
                    stats.incrementCommands();
                    return;
                }
                const calcResult = await calculate(expression);
                await sock.sendMessage(sender, { text: calcResult });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'password':
                const length = parseInt(args[0]) || 12;
                const password = await generatePassword(length);
                await sock.sendMessage(sender, { text: password });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'ip':
                const ip = args[0];
                if (!ip) {
                    await sock.sendMessage(sender, { text: '❌ Please provide an IP address.\nExample: .ip 8.8.8.8' });
                    stats.incrementCommands();
                    return;
                }
                const ipInfo = await getIPInfo(ip);
                await sock.sendMessage(sender, { text: ipInfo });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'time':
                const timezone = args.join(' ') || 'UTC';
                const time = await getTime(timezone);
                await sock.sendMessage(sender, { text: time });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            // SUDO Commands (Only for owners)
            case 'setsudo':
                if (message.message.extendedTextMessage?.contextInfo?.participant) {
                    const userJid = message.message.extendedTextMessage.contextInfo.participant;
                    const days = args[0] ? parseInt(args[0]) : null;
                    
                    // Get user's name
                    let userName = 'Unknown';
                    if (isGroup(sender)) {
                        const groupMetadata = await sock.groupMetadata(sender);
                        const participant = groupMetadata.participants.find(p => p.id === userJid);
                        userName = participant?.notify || participant?.id.split('@')[0] || 'Unknown';
                    }
                    
                    await addSudo(userJid, userName, senderId, days);
                    await sock.sendMessage(sender, { 
                        text: `✅ @${getJidNumber(userJid)} is now a sudo user${days ? ` for ${days} days` : ''}.`,
                        mentions: [userJid]
                    });
                } else {
                    await sock.sendMessage(sender, { text: '❌ Reply to a user\'s message to make them sudo.' });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'delsudo':
                if (message.message.extendedTextMessage?.contextInfo?.participant) {
                    const userJid = message.message.extendedTextMessage.contextInfo.participant;
                    await removeSudo(userJid);
                    await sock.sendMessage(sender, { 
                        text: `✅ @${getJidNumber(userJid)} removed from sudo users.`,
                        mentions: [userJid]
                    });
                } else {
                    await sock.sendMessage(sender, { text: '❌ Reply to a user\'s message to remove sudo.' });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'sudolist':
                const sudoList = await getSudoList();
                let listText = `👑 *Sudo Users List - Master ${MASTER_NAME}*\n\n`;
                
                sudoList.forEach((user, index) => {
                    const isOwner = user.is_owner ? '👑 ' : '';
                    const expiry = user.expiry_date ? `\n   ⏰ Expires: ${new Date(user.expiry_date).toLocaleDateString()}` : '';
                    listText += `${index + 1}. ${isOwner}${user.name || user.number}\n` +
                               `   📱 ${user.number}\n` +
                               `   📅 Added: ${new Date(user.added_at).toLocaleDateString()}${expiry}\n\n`;
                });
                
                await sock.sendMessage(sender, { text: listText });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            // Admin Commands (Group Only) - For Sudo Users
            case 'kick':
                if (!sender.includes('@g.us')) {
                    await sock.sendMessage(sender, { text: '❌ This command only works in groups.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                if (message.message.extendedTextMessage?.contextInfo?.participant) {
                    const userToKick = message.message.extendedTextMessage.contextInfo.participant;
                    const kickResult = await kickUser(sock, sender, userToKick, senderId);
                    await sock.sendMessage(sender, { text: kickResult });
                } else {
                    await sock.sendMessage(sender, { text: '❌ Reply to a user\'s message to kick them.' });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'promote':
                if (!sender.includes('@g.us')) {
                    await sock.sendMessage(sender, { text: '❌ This command only works in groups.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                if (message.message.extendedTextMessage?.contextInfo?.participant) {
                    const userToPromote = message.message.extendedTextMessage.contextInfo.participant;
                    const promoteResult = await promoteUser(sock, sender, userToPromote, senderId);
                    await sock.sendMessage(sender, { text: promoteResult });
                } else {
                    await sock.sendMessage(sender, { text: '❌ Reply to a user\'s message to promote them.' });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'demote':
                if (!sender.includes('@g.us')) {
                    await sock.sendMessage(sender, { text: '❌ This command only works in groups.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                if (message.message.extendedTextMessage?.contextInfo?.participant) {
                    const userToDemote = message.message.extendedTextMessage.contextInfo.participant;
                    const demoteResult = await demoteUser(sock, sender, userToDemote, senderId);
                    await sock.sendMessage(sender, { text: demoteResult });
                } else {
                    await sock.sendMessage(sender, { text: '❌ Reply to a user\'s message to demote them.' });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'mute':
                if (!sender.includes('@g.us')) {
                    await sock.sendMessage(sender, { text: '❌ This command only works in groups.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const muteResult = await muteGroup(sock, sender, senderId);
                await sock.sendMessage(sender, { text: muteResult });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'unmute':
                if (!sender.includes('@g.us')) {
                    await sock.sendMessage(sender, { text: '❌ This command only works in groups.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const unmuteResult = await unmuteGroup(sock, sender, senderId);
                await sock.sendMessage(sender, { text: unmuteResult });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'tagall':
                if (!sender.includes('@g.us')) {
                    await sock.sendMessage(sender, { text: '❌ This command only works in groups.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const tagText = args.join(' ') || 'Hello everyone!';
                await tagAll(sock, sender, senderId, tagText);
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'antilink':
                if (!sender.includes('@g.us')) {
                    await sock.sendMessage(sender, { text: '❌ This command only works in groups.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const setting = args[0]?.toLowerCase();
                if (setting === 'on' || setting === 'off') {
                    const antiLinkResult = await setAntiLink(sock, sender, setting === 'on', senderId);
                    await sock.sendMessage(sender, { text: antiLinkResult });
                } else {
                    await sock.sendMessage(sender, { text: '❌ Usage: .antilink on/off' });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            case 'welcome':
                if (!sender.includes('@g.us')) {
                    await sock.sendMessage(sender, { text: '❌ This command only works in groups.' });
                    antiBan.incrementCount(sender);
                    stats.incrementCommands();
                    return;
                }
                const welcomeMsg = args.join(' ');
                if (!welcomeMsg) {
                    await sock.sendMessage(sender, { text: '❌ Please provide a welcome message.\nExample: .welcome Welcome @user to the group!' });
                    stats.incrementCommands();
                    return;
                }
                const welcomeResult = await setWelcome(sock, sender, welcomeMsg);
                await sock.sendMessage(sender, { text: welcomeResult });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            // Speed Control Commands (Owner only)
            case 'speed':
                const mode = args[0]?.toLowerCase();
                if (mode === 'turbo' || mode === 'normal' || mode === 'stealth') {
                    await speedOptimize(mode);
                    await sock.sendMessage(sender, { text: `⚡ Speed mode changed to: *${mode}*` });
                } else {
                    await sock.sendMessage(sender, { 
                        text: '❌ Usage: .speed [turbo|normal|stealth]\n\n' +
                              '• turbo: Fastest response (higher risk)\n' +
                              '• normal: Balanced speed/safety\n' +
                              '• stealth: Safest but slower'
                    });
                }
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'refresh':
            case 'reboot':
                await sock.sendMessage(sender, { text: '🔄 Rebooting bot...' });
                console.log('Bot rebooting by owner command');
                setTimeout(() => process.exit(0), 2000);
                break;
                
            case 'stats':
                const botStats = getStats();
                const statsText = `📊 *CHEEMY-BOT Statistics*\n\n` +
                                 `👑 *Master:* ${MASTER_NAME}\n` +
                                 `⏱️ Uptime: ${botStats.uptime}\n` +
                                 `📨 Total Messages: ${botStats.totalMessages}\n` +
                                 `⚡ Commands: ${botStats.commandsProcessed}\n` +
                                 `📈 This Hour: ${botStats.messagesThisHour}\n` +
                                 `❌ Errors: ${botStats.errors}\n` +
                                 `🛡️ Anti-Ban: Active\n` +
                                 `⚙️ Status: ${botStats.status}`;
                
                await sock.sendMessage(sender, { text: statsText });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
            
            // Enhanced Help Command
            case 'help':
            case 'menu':
            case 'commands':
                const helpSections = [];
                
                // Basic help (everyone)
                helpSections.push(
                    `🤖 *CHEEMY-BOT Commands* 🤖\n`,
                    `👑 *Master: ${MASTER_NAME}*\n`,
                    `*📱 Public Commands*`,
                    `└ ${prefix}help - Show this menu`,
                    `└ ${prefix}ping - Check bot response`,
                    `└ ${prefix}ai [question] - Ask AI`,
                    `└ ${prefix}sticker - Make sticker`,
                    `└ ${prefix}stickertext - Text sticker`,
                    `└ ${prefix}truth - Truth or dare`,
                    `└ ${prefix}dare - Get a dare`,
                    `└ ${prefix}wyr - Would you rather`,
                    `└ ${prefix}guess [num] - Number game`,
                    `└ ${prefix}qr [text] - Make QR code`,
                    `└ ${prefix}weather [city] - Weather`,
                    `└ ${prefix}translate [lang] [text]`,
                    `└ ${prefix}fact - Random fact`,
                    `└ ${prefix}calc - Calculator`,
                    `└ ${prefix}password - Generate password`,
                    `└ ${prefix}ytaudio - Download YouTube audio`,
                    `└ ${prefix}ytvideo - Download YouTube video`,
                    `└ ${prefix}shorten [url] - Shorten URL`,
                    `└ ${prefix}ip [address] - IP info`,
                    `└ ${prefix}time [timezone] - Current time`
                );
                
                // Sudo commands (visible only to sudo users)
                if (isSudoUser) {
                    helpSections.push(
                        `\n*👥 Sudo Commands*`,
                        `└ ${prefix}kick - Kick user (group)`,
                        `└ ${prefix}promote - Promote admin (group)`,
                        `└ ${prefix}demote - Demote admin (group)`,
                        `└ ${prefix}mute - Mute group`,
                        `└ ${prefix}unmute - Unmute group`,
                        `└ ${prefix}tagall [text] - Tag all members`,
                        `└ ${prefix}antilink [on/off] - Anti-link`,
                        `└ ${prefix}welcome [text] - Set welcome message`,
                        `└ ${prefix}sudolist - Show sudo users`
                    );
                }
                
                // Owner commands (visible only to owner)
                if (config.ownerNumber.includes(getJidNumber(senderId))) {
                    helpSections.push(
                        `\n*🔧 Owner Commands*`,
                        `└ ${prefix}setsudo [days] - Make user sudo`,
                        `└ ${prefix}delsudo - Remove sudo`,
                        `└ ${prefix}speed [mode] - Change speed mode`,
                        `└ ${prefix}reboot - Restart bot`,
                        `└ ${prefix}stats - Bot statistics`,
                        `└ ${prefix}personality [text] - Set AI personality`,
                        `└ ${prefix}clearmemory - Clear chat memory`
                    );
                }
                
                // Add examples
                helpSections.push(
                    `\n*📝 Examples*`,
                    `└ ${prefix}ai What is JavaScript?`,
                    `└ ${prefix}sticker (reply to image)`,
                    `└ ${prefix}weather London`,
                    `└ ${prefix}translate es Hello`,
                    `└ ${prefix}ytaudio never gonna give you up`,
                    `└ ${prefix}qr https://github.com`
                );
                
                await sock.sendMessage(sender, { text: helpSections.join('\n') });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            case 'ping':
                const start = Date.now();
                await sock.sendMessage(sender, { text: '🏓 Pong!' });
                antiBan.incrementCount(sender);
                const end = Date.now();
                await sock.sendMessage(sender, { text: `⏱️ Response time: ${end - start}ms` });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
                
            default:
                // Unknown command
                console.log(`❌ Unknown command: ${command}`);
                await sock.sendMessage(sender, { 
                    text: `❌ Unknown command. Type ${prefix}help for available commands.` 
                });
                antiBan.incrementCount(sender);
                stats.incrementCommands();
                break;
        }
    } catch (error) {
        console.error('❌ Message handler error:', error);
        stats.incrementErrors();
        try {
            await sock.sendMessage(message.key.remoteJid, { 
                text: '❌ An error occurred while processing your command.' 
            });
        } catch {}
    }
}

module.exports = { handleMessage };