'use strict';

/**
 * 澄时 ClearTime — 任务拆解接口
 * Vercel Serverless Function：部署后自动映射为 POST /api/breakdown
 *
 * DeepSeek key 不写在这里，而是通过 Vercel 后台配置环境变量：
 *   Project → Settings → Environment Variables → 名称 DEEPSEEK_API_KEY
 * 本地开发请用根目录的 server.js（也读同一个环境变量）。
 */

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: '只支持 POST' });
    return;
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY 环境变量' });
    return;
  }

  try {
    const { task } = req.body || {};
    if (!task || !String(task).trim()) {
      res.status(400).json({ error: '任务不能为空' });
      return;
    }
    const steps = await callDeepSeek(String(task).trim());
    res.status(200).json({ steps });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};

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
      'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY
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

function parseSteps(content) {
  let text = String(content).trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

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
