/**
 * 澄时 ClearTime — 后端服务
 * 作用：代理 DeepSeek，做「任务拆解」
 *
 * 零依赖：只用 Node 内置的 http / fs / fetch（Node 18+ 即可）
 *
 * 运行：
 *   1. 在下方 DEEPSEEK_API_KEY 里填你的 key
 *   2. 终端执行：node server.js
 *   3. 浏览器打开 http://localhost:3000
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

/* ============ 配置 ============ */
// ★ 在这里填你的 DeepSeek API Key（sk- 开头）
//   更推荐用环境变量：命令行 set DEEPSEEK_API_KEY=sk-xxx 后运行
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat'; // 拆任务用 deepseek-chat 足够，便宜又快
const PORT = 3000;

/* ============ 静态文件 + 路由 ============ */
const server = http.createServer(function (req, res) {
  // 允许跨域（方便调试）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  // 首页
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
    return;
  }

  // 拆解接口
  if (req.method === 'POST' && url.pathname === '/api/breakdown') {
    handleBreakdown(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

function serveFile(res, filePath, type) {
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('读取文件失败：' + filePath);
      return;
    }
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
    res.end(data);
  });
}

/* ============ 拆解接口 ============ */
function handleBreakdown(req, res) {
  let body = '';
  req.on('data', function (c) { body += c; });
  req.on('end', async function () {
    try {
      const { task } = JSON.parse(body);
      if (!task || !String(task).trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '任务不能为空' }));
        return;
      }
      const steps = await callDeepSeek(String(task).trim());
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ steps }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e && e.message ? e.message : String(e) }));
    }
  });
}

/* ============ 调 DeepSeek ============ */
async function callDeepSeek(task) {
  const system =
    '你是一位专为 ADHD 中学生设计的任务拆解助手。把用户输入的大任务拆成 4~6 个具体、能立刻动手的小步骤。\n' +
    '要求：\n' +
    '1. 每个步骤用动词开头，足够具体；\n' +
    '2. 每步小到 2~10 分钟就能完成，让人不会犹豫从哪开始；\n' +
    '3. 有明确的完成标准。\n' +
    '严格只输出 JSON，不要任何其他文字，格式：\n' +
    '{"steps":[{"text":"步骤内容","minutes":5}]}\n' +
    'minutes 是完成该步大约需要的整数分钟。';

  const resp = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: task }
      ],
      temperature: 0.6,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('DeepSeek 调用失败（HTTP ' + resp.status + '）：' + text.slice(0, 300));
  }

  const data = await resp.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';

  return parseSteps(content);
}

/* ============ 稳健解析模型返回的 JSON ============ */
function parseSteps(content) {
  let text = String(content).trim();

  // 去掉可能的 ```json ... ``` 包裹
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  // 截取第一个 { 到最后一个 }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) text = text.slice(start, end + 1);

  const obj = JSON.parse(text);
  const steps = (obj.steps || [])
    .map(function (s) {
      return {
        text: String(s.text || s.title || '').trim(),
        minutes: Math.max(1, Math.round(Number(s.minutes) || 5))
      };
    })
    .filter(function (s) { return s.text; });

  if (!steps.length) throw new Error('模型没有返回有效步骤');
  return steps;
}

server.listen(PORT, function () {
  console.log('澄时 ClearTime 已启动：http://localhost:' + PORT);
  if (DEEPSEEK_API_KEY) {
    console.log('DeepSeek API Key：已配置 ✔');
  } else {
    console.log('⚠ 未配置 DeepSeek API Key，任务拆解接口会报错。');
    console.log('  设置方法（PowerShell）：$env:DEEPSEEK_API_KEY="sk-你的key"; node server.js');
  }
});
