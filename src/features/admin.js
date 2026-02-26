
const { getDb } = require('../utils/database');
const config = require('../../config');

async function isAdmin(sock, groupId, userId) {
    try {
        const groupMetadata = await sock.groupMetadata(groupId);
        const participant = groupMetadata.participants.find(p => p.id === userId);
        return participant?.admin === 'admin' || participant?.admin === 'superadmin' || 
               config.ownerNumber.includes(userId.split('@')[0]);
    } catch {
        return false;
    }
}

async function kickUser(sock, groupId, userId, senderId) {
    if (!await isAdmin(sock, groupId, senderId)) {
        return '❌ Only admins can use this command.';
    }
    
    try {
        await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
        return `✅ User removed successfully.`;
    } catch (error) {
        return '❌ Failed to remove user.';
    }
}

async function promoteUser(sock, groupId, userId, senderId) {
    if (!await isAdmin(sock, groupId, senderId)) {
        return '❌ Only admins can promote members.';
    }
    
    try {
        await sock.groupParticipantsUpdate(groupId, [userId], 'promote');
        return `✅ User promoted to admin.`;
    } catch {
        return '❌ Failed to promote user.';
    }
}

async function demoteUser(sock, groupId, userId, senderId) {
    if (!await isAdmin(sock, groupId, senderId)) {
        return '❌ Only admins can demote members.';
    }
    
    try {
        await sock.groupParticipantsUpdate(groupId, [userId], 'demote');
        return `✅ User demoted from admin.`;
    } catch {
        return '❌ Failed to demote user.';
    }
}

async function muteGroup(sock, groupId, senderId) {
    if (!await isAdmin(sock, groupId, senderId)) {
        return '❌ Only admins can mute the group.';
    }
    
    try {
        await sock.groupSettingUpdate(groupId, 'announcement');
        return '✅ Group muted (only admins can message).';
    } catch {
        return '❌ Failed to mute group.';
    }
}

async function unmuteGroup(sock, groupId, senderId) {
    if (!await isAdmin(sock, groupId, senderId)) {
        return '❌ Only admins can unmute the group.';
    }
    
    try {
        await sock.groupSettingUpdate(groupId, 'not_announcement');
        return '✅ Group unmuted (all members can message).';
    } catch {
        return '❌ Failed to unmute group.';
    }
}

async function tagAll(sock, groupId, senderId, text) {
    if (!await isAdmin(sock, groupId, senderId)) {
        return '❌ Only admins can tag all members.';
    }
    
    try {
        const groupMetadata = await sock.groupMetadata(groupId);
        const mentions = groupMetadata.participants.map(p => p.id);
        
        await sock.sendMessage(groupId, {
            text: text || '@everyone',
            mentions
        });
        return null; // Message sent directly
    } catch {
        return '❌ Failed to tag members.';
    }
}

async function setWelcome(sock, groupId, message) {
    const db = getDb();
    await db.run(
        'INSERT OR REPLACE INTO group_settings (group_jid, welcome_message) VALUES (?, ?)',
        [groupId, message]
    );
    return '✅ Welcome message updated.';
}

async function setAntiLink(sock, groupId, enabled, senderId) {
    if (!await isAdmin(sock, groupId, senderId)) {
        return '❌ Only admins can change settings.';
    }
    
    const db = getDb();
    await db.run(
        'INSERT OR REPLACE INTO group_settings (group_jid, anti_link) VALUES (?, ?)',
        [groupId, enabled ? 1 : 0]
    );
    return enabled ? '✅ Anti-link enabled.' : '✅ Anti-link disabled.';
}

module.exports = {
    isAdmin,
    kickUser,
    promoteUser,
    demoteUser,
    muteGroup,
    unmuteGroup,
    tagAll,
    setWelcome,
    setAntiLink
};
