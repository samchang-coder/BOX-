const chatEl = document.getElementById('chat');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

const history = [];

function appendMessage(role, text) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
  return el;
}

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
}
inputEl.addEventListener('input', autoResize);

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  autoResize();
  sendBtn.disabled = true;

  appendMessage('user', text);
  history.push({ role: 'user', content: text });

  const assistantEl = appendMessage('assistant', '');
  assistantEl.classList.add('pending');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`伺服器回應錯誤：${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      assistantEl.textContent = fullText;
      chatEl.scrollTop = chatEl.scrollHeight;
    }

    assistantEl.classList.remove('pending');
    history.push({ role: 'assistant', content: fullText });
  } catch (err) {
    assistantEl.classList.remove('pending');
    assistantEl.textContent = '發生錯誤，請確認伺服器是否正常運作，或稍後再試一次。';
    console.error(err);
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
});
