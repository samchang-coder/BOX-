import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import budgetRouter from './budget.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/api/budget', budgetRouter);

const client = new Anthropic(); // 從環境變數 ANTHROPIC_API_KEY 讀取金鑰

const SYSTEM_PROMPT = '你的名字叫管家，是一個友善、精簡的中文 AI 助理，樂於協助使用者解決各種問題。回答時清楚直接，避免不必要的贅述。';

// 回答來源：api（預設，用 ANTHROPIC_API_KEY，需要 API 額度）
// 或 claude-cli（暫時方案：借用本機已登入的 Claude Code，吃訂閱額度，只適合自己在本機測試）
const CHAT_BACKEND = process.env.CHAT_BACKEND || 'api';
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const CLAUDE_CLI_MODEL = process.env.CLAUDE_CLI_MODEL || 'haiku';
// API 模式用的模型。Haiku 4.5 不支援 effort 參數，所以請求裡不要帶 output_config
const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5';

const LOG_DIR = path.join(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

function taipeiDateForFilename(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(date);
}

function taipeiTimestamp(date) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

function appendChatLog({ question, reply }) {
  const now = new Date();
  const logFile = path.join(LOG_DIR, `${taipeiDateForFilename(now)}.log`);
  const entry = { time: taipeiTimestamp(now), question, reply };
  fs.appendFile(logFile, JSON.stringify(entry) + '\n', (err) => {
    if (err) console.error('寫入對話 log 失敗：', err);
  });
}

// 把對話紀錄轉成一段純文字，交給 claude CLI
function buildCliPrompt(messages) {
  const lines = messages.map((m) => `${m.role === 'user' ? '使用者' : '管家'}：${m.content}`);
  return `${lines.join('\n\n')}\n\n請以管家的身分，直接回覆使用者的最後一則訊息（不要加「管家：」前綴）。`;
}

// 暫時方案：呼叫本機 claude CLI，逐段產出文字。關閉所有工具，只讓它純聊天。
async function* streamFromClaudeCli(messages) {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guanjia-'));
  // 不能把 API Key 傳給 claude CLI，否則它會改用 API 額度，而不是本機的訂閱登入
  const childEnv = { ...process.env };
  delete childEnv.ANTHROPIC_API_KEY;
  delete childEnv.ANTHROPIC_AUTH_TOKEN;
  const child = spawn(
    CLAUDE_BIN,
    [
      '-p',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--no-session-persistence',
      '--tools', '',
      '--strict-mcp-config',
      '--disable-slash-commands',
      '--model', CLAUDE_CLI_MODEL,
      '--system-prompt', SYSTEM_PROMPT,
    ],
    { cwd: scratchDir, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  );

  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  child.stdin.end(buildCliPrompt(messages));

  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  let buffer = '';
  let streamed = false;
  let finalText = '';
  let cliError = null;

  for await (const chunk of child.stdout) {
    buffer += chunk.toString('utf8');
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let evt;
      try { evt = JSON.parse(line); } catch { continue; }
      if (evt.type === 'stream_event' && evt.event?.type === 'content_block_delta' && evt.event.delta?.type === 'text_delta') {
        streamed = true;
        yield evt.event.delta.text;
      } else if (evt.type === 'result') {
        if (evt.is_error) cliError = evt.result || 'claude CLI 回傳錯誤';
        else finalText = evt.result || '';
      }
    }
  }

  const code = await exited;
  fs.rm(scratchDir, { recursive: true, force: true }, () => {});
  if (cliError) throw new Error(cliError);
  if (code !== 0 && !streamed && !finalText) throw new Error(`claude CLI 結束碼 ${code}：${stderr.trim()}`);
  if (!streamed && finalText) yield finalText;
}

async function* streamFromApi(messages) {
  const stream = client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
  await stream.finalMessage();
}

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 為必填，且需為陣列' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  const lastUserMessage = messages[messages.length - 1];
  let fullReply = '';

  try {
    const source = CHAT_BACKEND === 'claude-cli' ? streamFromClaudeCli(messages) : streamFromApi(messages);
    for await (const text of source) {
      res.write(text);
      fullReply += text;
    }
  } catch (err) {
    console.error('呼叫 Claude API 失敗：', err);
    if (!res.headersSent) {
      res.status(500);
    }
    const errorText = '\n\n[錯誤] 呼叫 AI 服務時發生問題，請稍後再試。';
    res.write(errorText);
    fullReply += errorText;
  } finally {
    res.end();
    appendChatLog({ question: lastUserMessage?.content ?? null, reply: fullReply });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI 助理伺服器已啟動：http://localhost:${PORT}`);
});
