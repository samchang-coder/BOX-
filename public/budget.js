const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

const monthInput = document.getElementById('month-input');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const totalAmountEl = document.getElementById('total-amount');
const categoryBreakdownEl = document.getElementById('category-breakdown');
const memberBreakdownEl = document.getElementById('member-breakdown');
const recordForm = document.getElementById('record-form');
const recordDateInput = document.getElementById('record-date');
const recordCategorySelect = document.getElementById('record-category');
const recordAmountInput = document.getElementById('record-amount');
const recordNoteInput = document.getElementById('record-note');
const recordMemberSelect = document.getElementById('record-member');
const recordListEl = document.getElementById('record-list');
const categoryListEl = document.getElementById('category-list');
const categoryForm = document.getElementById('category-form');
const newCategoryNameInput = document.getElementById('new-category-name');
const memberListEl = document.getElementById('member-list');
const memberForm = document.getElementById('member-form');
const newMemberNameInput = document.getElementById('new-member-name');

const rangeForm = document.getElementById('range-form');
const rangeStartInput = document.getElementById('range-start');
const rangeEndInput = document.getElementById('range-end');
const rangeMemberSelect = document.getElementById('range-member');
const rangeTotalAmountEl = document.getElementById('range-total-amount');
const rangeCategoryBreakdownEl = document.getElementById('range-category-breakdown');
const rangeMemberBreakdownEl = document.getElementById('range-member-breakdown');
const rangeRecordListEl = document.getElementById('range-record-list');

let categories = [];
let members = [];

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

const CATEGORY_ICONS = { 吃: '🍜', 喝: '🥤', 玩: '🎮', 樂: '🎉', 其他: '📦' };
const CATEGORY_PALETTE = ['#b5794a', '#c17b52', '#8f8558', '#c79a3f', '#5f8f78', '#a85d6e', '#6a7f9e'];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function categoryIcon(name) {
  return CATEGORY_ICONS[name] || '🐾';
}

function categoryColor(name) {
  return CATEGORY_PALETTE[hashCode(name) % CATEGORY_PALETTE.length];
}

function memberColor(name) {
  return CATEGORY_PALETTE[(hashCode(name) + 3) % CATEGORY_PALETTE.length];
}

/* Tabs */

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
    tabPanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`));
  });
});

/* Categories & members */

async function loadCategories() {
  const res = await fetch('/api/budget/categories');
  const data = await res.json();
  categories = data.categories;
  renderCategorySelect();
  renderCategoryList();
}

async function loadMembers() {
  const res = await fetch('/api/budget/members');
  const data = await res.json();
  members = data.members;
  renderMemberSelect();
  renderRangeMemberSelect();
  renderMemberList();
}

function renderCategorySelect() {
  const previous = recordCategorySelect.value;
  recordCategorySelect.innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c)}">${categoryIcon(c)} ${escapeHtml(c)}</option>`)
    .join('');
  if (categories.includes(previous)) {
    recordCategorySelect.value = previous;
  }
}

function renderCategoryList() {
  categoryListEl.innerHTML = categories
    .map(
      (c) => `
      <li>
        <span class="cat-dot" style="background:${categoryColor(c)}"></span>
        ${categoryIcon(c)} ${escapeHtml(c)}
        <button type="button" class="del-category" data-name="${escapeHtml(c)}" aria-label="刪除分類">×</button>
      </li>`
    )
    .join('');
}

function renderMemberSelect() {
  const previous = recordMemberSelect.value;
  recordMemberSelect.innerHTML =
    '<option value="">未指定</option>' +
    members.map((m) => `<option value="${escapeHtml(m)}">👤 ${escapeHtml(m)}</option>`).join('');
  if (members.includes(previous)) {
    recordMemberSelect.value = previous;
  }
}

function renderRangeMemberSelect() {
  const previous = rangeMemberSelect.value;
  rangeMemberSelect.innerHTML =
    '<option value="">全部人員</option>' +
    members.map((m) => `<option value="${escapeHtml(m)}">👤 ${escapeHtml(m)}</option>`).join('');
  if (members.includes(previous)) {
    rangeMemberSelect.value = previous;
  }
}

function renderMemberList() {
  memberListEl.innerHTML = members
    .map(
      (m) => `
      <li>
        <span class="cat-dot" style="background:${memberColor(m)}"></span>
        👤 ${escapeHtml(m)}
        <button type="button" class="del-member" data-name="${escapeHtml(m)}" aria-label="刪除人員">×</button>
      </li>`
    )
    .join('');
}

/* Rendering records & summaries (shared by ledger tab and stats tab) */

function renderRecordsInto(listEl, records, emptyText) {
  if (records.length === 0) {
    listEl.innerHTML = `<li class="empty">${escapeHtml(emptyText)}</li>`;
    return;
  }
  listEl.innerHTML = records
    .map(
      (r) => `
      <li data-id="${r.id}">
        <span class="record-date">${escapeHtml(r.date)}</span>
        <span class="record-category" style="background:${categoryColor(r.category)}">${categoryIcon(r.category)} ${escapeHtml(r.category)}</span>
        ${r.member ? `<span class="record-member" style="border-color:${memberColor(r.member)}">👤 ${escapeHtml(r.member)}</span>` : ''}
        <span class="record-note">${escapeHtml(r.note)}</span>
        <span class="record-amount">${formatMoney(r.amount)}</span>
        <button type="button" class="del-record" data-id="${r.id}" aria-label="刪除紀錄">×</button>
      </li>`
    )
    .join('');
}

function renderBreakdownInto(listEl, entries, total) {
  if (entries.length === 0) {
    listEl.innerHTML = '';
    return;
  }
  listEl.innerHTML = entries
    .map(([name, amount, icon]) => {
      const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
      return `
        <li>
          <span class="cat-breakdown-name">${icon} ${escapeHtml(name)}</span>
          <span class="cat-bar-track"><span class="cat-bar-fill" style="width:${pct}%"></span></span>
          <span class="cat-breakdown-amount">${formatMoney(amount)}</span>
        </li>`;
    })
    .join('');
}

function renderSummaryInto({ totalEl, categoryEl, memberEl }, records, emptyText) {
  const total = records.reduce((sum, r) => sum + r.amount, 0);
  totalEl.textContent = formatMoney(total);

  const byCategory = {};
  for (const r of records) {
    byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
  }
  const categoryEntries = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => [name, amount, categoryIcon(name)]);

  if (categoryEntries.length === 0) {
    categoryEl.innerHTML = `<li class="summary-empty">${escapeHtml(emptyText)}</li>`;
  } else {
    renderBreakdownInto(categoryEl, categoryEntries, total);
  }

  const byMember = {};
  for (const r of records) {
    if (!r.member) continue;
    byMember[r.member] = (byMember[r.member] || 0) + r.amount;
  }
  const memberEntries = Object.entries(byMember)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => [name, amount, '👤']);
  renderBreakdownInto(memberEl, memberEntries, total);
}

/* Ledger tab (current month) */

async function loadRecords() {
  const month = monthInput.value;
  const res = await fetch(`/api/budget/records?month=${encodeURIComponent(month)}`);
  const data = await res.json();
  renderRecordsInto(recordListEl, data.records, '這個月還沒有紀錄');
  renderSummaryInto(
    { totalEl: totalAmountEl, categoryEl: categoryBreakdownEl, memberEl: memberBreakdownEl },
    data.records,
    '這個月還沒有花費紀錄'
  );
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
    member: recordMemberSelect.value,
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

memberForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = newMemberNameInput.value.trim();
  if (!name) return;
  const res = await fetch('/api/budget/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || '新增人員失敗');
    return;
  }
  newMemberNameInput.value = '';
  await loadMembers();
});

memberListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.del-member');
  if (!btn) return;
  await fetch(`/api/budget/members/${encodeURIComponent(btn.dataset.name)}`, { method: 'DELETE' });
  await loadMembers();
});

/* Stats tab (date range) */

async function loadRange() {
  const start = rangeStartInput.value;
  const end = rangeEndInput.value;
  const member = rangeMemberSelect.value;
  if (!start || !end) return;
  const params = new URLSearchParams({ start, end });
  if (member) params.set('member', member);
  const res = await fetch(`/api/budget/records?${params.toString()}`);
  const data = await res.json();
  const emptyText = member ? `這個區間 ${member} 還沒有紀錄` : '這個區間還沒有紀錄';
  renderRecordsInto(rangeRecordListEl, data.records, emptyText);
  renderSummaryInto(
    { totalEl: rangeTotalAmountEl, categoryEl: rangeCategoryBreakdownEl, memberEl: rangeMemberBreakdownEl },
    data.records,
    member ? `這個區間 ${member} 還沒有花費紀錄` : '這個區間還沒有花費紀錄'
  );
}

rangeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loadRange();
});

rangeMemberSelect.addEventListener('change', loadRange);
rangeStartInput.addEventListener('change', loadRange);
rangeEndInput.addEventListener('change', loadRange);

rangeRecordListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.del-record');
  if (!btn) return;
  await fetch(`/api/budget/records/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
  await loadRange();
});

(async function init() {
  monthInput.value = currentMonth();
  recordDateInput.value = taipeiToday();
  rangeEndInput.value = taipeiToday();
  rangeStartInput.value = `${currentMonth()}-01`;
  await loadCategories();
  await loadMembers();
  await loadRecords();
})();
