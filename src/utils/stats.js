// Bot statistics
let startTime = Date.now();
let messageStats = {
    total: 0,
    commands: 0,
    errors: 0,
    lastHour: 0
};

function incrementTotal() {
    messageStats.total++;
}

function incrementCommands() {
    messageStats.commands++;
}

function incrementErrors() {
    messageStats.errors++;
}

function getStats() {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    return {
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        totalMessages: messageStats.total,
        commandsProcessed: messageStats.commands,
        errors: messageStats.errors,
        messagesThisHour: messageStats.lastHour,
        status: 'online'
    };
}

function resetHourlyStats() {
    messageStats.lastHour = 0;
}

module.exports = {
    incrementTotal,
    incrementCommands,
    incrementErrors,
    getStats,
    resetHourlyStats
};
