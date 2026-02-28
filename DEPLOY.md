# AI Notebook 部署说明

将本项目部署到公网后，其他人可通过链接访问并使用笔记本。

## 一、本地先确认能跑通

在项目根目录：

```bash
# 安装依赖（根目录、前端、后端各装一次，或只装后端用于生产）
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 构建前端并复制到 backend/public
npm run build

# 以生产模式启动（会托管前端静态资源）
# Windows PowerShell：
$env:NODE_ENV="production"; cd backend; node index.js

# macOS / Linux：
NODE_ENV=production cd backend && node index.js
```

浏览器访问 `http://localhost:4000`，应看到完整页面且无留白。

---

## 二、部署到 Render（免费）

1. 将代码推到 **GitHub**（或 GitLab）仓库。

2. 打开 [Render](https://render.com) 并登录，点击 **New → Web Service**。

3. 连接你的仓库，配置如下：
   - **Root Directory**：留空（使用仓库根目录）。
   - **Build Command**：`npm install && cd frontend && npm install && npm run build && cd ../backend && npm install && node build-public.js`
   - **Start Command**：`cd backend && node index.js`
   - **Environment**：添加变量 `NODE_ENV` = `production`（Render 生产环境通常会自动设置）。

4. 如需 AI 搜索使用 OpenAI，在 Render 的 **Environment** 里添加：
   - `OPENAI_API_KEY` = 你的 API Key

5. 部署完成后，Render 会给你一个地址，例如：  
   `https://ai-notebook-xxxx.onrender.com`  
   把这个链接发给别人即可使用。

> 注意：免费实例一段时间无访问会休眠，首次打开可能较慢；笔记数据存在内存中，重启服务会清空，如需持久化可后续接数据库。

---

## 三、部署到 Railway / 其他平台

- **Railway**：New Project → 从 GitHub 部署 → 在设置里把 **Build** 设为 `npm run build`，**Start** 设为 `npm run start`，并设置 `NODE_ENV=production`。
- **Fly.io / 自有服务器**：在服务器上执行 `git clone`、`npm run build`、`npm run start`，并确保 `NODE_ENV=production`，用 Nginx 或 Caddy 反代到 4000 端口即可。

---

## 四、页面铺满、无留白

当前前端已做：

- `html` / `body` / `#root` 占满视口，无多余边距。
- 主布局使用 `height: 100%`、`min-height: 100vh`、`overflow: hidden`，避免出现留白或双滚动条。

部署后若仍有留白，多半是浏览器缩放或移动端视口问题，可再根据设备做一次媒体查询微调。
