import express from 'express';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'budget.json');

const DEFAULT_CATEGORIES = ['吃', '喝', '玩', '樂', '其他'];

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { categories: [...DEFAULT_CATEGORIES], records: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return { categories: [...DEFAULT_CATEGORIES], records: [] };
  }
}

function saveData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function taipeiToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
}

const router = express.Router();

router.get('/categories', (req, res) => {
  res.json({ categories: loadData().categories });
});

router.post('/categories', (req, res) => {
  const name = (req.body?.name ?? '').trim();
  if (!name) {
    return res.status(400).json({ error: '分類名稱為必填' });
  }
  const data = loadData();
  if (data.categories.includes(name)) {
    return res.status(400).json({ error: '分類已存在' });
  }
  data.categories.push(name);
  saveData(data);
  res.json({ categories: data.categories });
});

router.delete('/categories/:name', (req, res) => {
  const data = loadData();
  data.categories = data.categories.filter((c) => c !== req.params.name);
  saveData(data);
  res.json({ categories: data.categories });
});

router.get('/records', (req, res) => {
  const month = req.query.month || taipeiToday().slice(0, 7);
  const records = loadData()
    .records.filter((r) => r.date.startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({ month, records });
});

router.post('/records', (req, res) => {
  const { date, category, amount, note } = req.body ?? {};
  const parsedAmount = Number(amount);

  if (!date || !category || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: '日期、分類、金額為必填，金額需大於 0' });
  }

  const data = loadData();
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date,
    category,
    amount: parsedAmount,
    note: (note ?? '').trim(),
  };
  data.records.push(record);
  saveData(data);
  res.json({ record });
});

router.delete('/records/:id', (req, res) => {
  const data = loadData();
  data.records = data.records.filter((r) => r.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

export default router;
