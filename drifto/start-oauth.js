#!/usr/bin/env node

/**
 * Script para iniciar el servidor OAuth de Google Calendar
 * Ejecutar con: node start-oauth.js
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Drifto OAuth Server...\n');

// Compilar TypeScript si es necesario
console.log('📦 Compiling TypeScript files...');
const tscProcess = spawn('npx', ['tsc', '--noEmit'], {
  cwd: __dirname,
  stdio: 'inherit'
});

tscProcess.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error('❌ TypeScript compilation failed');
    process.exit(1);
  }

  console.log('✅ TypeScript compilation successful\n');
  
  // Ejecutar el servidor OAuth con ts-node
  console.log('🔐 Starting OAuth server...\n');
  const serverPath = path.join(__dirname, 'src/mastra/auth/oauth-server.ts');
  
  const server = spawn('npx', ['ts-node', serverPath], {
    cwd: __dirname,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: process.env.PORT || '3000'
    }
  });

  server.on('error', (err) => {
    console.error('❌ Failed to start OAuth server:', err);
    process.exit(1);
  });

  server.on('close', (code) => {
    console.log(`\n🛑 OAuth server stopped with code ${code}`);
  });

  // Manejar cierre limpio
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down OAuth server...');
    server.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.kill();
    process.exit(0);
  });
});

console.log(`
═══════════════════════════════════════════════════════════════
  
  📋 Instructions:
  
  1. The OAuth server will start on http://localhost:3000
  2. Visit the URL in your browser
  3. Click "Connect Google Calendar"
  4. Authorize the application
  5. Tokens will be saved in .tokens.json
  
  ⚠️  Keep this server running while authorizing!
  
  Press Ctrl+C to stop the server when done.
  
═══════════════════════════════════════════════════════════════
`);