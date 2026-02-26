const { getDb } = require('../utils/database');
const config = require('../../config');

// Initialize sudo users table
async function initSudoTable() {
    const db = getDb();
    if (!db) {
        console.log('⏳ Database not ready, will initialize sudo table later...');
        return;
    }
    
    try {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS sudo_users (
                jid TEXT PRIMARY KEY,
                number TEXT,
                name TEXT,
                added_by TEXT,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expiry_date DATETIME,
                permissions TEXT DEFAULT 'all'
            )
        `);
        console.log('✅ Sudo users table initialized');
    } catch (error) {
        console.error('Failed to initialize sudo table:', error);
    }
}

// Check if user is sudo
async function isSudo(jid) {
    try {
        // Owner is always sudo
        const number = jid.split('@')[0];
        if (config.ownerNumber.includes(number)) return true;
        
        const db = getDb();
        if (!db) return false;
        
        const sudo = await db.get('SELECT * FROM sudo_users WHERE jid = ?', [jid]);
        
        if (sudo) {
            // Check if expired
            if (sudo.expiry_date && new Date(sudo.expiry_date) < new Date()) {
                await db.run('DELETE FROM sudo_users WHERE jid = ?', [jid]);
                return false;
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking sudo status:', error);
        return false;
    }
}

// Add sudo user
async function addSudo(jid, name, addedBy, expiryDays = null) {
    try {
        const db = getDb();
        if (!db) return false;
        
        const number = jid.split('@')[0];
        
        let expiryDate = null;
        if (expiryDays) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + expiryDays);
        }
        
        await db.run(
            'INSERT OR REPLACE INTO sudo_users (jid, number, name, added_by, expiry_date) VALUES (?, ?, ?, ?, ?)',
            [jid, number, name, addedBy, expiryDate?.toISOString()]
        );
        
        console.log(`✅ Added sudo user: ${number}`);
        return true;
    } catch (error) {
        console.error('Error adding sudo user:', error);
        return false;
    }
}

// Remove sudo user
async function removeSudo(jid) {
    try {
        const db = getDb();
        if (!db) return false;
        
        await db.run('DELETE FROM sudo_users WHERE jid = ?', [jid]);
        console.log(`✅ Removed sudo user: ${jid}`);
        return true;
    } catch (error) {
        console.error('Error removing sudo user:', error);
        return false;
    }
}

// Get all sudo users
async function getSudoList() {
    try {
        const db = getDb();
        if (!db) return [];
        
        const suds = await db.all('SELECT * FROM sudo_users ORDER BY added_at DESC');
        
        // Add owners to list
        const owners = config.ownerNumber.map(num => ({
            jid: `${num}@s.whatsapp.net`,
            number: num,
            name: 'Bot Owner',
            added_by: 'System',
            added_at: new Date().toISOString(),
            is_owner: true
        }));
        
        return [...owners, ...suds];
    } catch (error) {
        console.error('Error getting sudo list:', error);
        return [];
    }
}

module.exports = {
    initSudoTable,
    isSudo,
    addSudo,
    removeSudo,
    getSudoList
};
