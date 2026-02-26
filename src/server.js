const express = require('express');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

// Track start time for uptime
const startTime = Date.now();

// Simple status page
app.get('/', (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>CHEEMY-BOT Status</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-align: center;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .container {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 40px;
                        max-width: 600px;
                        width: 100%;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        border: 1px solid rgba(255,255,255,0.2);
                    }
                    h1 { 
                        font-size: 3em; 
                        margin-bottom: 10px;
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                    }
                    .master-badge {
                        background: linear-gradient(135deg, #ffd700 0%, #ffb347 100%);
                        color: #333;
                        display: inline-block;
                        padding: 8px 20px;
                        border-radius: 50px;
                        font-weight: bold;
                        margin: 10px 0 20px;
                        font-size: 1.2em;
                        box-shadow: 0 4px 15px rgba(255,215,0,0.3);
                    }
                    .status-card {
                        background: rgba(0,0,0,0.2);
                        border-radius: 15px;
                        padding: 25px;
                        margin: 20px 0;
                    }
                    .status {
                        font-size: 1.8em;
                        margin: 15px 0;
                    }
                    .online { 
                        color: #4cff4c;
                        text-shadow: 0 0 10px #00ff00;
                    }
                    .uptime {
                        font-size: 1.3em;
                        color: #ffd700;
                        margin: 15px 0;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 15px;
                        margin: 25px 0;
                    }
                    .stat-item {
                        background: rgba(255,255,255,0.1);
                        border-radius: 10px;
                        padding: 15px;
                    }
                    .stat-label {
                        font-size: 0.9em;
                        opacity: 0.8;
                        margin-bottom: 5px;
                    }
                    .stat-value {
                        font-size: 1.4em;
                        font-weight: bold;
                    }
                    .ping {
                        color: #00ffff;
                        font-family: monospace;
                        font-size: 1.1em;
                        margin: 15px 0;
                    }
                    .footer {
                        margin-top: 30px;
                        font-size: 0.9em;
                        opacity: 0.7;
                    }
                    .heartbeat {
                        display: inline-block;
                        animation: pulse 1.5s ease infinite;
                    }
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.1); opacity: 0.8; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    .auth-status {
                        background: rgba(0,0,0,0.3);
                        border-radius: 10px;
                        padding: 15px;
                        margin-top: 20px;
                        font-size: 0.9em;
                    }
                    .auth-active {
                        color: #4cff4c;
                    }
                    .auth-stale {
                        color: #ff6b6b;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🤖 CHEEMY-BOT</h1>
                    <div class="master-badge">👑 Master Cheema's Bot</div>
                    
                    <div class="status-card">
                        <div class="status">
                            Status: <span class="online">🟢 ONLINE</span>
                            <span class="heartbeat">💓</span>
                        </div>
                        
                        <div class="uptime">
                            ⏱️ Uptime: <span id="uptime">${hours}h ${minutes}m ${seconds}s</span>
                        </div>
                        
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-label">Last Ping</div>
                                <div class="stat-value" id="lastPing">Just now</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Keep-Alive</div>
                                <div class="stat-value" style="color: #4cff4c;">Active 🔄</div>
                            </div>
                        </div>
                        
                        <div class="ping">
                            📡 Next ping in <span id="countdown">3:00</span>
                        </div>
                        
                        <div class="auth-status" id="authStatus">
                            🔐 Loading auth status...
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>⚡ Running 24/7 for Master Cheema ⚡</p>
                        <p>Last heartbeat: ${new Date().toLocaleString()}</p>
                        <p>🔄 Auto auth cleanup every 12 hours</p>
                    </div>
                </div>
                
                <script>
                    const startTime = ${startTime};
                    let lastPingTime = Date.now();
                    
                    function updateUptime() {
                        const uptime = Math.floor((Date.now() - startTime) / 1000);
                        const hours = Math.floor(uptime / 3600);
                        const minutes = Math.floor((uptime % 3600) / 60);
                        const seconds = uptime % 60;
                        document.getElementById('uptime').textContent = 
                            hours + 'h ' + minutes + 'm ' + seconds + 's';
                    }
                    
                    function updateCountdown() {
                        const now = Date.now();
                        const timeSincePing = Math.floor((now - lastPingTime) / 1000);
                        const nextPing = 180 - timeSincePing;
                        
                        if (nextPing <= 0) {
                            lastPingTime = now;
                            document.getElementById('lastPing').textContent = 'Just now';
                            document.getElementById('countdown').textContent = '3:00';
                        } else {
                            const minutes = Math.floor(nextPing / 60);
                            const seconds = nextPing % 60;
                            const minutesSince = Math.floor(timeSincePing / 60);
                            const secondsSince = timeSincePing % 60;
                            document.getElementById('lastPing').textContent = 
                                minutesSince + 'm ' + secondsSince + 's ago';
                            document.getElementById('countdown').textContent = 
                                minutes + ':' + (seconds < 10 ? '0' + seconds : seconds);
                        }
                    }
                    
                    async function updateAuthStatus() {
                        try {
                            const response = await fetch('/auth-status');
                            const data = await response.json();
                            
                            const authDiv = document.getElementById('authStatus');
                            if (data.status === 'active') {
                                const hours = parseFloat(data.auth_age.hours);
                                const statusClass = hours > 12 ? 'auth-stale' : 'auth-active';
                                authDiv.innerHTML = \`
                                    🔐 <span class="\${statusClass}">Auth Active</span><br>
                                    Last active: \${data.auth_age.minutes} minutes ago<br>
                                    \${hours > 12 ? '⚠️ Needs cleanup' : '✅ Healthy'}
                                \`;
                            } else if (data.qr_needed) {
                                authDiv.innerHTML = '🔐 <span class="auth-stale">QR Code Ready - Scan to connect</span>';
                            } else {
                                authDiv.innerHTML = '🔐 <span class="auth-stale">No Auth - Waiting for QR scan</span>';
                            }
                        } catch (err) {
                            console.error('Failed to fetch auth status:', err);
                        }
                    }
                    
                    setInterval(function() {
                        updateUptime();
                        updateCountdown();
                    }, 1000);
                    
                    setInterval(updateAuthStatus, 10000); // Update auth status every 10 seconds
                    
                    // Initial calls
                    fetch('/ping').then(function() {
                        lastPingTime = Date.now();
                    });
                    updateAuthStatus();
                </script>
            </body>
        </html>
    `);
});

// Health check endpoint
app.get('/health', (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    res.json({ 
        status: 'online',
        bot: 'CHEEMY-BOT',
        master: 'Cheema',
        uptime: uptime,
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        keepAlive: 'active'
    });
});

// Ping endpoint for keep-alive services
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Stats endpoint
app.get('/stats', (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    res.json({
        botName: 'CHEEMY-BOT',
        master: 'Cheema',
        status: 'online',
        uptime: uptime,
        uptimeFormatted: {
            hours: Math.floor(uptime / 3600),
            minutes: Math.floor((uptime % 3600) / 60),
            seconds: uptime % 60
        },
        startTime: new Date(startTime).toISOString(),
        currentTime: new Date().toISOString()
    });
});

// Auth status endpoint
app.get('/auth-status', async (req, res) => {
    const authFolder = path.join(process.cwd(), 'auth_info');
    
    try {
        if (!await fs.pathExists(authFolder)) {
            return res.json({ 
                status: 'no_auth',
                message: 'No auth folder found - waiting for QR scan',
                qr_needed: true
            });
        }
        
        const files = await fs.readdir(authFolder);
        
        if (files.length === 0) {
            return res.json({
                status: 'empty',
                message: 'Auth folder is empty - ready for QR scan',
                qr_needed: true
            });
        }
        
        // Get last modified time
        let lastModified = 0;
        for (const file of files) {
            const filePath = path.join(authFolder, file);
            const stats = await fs.stat(filePath);
            if (stats.mtimeMs > lastModified) {
                lastModified = stats.mtimeMs;
            }
        }
        
        const now = Date.now();
        const hoursSinceLastUse = (now - lastModified) / (1000 * 60 * 60);
        const minutesSinceLastUse = Math.floor((now - lastModified) / (1000 * 60));
        
        res.json({
            status: 'active',
            auth_age: {
                hours: hoursSinceLastUse.toFixed(1),
                minutes: minutesSinceLastUse,
                last_active: new Date(lastModified).toISOString()
            },
            files: files.length,
            needs_cleanup: hoursSinceLastUse > 12,
            qr_needed: false
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Force clear auth endpoint (protected by secret)
app.get('/force-clear-auth', async (req, res) => {
    const secret = req.query.secret;
    const AUTH_SECRET = process.env.AUTH_CLEAR_SECRET || 'cheema-clear-123';
    
    if (secret !== AUTH_SECRET) {
        return res.status(401).json({ error: 'Unauthorized - Invalid secret' });
    }
    
    const authFolder = path.join(process.cwd(), 'auth_info');
    
    try {
        console.log(chalk.red('🧹 Auth cleared via web endpoint!'));
        await fs.remove(authFolder);
        await fs.ensureDir(authFolder);
        
        res.json({ 
            success: true, 
            message: 'Auth folder cleared. Bot will generate new QR code.',
            timestamp: new Date().toISOString()
        });
        
        // Restart bot after 2 seconds
        setTimeout(() => process.exit(0), 2000);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function startServer() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(chalk.green(`🌐 Status server running on port ${PORT}`));
        console.log(chalk.cyan(`📊 Health check: http://localhost:${PORT}/health`));
        console.log(chalk.cyan(`📡 Ping endpoint: http://localhost:${PORT}/ping`));
        console.log(chalk.cyan(`🔐 Auth status: http://localhost:${PORT}/auth-status`));
        console.log(chalk.yellow(`⚠️  Force clear auth: http://localhost:${PORT}/force-clear-auth?secret=cheema-clear-123`));
        
        if (process.env.RAILWAY_STATIC_URL) {
            console.log(chalk.magenta(`🚀 Railway URL: https://${process.env.RAILWAY_STATIC_URL}`));
        }
    });
}

module.exports = { startServer };