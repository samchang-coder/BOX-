import express from 'express';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'budget.json');

const DEFAULT_CATEGORIES = ['吃', '喝', '玩', '樂', '其他'];

function loadData() {
  let data;
  if (!fs.existsSync(DATA_FILE)) {
    data = { categories: [...DEFAULT_CATEGORIES], members: [], records: [] };
  } else {
    try {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch {
      data = { categories: [...DEFAULT_CATEGORIES], members: [], records: [] };
    }
  }
  if (!Array.isArray(data.members)) {
    data.members = [];
  }
  return data;
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

router.get('/members', (req, res) => {
  res.json({ members: loadData().members });
});

router.post('/members', (req, res) => {
  const name = (req.body?.name ?? '').trim();
  if (!name) {
    return res.status(400).json({ error: '人員名稱為必填' });
  }
  const data = loadData();
  if (data.members.includes(name)) {
    return res.status(400).json({ error: '人員已存在' });
  }
  data.members.push(name);
  saveData(data);
  res.json({ members: data.members });
});

router.delete('/members/:name', (req, res) => {
  const data = loadData();
  data.members = data.members.filter((m) => m !== req.params.name);
  saveData(data);
  res.json({ members: data.members });
});

router.get('/records', (req, res) => {
  const { start, end, member } = req.query;
  const all = loadData().records;
  let records;

  if (start || end) {
    records = all.filter((r) => (!start || r.date >= start) && (!end || r.date <= end));
  } else {
    const month = req.query.month || taipeiToday().slice(0, 7);
    records = all.filter((r) => r.date.startsWith(month));
  }

  if (member) {
    records = records.filter((r) => r.member === member);
  }

  records.sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({ records });
});

router.post('/records', (req, res) => {
  const { date, category, amount, note, member } = req.body ?? {};
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
    member: (member ?? '').trim(),
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
