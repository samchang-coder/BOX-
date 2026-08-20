import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import budgetRouter from './budget.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/api/budget', budgetRouter);

const client = new Anthropic(); // 從環境變數 ANTHROPIC_API_KEY 讀取金鑰

const SYSTEM_PROMPT = '你的名字叫管家，是一個友善、精簡的中文 AI 助理，樂於協助使用者解決各種問題。回答時清楚直接，避免不必要的贅述。';

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

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 為必填，且需為陣列' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  const lastUserMessage = messages[messages.length - 1];
  let fullReply = '';

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      thinking: { type: 'disabled' },
      output_config: { effort: 'medium' },
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text);
        fullReply += event.delta.text;
      }
    }

    await stream.finalMessage();
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
