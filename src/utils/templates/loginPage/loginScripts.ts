/**
 * Generate authentication JavaScript for login page
 * @param sessionKey - Session storage key
 * @returns JavaScript code as string
 */
export function generateLoginScript(sessionKey: string): string {
	return `
    const SESSION_KEY = '${sessionKey}';

    // Session Management
    const saveSession = (session) => {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session || {}));
      } catch (e) {
        console.error('Failed to save session:', e);
      }
    };

    // Error Handling
    const showError = (message) => {
      const errorBox = document.getElementById('login-error');
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.classList.remove('hidden');
      }
    };

    const hideError = () => {
      const errorBox = document.getElementById('login-error');
      if (errorBox) {
        errorBox.classList.add('hidden');
      }
    };

    // State Management
    let partialToken = '';
    let currentUsername = '';
    document.getElementById('btn-login')?.addEventListener('click', async () => {
      hideError();

      const username = document.getElementById('login-username')?.value.trim();
      const password = document.getElementById('login-password')?.value.trim();

      if (!username || !password) {
        showError('Please enter both username and password.');
        return;
      }

      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          showError(data.error || 'Login failed. Please check your credentials.');
          return;
        }

        // Check if 2FA is required
        if (data.requires2FA) {
          partialToken = data.partialToken;
          currentUsername = username;

          // Switch to 2FA step
          document.getElementById('step-password')?.classList.add('hidden');
          document.getElementById('step-2fa')?.classList.remove('hidden');
          document.getElementById('login-totp')?.focus();
          return;
        }

        // No 2FA required - save tokens and redirect
        saveSession({
          url: window.location.origin,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + (data.expiresIn || 900) * 1000,
          user: data.user || { username },
        });

        window.location.href = '/';
      } catch (error) {
        console.error('Login error:', error);
        showError('Unable to connect to server. Please try again.');
      }
    });

    // Handle Enter key for password input
    document.getElementById('login-password')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-login')?.click();
      }
    });

    // Step 2: 2FA Verification
    document.getElementById('btn-2fa')?.addEventListener('click', async () => {
      hideError();

      const totpCode = document.getElementById('login-totp')?.value.trim();
      const recoveryCode = document.getElementById('login-recovery')?.value.trim();

      if (!partialToken) {
        showError('Session expired. Please log in again.');
        return;
      }

      if (!totpCode && !recoveryCode) {
        showError('Please enter either a TOTP code or recovery code.');
        return;
      }

      try {
        const response = await fetch('/auth/2fa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partialToken,
            code: totpCode,
            recoveryCode: recoveryCode || undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showError(data.error || '2FA verification failed. Please try again.');
          return;
        }

        // Save tokens and redirect
        saveSession({
          url: window.location.origin,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + (data.expiresIn || 900) * 1000,
          user: data.user || { username: currentUsername },
        });

        window.location.href = '/';
      } catch (error) {
        console.error('2FA verification error:', error);
        showError('Unable to verify 2FA. Please try again.');
      }
    });

    // Handle Enter key for TOTP input
    document.getElementById('login-totp')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-2fa')?.click();
      }
    });

    // Back to login button
    document.getElementById('btn-back')?.addEventListener('click', () => {
      partialToken = '';
      currentUsername = '';
      document.getElementById('step-2fa')?.classList.add('hidden');
      document.getElementById('step-password')?.classList.remove('hidden');
      document.getElementById('login-totp').value = '';
      document.getElementById('login-recovery').value = '';
      hideError();
    });

    // Step 3: WebAuthn Passkey Login
    document.getElementById('btn-passkey')?.addEventListener('click', async () => {
      hideError();

      const username = document.getElementById('login-username')?.value.trim();

      if (!username) {
        showError('Please enter your username to use Passkey authentication.');
        return;
      }

      try {
        // Start passkey authentication
        const startResponse = await fetch('/auth/passkey/authenticate/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });

        const startData = await startResponse.json();

        if (!startResponse.ok) {
          showError(startData.error || 'Failed to initialize Passkey authentication.');
          return;
        }

        // Prepare credential request options
        const options = startData.options;

        // Decode challenge from base64
        options.challenge = Uint8Array.from(atob(options.challenge), c => c.charCodeAt(0));

        // Decode credential IDs if present
        if (options.allowCredentials) {
          options.allowCredentials = options.allowCredentials.map(cred => ({
            ...cred,
            id: Uint8Array.from(
              atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')),
              c => c.charCodeAt(0)
            ),
          }));
        }

        // Request credential from browser
        const credential = await navigator.credentials.get({ publicKey: options });

        if (!credential) {
          showError('Passkey authentication was cancelled.');
          return;
        }

        // Encode credential response
        const credentialData = {
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          type: credential.type,
          response: {
            authenticatorData: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData))),
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
            signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature))),
            userHandle: credential.response.userHandle
              ? btoa(String.fromCharCode(...new Uint8Array(credential.response.userHandle)))
              : null,
          },
          clientExtensionResults: credential.getClientExtensionResults(),
        };

        // Finish passkey authentication
        const finishResponse = await fetch('/auth/passkey/authenticate/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential: credentialData,
            challengeId: startData.challengeId,
          }),
        });

        const finishData = await finishResponse.json();

        if (!finishResponse.ok) {
          showError(finishData.error || 'Passkey authentication failed.');
          return;
        }

        // Save tokens and redirect
        saveSession({
          url: window.location.origin,
          accessToken: finishData.accessToken,
          refreshToken: finishData.refreshToken,
          expiresAt: Date.now() + (finishData.expiresIn || 900) * 1000,
          user: finishData.user || { username },
        });

        window.location.href = '/';
      } catch (error) {
        console.error('Passkey error:', error);

        if (error.name === 'NotAllowedError') {
          showError('Passkey authentication was cancelled or not allowed.');
        } else if (error.name === 'NotSupportedError') {
          showError('Passkey authentication is not supported by your browser.');
        } else {
          showError('Passkey authentication failed. Please try another method.');
        }
      }
    });

    // Focus username field on load
  `;
}
