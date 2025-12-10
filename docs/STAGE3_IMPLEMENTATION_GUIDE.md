# 阶段三 WebAuthn Passkeys 实施指南

**日期**: 2025-12-11
**版本**: 1.0
**状态**: 部分完成，待继续

## 当前进度

### ✅ 已完成部分

1. **类型定义** (`src/types.ts`)
   - ✅ 添加 `AUTH_KV?: KVNamespace` 到 Env 接口
   - ✅ `PasskeyCredential` 接口 - 存储的凭证数据
   - ✅ `ChallengeRecord` 接口 - 临时挑战数据
   - ✅ 所有 WebAuthn API 请求/响应类型

2. **WebAuthn 核心实现** (`src/utils/webauthn.ts` - 900+ 行)
   - ✅ Base64URL 编解码工具
   - ✅ Challenge 管理（生成、保存、读取、删除）
   - ✅ 注册流程函数
   - ✅ 认证流程函数
   - ✅ CBOR 解码器
   - ✅ COSE 公钥处理（ES256、RS256）
   - ✅ 签名验证、Counter 检查

### ⏳ 待完成部分

1. **auth.ts 处理器** - 6 个函数
2. **requestHandler.ts** - 路由挂载
3. **wrangler.toml** - KV 绑定配置
4. **SECURITY_SETUP.md** - 文档更新
5. **测试和验证**

---

## 实施步骤

### 步骤 1: 实现 auth.ts 中的 WebAuthn 处理器

在 `src/utils/auth.ts` 文件末尾添加以下 6 个处理器函数：

#### 1.1 获取 AUTH_KV 的辅助函数

首先添加一个辅助函数，用于获取 AUTH_KV（如果未配置则回退到 TOTP_KV）：

```typescript
/**
 * Get AUTH_KV namespace (falls back to TOTP_KV if not configured)
 */
function getAuthKV(env: Env): KVNamespace {
	return env.AUTH_KV ?? env.TOTP_KV;
}
```

#### 1.2 Passkey 注册开始 (handlePasskeyRegisterStart)

```typescript
/**
 * Start passkey registration
 *
 * POST /auth/passkey/register/start
 * Requires authentication
 *
 * @returns PublicKeyCredentialCreationOptions and challenge ID
 */
export async function handlePasskeyRegisterStart(
	request: Request,
	env: Env,
	authContext: AuthContext
): Promise<Response> {
	try {
		const username = authContext.userId;
		const kv = getAuthKV(env);

		// Generate challenge
		const challenge = generateChallenge();
		const challengeId = crypto.randomUUID();

		// Extract RP ID from WORKER_URL
		const rpId = new URL(env.WORKER_URL).hostname;

		// Generate registration options
		const options = generateRegistrationOptions(username, username, rpId);

		// Save challenge to KV (5 minute TTL)
		await saveChallenge(kv, challengeId, challenge, username, 300);

		// Replace challenge in options with the saved one (for serialization)
		const serializableOptions = {
			...options,
			challenge: base64urlEncode(challenge),
			user: {
				...options.user,
				id: base64urlEncode(new Uint8Array(options.user.id as ArrayBuffer)),
			},
		};

		return new Response(
			JSON.stringify({
				options: serializableOptions,
				challengeId,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Passkey register start error:', error);
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}
```

**关键点：**
- 需要用户已登录（authContext）
- 生成 challenge 并保存到 KV
- 将 ArrayBuffer 转换为 base64url 以便 JSON 序列化
- RP ID 从 WORKER_URL 提取

#### 1.3 Passkey 注册完成 (handlePasskeyRegisterFinish)

```typescript
/**
 * Finish passkey registration
 *
 * POST /auth/passkey/register/finish
 * Body: { credential, challengeId, name? }
 * Requires authentication
 */
export async function handlePasskeyRegisterFinish(
	request: Request,
	env: Env,
	authContext: AuthContext
): Promise<Response> {
	try {
		const username = authContext.userId;
		const kv = getAuthKV(env);

		const body = await safeJson<PasskeyRegisterFinishRequest>(request);
		const { credential, challengeId, name } = body;

		if (!credential || !challengeId) {
			return new Response(
				JSON.stringify({ error: 'Missing credential or challengeId' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Retrieve challenge
		const challengeRecord = await getChallenge(kv, challengeId);
		if (!challengeRecord) {
			return new Response(
				JSON.stringify({ error: 'Challenge not found or expired' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Verify user matches
		if (challengeRecord.userId !== username) {
			return new Response(
				JSON.stringify({ error: 'Challenge user mismatch' }),
				{
					status: 403,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Verify registration response
		const rpId = new URL(env.WORKER_URL).hostname;
		const expectedChallenge = base64urlDecode(challengeRecord.challenge);
		const verificationResult = await verifyRegistrationResponse(
			credential,
			expectedChallenge,
			rpId,
			env.WORKER_URL
		);

		// Delete challenge to prevent reuse
		await deleteChallenge(kv, challengeId);

		// Store passkey credential
		const passkeyData: PasskeyCredential = {
			credentialId: verificationResult.credentialId,
			publicKey: verificationResult.publicKey,
			counter: verificationResult.counter,
			name: name || `Passkey ${new Date().toLocaleDateString()}`,
			createdAt: Date.now(),
		};

		const key = `passkey:${username}:${verificationResult.credentialId}`;
		await kv.put(key, JSON.stringify(passkeyData));

		return new Response(
			JSON.stringify({
				success: true,
				credentialId: verificationResult.credentialId,
				message: 'Passkey registered successfully',
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		if (error instanceof Response) {
			return error;
		}
		console.error('Passkey register finish error:', error);
		return new Response(
			JSON.stringify({
				error: 'Registration verification failed',
				details: error instanceof Error ? error.message : 'Unknown error',
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}
```

**关键点：**
- 验证 challenge 未过期且属于当前用户
- 调用 `verifyRegistrationResponse` 验证 attestation
- 成功后删除 challenge（防止重放）
- 将凭证存储到 KV：`passkey:${username}:${credentialId}`

#### 1.4 Passkey 认证开始 (handlePasskeyAuthStart)

```typescript
/**
 * Start passkey authentication
 *
 * POST /auth/passkey/authenticate/start
 * Body: { username }
 * No authentication required
 */
export async function handlePasskeyAuthStart(
	request: Request,
	env: Env
): Promise<Response> {
	try {
		const body = await safeJson<PasskeyAuthStartRequest>(request);
		const { username } = body;

		if (!username) {
			return new Response(
				JSON.stringify({ error: 'Username is required' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		const kv = getAuthKV(env);

		// Get user's passkeys
		const passkeys = await listUserPasskeys(kv, username);

		if (passkeys.length === 0) {
			return new Response(
				JSON.stringify({ error: 'No passkeys registered for this user' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Generate challenge
		const challenge = generateChallenge();
		const challengeId = crypto.randomUUID();

		// Extract RP ID from WORKER_URL
		const rpId = new URL(env.WORKER_URL).hostname;

		// Generate authentication options
		const options = generateAuthenticationOptions(username, passkeys, rpId);

		// Save challenge
		await saveChallenge(kv, challengeId, challenge, username, 300);

		// Serialize options
		const serializableOptions = {
			...options,
			challenge: base64urlEncode(challenge),
			allowCredentials: options.allowCredentials?.map(cred => ({
				...cred,
				id: base64urlEncode(new Uint8Array(cred.id as ArrayBuffer)),
			})),
		};

		return new Response(
			JSON.stringify({
				options: serializableOptions,
				challengeId,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		if (error instanceof Response) {
			return error;
		}
		console.error('Passkey auth start error:', error);
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}
```

**关键点：**
- **不需要**用户登录（无密码登录）
- 根据 username 获取该用户的所有 passkeys
- 如果用户没有注册 passkey，返回 404

#### 1.5 Passkey 认证完成 (handlePasskeyAuthFinish)

```typescript
/**
 * Finish passkey authentication
 *
 * POST /auth/passkey/authenticate/finish
 * Body: { credential, challengeId }
 * No authentication required
 *
 * @returns JWT access and refresh tokens
 */
export async function handlePasskeyAuthFinish(
	request: Request,
	env: Env
): Promise<Response> {
	try {
		const body = await safeJson<PasskeyAuthFinishRequest>(request);
		const { credential, challengeId } = body;

		if (!credential || !challengeId) {
			return new Response(
				JSON.stringify({ error: 'Missing credential or challengeId' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		const kv = getAuthKV(env);

		// Retrieve challenge
		const challengeRecord = await getChallenge(kv, challengeId);
		if (!challengeRecord) {
			return new Response(
				JSON.stringify({ error: 'Challenge not found or expired' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		const username = challengeRecord.userId;

		// Get credential from storage
		// Extract credential ID from response
		const credentialIdB64 = base64urlEncode(
			new Uint8Array((credential as any).rawId)
		);
		const storedKey = `passkey:${username}:${credentialIdB64}`;
		const storedDataRaw = await kv.get(storedKey);

		if (!storedDataRaw) {
			return new Response(
				JSON.stringify({ error: 'Passkey not found' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		const storedCredential = JSON.parse(storedDataRaw) as PasskeyCredential;

		// Verify authentication response
		const rpId = new URL(env.WORKER_URL).hostname;
		const expectedChallenge = base64urlDecode(challengeRecord.challenge);
		const verificationResult = await verifyAuthenticationResponse(
			credential,
			expectedChallenge,
			storedCredential,
			rpId,
			env.WORKER_URL
		);

		// Delete challenge
		await deleteChallenge(kv, challengeId);

		// Update counter
		storedCredential.counter = verificationResult.newCounter;
		await kv.put(storedKey, JSON.stringify(storedCredential));

		// Generate JWT tokens
		const accessToken = await generateAccessToken(username, env.JWT_SECRET);
		const refreshToken = await generateRefreshToken(username, env.JWT_SECRET);

		return new Response(
			JSON.stringify({
				success: true,
				accessToken,
				refreshToken,
				user: { username },
				expiresIn: 900, // 15 minutes
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		if (error instanceof Response) {
			return error;
		}
		console.error('Passkey auth finish error:', error);
		return new Response(
			JSON.stringify({
				error: 'Authentication verification failed',
				details: error instanceof Error ? error.message : 'Unknown error',
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}
```

**关键点：**
- 从 credential.rawId 提取 credential ID
- 验证 assertion 签名
- 更新 counter（防止重放攻击）
- 签发完整的 JWT tokens（与密码登录相同）

#### 1.6 列出用户的 Passkeys (handlePasskeyList)

```typescript
/**
 * List user's passkeys
 *
 * GET /auth/passkeys
 * Requires authentication
 */
export async function handlePasskeyList(
	request: Request,
	env: Env,
	authContext: AuthContext
): Promise<Response> {
	try {
		const username = authContext.userId;
		const kv = getAuthKV(env);

		const passkeys = await listUserPasskeys(kv, username);

		const passkeyList: PasskeyListItem[] = passkeys.map(p => ({
			id: p.credentialId,
			name: p.name,
			createdAt: p.createdAt,
		}));

		return new Response(
			JSON.stringify({
				passkeys: passkeyList,
				count: passkeyList.length,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Passkey list error:', error);
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}
```

#### 1.7 删除 Passkey (handlePasskeyDelete)

```typescript
/**
 * Delete a passkey
 *
 * DELETE /auth/passkey/:credentialId
 * Requires authentication
 */
export async function handlePasskeyDelete(
	request: Request,
	env: Env,
	authContext: AuthContext,
	credentialId: string
): Promise<Response> {
	try {
		const username = authContext.userId;
		const kv = getAuthKV(env);

		const key = `passkey:${username}:${credentialId}`;
		const existing = await kv.get(key);

		if (!existing) {
			return new Response(
				JSON.stringify({ error: 'Passkey not found' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		await kv.delete(key);

		return new Response(
			JSON.stringify({
				success: true,
				deletedId: credentialId,
				message: 'Passkey deleted successfully',
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Passkey delete error:', error);
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}
```

#### 1.8 辅助函数：列出用户 Passkeys

在 auth.ts 文件中添加这个辅助函数：

```typescript
/**
 * List all passkeys for a user
 *
 * @param kv - KV namespace
 * @param username - User ID
 * @returns Array of passkey credentials
 */
async function listUserPasskeys(kv: KVNamespace, username: string): Promise<PasskeyCredential[]> {
	// KV doesn't support prefix listing, so we need to use list() with prefix
	const prefix = `passkey:${username}:`;
	const list = await kv.list({ prefix });

	const passkeys: PasskeyCredential[] = [];
	for (const key of list.keys) {
		const data = await kv.get(key.name);
		if (data) {
			try {
				passkeys.push(JSON.parse(data) as PasskeyCredential);
			} catch {
				// Skip invalid data
			}
		}
	}

	return passkeys;
}
```

#### 1.9 需要导入的模块

在 `auth.ts` 文件顶部添加导入：

```typescript
import {
	generateChallenge,
	saveChallenge,
	getChallenge,
	deleteChallenge,
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
	base64urlEncode,
	base64urlDecode,
} from './webauthn';
import type {
	PasskeyCredential,
	PasskeyRegisterFinishRequest,
	PasskeyAuthStartRequest,
	PasskeyAuthFinishRequest,
	PasskeyListItem,
} from '../types';
```

---

### 步骤 2: 挂载路由到 requestHandler.ts

在 `src/handlers/requestHandler.ts` 中：

#### 2.1 导入新的处理器

在文件顶部的导入语句中添加：

```typescript
import {
	// ... 现有导入
	handlePasskeyRegisterStart,
	handlePasskeyRegisterFinish,
	handlePasskeyAuthStart,
	handlePasskeyAuthFinish,
	handlePasskeyList,
	handlePasskeyDelete,
} from '../utils/auth';
```

#### 2.2 添加路由

在 `handleRequest` 函数中，在认证检查后添加以下路由：

```typescript
// Passkey authentication endpoints (no auth required)
if (url.pathname === '/auth/passkey/authenticate/start' && request.method === 'POST') {
	const response = await handlePasskeyAuthStart(request, env);
	setCORSHeaders(response, request, env);
	return response;
}

if (url.pathname === '/auth/passkey/authenticate/finish' && request.method === 'POST') {
	const response = await handlePasskeyAuthFinish(request, env);
	setCORSHeaders(response, request, env);
	return response;
}

// All other requests require authentication
const authContext = await authenticate(request, env);
if (!authContext) {
	const response = createUnauthorizedResponse();
	setCORSHeaders(response, request, env);
	return response;
}

// Passkey management endpoints (require authentication)
if (url.pathname === '/auth/passkey/register/start' && request.method === 'POST') {
	const response = await handlePasskeyRegisterStart(request, env, authContext);
	setCORSHeaders(response, request, env);
	return response;
}

if (url.pathname === '/auth/passkey/register/finish' && request.method === 'POST') {
	const response = await handlePasskeyRegisterFinish(request, env, authContext);
	setCORSHeaders(response, request, env);
	return response;
}

if (url.pathname === '/auth/passkeys' && request.method === 'GET') {
	const response = await handlePasskeyList(request, env, authContext);
	setCORSHeaders(response, request, env);
	return response;
}

if (url.pathname.startsWith('/auth/passkey/') && request.method === 'DELETE') {
	const credentialId = url.pathname.split('/').pop();
	if (credentialId) {
		const response = await handlePasskeyDelete(request, env, authContext, credentialId);
		setCORSHeaders(response, request, env);
		return response;
	}
}
```

---

### 步骤 3: 更新 wrangler.toml

添加 AUTH_KV 绑定（可选，如果不添加将自动使用 TOTP_KV）：

```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-auth-kv-id"  # 运行 wrangler kv:namespace create "AUTH_KV" 获取
```

或者，如果你想复用 TOTP_KV，可以不添加新的绑定，代码会自动回退。

---

### 步骤 4: 更新文档

在 `docs/SECURITY_SETUP.md` 的阶段三部分添加：

```markdown
## Stage 3: WebAuthn Passkeys ✅

Stage 3 implements passwordless authentication using WebAuthn Passkeys.

### Features

- Platform authenticators (Touch ID, Face ID, Windows Hello)
- Cross-platform authenticators (YubiKey, security keys)
- ES256 and RS256 public key algorithms
- Counter-based replay protection
- No passwords required

### API Endpoints

**Registration (requires authentication):**
```bash
# Start registration
curl -X POST https://your-worker.workers.dev/auth/passkey/register/start \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Finish registration (called by client JavaScript)
curl -X POST https://your-worker.workers.dev/auth/passkey/register/finish \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credential":{...},"challengeId":"...","name":"My iPhone"}'
```

**Authentication (no authentication required):**
```bash
# Start authentication
curl -X POST https://your-worker.workers.dev/auth/passkey/authenticate/start \
  -H "Content-Type: application/json" \
  -d '{"username":"admin"}'

# Finish authentication (called by client JavaScript)
curl -X POST https://your-worker.workers.dev/auth/passkey/authenticate/finish \
  -H "Content-Type: application/json" \
  -d '{"credential":{...},"challengeId":"..."}'
```

**Management (requires authentication):**
```bash
# List passkeys
curl https://your-worker.workers.dev/auth/passkeys \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Delete passkey
curl -X DELETE https://your-worker.workers.dev/auth/passkey/CREDENTIAL_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Browser Support

- Chrome/Edge: Full support
- Safari (macOS/iOS): Full support
- Firefox: Full support

### Security Features

✅ **RFC WebAuthn** - Standard compliant implementation
✅ **Counter Protection** - Prevents replay attacks
✅ **Challenge-based** - 5-minute challenge TTL
✅ **RP ID Verification** - Origin validation
✅ **Signature Verification** - Cryptographic proof
```

---

## 测试步骤

### 1. 本地测试

```bash
# 启动开发服务器
npm run dev

# 在另一个终端测试注册
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# 获取 access token 后测试 passkey 注册
curl -X POST http://localhost:8787/auth/passkey/register/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. 浏览器测试

创建简单的 HTML 页面测试 WebAuthn：

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebAuthn Test</title>
</head>
<body>
    <h1>Passkey Test</h1>
    <button onclick="registerPasskey()">Register Passkey</button>
    <button onclick="authenticatePasskey()">Authenticate with Passkey</button>

    <script>
        const API_BASE = 'http://localhost:8787';
        let accessToken = 'YOUR_ACCESS_TOKEN_HERE';

        async function registerPasskey() {
            // Start registration
            const startResp = await fetch(`${API_BASE}/auth/passkey/register/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            const { options, challengeId } = await startResp.json();

            // Convert base64url strings to ArrayBuffer
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
                    name: 'Test Passkey'
                })
            });

            const result = await finishResp.json();
            console.log('Registration result:', result);
        }

        async function authenticatePasskey() {
            // Start authentication
            const startResp = await fetch(`${API_BASE}/auth/passkey/authenticate/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: 'admin' })
            });
            const { options, challengeId } = await startResp.json();

            // Convert base64url strings to ArrayBuffer
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    credential: credentialToJSON(credential),
                    challengeId
                })
            });

            const result = await finishResp.json();
            console.log('Authentication result:', result);
            if (result.accessToken) {
                accessToken = result.accessToken;
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

---

## 部署

```bash
# 1. 创建 AUTH_KV namespace（如果需要）
wrangler kv:namespace create "AUTH_KV"

# 2. 更新 wrangler.toml 中的 KV ID

# 3. 部署
npm run deploy

# 4. 在生产环境测试
```

---

## 故障排查

### 问题 1: "Challenge not found or expired"

**原因**: Challenge 已过期（5分钟 TTL）或已被使用

**解决**: 重新开始注册/认证流程

### 问题 2: "rpIdHash mismatch"

**原因**: WORKER_URL 配置不正确，或浏览器访问的域名与 RP ID 不匹配

**解决**: 确保 `WORKER_URL` 与实际访问的域名一致

### 问题 3: "Signature verification failed"

**原因**: 公钥或签名数据损坏，或 counter 问题

**解决**:
- 检查公钥是否正确存储
- 验证 counter 递增逻辑
- 删除并重新注册 passkey

### 问题 4: WebAuthn API 不可用

**原因**: 浏览器不支持或不在 HTTPS 环境

**解决**:
- 本地测试使用 `localhost`（允许 HTTP）
- 生产环境必须使用 HTTPS
- 检查浏览器兼容性

---

## 下一步

完成阶段三后，你的 CFr2-webdav 将拥有：

1. ✅ **阶段一**: PBKDF2密码哈希、JWT认证、限流、文件验证
2. ✅ **阶段二**: TOTP 两步验证、恢复码
3. ✅ **阶段三**: WebAuthn Passkeys无密码认证

所有三个阶段可以同时使用，用户可以选择：
- 密码登录
- 密码 + TOTP 登录
- Passkey 无密码登录

---

## 参考资料

- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [FIDO Alliance](https://fidoalliance.org/)
- [MDN WebAuthn Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

**编写日期**: 2025-12-11
**最后更新**: 2025-12-11
