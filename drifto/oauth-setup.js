#!/usr/bin/env node

/**
 * Script simplificado para OAuth de Google Calendar
 * Ejecutar con: node oauth-setup.js
 */

import { google } from 'googleapis';
import fs from 'fs';
import http from 'http';
import { URL } from 'url';

// Leer credenciales del archivo JSON
const credentialsPath = './client_secret_214679969940-bstkk1ksjp436gnmn75rtn7rqs6d1a7e.apps.googleusercontent.com.json';
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const { client_id, client_secret, redirect_uris } = credentials.web;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

const scopes = ['https://www.googleapis.com/auth/calendar'];

// Generar URL de autorización
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent',
});

console.log('🚀 OAuth Setup for Google Calendar\n');
console.log('1. Open this URL in your browser:');
console.log(`   ${authUrl}\n`);

// Crear servidor temporal para recibir el callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3000`);
  
  if (url.pathname === '/google/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    
    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<h1>❌ Error: ${error}</h1><p><a href="/">Try again</a></p>`);
      return;
    }
    
    if (code) {
      try {
        // Intercambiar código por tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        // Guardar tokens
        const tokensData = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date
        };
        
        fs.writeFileSync('.tokens.json', JSON.stringify(tokensData, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>✅ Success!</h1>
          <p>Google Calendar connected successfully!</p>
          <p>Tokens saved to .tokens.json</p>
          <p>You can now close this window and stop the server (Ctrl+C)</p>
        `);
        
        console.log('\n✅ Authentication successful!');
        console.log('📁 Tokens saved to .tokens.json');
        console.log('🎉 Your agent can now access Google Calendar');
        console.log('\nPress Ctrl+C to stop the server');
        
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>❌ Token exchange failed</h1><p>${error.message}</p>`);
        console.error('Token exchange error:', error);
      }
    }
  } else {
    // Página principal
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h1>🗓️ Drifto OAuth Setup</h1>
      <p><a href="${authUrl}">Connect Google Calendar</a></p>
    `);
  }
});

server.listen(3000, () => {
  console.log('2. OAuth server running at: http://localhost:3000');
  console.log('3. Click "Connect Google Calendar" and authorize the app');
  console.log('\n⚠️  Keep this server running until authorization is complete!\n');
});