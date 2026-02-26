const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function downloadMedia(sock, message) {
    try {
        const stream = await downloadContentFromMessage(message, 'media');
        let buffer = Buffer.from([]);
        
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        return buffer;
    } catch (error) {
        console.error('Download error:', error);
        return null;
    }
}

async function handleViewOnce(sock, message, ownerJid) {
    try {
        if (!config.media.saveMedia) return;

        const msg = message.message;
        
        // Check for view-once messages
        if (msg?.viewOnceMessage?.message) {
            const viewOnce = msg.viewOnceMessage.message;
            const mediaType = viewOnce.imageMessage ? 'image' : 
                             viewOnce.videoMessage ? 'video' : 
                             viewOnce.audioMessage ? 'audio' : 'unknown';
            
            // Download the media
            let mediaBuffer;
            let mediaInfo = {};
            let mediaMessage;
            
            if (viewOnce.imageMessage) {
                mediaMessage = viewOnce.imageMessage;
                mediaInfo.type = 'image';
            } else if (viewOnce.videoMessage) {
                mediaMessage = viewOnce.videoMessage;
                mediaInfo.type = 'video';
            } else if (viewOnce.audioMessage) {
                mediaMessage = viewOnce.audioMessage;
                mediaInfo.type = 'audio';
            } else {
                return;
            }
            
            mediaBuffer = await downloadMedia(sock, mediaMessage);
            
            if (mediaBuffer) {
                // Save to file
                const fileName = `${Date.now()}_${mediaMessage?.fileName || 'viewonce'}.${mediaInfo.type}`;
                const filePath = path.join(process.cwd(), 'media', 'viewonce', fileName);
                await fs.ensureDir(path.dirname(filePath));
                await fs.writeFile(filePath, mediaBuffer);
                
                // Send to owner
                const caption = `📸 *View Once Media Received*\n\n` +
                               `From: ${message.key.remoteJid}\n` +
                               `Type: ${mediaInfo.type}\n` +
                               `Time: ${new Date().toLocaleString()}\n` +
                               `Chat: ${message.key.remoteJid.includes('@g.us') ? 'Group' : 'Private'}`;
                
                if (mediaInfo.type === 'image') {
                    await sock.sendMessage(ownerJid, {
                        image: mediaBuffer,
                        caption: caption
                    });
                } else if (mediaInfo.type === 'video') {
                    await sock.sendMessage(ownerJid, {
                        video: mediaBuffer,
                        caption: caption
                    });
                } else if (mediaInfo.type === 'audio') {
                    await sock.sendMessage(ownerJid, {
                        audio: mediaBuffer,
                        mimetype: 'audio/mp4',
                        caption: caption
                    });
                }
                
                console.log(`📸 View once media saved from ${message.key.remoteJid}`);
            }
        }
    } catch (error) {
        console.error('View once handler error:', error);
    }
}

module.exports = { handleViewOnce, downloadMedia };
