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
  const nonce = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64UrlEncode(sha256Bytes(codeVerifier));

  sessionStorage.setItem('oidc_nonce', nonce);
  sessionStorage.setItem('oidc_code_verifier', codeVerifier);

  const initiateUrl = new URL(`${OIDC_CONFIG.issuer}/api/idp/initiate`);
  initiateUrl.searchParams.set('x-blocks-key', OIDC_CONFIG.tenant_id);
  initiateUrl.searchParams.set('clientId', OIDC_CONFIG.client_id);
  initiateUrl.searchParams.set('redirectUri', OIDC_CONFIG.redirect_uri);

  try {
    const response = await fetch(initiateUrl.toString(), {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'x-blocks-key': OIDC_CONFIG.tenant_id,
      },
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      const authUrl = data?.authorizationUrl || data?.url || data?.authorization_url || data?.redirectUrl;
      if (authUrl) {
        let state: string | null = null;
        try {
          state = new URL(authUrl).searchParams.get('state');
        } catch {
          /* ignore */
        }
        if (!state) {
          state =
            (data as Record<string, unknown> | null)?.state as string ??
            (data as Record<string, unknown> | null)?.sessionState as string ??
            (data as Record<string, unknown> | null)?.session_state as string ??
            null;
        }
        if (state) {
          sessionStorage.setItem('oidc_state', state);
        }
        sessionStorage.setItem('oidc_flow', 'idp');
        window.location.href = authUrl;
        return;
      }
    }
  } catch (error) {
    console.warn('IDP initiate call failed, falling back to direct authorize:', error);
  }

  const state = generateRandomString(32);
  sessionStorage.setItem('oidc_state', state);
  sessionStorage.setItem('oidc_flow', 'oidc');

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

  window.location.href = `${OIDC_CONFIG.issuer}/api/oidc/authorize?${params.toString()}`;
}

interface IDPCallbackResponse {
  refresh_token?: string;
  refreshToken?: string;
  id_token?: string;
  idToken?: string;
  access_token?: string;
  accessToken?: string;
  expires_in?: number;
  expiresIn?: number;
  [key: string]: unknown;
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
  if (state !== savedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  const flowType = sessionStorage.getItem('oidc_flow') ?? 'idp';
  const codeVerifier = sessionStorage.getItem('oidc_code_verifier');

  sessionStorage.removeItem('oidc_state');
  sessionStorage.removeItem('oidc_nonce');
  sessionStorage.removeItem('oidc_code_verifier');
  sessionStorage.removeItem('oidc_flow');

  const tokenUrl = `${OIDC_CONFIG.issuer}/api/oidc/token?tenant_id=${OIDC_CONFIG.tenant_id}`;
  const basicAuth = btoa(`${OIDC_CONFIG.client_id}:${OIDC_CONFIG.client_secret}`);

  if (flowType === 'idp') {
    const callbackUrl = `${OIDC_CONFIG.issuer}/api/idp/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

    const callbackResponse = await fetch(callbackUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        accept: '*/*',
        'x-blocks-key': OIDC_CONFIG.tenant_id,
      },
    });

    if (!callbackResponse.ok) {
      const errorText = await callbackResponse.text().catch(() => '');
      throw new Error(`IDP callback failed: ${errorText || callbackResponse.statusText}`);
    }

    const callbackData: IDPCallbackResponse = await callbackResponse.json().catch(() => ({} as IDPCallbackResponse));

    const refreshToken = callbackData.refresh_token ?? callbackData.refreshToken ?? null;
    const idToken = callbackData.id_token ?? callbackData.idToken ?? null;

    if (!refreshToken) {
      throw new Error('No refresh token returned from IDP callback');
    }
    if (idToken) {
      localStorage.setItem('id_token', idToken);
    }

    const refreshResponse = await fetch(tokenUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${basicAuth}`,
        'x-blocks-key': OIDC_CONFIG.tenant_id,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: OIDC_CONFIG.client_id,
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text().catch(() => '');
      throw new Error(`Token exchange failed: ${errorText || refreshResponse.statusText}`);
    }

    const tokens: TokenResponse = await refreshResponse.json();

    if (tokens.access_token) localStorage.setItem('access_token', tokens.access_token);
    if (tokens.id_token) localStorage.setItem('id_token', tokens.id_token);
    if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token);
    if (tokens.expires_in) localStorage.setItem('token_expiry', String(Date.now() + tokens.expires_in * 1000));
    localStorage.setItem('auth_completed', '1');

    return tokens;
  }

  // OIDC authorize fallback: exchange authorization code directly
  const tokenBody: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: OIDC_CONFIG.redirect_uri,
    client_id: OIDC_CONFIG.client_id,
  };
  if (codeVerifier) {
    tokenBody['code_verifier'] = codeVerifier;
  }

  const codeResponse = await fetch(tokenUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`,
      'x-blocks-key': OIDC_CONFIG.tenant_id,
    },
    body: new URLSearchParams(tokenBody),
  });

  if (!codeResponse.ok) {
    const errorText = await codeResponse.text().catch(() => '');
    throw new Error(`Token exchange failed: ${errorText || codeResponse.statusText}`);
  }

  const tokens: TokenResponse = await codeResponse.json();

  if (tokens.access_token) localStorage.setItem('access_token', tokens.access_token);
  if (tokens.id_token) localStorage.setItem('id_token', tokens.id_token);
  if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token);
  if (tokens.expires_in) localStorage.setItem('token_expiry', String(Date.now() + tokens.expires_in * 1000));
  localStorage.setItem('auth_completed', '1');

  return tokens;
}

export async function getUserInfo(): Promise<OIDCUserInfo | null> {
  const userInfoUrl = `${OIDC_CONFIG.issuer}/api/auth/me?tenant_id=${OIDC_CONFIG.tenant_id}`;

  try {
    const response = await fetch(userInfoUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
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
      credentials: 'include',
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

export async function logout(): Promise<void> {
  const idToken = localStorage.getItem('id_token');
  const revokeUrl = `${OIDC_CONFIG.issuer}/api/oidc/revoke?tenant_id=${OIDC_CONFIG.tenant_id}`;
  const basicAuth = btoa(`${OIDC_CONFIG.client_id}:${OIDC_CONFIG.client_secret}`);

  if (idToken) {
    try {
      await fetch(revokeUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
          'x-blocks-key': OIDC_CONFIG.tenant_id,
        },
        body: new URLSearchParams({
          token: idToken,
          token_type_hint: 'id_token',
          client_id: OIDC_CONFIG.client_id,
        }),
      });
    } catch (error) {
      console.warn('Token revocation failed:', error);
    }
  }

  localStorage.removeItem('access_token');
  localStorage.removeItem('id_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('token_expiry');
  localStorage.removeItem('auth_completed');
  sessionStorage.removeItem('oidc_state');
  sessionStorage.removeItem('oidc_nonce');
  sessionStorage.removeItem('oidc_code_verifier');

  window.location.href = '/';
}

export function isAuthenticated(): boolean {
  if (localStorage.getItem('auth_completed') !== '1') return false;
  const expiry = localStorage.getItem('token_expiry');
  if (!expiry) return true; // cookie-based session — trust until getUserInfo fails
  return Date.now() < parseInt(expiry, 10);
}

export function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}
