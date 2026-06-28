import { sha256 } from 'js-sha256';

const OIDC_CONFIG = {
  issuer: import.meta.env.VITE_API_URL || 'https://dev-iam.blocksdevelopers.com',
  tenant_id: import.meta.env.VITE_TENANT_ID || '',
  client_id: import.meta.env.VITE_CLIENT_ID || '',
  client_secret: import.meta.env.VITE_CLIENT_SECRET || '',
  redirect_uri: import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}/auth/callback`,
  scope: 'openid profile email',
};

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

function sha256Bytes(input: string): Uint8Array {
  const hashHex = sha256(input);
  const bytes = new Uint8Array(hashHex.length / 2);
  for (let i = 0; i < hashHex.length; i += 2) {
    bytes[i / 2] = parseInt(hashHex.substr(i, 2), 16);
  }
  return bytes;
}

export interface OIDCUserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export async function startAuthorization(): Promise<void> {
  const state = generateRandomString(32);
  const nonce = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64UrlEncode(sha256Bytes(codeVerifier));

  sessionStorage.setItem('oidc_state', state);
  sessionStorage.setItem('oidc_nonce', nonce);
  sessionStorage.setItem('oidc_code_verifier', codeVerifier);

  const initiateUrl = new URL(`${OIDC_CONFIG.issuer}/api/idp/initiate`);
  initiateUrl.searchParams.set('x-blocks-key', OIDC_CONFIG.tenant_id);
  initiateUrl.searchParams.set('clientId', OIDC_CONFIG.client_id);
  initiateUrl.searchParams.set('redirectUri', OIDC_CONFIG.redirect_uri);

  const params = new URLSearchParams({
    client_id: OIDC_CONFIG.client_id,
    response_type: 'code',
    redirect_uri: OIDC_CONFIG.redirect_uri,
    scope: OIDC_CONFIG.scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    tenant_id: OIDC_CONFIG.tenant_id,
  });

  const oidcAuthUrl = `${OIDC_CONFIG.issuer}/api/oidc/authorize?${params.toString()}`;

  try {
    const response = await fetch(initiateUrl.toString(), {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'origin': window.location.origin,
        'referer': window.location.origin + '/',
        'x-blocks-key': OIDC_CONFIG.tenant_id,
      },
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data?.authorizationUrl || data?.url || data?.authorization_url) {
        window.location.href = data.authorizationUrl || data.url || data.authorization_url;
        return;
      }
    }
  } catch (error) {
    console.warn('IDP initiate call failed, falling back to direct authorize:', error);
  }

  window.location.href = oidcAuthUrl;
}

export async function handleAuthorizationCallback(): Promise<TokenResponse | null> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');

  if (error) {
    throw new Error(errorDescription || error);
  }

  if (!code || !state) {
    throw new Error('Missing code or state');
  }

  const savedState = sessionStorage.getItem('oidc_state');
  const codeVerifier = sessionStorage.getItem('oidc_code_verifier');

  if (state !== savedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  if (!codeVerifier) {
    throw new Error('Missing code verifier');
  }

  sessionStorage.removeItem('oidc_state');
  sessionStorage.removeItem('oidc_nonce');
  sessionStorage.removeItem('oidc_code_verifier');

  const tokenUrl = `${OIDC_CONFIG.issuer}/api/oidc/token?tenant_id=${OIDC_CONFIG.tenant_id}`;
  
  const basicAuth = btoa(`${OIDC_CONFIG.client_id}:${OIDC_CONFIG.client_secret}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': `Basic ${basicAuth}`,
      'x-blocks-key': OIDC_CONFIG.tenant_id,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: OIDC_CONFIG.redirect_uri,
      code_verifier: codeVerifier,
      client_id: OIDC_CONFIG.client_id,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const tokens: TokenResponse = await response.json();

  localStorage.setItem('access_token', tokens.access_token);
  if (tokens.id_token) localStorage.setItem('id_token', tokens.id_token);
  if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token);
  localStorage.setItem('token_expiry', String(Date.now() + tokens.expires_in * 1000));

  return tokens;
}

export async function getUserInfo(): Promise<OIDCUserInfo | null> {
  const accessToken = localStorage.getItem('access_token');
  if (!accessToken) return null;

  const userInfoUrl = `${OIDC_CONFIG.issuer}/api/auth/me?tenant_id=${OIDC_CONFIG.tenant_id}`;
  
  try {
    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'x-blocks-key': OIDC_CONFIG.tenant_id,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return await response.json();
  } catch (error) {
    console.error('UserInfo error:', error);
    return null;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;

  const tokenUrl = `${OIDC_CONFIG.issuer}/api/oidc/token?tenant_id=${OIDC_CONFIG.tenant_id}`;
  const basicAuth = btoa(`${OIDC_CONFIG.client_id}:${OIDC_CONFIG.client_secret}`);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
        'x-blocks-key': OIDC_CONFIG.tenant_id,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: OIDC_CONFIG.client_id,
      }),
    });

    if (!response.ok) return false;

    const tokens: TokenResponse = await response.json();
    localStorage.setItem('access_token', tokens.access_token);
    if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token);
    localStorage.setItem('token_expiry', String(Date.now() + tokens.expires_in * 1000));
    return true;
  } catch {
    return false;
  }
}

export function logout(): void {
  const idToken = localStorage.getItem('id_token');
  const params = new URLSearchParams({
    client_id: OIDC_CONFIG.client_id,
    post_logout_redirect_uri: window.location.origin,
  });
  if (idToken) params.append('id_token_hint', idToken);

  localStorage.removeItem('access_token');
  localStorage.removeItem('id_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('token_expiry');

  window.location.href = `${OIDC_CONFIG.issuer}/api/oidc/logout?tenant_id=${OIDC_CONFIG.tenant_id}&${params.toString()}`;
}

export function isAuthenticated(): boolean {
  const expiry = localStorage.getItem('token_expiry');
  if (!expiry) return false;
  return Date.now() < parseInt(expiry, 10);
}

export function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}
