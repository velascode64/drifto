#!/usr/bin/env node

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Verificar tokens
const tokensPath = path.join(__dirname, '.tokens.json');

console.log('🔍 Testing Google Calendar Connection...\n');
console.log(`📁 Looking for tokens at: ${tokensPath}`);

if (!fs.existsSync(tokensPath)) {
  console.error('❌ No tokens file found!');
  console.log('   Run: npm run auth or npm run get:google');
  process.exit(1);
}

// Leer tokens
const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
console.log('✅ Tokens found!');
console.log(`   Access Token: ${tokens.accessToken.substring(0, 30)}...`);
console.log(`   Refresh Token: ${tokens.refreshToken ? tokens.refreshToken.substring(0, 20) + '...' : 'N/A'}`);
console.log(`   Expiry Date: ${new Date(tokens.expiryDate).toLocaleString()}`);

// Verificar si el token está expirado
const isExpired = tokens.expiryDate && tokens.expiryDate < Date.now();
if (isExpired) {
  console.log('⚠️  Token is expired, will need refresh');
} else {
  console.log('✅ Token is still valid');
}

// Configurar OAuth2 client
const credentialsPath = path.join(__dirname, 'client_secret_214679969940-bstkk1ksjp436gnmn75rtn7rqs6d1a7e.apps.googleusercontent.com.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const { client_id, client_secret, redirect_uris } = credentials.web;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// Establecer tokens
oauth2Client.setCredentials({
  access_token: tokens.accessToken,
  refresh_token: tokens.refreshToken,
});

// Crear cliente de Calendar
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

console.log('\n📅 Testing Calendar API...\n');

// Test 1: Listar calendarios
try {
  console.log('Test 1: Listing calendars...');
  const calendarList = await calendar.calendarList.list();
  console.log(`✅ Found ${calendarList.data.items?.length || 0} calendars`);
  calendarList.data.items?.forEach((cal, i) => {
    console.log(`   ${i + 1}. ${cal.summary} (${cal.id})`);
  });
} catch (error) {
  console.error('❌ Failed to list calendars:', error.message);
}

// Test 2: Listar eventos de esta semana
try {
  console.log('\nTest 2: Listing this week\'s events...');
  
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Domingo
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfWeek.toISOString(),
    timeMax: endOfWeek.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  console.log(`✅ Found ${events.data.items?.length || 0} events this week`);
  events.data.items?.forEach((event, i) => {
    const start = event.start?.dateTime || event.start?.date;
    console.log(`   ${i + 1}. ${event.summary} - ${start}`);
  });
} catch (error) {
  console.error('❌ Failed to list events:', error.message);
  if (error.code === 401) {
    console.log('   Authentication failed. Token might be invalid.');
    console.log('   Try running: npm run auth');
  }
}

// Test 3: Check free/busy
try {
  console.log('\nTest 3: Checking free/busy for next 24 hours...');
  
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: tomorrow.toISOString(),
      items: [{ id: 'primary' }],
    },
  });
  
  const busySlots = freeBusy.data.calendars?.primary?.busy || [];
  console.log(`✅ Found ${busySlots.length} busy time slots`);
  busySlots.forEach((slot, i) => {
    console.log(`   ${i + 1}. ${slot.start} to ${slot.end}`);
  });
} catch (error) {
  console.error('❌ Failed to check free/busy:', error.message);
}

console.log('\n✨ Connection test complete!\n');

// Resumen
console.log('📊 Summary:');
console.log(`   • Tokens: ${fs.existsSync(tokensPath) ? '✅ Found' : '❌ Missing'}`);
console.log(`   • Token Status: ${isExpired ? '⚠️ Expired' : '✅ Valid'}`);
console.log(`   • API Access: Check results above`);
console.log('\nIf any tests failed, try:');
console.log('   1. Run: npm run auth');
console.log('   2. Re-authorize your Google account');
console.log('   3. Make sure calendar permissions are granted');