# CFr2-webdav 部署指南

本指南说明如何使用 GitHub Actions 将 CFr2-webdav（包含所有安全功能：阶段 1-3）部署到 Cloudflare Workers。

## 前置要求

1. 启用了 R2 的 Cloudflare 账户
2. GitHub 仓库（fork 或 clone）
3. 已安装项目依赖（运行 `npm install` 或 `pnpm install`）

## 步骤 1：创建 KV 命名空间

### 1.1 登录 Cloudflare

首先，使用 wrangler 登录到你的 Cloudflare 账户：

```bash
npx wrangler login
```

这将打开浏览器窗口进行授权。如果你有多个 Cloudflare 账户，可以使用 `npx wrangler whoami` 查看当前登录的账户。

### 1.2 创建 KV 命名空间

你需要在 Cloudflare 账户中创建三个 KV 命名空间：

```bash
# 如果只有一个账户，直接运行：
npx wrangler kv namespace create "RATE_LIMIT_KV"
npx wrangler kv namespace create "QUOTA_KV"
npx wrangler kv namespace create "TOTP_KV"

# 如果有多个账户，需要指定账户 ID：
npx wrangler kv namespace create "RATE_LIMIT_KV" --account-id YOUR_ACCOUNT_ID
npx wrangler kv namespace create "QUOTA_KV" --account-id YOUR_ACCOUNT_ID
npx wrangler kv namespace create "TOTP_KV" --account-id YOUR_ACCOUNT_ID

# 可选：为 WebAuthn passkeys 创建专用命名空间（阶段 3）
# 如果不创建，passkeys 将使用 TOTP_KV
npx wrangler kv namespace create "AUTH_KV"
```

**保存输出中的命名空间 ID**，步骤 3 中需要用到。

输出示例：

```
{ binding = "RATE_LIMIT_KV", id = "abc123..." }
{ binding = "QUOTA_KV", id = "def456..." }
{ binding = "TOTP_KV", id = "ghi789..." }
```

## 步骤 2：生成密钥

### 密码哈希

生成安全的 PBKDF2 密码哈希：

```bash
# 方法 1：使用项目脚本（推荐）
node scripts/generate-password-hash.js your-password-here

# 方法 2：使用浏览器控制台
# 打开浏览器控制台并运行：
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

### JWT 密钥

生成安全的随机 JWT 密钥：

```bash
# 使用 OpenSSL
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 步骤 3：配置 GitHub Secrets

进入你的 GitHub 仓库：**Settings > Secrets and variables > Actions > New repository secret**

添加以下 secrets：

### 必需的 Secrets

| Secret 名称             | 说明                    | 示例 / 如何获取                                        |
| ----------------------- | ----------------------- | ------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token    | 在 https://dash.cloudflare.com/profile/api-tokens 创建 |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Cloudflare 账户 ID | 在 Cloudflare 仪表板 URL 或 Workers 概览中找到         |
| `USERNAME`              | 管理员用户名            | `admin`                                                |
| `PASSWORD_HASH`         | PBKDF2 密码哈希         | 来自步骤 2（例如：`v1:100000:abc...`）                 |
| `JWT_SECRET`            | JWT 签名密钥            | 来自步骤 2（32 字节 base64 字符串）                    |
| `WORKER_URL`            | 你的 Worker URL         | `https://your-worker.workers.dev`                      |
| `BUCKET_NAME`           | R2 存储桶名称           | 你的 R2 bucket 名称                                    |
| `RATE_LIMIT_KV_ID`      | 限流 KV ID              | 来自步骤 1                                             |
| `QUOTA_KV_ID`           | 存储配额 KV ID          | 来自步骤 1                                             |
| `TOTP_KV_ID`            | TOTP 2FA KV ID          | 来自步骤 1                                             |

### 可选的 Secrets

| Secret 名称  | 说明                    | 未设置时的默认值  |
| ------------ | ----------------------- | ----------------- |
| `PASSWORD`   | 旧版明文密码            | `_pass`（不推荐） |
| `AUTH_KV_ID` | WebAuthn passkeys KV ID | 使用 `TOTP_KV_ID` |

## 步骤 4：创建 Cloudflare API Token

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击"Create Token"
3. 使用"Edit Cloudflare Workers"模板
4. 配置：
   - **权限**：
     - Account > Workers Scripts > Edit
     - Account > Workers KV Storage > Edit
     - Account > Account Settings > Read
   - **账户资源**：Include > 你的账户
   - **区域资源**：All zones（或特定 zones）
5. 点击"Continue to summary"和"Create Token"
6. **复制 token**（只显示一次！）
7. 在 GitHub 中添加为 `CLOUDFLARE_API_TOKEN` secret

## 步骤 5：部署

配置好所有 secrets 后，部署将自动进行：

1. 推送到 `main` 分支：

   ```bash
   git push origin main
   ```

2. GitHub Actions 将自动：
   - 从模板生成 `wrangler.toml`
   - 验证所有必需的 secrets
   - 构建项目
   - 部署到 Cloudflare Workers

3. 检查部署状态：
   - 进入 GitHub 仓库的 **Actions** 标签
   - 点击最新的 workflow 运行
   - 监控"Deploy to Cloudflare Workers For WebDAV"任务

## 故障排查

### "Missing secret X"

**原因**：未配置必需的 GitHub secret

**解决方案**：在 GitHub Settings > Secrets > Actions 中添加缺失的 secret

### "KV namespace 'X' is not valid"

**原因**：secrets 中的 KV 命名空间 ID 无效

**解决方案**：

1. 验证 KV 命名空间存在：`npx wrangler kv namespace list`
2. 使用正确的命名空间 ID 更新相应的 secret

### "Cloudflare API token is invalid"

**原因**：API token 过期或权限不足

**解决方案**：

1. 使用正确权限创建新的 API token（参见步骤 4）
2. 更新 `CLOUDFLARE_API_TOKEN` secret

### "Worker URL mismatch"

**原因**：`WORKER_URL` secret 与实际 Worker URL 不匹配

**解决方案**：更新 `WORKER_URL` secret 以匹配实际的 Worker URL（在 Cloudflare Workers 仪表板中找到）

## 验证

部署成功后，验证你的 Worker：

1. **检查 Worker 状态**：

   ```bash
   curl https://your-worker.workers.dev/
   ```

2. **测试认证**：

   ```bash
   # 测试密码登录
   curl -X POST https://your-worker.workers.dev/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-password"}'

   # 应返回 JWT tokens
   ```

3. **测试 WebDAV**：
   ```bash
   # 使用 access token
   curl https://your-worker.workers.dev/webdav/ \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

## 安全最佳实践

1. **永远不要提交 secrets** 到你的仓库
2. **使用强密码** 生成 PASSWORD_HASH
3. **定期轮换** JWT_SECRET
4. **监控 Worker 日志** 以发现可疑活动
5. **为你的 Cloudflare 账户启用 2FA**
6. **定期审查** API token 权限

## 更新配置

要更新任何配置：

1. 在 GitHub Settings 中更新 secret
2. 重新运行 workflow：
   - 进入 Actions > 最新的 workflow
   - 点击"Re-run jobs" > "Re-run all jobs"

或推送新的提交以触发自动部署。

## 本地开发

对于不使用 GitHub Actions 的本地开发：

1. 复制 `wrangler.toml.template` 到 `wrangler.toml`
2. 将所有 `$VARIABLE` 占位符替换为实际值
3. 本地运行：
   ```bash
   npm run dev
   ```

**重要**：永远不要提交包含真实凭据的 `wrangler.toml`！

## 支持

- **安全设置指南**：查看 `docs/SECURITY_SETUP.md`
- **问题报告**：在 GitHub 上开启 issue
