import * as fs from 'fs';
import * as path from 'path';
import { OAuthCredentials } from './googleClient';

const TOKENS_FILE = path.join(process.cwd(), '.tokens.json');

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

/**
 * Cargar tokens guardados desde .tokens.json
 */
export function loadStoredTokens(): OAuthCredentials | null {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      console.warn('⚠️  No tokens file found. Run OAuth flow first.');
      return null;
    }

    const content = fs.readFileSync(TOKENS_FILE, 'utf-8');
    const tokens: StoredTokens = JSON.parse(content);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (error) {
    console.error('❌ Error loading tokens:', error);
    return null;
  }
}

/**
 * Guardar tokens en .tokens.json
 */
export function saveTokens(tokens: StoredTokens): void {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    console.log('✅ Tokens saved successfully');
  } catch (error) {
    console.error('❌ Error saving tokens:', error);
  }
}

/**
 * Verificar si los tokens existen y son válidos
 */
export function hasValidTokens(): boolean {
  const tokens = loadStoredTokens();
  return tokens !== null && !!tokens.accessToken;
}