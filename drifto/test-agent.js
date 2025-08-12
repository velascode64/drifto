#!/usr/bin/env node

/**
 * Script para probar el agente Drifto con Google Calendar
 */

const fs = require('fs');
const path = require('path');

// Verificar que existan los tokens
const tokensPath = path.join(__dirname, '.tokens.json');
if (!fs.existsSync(tokensPath)) {
  console.error('❌ No tokens found. Run: node start-oauth.js first');
  process.exit(1);
}

console.log('🧪 Testing Drifto Agent with Google Calendar...\n');

// Simular conversación donde Ana y Carlos coordinan reunión
console.log('📧 Simulated conversation:');
console.log('Ana: "Let\'s meet Thursday at 4:00 PM SGT (Singapore time)"');
console.log('Carlos (Berkeley): "Sure!"');
console.log('\n🤖 Drifto Agent response should be:');
console.log('⚠️  4PM Singapore = 1AM Berkeley (you\'d be sleeping!)');
console.log('');
console.log('Better alternatives:');
console.log('• 9AM SGT = 6PM Berkeley (previous day) ✓');
console.log('• 10AM SGT = 7PM Berkeley (previous day) ✓');
console.log('• 11AM SGT = 8PM Berkeley (previous day) ✓');
console.log('');
console.log('Which time works better?');

console.log('\n💡 Run this to test the actual agent:');
console.log('npm run start -- "Ana wants to meet Thursday at 4PM Singapore time"');