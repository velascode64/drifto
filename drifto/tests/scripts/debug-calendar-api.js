#!/usr/bin/env node

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Debug Calendar API Direct...\n');

// Load tokens
const tokensPath = path.join(__dirname, '.tokens.json');
if (!fs.existsSync(tokensPath)) {
  console.error('❌ No tokens found at:', tokensPath);
  process.exit(1);
}

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
console.log('✅ Tokens loaded');

// Load credentials
const credentialsPath = path.join(__dirname, 'client_secret_214679969940-bstkk1ksjp436gnmn75rtn7rqs6d1a7e.apps.googleusercontent.com.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const { client_id, client_secret, redirect_uris } = credentials.web;

// Setup OAuth2
const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
oauth2Client.setCredentials({
  access_token: tokens.accessToken,
  refresh_token: tokens.refreshToken,
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

console.log('📅 Testing Calendar API operations...\n');

// Test 1: List events
console.log('Test 1: List events...');
try {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  console.log(`   Time range: ${now.toISOString()} to ${nextWeek.toISOString()}`);
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: nextWeek.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  const events = response.data.items || [];
  console.log(`✅ Found ${events.length} events:`);
  
  events.forEach((event, i) => {
    const start = event.start?.dateTime || event.start?.date;
    console.log(`   ${i + 1}. ${event.summary} - ${start}`);
  });
  
} catch (error) {
  console.error('❌ List events failed:', error.message);
  if (error.response?.data) {
    console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
  }
}

console.log('\n---\n');

// Test 2: Create event
console.log('Test 2: Create event...');
try {
  const startTime = new Date();
  startTime.setDate(startTime.getDate() + 1);
  startTime.setHours(15, 30, 0, 0);
  
  const endTime = new Date(startTime);
  endTime.setHours(16, 30, 0, 0);
  
  console.log(`   Creating event from ${startTime.toISOString()} to ${endTime.toISOString()}`);
  
  const eventData = {
    summary: 'DEBUG: Direct API Test Event',
    description: 'Created directly through googleapis to test API access',
    start: {
      dateTime: startTime.toISOString(),
    },
    end: {
      dateTime: endTime.toISOString(),
    },
    conferenceData: {
      createRequest: {
        requestId: `debug-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };
  
  console.log('   Event data:', JSON.stringify(eventData, null, 2));
  
  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: eventData,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  });
  
  console.log('✅ Event created successfully:');
  console.log(`   Event ID: ${response.data.id}`);
  console.log(`   HTML Link: ${response.data.htmlLink}`);
  console.log(`   Meet Link: ${response.data.hangoutLink || 'Not created'}`);
  
} catch (error) {
  console.error('❌ Create event failed:', error.message);
  if (error.response?.data) {
    console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
  }
}

console.log('\n✨ Debug complete!');