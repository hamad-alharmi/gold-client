/**
 * Gold Client — Microsoft / Xbox Live / Minecraft OAuth Flow
 *
 * Full authentication chain:
 *   1. Open browser window → user logs in to Microsoft
 *   2. Capture auth code from redirect
 *   3. Exchange code for MS access + refresh tokens
 *   4. Get Xbox Live (XBL) token
 *   5. Get XSTS token
 *   6. Get Minecraft access token
 *   7. Fetch Minecraft profile (username + UUID)
 *
 * Uses the public Xbox client ID (same as used by Prism Launcher,
 * MultiMC and many other community launchers).
 *
 * If you want your own Azure AD app:
 *   https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app
 */

const { BrowserWindow } = require('electron');
const fetch  = require('node-fetch');
const logger = require('../../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────
const MSA_CLIENT_ID  = '00000000402b5328';   // Xbox public client ID
const MSA_REDIRECT   = 'https://login.live.com/oauth20_desktop.srf';
const MSA_SCOPE      = 'XboxLive.signin offline_access';

const URLS = {
  authorize:  'https://login.live.com/oauth20_authorize.srf',
  token:      'https://login.live.com/oauth20_token.srf',
  xbl:        'https://user.auth.xboxlive.com/user/authenticate',
  xsts:       'https://xsts.auth.xboxlive.com/xsts/authorize',
  mcAuth:     'https://api.minecraftservices.com/authentication/login_with_xbox',
  mcEntitle:  'https://api.minecraftservices.com/entitlements/mcstore',
  mcProfile:  'https://api.minecraftservices.com/minecraft/profile',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full Microsoft → Minecraft authentication flow.
 * Opens an Electron BrowserWindow for the user to log in.
 *
 * @param {BrowserWindow} parentWindow - the main app window
 * @returns {Promise<object>} auth profile to store in electron-store
 */
async function loginWithMicrosoft(parentWindow) {
  const code = await openOAuthWindow(parentWindow);
  logger.info('Got MS auth code, exchanging for tokens...');

  const profile = await exchangeCodeForProfile(code);
  logger.info(`MS auth success: ${profile.username} (${profile.uuid})`);
  return profile;
}

/**
 * Refresh a Microsoft session using a stored refresh token.
 *
 * @param {string} refreshToken
 * @returns {Promise<object>} updated auth profile
 */
async function refreshMicrosoftSession(refreshToken) {
  logger.info('Refreshing Microsoft session...');

  const msToken = await refreshAccessToken(refreshToken);
  const profile = await msTokenToMinecraft(msToken.access_token, msToken.refresh_token);

  logger.info(`MS session refreshed for ${profile.username}`);
  return profile;
}

// ── OAuth Window ──────────────────────────────────────────────────────────────

/**
 * Open the Microsoft OAuth window and wait for the user to authenticate.
 * Resolves with the authorization code, rejects if the user closes the window.
 *
 * @param {BrowserWindow} parentWindow
 * @returns {Promise<string>} the authorization code
 */
function openOAuthWindow(parentWindow) {
  return new Promise((resolve, reject) => {
    const authUrl = buildAuthUrl();

    const authWin = new BrowserWindow({
      width:  520,
      height: 620,
      parent: parentWindow || undefined,
      modal:  !!parentWindow,
      show:   true,
      title:  'Sign in with Microsoft',
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        // Allow navigating to MS domains
        sandbox: true,
      },
    });

    // Remove the menu bar from the auth window
    authWin.setMenuBarVisibility(false);

    authWin.loadURL(authUrl);

    let resolved = false;

    function handleRedirect(url) {
      if (resolved) return;
      if (!url.startsWith(MSA_REDIRECT)) return;

      resolved = true;

      try {
        const parsed = new URL(url);
        const code   = parsed.searchParams.get('code');
        const error  = parsed.searchParams.get('error');
        const errDesc = parsed.searchParams.get('error_description');

        // Close the window
        if (!authWin.isDestroyed()) authWin.destroy();

        if (error) {
          reject(new Error(`Microsoft auth error: ${errDesc || error}`));
          return;
        }
        if (!code) {
          reject(new Error('No authorization code received from Microsoft.'));
          return;
        }

        resolve(code);
      } catch (err) {
        if (!authWin.isDestroyed()) authWin.destroy();
        reject(err);
      }
    }

    // Catch the redirect before it actually loads (more reliable)
    authWin.webContents.on('will-redirect', (_, url) => handleRedirect(url));
    // Also catch it after navigate (fallback)
    authWin.webContents.on('did-navigate', (_, url) => handleRedirect(url));

    authWin.on('closed', () => {
      if (!resolved) {
        reject(new Error('Microsoft authentication was cancelled.'));
      }
    });
  });
}

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id:     MSA_CLIENT_ID,
    response_type: 'code',
    redirect_uri:  MSA_REDIRECT,
    scope:         MSA_SCOPE,
    prompt:        'select_account',
  });
  return `${URLS.authorize}?${params.toString()}`;
}

// ── Token Exchange Chain ──────────────────────────────────────────────────────

async function exchangeCodeForProfile(code) {
  // Step 1: Exchange auth code for MS access + refresh tokens
  const msToken = await fetchMSToken({ code });
  return msTokenToMinecraft(msToken.access_token, msToken.refresh_token);
}

async function msTokenToMinecraft(msAccessToken, msRefreshToken) {
  // Step 2: Get Xbox Live (XBL) token
  const xbl = await fetchXBLToken(msAccessToken);

  // Step 3: Get XSTS token
  const xsts = await fetchXSTSToken(xbl.Token);

  const uhs = xsts.DisplayClaims?.xui?.[0]?.uhs;
  if (!uhs) throw new Error('Failed to get Xbox user hash from XSTS response.');

  // Step 4: Get Minecraft access token
  const mc = await fetchMCToken(uhs, xsts.Token);

  // Step 5: Verify the account owns Minecraft (optional but good practice)
  await verifyOwnership(mc.access_token);

  // Step 6: Get Minecraft profile
  const profile = await fetchMCProfile(mc.access_token);

  return {
    type:         'microsoft',
    username:     profile.name,
    uuid:         profile.id,
    accessToken:  mc.access_token,
    refreshToken: msRefreshToken,
    expiresAt:    Date.now() + (mc.expires_in || 86400) * 1000,
    clientToken:  '',
  };
}

// ── Individual API calls ──────────────────────────────────────────────────────

async function fetchMSToken({ code, refreshToken } = {}) {
  const body = new URLSearchParams({ client_id: MSA_CLIENT_ID, redirect_uri: MSA_REDIRECT });

  if (code) {
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
  } else if (refreshToken) {
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', refreshToken);
  } else {
    throw new Error('fetchMSToken: need either code or refreshToken');
  }

  const res  = await fetch(URLS.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = await res.json();

  if (data.error) throw new Error(`MS token error: ${data.error_description || data.error}`);
  if (!data.access_token) throw new Error('MS token response missing access_token');

  return data; // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  return fetchMSToken({ refreshToken });
}

async function fetchXBLToken(msAccessToken) {
  const res  = await fetch(URLS.xbl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName:   'user.auth.xboxlive.com',
        RpsTicket:  `d=${msAccessToken}`,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType:    'JWT',
    }),
  });

  const data = await res.json();
  if (!data.Token) throw new Error('XBL token exchange failed — missing Token in response.');
  return data;
}

async function fetchXSTSToken(xblToken) {
  const res  = await fetch(URLS.xsts, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify({
      Properties: {
        SandboxId:  'RETAIL',
        UserTokens: [xblToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType:    'JWT',
    }),
  });

  const data = await res.json();

  // Handle XSTS error codes
  if (data.XErr) {
    const xstsErrors = {
      2148916233: 'This Microsoft account does not have an Xbox profile. Create one at xbox.com.',
      2148916235: 'Xbox Live is not available in your country or region.',
      2148916236: 'This account needs adult verification on Xbox (South Korea).',
      2148916237: 'This account needs adult verification on Xbox (South Korea).',
      2148916238: 'This is a child account. Add it to a family to play Minecraft.',
    };
    const friendlyMsg = xstsErrors[data.XErr] || `XSTS error code ${data.XErr}: ${data.Message || 'Unknown error'}`;
    throw new Error(friendlyMsg);
  }

  if (!data.Token) throw new Error('XSTS token exchange failed — missing Token.');
  return data;
}

async function fetchMCToken(uhs, xstsToken) {
  const res  = await fetch(URLS.mcAuth, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Minecraft token exchange failed — missing access_token.');
  return data;
}

async function verifyOwnership(mcAccessToken) {
  try {
    const res  = await fetch(URLS.mcEntitle, {
      headers: { Authorization: `Bearer ${mcAccessToken}` },
    });
    const data = await res.json();
    const hasGame = data.items?.some(
      (item) => item.name === 'game_minecraft' || item.name === 'product_minecraft'
    );
    if (data.items && !hasGame) {
      logger.warn('This Microsoft account may not own Minecraft Java Edition.');
      // Don't throw — let it try to launch; MCLC will fail at auth if truly invalid
    }
  } catch (err) {
    logger.warn(`Could not verify Minecraft ownership: ${err.message}`);
    // Non-fatal — proceed anyway
  }
}

async function fetchMCProfile(mcAccessToken) {
  const res  = await fetch(URLS.mcProfile, {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });
  const data = await res.json();

  if (data.error === 'NOT_FOUND' || !data.id) {
    throw new Error('This Microsoft account does not have a Minecraft profile. Have you purchased Minecraft Java Edition?');
  }
  if (!data.name) {
    throw new Error('Could not fetch Minecraft profile — account may not own the game.');
  }

  return data; // { id: uuid, name: username, skins: [...] }
}

module.exports = { loginWithMicrosoft, refreshMicrosoftSession };
