#!/bin/bash
echo "🧹 Running CHEEMY-BOT pre-deploy cleanup..."
node scripts/clear-auth.js
echo "✅ Cleanup complete, starting bot..."
npm start
