
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');

let db;

async function initializeDatabase() {
    const dbPath = path.join(process.cwd(), 'database', 'bot.db');
    await fs.ensureDir(path.dirname(dbPath));

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Create tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT,
            sender TEXT,
            message TEXT,
            type TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats(id)
        );

        CREATE TABLE IF NOT EXISTS memory (
            chat_id TEXT PRIMARY KEY,
            context TEXT,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS banned_users (
            jid TEXT PRIMARY KEY,
            reason TEXT,
            banned_by TEXT,
            banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS group_settings (
            group_jid TEXT PRIMARY KEY,
            welcome_message TEXT,
            goodbye_message TEXT,
            anti_link BOOLEAN DEFAULT 0,
            anti_badword BOOLEAN DEFAULT 0,
            mute BOOLEAN DEFAULT 0,
            nsfw_filter BOOLEAN DEFAULT 0
        );
    `);

    console.log('✅ Database initialized');
    return db;
}

function getDb() {
    return db;
}

module.exports = { initializeDatabase, getDb };
