#!/usr/bin/env node

/**
 * Servidor OAuth para múltiples usuarios de Drifto
 * Cada usuario obtiene un token único identificado por ID
 */

import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Cargar credenciales
const credentialsPath = path.join(__dirname, 'client_secret_214679969940-bstkk1ksjp436gnmn75rtn7rqs6d1a7e.apps.googleusercontent.com.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const { client_id, client_secret, redirect_uris } = credentials.web;

// Directorio para guardar tokens de usuarios
const TOKENS_DIR = path.join(__dirname, 'user-tokens');
if (!fs.existsSync(TOKENS_DIR)) {
  fs.mkdirSync(TOKENS_DIR);
}

// OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

const scopes = ['https://www.googleapis.com/auth/calendar'];

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Página principal
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Drifto - Multi-User OAuth</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 15px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 2rem;
        }
        .auth-section {
          background: #f8f9fa;
          padding: 2rem;
          border-radius: 10px;
          margin-bottom: 2rem;
          text-align: center;
        }
        .btn {
          display: inline-block;
          background: #4285f4;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: background 0.3s;
          font-size: 16px;
        }
        .btn:hover {
          background: #357ae8;
        }
        .user-id {
          background: #e9ecef;
          padding: 1rem;
          border-radius: 5px;
          font-family: monospace;
          margin: 1rem 0;
          word-break: break-all;
        }
        .instructions {
          background: #fff3cd;
          color: #856404;
          padding: 1.5rem;
          border-radius: 8px;
          border-left: 4px solid #ffc107;
        }
        .instructions h3 {
          margin-top: 0;
        }
        .existing-users {
          margin-top: 2rem;
        }
        .user-card {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .user-info {
          font-family: monospace;
          font-size: 14px;
        }
        .status {
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
        }
        .status.active {
          background: #d4edda;
          color: #155724;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🗓️ Drifto Calendar Access</h1>
        
        <div class="auth-section">
          <h2>Connect Your Google Calendar</h2>
          <p>Get a unique token for the Drifto agent to access your calendar</p>
          <a href="/auth" class="btn">Connect Google Calendar</a>
        </div>

        <div class="instructions">
          <h3>📋 Instructions for Testers:</h3>
          <ol>
            <li><strong>Click "Connect Google Calendar"</strong> above</li>
            <li><strong>Authorize the app</strong> with your Google account</li>
            <li><strong>Copy your unique User ID</strong> when the process completes</li>
            <li><strong>Share the User ID</strong> with the agent or save it for testing</li>
          </ol>
          <p><strong>Note:</strong> Each person gets a unique ID. This allows multiple testers to use the agent simultaneously without conflicts.</p>
        </div>

        <div class="existing-users">
          <h3>👥 Active Users</h3>
          ${getActiveUsers()}
        </div>
      </div>
    </body>
    </html>
  `);
});

function getActiveUsers() {
  try {
    const users = fs.readdirSync(TOKENS_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const userId = file.replace('.json', '');
        const tokenData = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, file), 'utf8'));
        const isExpired = tokenData.expiryDate && tokenData.expiryDate < Date.now();
        
        return `
          <div class="user-card">
            <div class="user-info">
              <strong>ID:</strong> ${userId}<br>
              <small>Created: ${new Date(tokenData.createdAt || Date.now()).toLocaleString()}</small>
            </div>
            <div class="status ${isExpired ? 'expired' : 'active'}">
              ${isExpired ? '⚠️ Expired' : '✅ Active'}
            </div>
          </div>
        `;
      }).join('');

    return users || '<p>No users connected yet</p>';
  } catch (error) {
    return '<p>No users connected yet</p>';
  }
}

// Iniciar OAuth
app.get('/auth', (req, res) => {
  const userId = crypto.randomBytes(8).toString('hex');
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: userId, // Pasamos el userId en el state
  });

  res.redirect(authUrl);
});

// Callback de OAuth
app.get('/google/callback', async (req, res) => {
  const { code, error, state: userId } = req.query;
  
  if (error) {
    return res.send(generateErrorPage(error));
  }
  
  if (!userId) {
    return res.send(generateErrorPage('Invalid state parameter'));
  }

  try {
    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Guardar tokens con ID único
    const tokensData = {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      createdAt: new Date().toISOString(),
    };
    
    const userTokenFile = path.join(TOKENS_DIR, `${userId}.json`);
    fs.writeFileSync(userTokenFile, JSON.stringify(tokensData, null, 2));
    
    res.send(generateSuccessPage(userId, tokensData));
    
    console.log(`✅ New user authenticated: ${userId}`);
    
  } catch (error) {
    console.error('Token exchange error:', error);
    res.send(generateErrorPage(`Token exchange failed: ${error.message}`));
  }
});

// API endpoint para obtener tokens de un usuario
app.get('/api/tokens/:userId', (req, res) => {
  const { userId } = req.params;
  const userTokenFile = path.join(TOKENS_DIR, `${userId}.json`);
  
  if (fs.existsSync(userTokenFile)) {
    const tokens = JSON.parse(fs.readFileSync(userTokenFile, 'utf-8'));
    res.json(tokens);
  } else {
    res.status(404).json({ error: `No tokens found for user: ${userId}` });
  }
});

// API endpoint para listar usuarios activos
app.get('/api/users', (req, res) => {
  try {
    const users = fs.readdirSync(TOKENS_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const userId = file.replace('.json', '');
        const tokenData = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, file), 'utf8'));
        return {
          userId,
          createdAt: tokenData.createdAt,
          isExpired: tokenData.expiryDate && tokenData.expiryDate < Date.now()
        };
      });

    res.json({ users, count: users.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function generateSuccessPage(userId, tokens) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>✅ Connected Successfully!</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .success {
          background: white;
          padding: 3rem;
          border-radius: 15px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 600px;
          margin: 2rem;
        }
        h1 {
          color: #27ae60;
          margin-bottom: 2rem;
        }
        .user-id-section {
          background: #f8f9fa;
          padding: 2rem;
          border-radius: 10px;
          margin: 2rem 0;
          border-left: 4px solid #28a745;
        }
        .user-id {
          font-family: monospace;
          font-size: 24px;
          font-weight: bold;
          color: #495057;
          background: white;
          padding: 1rem;
          border-radius: 5px;
          border: 2px dashed #28a745;
          margin: 1rem 0;
          word-break: break-all;
        }
        .copy-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          margin-left: 1rem;
        }
        .copy-btn:hover {
          background: #218838;
        }
        .instructions {
          background: #fff3cd;
          color: #856404;
          padding: 1.5rem;
          border-radius: 8px;
          text-align: left;
          margin: 2rem 0;
        }
        .back-btn {
          background: #4285f4;
          color: white;
          padding: 1rem 2rem;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          margin-top: 2rem;
        }
        .back-btn:hover {
          background: #357ae8;
        }
      </style>
    </head>
    <body>
      <div class="success">
        <h1>🎉 Google Calendar Connected!</h1>
        
        <div class="user-id-section">
          <h3>📋 Your Unique User ID:</h3>
          <div class="user-id" id="userId">${userId}</div>
          <button class="copy-btn" onclick="copyUserId()">📋 Copy ID</button>
        </div>

        <div class="instructions">
          <h4>🚀 Next Steps:</h4>
          <ol>
            <li><strong>Save this User ID</strong> - you'll need it to use the agent</li>
            <li><strong>Share the ID</strong> with other testers or developers</li>
            <li><strong>Use it in the agent</strong> by providing it when asked for authentication</li>
          </ol>
          <p><strong>Note:</strong> This ID is unique to your Google account and allows the agent to access your calendar securely.</p>
        </div>

        <a href="/" class="back-btn">← Back to Main Page</a>
      </div>

      <script>
        function copyUserId() {
          const userIdElement = document.getElementById('userId');
          const userId = userIdElement.textContent;
          
          if (navigator.clipboard) {
            navigator.clipboard.writeText(userId).then(() => {
              alert('User ID copied to clipboard!');
            });
          } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = userId;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('User ID copied to clipboard!');
          }
        }
      </script>
    </body>
    </html>
  `;
}

function generateErrorPage(error) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>❌ Authorization Failed</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .error {
          background: white;
          padding: 3rem;
          border-radius: 15px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 500px;
        }
        h1 {
          color: #e74c3c;
        }
        .back-btn {
          background: #4285f4;
          color: white;
          padding: 1rem 2rem;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          margin-top: 2rem;
        }
      </style>
    </head>
    <body>
      <div class="error">
        <h1>❌ Authorization Failed</h1>
        <p><strong>Error:</strong> ${error}</p>
        <a href="/" class="back-btn">← Try Again</a>
      </div>
    </body>
    </html>
  `;
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Drifto Multi-User OAuth Server running at http://localhost:${PORT}`);
  console.log(`📋 Open http://localhost:${PORT} in your browser to get started`);
  console.log(`📁 User tokens will be saved in: ${TOKENS_DIR}`);
});