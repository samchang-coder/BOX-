const monthInput = document.getElementById('month-input');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const totalAmountEl = document.getElementById('total-amount');
const categoryBreakdownEl = document.getElementById('category-breakdown');
const recordForm = document.getElementById('record-form');
const recordDateInput = document.getElementById('record-date');
const recordCategorySelect = document.getElementById('record-category');
const recordAmountInput = document.getElementById('record-amount');
const recordNoteInput = document.getElementById('record-note');
const recordListEl = document.getElementById('record-list');
const categoryListEl = document.getElementById('category-list');
const categoryForm = document.getElementById('category-form');
const newCategoryNameInput = document.getElementById('new-category-name');

let categories = [];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function taipeiToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
}

function currentMonth() {
  return taipeiToday().slice(0, 7);
}

function formatMoney(n) {
  return `$${n.toLocaleString('zh-TW')}`;
}

async function loadCategories() {
  const res = await fetch('/api/budget/categories');
  const data = await res.json();
  categories = data.categories;
  renderCategorySelect();
  renderCategoryList();
}

function renderCategorySelect() {
  const previous = recordCategorySelect.value;
  recordCategorySelect.innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');
  if (categories.includes(previous)) {
    recordCategorySelect.value = previous;
  }
}

function renderCategoryList() {
  categoryListEl.innerHTML = categories
    .map(
      (c) => `<li>${escapeHtml(c)} <button type="button" class="del-category" data-name="${escapeHtml(c)}">刪除</button></li>`
    )
    .join('');
}

async function loadRecords() {
  const month = monthInput.value;
  const res = await fetch(`/api/budget/records?month=${encodeURIComponent(month)}`);
  const data = await res.json();
  renderRecords(data.records);
  renderSummary(data.records);
}

function renderRecords(records) {
  if (records.length === 0) {
    recordListEl.innerHTML = '<li class="empty">這個月還沒有紀錄</li>';
    return;
  }
  recordListEl.innerHTML = records
    .map(
      (r) => `
      <li data-id="${r.id}">
        <span class="record-date">${escapeHtml(r.date)}</span>
        <span class="record-category">${escapeHtml(r.category)}</span>
        <span class="record-note">${escapeHtml(r.note)}</span>
        <span class="record-amount">${formatMoney(r.amount)}</span>
        <button type="button" class="del-record" data-id="${r.id}">刪除</button>
      </li>`
    )
    .join('');
}

function renderSummary(records) {
  const total = records.reduce((sum, r) => sum + r.amount, 0);
  totalAmountEl.textContent = formatMoney(total);

  const byCategory = {};
  for (const r of records) {
    byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
  }
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  categoryBreakdownEl.innerHTML = sorted
    .map(([name, amount]) => `<li><span>${escapeHtml(name)}</span><span>${formatMoney(amount)}</span></li>`)
    .join('');
}

function shiftMonth(delta) {
  const [y, m] = monthInput.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  loadRecords();
}

monthInput.addEventListener('change', loadRecords);
prevMonthBtn.addEventListener('click', () => shiftMonth(-1));
nextMonthBtn.addEventListener('click', () => shiftMonth(1));

recordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    date: recordDateInput.value,
    category: recordCategorySelect.value,
    amount: recordAmountInput.value,
    note: recordNoteInput.value,
  };
  const res = await fetch('/api/budget/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || '新增失敗');
    return;
  }
  recordAmountInput.value = '';
  recordNoteInput.value = '';
  await loadRecords();
});

recordListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.del-record');
  if (!btn) return;
  await fetch(`/api/budget/records/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
  await loadRecords();
});

categoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = newCategoryNameInput.value.trim();
  if (!name) return;
  const res = await fetch('/api/budget/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || '新增分類失敗');
    return;
  }
  newCategoryNameInput.value = '';
  await loadCategories();
});

categoryListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.del-category');
  if (!btn) return;
  await fetch(`/api/budget/categories/${encodeURIComponent(btn.dataset.name)}`, { method: 'DELETE' });
  await loadCategories();
});

(async function init() {
  monthInput.value = currentMonth();
  recordDateInput.value = taipeiToday();
  await loadCategories();
  await loadRecords();
})();
