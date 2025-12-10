# Deployment Guide for CFr2-webdav

This guide explains how to deploy CFr2-webdav with all security features (Stages 1-3) to Cloudflare Workers using GitHub Actions.

## Prerequisites

1. Cloudflare account with R2 enabled
2. GitHub repository forked or cloned
3. Project dependencies installed (run `npm install` or `pnpm install`)

## Step 1: Create KV Namespaces

### 1.1 Login to Cloudflare

First, login to your Cloudflare account using wrangler:

```bash
npx wrangler login
```

This will open a browser window for authorization. If you have multiple Cloudflare accounts, you can use `npx wrangler whoami` to check which account is currently logged in.

### 1.2 Create KV Namespaces

You need to create three KV namespaces in your Cloudflare account:

```bash
# If you have only one account, run directly:
npx wrangler kv namespace create "RATE_LIMIT_KV"
npx wrangler kv namespace create "QUOTA_KV"
npx wrangler kv namespace create "TOTP_KV"

# If you have multiple accounts, specify the account ID:
npx wrangler kv namespace create "RATE_LIMIT_KV" --account-id YOUR_ACCOUNT_ID
npx wrangler kv namespace create "QUOTA_KV" --account-id YOUR_ACCOUNT_ID
npx wrangler kv namespace create "TOTP_KV" --account-id YOUR_ACCOUNT_ID

# Optional: Create dedicated namespace for WebAuthn passkeys (Stage 3)
# If not created, passkeys will use TOTP_KV
npx wrangler kv namespace create "AUTH_KV"
```

**Save the namespace IDs** from the output. You'll need them in Step 3.

Example output:
```
{ binding = "RATE_LIMIT_KV", id = "abc123..." }
{ binding = "QUOTA_KV", id = "def456..." }
{ binding = "TOTP_KV", id = "ghi789..." }
```

## Step 2: Generate Secrets

### Password Hash

Generate a secure PBKDF2 password hash:

```bash
# Option 1: Using the included script (Recommended)
node scripts/generate-password-hash.js your-password-here

# Option 2: Using browser console
# Open browser console and run:
async function generateHash(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const hashArray = new Uint8Array(derivedBits);
  const toBase64 = (arr) => btoa(String.fromCharCode(...arr));
  return `v1:100000:${toBase64(salt)}:${toBase64(hashArray)}`;
}
generateHash('your-password-here').then(console.log);
```

### JWT Secret

Generate a secure random JWT secret:

```bash
# Using OpenSSL
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Step 3: Configure GitHub Secrets

Go to your GitHub repository: **Settings > Secrets and variables > Actions > New repository secret**

Add the following secrets:

### Required Secrets

| Secret Name | Description | Example / How to Get |
|------------|-------------|---------------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | Create at https://dash.cloudflare.com/profile/api-tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Found in Cloudflare dashboard URL or Workers overview |
| `USERNAME` | Admin username | `admin` |
| `PASSWORD_HASH` | PBKDF2 password hash | From Step 2 (e.g., `v1:100000:abc...`) |
| `JWT_SECRET` | JWT signing secret | From Step 2 (32-byte base64 string) |
| `WORKER_URL` | Your Worker URL | `https://your-worker.workers.dev` |
| `BUCKET_NAME` | R2 bucket name | Your R2 bucket name |
| `RATE_LIMIT_KV_ID` | Rate limiting KV ID | From Step 1 |
| `QUOTA_KV_ID` | Storage quota KV ID | From Step 1 |
| `TOTP_KV_ID` | TOTP 2FA KV ID | From Step 1 |

### Optional Secrets

| Secret Name | Description | Default if Not Set |
|------------|-------------|-------------------|
| `PASSWORD` | Legacy plaintext password | `_pass` (not recommended) |
| `AUTH_KV_ID` | WebAuthn passkeys KV ID | Uses `TOTP_KV_ID` if not set |

## Step 4: Create Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Configure:
   - **Permissions**:
     - Account > Workers Scripts > Edit
     - Account > Workers KV Storage > Edit
     - Account > Account Settings > Read
   - **Account Resources**: Include > Your Account
   - **Zone Resources**: All zones (or specific zones)
5. Click "Continue to summary" and "Create Token"
6. **Copy the token** (you won't see it again!)
7. Add it as `CLOUDFLARE_API_TOKEN` secret in GitHub

## Step 5: Deploy

Once all secrets are configured, deployment is automatic:

1. Push to the `main` branch:
   ```bash
   git push origin main
   ```

2. GitHub Actions will automatically:
   - Generate `wrangler.toml` from template
   - Validate all required secrets
   - Build the project
   - Deploy to Cloudflare Workers

3. Check the deployment status:
   - Go to **Actions** tab in your GitHub repository
   - Click on the latest workflow run
   - Monitor the "Deploy to Cloudflare Workers For WebDAV" job

## Troubleshooting

### "Missing secret X"

**Cause**: Required GitHub secret not configured

**Solution**: Add the missing secret in GitHub Settings > Secrets > Actions

### "KV namespace 'X' is not valid"

**Cause**: Invalid KV namespace ID in secrets

**Solution**:
1. Verify KV namespaces exist: `npx wrangler kv namespace list`
2. Update the corresponding secret with correct namespace ID

### "Cloudflare API token is invalid"

**Cause**: API token expired or has insufficient permissions

**Solution**:
1. Create a new API token with correct permissions (see Step 4)
2. Update `CLOUDFLARE_API_TOKEN` secret

### "Worker URL mismatch"

**Cause**: `WORKER_URL` secret doesn't match actual Worker URL

**Solution**: Update `WORKER_URL` secret to match your actual Worker URL (found in Cloudflare Workers dashboard)

## Verification

After successful deployment, verify your Worker:

1. **Check Worker status**:
   ```bash
   curl https://your-worker.workers.dev/
   ```

2. **Test authentication**:
   ```bash
   # Test password login
   curl -X POST https://your-worker.workers.dev/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-password"}'

   # Should return JWT tokens
   ```

3. **Test WebDAV**:
   ```bash
   # Using the access token
   curl https://your-worker.workers.dev/webdav/ \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

## Security Best Practices

1. **Never commit secrets** to your repository
2. **Use strong passwords** for PASSWORD_HASH generation
3. **Rotate JWT_SECRET** periodically
4. **Monitor Worker logs** for suspicious activity
5. **Enable 2FA** for your Cloudflare account
6. **Review API token permissions** regularly

## Updating Configuration

To update any configuration:

1. Update the secret in GitHub Settings
2. Re-run the workflow:
   - Go to Actions > Latest workflow
   - Click "Re-run jobs" > "Re-run all jobs"

Or push a new commit to trigger automatic deployment.

## Local Development

For local development without GitHub Actions:

1. Copy `wrangler.toml.template` to `wrangler.toml`
2. Replace all `$VARIABLE` placeholders with actual values
3. Run locally:
   ```bash
   npm run dev
   ```

**Important**: Never commit `wrangler.toml` with real credentials!

## Support

- **Security Setup Guide**: See `docs/SECURITY_SETUP.md`
- **Stage 3 Implementation**: See `docs/STAGE3_IMPLEMENTATION_GUIDE.md`
- **Issues**: Open an issue on GitHub
