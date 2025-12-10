# CFr2-webdav Security Setup Guide

This guide will help you set up the Stage 1 security features for CFr2-webdav.

## Prerequisites

1. Cloudflare account with R2 enabled
2. `wrangler` CLI installed and configured
3. Node.js and npm installed

## Step 1: Create KV Namespaces

Create two KV namespaces for rate limiting and storage quota tracking:

```bash
# Create rate limiting KV namespace
wrangler kv:namespace create "RATE_LIMIT_KV"

# Create storage quota KV namespace
wrangler kv:namespace create "QUOTA_KV"
```

Save the namespace IDs from the output. You'll need them for Step 3.

## Step 2: Generate Password Hash

You have two options to generate a secure password hash:

### Option A: Using wrangler dev (Recommended)

1. Start development server:
```bash
npm run dev
```

2. In another terminal, run the hash generation script:
```bash
node scripts/generate-password-hash.js your-password-here
```

### Option B: Manual generation using Web Browser Console

1. Open browser console (F12)
2. Paste and run this code:

```javascript
async function generateHash(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    256
  );

  const hashArray = new Uint8Array(derivedBits);
  const toBase64 = (arr) => btoa(String.fromCharCode(...arr));

  return `v1:100000:${toBase64(salt)}:${toBase64(hashArray)}`;
}

// Replace 'your-password-here' with your actual password
generateHash('your-password-here').then(console.log);
```

3. Copy the output hash

## Step 3: Generate JWT Secret

Generate a secure random JWT secret:

```bash
# Using OpenSSL
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Step 4: Configure Environment Variables

Update your `wrangler.toml` with the generated values:

```toml
[vars]
USERNAME = "admin"
PASSWORD_HASH = "v1:100000:YOUR_GENERATED_HASH_HERE"
JWT_SECRET = "YOUR_GENERATED_SECRET_HERE"
WORKER_URL = "https://your-worker.workers.dev"
BUCKET_NAME = "your-bucket-name"

# Optional: Customize limits (defaults shown)
# MAX_FILE_SIZE = "104857600"    # 100 MB
# STORAGE_QUOTA = "10737418240"  # 10 GB

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-bucket-name"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-rate-limit-kv-id"  # From Step 1

[[kv_namespaces]]
binding = "QUOTA_KV"
id = "your-quota-kv-id"  # From Step 1
```

## Step 5: Update GitHub Actions Secrets (if using CI/CD)

Add these secrets to your GitHub repository (Settings > Secrets > Actions):

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `USERNAME`: Your username (e.g., "admin")
- `PASSWORD_HASH`: Generated password hash from Step 2
- `JWT_SECRET`: Generated JWT secret from Step 3
- `WORKER_URL`: Your Worker URL
- `BUCKET_NAME`: Your R2 bucket name
- `RATE_LIMIT_KV_ID`: KV namespace ID from Step 1
- `QUOTA_KV_ID`: KV namespace ID from Step 1

Update `.github/workflows/main.yml` to use these secrets.

## Step 6: Deploy

```bash
# Build and deploy
npm run deploy
```

## Testing Your Setup

### Test Basic Auth

```bash
curl -u admin:your-password https://your-worker.workers.dev/webdav/
```

### Test JWT Authentication

1. Get access token:
```bash
curl -X POST https://your-worker.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

2. Use the access token:
```bash
curl https://your-worker.workers.dev/webdav/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test Rate Limiting

Try logging in with wrong password 6 times - you should be blocked on the 6th attempt:

```bash
for i in {1..6}; do
  curl -X POST https://your-worker.workers.dev/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong-password"}'
  echo "\nAttempt $i"
done
```

## Security Features Enabled

After completing this setup, you have:

✅ **PBKDF2 Password Hashing** - Passwords stored securely with 100,000 iterations
✅ **JWT Authentication** - Short-lived access tokens (15min) + refresh tokens (7 days)
✅ **Rate Limiting** - 5 failed login attempts per 15 minutes, 1-hour block
✅ **CORS Protection** - Only your Worker domain allowed
✅ **Path Traversal Prevention** - Validates all file paths
✅ **File Validation** - Extension whitelist, size limits, MIME type checking
✅ **Storage Quota** - Tracks usage, enforces limits (100MB/file, 10GB total)

## Troubleshooting

### "Missing environment variable"

Make sure all required variables are set in `wrangler.toml`:
- `PASSWORD_HASH`
- `JWT_SECRET`
- `WORKER_URL`
- `RATE_LIMIT_KV` (KV binding)
- `QUOTA_KV` (KV binding)

### "Invalid password hash"

Your `PASSWORD_HASH` must be in the format: `v1:iterations:base64(salt):base64(hash)`

Re-generate using Step 2.

### "401 Unauthorized"

1. Check your password hash is correct
2. Verify username matches `USERNAME` in `wrangler.toml`
3. Check CORS settings if accessing from browser

### Rate limit not working

Verify `RATE_LIMIT_KV` is properly bound in `wrangler.toml` and the namespace ID is correct.

## Stage 2: TOTP Two-Factor Authentication (2FA) ✅

Stage 2 has been implemented! TOTP 2FA adds an additional layer of security by requiring a time-based one-time password from an authenticator app.

### Setup Instructions

1. **Create TOTP KV Namespace**:
```bash
wrangler kv:namespace create "TOTP_KV"
```

2. **Update wrangler.toml**:
```toml
[[kv_namespaces]]
binding = "TOTP_KV"
id = "your-totp-kv-id"  # From step 1
```

3. **Deploy the updated worker**:
```bash
npm run deploy
```

### Using 2FA

**Setup 2FA (requires authentication)**:
```bash
curl -X POST https://your-worker.workers.dev/auth/2fa/setup \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

This returns:
- TOTP secret
- QR code URI (scan with Google Authenticator, Authy, etc.)
- 10 recovery codes (store securely offline!)

**Verify and enable 2FA**:
```bash
curl -X POST https://your-worker.workers.dev/auth/2fa/verify-setup \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

**Login with 2FA**:
1. First, login with username/password:
```bash
curl -X POST https://your-worker.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

2. If 2FA is enabled, you'll receive a `partialToken`. Complete login with TOTP code:
```bash
curl -X POST https://your-worker.workers.dev/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"partialToken":"PARTIAL_TOKEN","code":"123456"}'
```

Or use a recovery code:
```bash
curl -X POST https://your-worker.workers.dev/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"partialToken":"PARTIAL_TOKEN","recoveryCode":"A3B2-C5D7"}'
```

**WebDAV Clients with 2FA**:
WebDAV clients (Cyberduck, rclone, etc.) can use Basic Auth with additional headers:
- `X-TOTP-Code`: Your 6-digit TOTP code
- `X-Recovery-Code`: A recovery code (one-time use)

Example with curl:
```bash
curl -u admin:your-password \
  -H "X-TOTP-Code: 123456" \
  https://your-worker.workers.dev/webdav/
```

**Manage 2FA**:
```bash
# Check 2FA status
curl https://your-worker.workers.dev/auth/2fa/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Regenerate recovery codes (requires password)
curl -X POST https://your-worker.workers.dev/auth/2fa/recovery-codes/regenerate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'

# Disable 2FA (requires password)
curl -X POST https://your-worker.workers.dev/auth/2fa/disable \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'
```

### Security Features

✅ **RFC 6238 TOTP** - Standard 30-second window with ±1 tolerance
✅ **Recovery Codes** - 10 one-time use backup codes (PBKDF2 hashed)
✅ **Multi-tier Rate Limiting** - Protects against brute-force attacks across IP/user/combination
✅ **WebDAV Integration** - Works with Basic Auth via custom headers
✅ **No Bypass** - 2FA is enforced on all authentication methods when enabled

## Stage 3: WebAuthn Passkeys ✅

Stage 3 implements passwordless authentication using WebAuthn Passkeys for the highest level of security and convenience.

### Features

- **Passwordless Login**: No password required - authenticate with biometrics or security keys
- **Platform Authenticators**: Touch ID, Face ID, Windows Hello
- **Cross-platform Authenticators**: YubiKey, security keys
- **Multiple Algorithms**: ES256 (ECDSA P-256) and RS256 (RSA)
- **Replay Protection**: Counter-based replay prevention
- **Challenge-Response**: Cryptographic proof with 5-minute TTL
- **Account Enumeration Protection**: Timing-safe responses
- **Rate Limiting**: Multi-tier protection (10 attempts / 15 minutes)

### Setup Instructions

The WebAuthn implementation is already included in the codebase. No additional setup is required beyond what was done for Stages 1 and 2.

**Optional**: Create a dedicated KV namespace for passkeys:
```bash
# Create AUTH_KV namespace
wrangler kv:namespace create "AUTH_KV"

# Add to wrangler.toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-auth-kv-id"
```

If `AUTH_KV` is not configured, passkeys will automatically use the existing `TOTP_KV` namespace.

### API Endpoints

#### Registration (requires authentication)

**Start Passkey Registration**:
```bash
curl -X POST https://your-worker.workers.dev/auth/passkey/register/start \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Returns:
```json
{
  "options": {
    "challenge": "base64url-encoded-challenge",
    "rp": { "name": "CFr2 WebDAV", "id": "your-worker.workers.dev" },
    "user": { "id": "base64url-user-id", "name": "username", "displayName": "username" },
    "pubKeyCredParams": [
      { "type": "public-key", "alg": -7 },
      { "type": "public-key", "alg": -257 }
    ],
    "timeout": 60000,
    "attestation": "none"
  },
  "challengeId": "uuid"
}
```

**Finish Passkey Registration** (called by client JavaScript):
```bash
curl -X POST https://your-worker.workers.dev/auth/passkey/register/finish \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credential": { /* PublicKeyCredential from navigator.credentials.create() */ },
    "challengeId": "uuid",
    "name": "My iPhone"
  }'
```

#### Authentication (no authentication required)

**Start Passkey Authentication**:
```bash
curl -X POST https://your-worker.workers.dev/auth/passkey/authenticate/start \
  -H "Content-Type: application/json" \
  -d '{"username":"admin"}'
```

Returns:
```json
{
  "options": {
    "challenge": "base64url-encoded-challenge",
    "timeout": 60000,
    "rpId": "your-worker.workers.dev",
    "allowCredentials": [
      { "type": "public-key", "id": "base64url-credential-id" }
    ],
    "userVerification": "preferred"
  },
  "challengeId": "uuid"
}
```

**Finish Passkey Authentication** (called by client JavaScript):
```bash
curl -X POST https://your-worker.workers.dev/auth/passkey/authenticate/finish \
  -H "Content-Type": application/json" \
  -d '{
    "credential": { /* PublicKeyCredential from navigator.credentials.get() */ },
    "challengeId": "uuid"
  }'
```

Returns JWT tokens:
```json
{
  "success": true,
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": { "username": "admin" },
  "expiresIn": 900
}
```

#### Management (requires authentication)

**List Passkeys**:
```bash
curl https://your-worker.workers.dev/auth/passkeys \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Delete Passkey**:
```bash
curl -X DELETE https://your-worker.workers.dev/auth/passkey/CREDENTIAL_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Browser Client Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebAuthn Passkey Demo</title>
</head>
<body>
    <h1>Passkey Authentication</h1>
    <button onclick="registerPasskey()">Register Passkey</button>
    <button onclick="authenticatePasskey()">Login with Passkey</button>

    <script>
        const API_BASE = 'https://your-worker.workers.dev';
        let accessToken = localStorage.getItem('accessToken');

        async function registerPasskey() {
            if (!accessToken) {
                alert('Please login first with password');
                return;
            }

            // Start registration
            const startResp = await fetch(`${API_BASE}/auth/passkey/register/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const { options, challengeId } = await startResp.json();

            // Convert base64url to ArrayBuffer
            options.challenge = base64urlToBuffer(options.challenge);
            options.user.id = base64urlToBuffer(options.user.id);

            // Create credential
            const credential = await navigator.credentials.create({ publicKey: options });

            // Finish registration
            const finishResp = await fetch(`${API_BASE}/auth/passkey/register/finish`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    credential: credentialToJSON(credential),
                    challengeId,
                    name: 'My Device'
                })
            });

            const result = await finishResp.json();
            alert(result.message || 'Passkey registered!');
        }

        async function authenticatePasskey() {
            const username = prompt('Username:');
            if (!username) return;

            // Start authentication
            const startResp = await fetch(`${API_BASE}/auth/passkey/authenticate/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const { options, challengeId } = await startResp.json();

            // Convert base64url to ArrayBuffer
            options.challenge = base64urlToBuffer(options.challenge);
            options.allowCredentials = options.allowCredentials.map(c => ({
                ...c,
                id: base64urlToBuffer(c.id)
            }));

            // Get credential
            const credential = await navigator.credentials.get({ publicKey: options });

            // Finish authentication
            const finishResp = await fetch(`${API_BASE}/auth/passkey/authenticate/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    credential: credentialToJSON(credential),
                    challengeId
                })
            });

            const result = await finishResp.json();
            if (result.accessToken) {
                accessToken = result.accessToken;
                localStorage.setItem('accessToken', accessToken);
                alert('Authenticated successfully!');
            }
        }

        function base64urlToBuffer(base64url) {
            const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes.buffer;
        }

        function bufferToBase64url(buffer) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        }

        function credentialToJSON(credential) {
            return {
                id: credential.id,
                rawId: bufferToBase64url(credential.rawId),
                response: {
                    clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
                    attestationObject: credential.response.attestationObject
                        ? bufferToBase64url(credential.response.attestationObject)
                        : undefined,
                    authenticatorData: credential.response.authenticatorData
                        ? bufferToBase64url(credential.response.authenticatorData)
                        : undefined,
                    signature: credential.response.signature
                        ? bufferToBase64url(credential.response.signature)
                        : undefined
                },
                type: credential.type
            };
        }
    </script>
</body>
</html>
```

### Browser Support

- **Chrome/Edge**: Full support (version 67+)
- **Safari (macOS/iOS)**: Full support (version 13+)
- **Firefox**: Full support (version 60+)

### Security Features

✅ **RFC WebAuthn Compliant** - Standard-compliant implementation
✅ **Multi-tier Rate Limiting** - 10 attempts / 15 minutes, 1-hour block
✅ **Account Enumeration Protection** - Timing-safe responses prevent user enumeration
✅ **Counter-based Replay Protection** - Prevents replay attacks
✅ **Challenge TTL** - 5-minute expiration for challenges
✅ **RP ID Verification** - Origin and domain validation
✅ **Cryptographic Signatures** - ES256 and RS256 support
✅ **No Password Storage** - Public key cryptography
✅ **Phishing Resistant** - Domain-bound credentials

### Troubleshooting

#### "Challenge not found or expired"

**Cause**: Challenge has expired (5-minute TTL) or already been used

**Solution**: Start the registration/authentication flow again from the beginning

#### "Too many authentication attempts"

**Cause**: Rate limit triggered (10 attempts in 15 minutes)

**Solution**: Wait for the time specified in the `Retry-After` header (up to 1 hour)

#### "rpIdHash mismatch"

**Cause**: `WORKER_URL` environment variable doesn't match the actual domain

**Solution**: Ensure `WORKER_URL` in wrangler.toml matches the domain you're accessing

#### "Signature verification failed"

**Cause**: Corrupted public key or tampered credential

**Solution**: Delete the passkey and register a new one

#### WebAuthn API not available

**Cause**: Browser doesn't support WebAuthn or page not served over HTTPS

**Solution**:
- For local development: Use `localhost` (HTTP allowed)
- For production: Must use HTTPS
- Check browser compatibility

#### Passkey works on one device but not another

**Cause**: Platform authenticators (Touch ID, Face ID) are device-specific

**Solution**: Register separate passkeys for each device, or use a cross-platform security key (YubiKey)

### Authentication Methods Comparison

| Method | Security | Convenience | Phishing Resistant |
|--------|----------|-------------|-------------------|
| Password only | ⭐⭐ | ⭐⭐⭐ | ❌ |
| Password + TOTP | ⭐⭐⭐⭐ | ⭐⭐ | ❌ |
| Passkey | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ |

### Next Steps with Stage 3

After completing all three stages, your CFr2-webdav has multiple authentication options:

1. **Traditional**: Password-only login (Stage 1)
2. **Two-Factor**: Password + TOTP (Stages 1 + 2)
3. **Passwordless**: Passkey-only login (Stage 3)
4. **Mixed**: Users can enable 2FA and still use passkeys

Users can choose the authentication method that best fits their security and convenience needs.

## Next Steps

- **Stage 2**: TOTP Two-Factor Authentication (2FA)
- **Stage 3**: WebAuthn Passkeys (biometric authentication)

See `docs/plans/2025-12-10-security-enhancement-design.md` for the complete roadmap.

## Need Help?

Open an issue on GitHub or refer to the design document at:
`docs/plans/2025-12-10-security-enhancement-design.md`
