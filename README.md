# Cloudflare R2 WebDAV Server

这个项目实现了一个基于 Cloudflare Workers 和 R2 存储的 WebDAV 服务器，配备企业级安全功能。

## ✨ 特性

### 核心功能
- 完全兼容 WebDAV 协议
- 基于 Cloudflare Workers，无需管理服务器
- 使用 Cloudflare R2 作为存储后端（免费额度慷慨）
- 支持文件上传、下载、删除、移动和复制操作
- 支持目录创建和列表
- 内置 Web UI 界面

### 🔒 安全功能（阶段 1-3）

#### 阶段 1：基础安全
- ✅ **PBKDF2 密码哈希** - 100,000 次迭代，安全存储密码
- ✅ **JWT 认证** - 短期访问令牌（15分钟）+ 长期刷新令牌（7天）
- ✅ **多层级限流** - IP/用户/组合三重保护，防止暴力破解
- ✅ **CORS 保护** - 仅允许指定域名访问
- ✅ **路径遍历防护** - 验证所有文件路径
- ✅ **文件验证** - 扩展名白名单、大小限制、MIME 类型检查
- ✅ **存储配额** - 跟踪使用量，强制执行限制

#### 阶段 2：双因素认证
- ✅ **RFC 6238 TOTP** - 标准 30 秒窗口，±1 容差
- ✅ **恢复码** - 10 个一次性使用备份码（PBKDF2 哈希）
- ✅ **WebDAV 集成** - 通过自定义头部支持 Basic Auth
- ✅ **无绕过** - 启用后在所有认证方法上强制执行 2FA

#### 阶段 3：WebAuthn Passkeys
- ✅ **无密码登录** - 使用生物识别或安全密钥认证
- ✅ **平台认证器** - Touch ID、Face ID、Windows Hello
- ✅ **跨平台认证器** - YubiKey、安全密钥
- ✅ **多算法支持** - ES256（ECDSA P-256）和 RS256（RSA）
- ✅ **重放保护** - 基于 counter 的防重放
- ✅ **抗钓鱼** - 凭证与域名绑定

### 认证方式对比

| 方式 | 安全性 | 便利性 | 抗钓鱼 |
|------|--------|--------|--------|
| 密码登录 | ⭐⭐ | ⭐⭐⭐ | ❌ |
| 密码 + TOTP | ⭐⭐⭐⭐ | ⭐⭐ | ❌ |
| **Passkey** | **⭐⭐⭐⭐⭐** | **⭐⭐⭐⭐⭐** | **✅** |

## 📚 部署文档

### 快速开始

**完整部署指南**（包含所有安全功能配置）：
- 🇨🇳 **[中文部署指南](docs/DEPLOYMENT_CN.md)** - 推荐查看
- 🇬🇧 **[English Deployment Guide](docs/DEPLOYMENT.md)**

**安全设置文档**：
- **[安全功能设置指南](docs/SECURITY_SETUP.md)** - 阶段 1-3 详细说明
- **[阶段 3 实施指南](docs/STAGE3_IMPLEMENTATION_GUIDE.md)** - WebAuthn Passkeys 技术文档

## 一键部署到 Cloudflare Workers

点击下面的按钮，一键将此项目部署到您的Cloudflare Workers账户：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/amm10090/CFr2-webdav)

注意：需要有 Cloudflare 账户才能使用此功能。如果您还没有账户，可以在 [Cloudflare 官网](https://www.cloudflare.com) 注册。

## 🚀 手动部署步骤（GitHub Actions）

### 必需的 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 中配置以下 secrets：

#### 基础配置（必需）
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 账户 ID
- `BUCKET_NAME` - R2 存储桶名称

#### 安全配置（必需 - 阶段 1-3）
- `USERNAME` - 管理员用户名
- `PASSWORD_HASH` - PBKDF2 密码哈希
- `JWT_SECRET` - JWT 签名密钥
- `WORKER_URL` - Worker URL
- `RATE_LIMIT_KV_ID` - 限流 KV 命名空间 ID
- `QUOTA_KV_ID` - 配额 KV 命名空间 ID
- `TOTP_KV_ID` - 2FA KV 命名空间 ID

### 详细步骤

**请查看完整的部署指南**：
- 🇨🇳 [中文部署指南](docs/DEPLOYMENT_CN.md) - 包含详细步骤、KV 创建、密钥生成等
- 🇬🇧 [English Deployment Guide](docs/DEPLOYMENT.md)

部署指南包含：
1. 创建 KV 命名空间的详细说明
2. 生成密码哈希和 JWT 密钥的方法
3. 创建 Cloudflare API Token 的完整流程
4. 配置所有必需 GitHub Secrets 的清单
5. 故障排查和验证步骤

## 使用方法

### WebDAV 客户端

使用任何支持 WebDAV 协议的客户端连接到您的 Worker URL：

#### 使用密码认证
```
URL: https://your-worker.workers.dev/webdav/
用户名: admin
密码: your-password
```

#### 使用 Bearer Token 认证
```bash
# 1. 获取访问令牌
curl -X POST https://your-worker.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# 2. 使用令牌访问
curl https://your-worker.workers.dev/webdav/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 使用 2FA（如果已启用）
```bash
# 方法 1：使用 Basic Auth + X-TOTP-Code 头部
curl -u admin:your-password \
  -H "X-TOTP-Code: 123456" \
  https://your-worker.workers.dev/webdav/

# 方法 2：先登录获取 partial token，再验证 2FA
curl -X POST https://your-worker.workers.dev/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"partialToken":"PARTIAL_TOKEN","code":"123456"}'
```

#### 使用 Passkey 无密码登录（阶段 3）
参见 [SECURITY_SETUP.md](docs/SECURITY_SETUP.md#stage-3-webauthn-passkeys-) 中的浏览器客户端示例。

### 推荐的 WebDAV 客户端

- **Windows**: RaiDrive, Cyberduck
- **macOS**: Finder（内置）、Cyberduck
- **Linux**: Nautilus（GNOME）、Dolphin（KDE）
- **iOS**: Documents by Readdle
- **Android**: Solid Explorer, X-plore

## 本地开发

如果您需要在本地进行开发和测试：

1. 克隆仓库：
   ```bash
   git clone https://github.com/amm10090/CFr2-webdav.git
   cd CFr2-webdav
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 复制并配置 wrangler.toml：
   ```bash
   cp wrangler.toml.template wrangler.toml
   # 编辑 wrangler.toml，替换所有 $VARIABLE 占位符
   ```

4. 启动本地开发服务器：
   ```bash
   npm run dev
   ```

**注意**：
- 永远不要提交包含真实凭据的 `wrangler.toml`！
- 本地开发可能无法完全模拟 Cloudflare Workers 环境

## ⚠️ 安全注意事项

1. **永远不要提交 secrets** 到 Git 仓库
2. **使用强密码** 并通过 PBKDF2 哈希存储
3. **定期轮换** JWT_SECRET 和 API tokens
4. **启用 2FA** 以提高账户安全性
5. **启用 Passkeys** 以获得最高级别的安全和便利
6. **监控 Worker 日志** 以发现可疑活动
7. **定期更新依赖** 以确保安全性
8. **遵守 Cloudflare** 的使用政策和条款

## 📖 文档索引

- [中文部署指南](docs/DEPLOYMENT_CN.md) - 完整的部署步骤
- [English Deployment Guide](docs/DEPLOYMENT.md) - Full deployment instructions
- [安全功能设置指南](docs/SECURITY_SETUP.md) - 阶段 1-3 安全功能详解
- [阶段 3 实施指南](docs/STAGE3_IMPLEMENTATION_GUIDE.md) - WebAuthn 技术文档

## 🤝 贡献

欢迎提交 Pull Requests 或创建 Issues 来改进这个项目！

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

本项目使用以下技术构建：
- Cloudflare Workers - 边缘计算平台
- Cloudflare R2 - 对象存储
- Cloudflare KV - 键值存储
- WebAuthn - W3C 无密码认证标准
- TOTP - RFC 6238 双因素认证
