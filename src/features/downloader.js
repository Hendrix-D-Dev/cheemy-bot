const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');

async function downloadYouTube(query, type = 'audio') {
    try {
        // Check if query is URL or search term
        let url = query;
        if (!ytdl.validateURL(query)) {
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) return null;
            url = searchResults.videos[0].url;
        }

        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title;
        
        if (type === 'audio') {
            const audioStream = ytdl(url, { quality: 'highestaudio' });
            const filePath = path.join(process.cwd(), 'temp', `${Date.now()}.mp3`);
            await fs.ensureDir(path.dirname(filePath));
            
            // Save audio
            const writeStream = fs.createWriteStream(filePath);
            audioStream.pipe(writeStream);
            
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            
            return { filePath, title, type: 'audio' };
        } else {
            const videoStream = ytdl(url, { quality: 'lowest' });
            const filePath = path.join(process.cwd(), 'temp', `${Date.now()}.mp4`);
            await fs.ensureDir(path.dirname(filePath));
            
            const writeStream = fs.createWriteStream(filePath);
            videoStream.pipe(writeStream);
            
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            
            return { filePath, title, type: 'video' };
        }
    } catch (error) {
        console.error('Download error:', error);
        return null;
    }
}

async function downloadInstagram(url) {
    try {
        // Using instagram downloader API
        const response = await axios.get(`https://api.instagram.com/oembed/?url=${url}`);
        return {
            title: response.data.title,
            url: url
        };
    } catch {
        return null;
    }
}

async function downloadTikTok(url) {
    try {
        // Using tikwm API
        const response = await axios.post('https://www.tikwm.com/api/', {
            url: url,
            count: 12,
            cursor: 0,
            web: 1
        });
        
        if (response.data.data) {
            const videoUrl = response.data.data.play;
            return {
                videoUrl: videoUrl,
                title: response.data.data.title
            };
        }
        return null;
    } catch {
        return null;
    }
}

async function cleanupTemp() {
    const tempDir = path.join(process.cwd(), 'temp');
    if (await fs.pathExists(tempDir)) {
        const files = await fs.readdir(tempDir);
        const now = Date.now();
        
        for (const file of files) {
            const filePath = path.join(tempDir, file);
            const stats = await fs.stat(filePath);
            // Delete files older than 1 hour
            if (now - stats.mtimeMs > 3600000) {
                await fs.remove(filePath);
            }
        }
    }
}

module.exports = {
    downloadYouTube,
    downloadInstagram,
    downloadTikTok,
    cleanupTemp
};
