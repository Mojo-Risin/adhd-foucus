# 澄时 ClearTime

一个为 ADHD 中学生设计的学习辅助网站，包含三个功能：

1. **AI 任务拆解** —— 把「写一篇 2000 字论文」这种大任务拆成 4~6 个能立刻动手的小步骤
2. **可视化计时器** —— 不显示数字的色块计时，缓解时间盲（time blindness）
3. **共学陪伴（Body Doubling）** —— 一个陪你一起专注的小人，缓解任务启动困难

## 技术栈

- 前端：单文件 `index.html`（原生 HTML/CSS/JS，无框架）
- 后端：零依赖 Node.js（原生 `http` + `fetch`）
- AI：DeepSeek（`deepseek-chat`，OpenAI 兼容接口）

---

## 一、部署到 Vercel（上线，免费）

> Vercel 免费版**不需要绑信用卡**；用你已有的 GitHub 账号登录即可。

### 第 1 步：把项目推到 GitHub

在项目目录里依次执行：

```bash
git init
git add .
git commit -m "初版：AI 任务拆解 + 可视化计时器 + 共学"
```

然后到 github.com 新建一个仓库（比如 `adhd-focus`，Public 公开即可），按页面提示把本地推上去：

```bash
git branch -M main
git remote add origin https://github.com/你的用户名/adhd-focus.git
git push -u origin main
```

### 第 2 步：在 Vercel 导入项目

1. 打开 vercel.com，点 **Sign Up**，选择 **Continue with GitHub**（用 GitHub 登录）
2. 登录后点 **Add New → Project**，找到 `adhd-focus` 仓库，点 **Import**
3. Vercel 会自动识别（框架显示 Other / Node 都正常），直接点 **Deploy**

### 第 3 步：配置 DeepSeek key（重要）

1. 项目页点 **Settings → Environment Variables**
2. Name 填 `DEEPSEEK_API_KEY`，Value 填你的 key（`sk-...`）
3. 点 Save 后，回到 **Deployments** 点 **Redeploy**（重新部署一次，让环境变量生效）

### 第 4 步：拿到网址

部署完成后 Vercel 会给你一个 `https://xxx.vercel.app` 的链接，点开就能用，发给任何人都能访问。

> ⚠ 国内访问 `*.vercel.app` 可能较慢或需要代理；如果你的评委在国内，可考虑改用国内云服务器或内网穿透。

---

## 二、本地开发

```bash
# Windows PowerShell（先设置 key）
$env:DEEPSEEK_API_KEY="sk-你的key"
node server.js
```

然后浏览器打开 http://localhost:3000

> 后端没启动时，「AI 任务拆解」会自动回退到本地规则模拟，不影响演示另外两个功能。

---

## 三、目录结构

```
adhd-focus/
├── index.html          # 全部前端（三个功能 + 设计系统 + 动效）
├── server.js           # 本地开发后端（Node http，不部署）
├── api/breakdown.js    # Vercel 线上后端（serverless 函数）
├── package.json        # 声明 Node 版本（Vercel 用）
├── .vercelignore       # 排除本地后端，不部署到线上
├── .gitignore
└── .env.example        # 环境变量示例
```
