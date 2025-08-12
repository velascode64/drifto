import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// Interfaz para las credenciales OAuth completas
export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

// Interfaz para credenciales parciales (solo accessToken requerido)
export interface PartialOAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

// Cache de clientes OAuth para reutilizar conexiones
const clientCache = new Map<string, any>();

// Cargar credenciales desde el archivo client_secret.json
function loadCredentials() {
  // Usar ruta absoluta porque Mastra compila el código en .mastra/output/
  const credentialsPath = '/Users/gdesign/developer-projects/agents/drifto/drifto/client_secret_214679969940-bstkk1ksjp436gnmn75rtn7rqs6d1a7e.apps.googleusercontent.com.json';
  
  if (fs.existsSync(credentialsPath)) {
    const content = fs.readFileSync(credentialsPath, 'utf-8');
    const credentials = JSON.parse(content);
    return credentials.web;
  }
  
  // Fallback a variables de entorno si no existe el archivo
  return {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/google/callback']
  };
}

/**
 * Obtiene o crea un cliente OAuth2 para Google
 */
export function getOAuth2Client(credentials?: OAuthCredentials) {
  const defaultCreds = loadCredentials();
  
  const clientId = credentials?.clientId || defaultCreds.client_id;
  const clientSecret = credentials?.clientSecret || defaultCreds.client_secret;
  const redirectUri = credentials?.redirectUri || defaultCreds.redirect_uris[0];
  
  const cacheKey = `${clientId}:${clientSecret}`;
  
  // Reutilizar cliente existente si existe
  if (clientCache.has(cacheKey) && !credentials?.accessToken) {
    return clientCache.get(cacheKey)!;
  }
  
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  
  // Configurar tokens si se proporcionan
  if (credentials?.accessToken) {
    oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });
  }
  
  // Guardar en cache
  clientCache.set(cacheKey, oauth2Client);
  
  return oauth2Client;
}

/**
 * Obtiene el cliente de Google Calendar
 * Acepta credenciales parciales y usa valores por defecto del archivo client_secret
 */
export function getGoogleCalendarClient(credentials?: PartialOAuthCredentials) {
  const auth = getOAuth2Client(credentials);
  return google.calendar({ version: 'v3', auth });
}

/**
 * Genera URL de autorizaci�n para OAuth2
 */
export function getAuthUrl(scopes: string[] = ['https://www.googleapis.com/auth/calendar']): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Para obtener refresh token
    scope: scopes,
    prompt: 'consent', // Forzar consentimiento para obtener refresh token
  });
}

/**
 * Intercambia c�digo de autorizaci�n por tokens
 */
export async function getTokensFromCode(code: string): Promise<OAuthCredentials> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token || undefined,
  };
}

/**
 * Refresca el access token usando el refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token!;
}

/**
 * Verifica si un token es v�lido
 */
export async function verifyToken(accessToken: string): Promise<boolean> {
  try {
    const oauth2Client = getOAuth2Client();
    const tokenInfo = await oauth2Client.getTokenInfo(accessToken);
    return tokenInfo.scopes.includes('https://www.googleapis.com/auth/calendar');
  } catch {
    return false;
  }
}