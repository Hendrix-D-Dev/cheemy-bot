const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

async function imageToSticker(imageBuffer, metadata = {}) {
    try {
        // Process image for WhatsApp sticker
        const processed = await sharp(imageBuffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp()
            .toBuffer();

        return processed;
    } catch (error) {
        console.error('Sticker error:', error);
        return null;
    }
}

async function videoToSticker(videoBuffer) {
    // Note: This requires ffmpeg installed on system
    // For simplicity, we'll extract first frame as image
    // In production, use fluent-ffmpeg to convert video to GIF then to WebP
    
    try {
        const processed = await sharp(videoBuffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp()
            .toBuffer();

        return processed;
    } catch {
        return null;
    }
}

async function textToSticker(text) {
    // Create image from text
    const width = 512;
    const height = 512;
    
    const svgText = `
    <svg width="${width}" height="${height}">
        <style>
            .text {
                fill: white;
                font-size: 40px;
                font-family: Arial;
                text-anchor: middle;
                dominant-baseline: middle;
            }
        </style>
        <rect width="100%" height="100%" fill="black" />
        <text x="50%" y="50%" class="text" text-anchor="middle">${text}</text>
    </svg>
    `;
    
    const processed = await sharp(Buffer.from(svgText))
        .webp()
        .toBuffer();
    
    return processed;
}

module.exports = {
    imageToSticker,
    videoToSticker,
    textToSticker
};
