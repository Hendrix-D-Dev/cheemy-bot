const moment = require('moment');

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(timestamp) {
    return moment(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractUrlFromText(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex);
}

function isGroup(jid) {
    return jid.includes('@g.us');
}

function isPrivate(jid) {
    return jid.includes('@s.whatsapp.net');
}

function getJidNumber(jid) {
    return jid.split('@')[0];
}

module.exports = {
    formatBytes,
    formatTime,
    sleep,
    extractUrlFromText,
    isGroup,
    isPrivate,
    getJidNumber
};
