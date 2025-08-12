import express from 'express';
import { getAuthUrl, getTokensFromCode } from '../lib/googleClient';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Archivo para guardar tokens (en producción usar base de datos)
const TOKENS_FILE = path.join(process.cwd(), '.tokens.json');

// Middleware
app.use(express.json());

// Página de inicio con botón para autorizar
app.get('/', (req, res) => {
  const authUrl = getAuthUrl();
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Drifto - Google Calendar Authorization</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
        }
        h1 {
          color: #333;
          margin-bottom: 1rem;
        }
        p {
          color: #666;
          margin-bottom: 2rem;
        }
        .auth-button {
          display: inline-block;
          background: #4285f4;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 500;
          transition: background 0.3s;
        }
        .auth-button:hover {
          background: #357ae8;
        }
        .status {
          margin-top: 2rem;
          padding: 1rem;
          border-radius: 5px;
          background: #f0f0f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🗓️ Drifto Calendar Setup</h1>
        <p>Connect your Google Calendar to enable smart scheduling features</p>
        <a href="${authUrl}" class="auth-button">Connect Google Calendar</a>
        ${fs.existsSync(TOKENS_FILE) ? `
          <div class="status">
            ✅ Already connected! You can re-authorize if needed.
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `);
});

// Callback de OAuth
app.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .error {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #e74c3c;
          }
          a {
            color: #4285f4;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Authorization Failed</h1>
          <p>Error: ${error}</p>
          <a href="/">Try again</a>
        </div>
      </body>
      </html>
    `);
  }
  
  try {
    const tokens = await getTokensFromCode(code as string);
    
    // Guardar tokens en archivo (en producción usar base de datos)
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .success {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
          }
          h1 {
            color: #27ae60;
            margin-bottom: 1rem;
          }
          .token-info {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
            font-family: monospace;
            font-size: 0.9rem;
            word-break: break-all;
          }
          .warning {
            background: #fff3cd;
            color: #856404;
            padding: 0.75rem;
            border-radius: 5px;
            margin-top: 1rem;
            font-size: 0.9rem;
          }
          .next-steps {
            margin-top: 2rem;
            text-align: left;
          }
          .next-steps h3 {
            color: #333;
          }
          .next-steps li {
            margin: 0.5rem 0;
          }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Successfully Connected!</h1>
          <p>Your Google Calendar has been connected to Drifto.</p>
          
          <div class="token-info">
            <strong>Access Token:</strong> ${tokens.accessToken.substring(0, 20)}...
            ${tokens.refreshToken ? `<br><strong>Refresh Token:</strong> ${tokens.refreshToken.substring(0, 20)}...` : ''}
          </div>
          
          <div class="warning">
            ⚠️ Save these tokens securely. They're also stored in .tokens.json
          </div>
          
          <div class="next-steps">
            <h3>Next Steps:</h3>
            <ol>
              <li>The agent can now access your Google Calendar</li>
              <li>Use the calendar tools to create, update, and manage events</li>
              <li>The refresh token will be used to keep access active</li>
            </ol>
          </div>
          
          <p style="margin-top: 2rem;">
            <a href="/" style="color: #4285f4;">Back to Home</a>
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .error {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #e74c3c;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Token Exchange Failed</h1>
          <p>${error}</p>
          <a href="/" style="color: #4285f4;">Try again</a>
        </div>
      </body>
      </html>
    `);
  }
});

// API endpoint para obtener tokens guardados
app.get('/api/tokens', (req, res) => {
  if (fs.existsSync(TOKENS_FILE)) {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
    res.json(tokens);
  } else {
    res.status(404).json({ error: 'No tokens found. Please authorize first.' });
  }
});

// API endpoint para verificar estado
app.get('/api/status', (req, res) => {
  const hasTokens = fs.existsSync(TOKENS_FILE);
  res.json({ 
    connected: hasTokens,
    message: hasTokens ? 'Google Calendar connected' : 'Not connected'
  });
});

// Iniciar servidor
export function startOAuthServer() {
  app.listen(PORT, () => {
    console.log(`🚀 OAuth server running at http://localhost:${PORT}`);
    console.log(`📋 Visit http://localhost:${PORT} to authorize Google Calendar access`);
  });
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  startOAuthServer();
}