import * as fs from 'fs';
import * as path from 'path';
import { OAuthCredentials } from './googleClient';

// Usar ruta absoluta hardcodeada para garantizar que siempre encuentre los tokens
// Esto es necesario porque Mastra compila los archivos en .mastra/output/
const PROJECT_ROOT = '/Users/gdesign/developer-projects/agents/drifto/drifto';
const TOKENS_FILE = path.join(PROJECT_ROOT, '.tokens.json');
const USER_TOKENS_DIR = path.join(PROJECT_ROOT, 'user-tokens');

export interface StoredTokens {
  userId?: string;
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  createdAt?: string;
}

/**
 * Cargar tokens de un usuario específico desde user-tokens/{userId}.json
 */
export function loadUserTokens(userId: string): OAuthCredentials | null {
  try {
    const userTokenFile = path.join(USER_TOKENS_DIR, `${userId}.json`);
    
    if (!fs.existsSync(userTokenFile)) {
      console.warn(`⚠️  No tokens found for user: ${userId}`);
      return null;
    }

    const content = fs.readFileSync(userTokenFile, 'utf-8');
    const tokens: StoredTokens = JSON.parse(content);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (error) {
    console.error(`❌ Error loading tokens for user ${userId}:`, error);
    return null;
  }
}

/**
 * Cargar tokens guardados desde .tokens.json (legacy para compatibilidad)
 */
export function loadStoredTokens(): OAuthCredentials | null {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      console.warn('⚠️  No legacy tokens file found. Use loadUserTokens(userId) or run multi-user OAuth flow.');
      return null;
    }

    const content = fs.readFileSync(TOKENS_FILE, 'utf-8');
    const tokens: StoredTokens = JSON.parse(content);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (error) {
    console.error('❌ Error loading legacy tokens:', error);
    return null;
  }
}

/**
 * Guardar tokens en .tokens.json (legacy)
 */
export function saveTokens(tokens: StoredTokens): void {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    console.log('✅ Legacy tokens saved successfully');
  } catch (error) {
    console.error('❌ Error saving legacy tokens:', error);
  }
}

/**
 * Guardar tokens de usuario específico
 */
export function saveUserTokens(userId: string, tokens: StoredTokens): void {
  try {
    // Crear directorio si no existe
    if (!fs.existsSync(USER_TOKENS_DIR)) {
      fs.mkdirSync(USER_TOKENS_DIR, { recursive: true });
    }

    const userTokenFile = path.join(USER_TOKENS_DIR, `${userId}.json`);
    const tokensWithUserId = { ...tokens, userId };
    
    fs.writeFileSync(userTokenFile, JSON.stringify(tokensWithUserId, null, 2));
    console.log(`✅ Tokens saved for user: ${userId}`);
  } catch (error) {
    console.error(`❌ Error saving tokens for user ${userId}:`, error);
  }
}

/**
 * Verificar si los tokens de un usuario existen y son válidos
 */
export function hasValidUserTokens(userId: string): boolean {
  const tokens = loadUserTokens(userId);
  return tokens !== null && !!tokens.accessToken;
}

/**
 * Verificar si los tokens legacy existen y son válidos
 */
export function hasValidTokens(): boolean {
  const tokens = loadStoredTokens();
  return tokens !== null && !!tokens.accessToken;
}

/**
 * Listar todos los usuarios con tokens activos
 */
export function listActiveUsers(): string[] {
  try {
    if (!fs.existsSync(USER_TOKENS_DIR)) {
      return [];
    }

    return fs.readdirSync(USER_TOKENS_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(userId => hasValidUserTokens(userId));
  } catch (error) {
    console.error('❌ Error listing users:', error);
    return [];
  }
}