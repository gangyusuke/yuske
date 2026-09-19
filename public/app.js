const chatEl = document.getElementById('chat');
const formEl = document.getElementById('chatForm');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');

const SESSION_KEY = 'sideJobAgentSessionId';
let sessionId = localStorage.getItem(SESSION_KEY) || null;

function addBubble(text, role) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble;
}

function addWelcome() {
  addBubble(
    'こんにちは！スマホ副業AIエージェントです。\n' +
      '1日にどれくらい作業時間を確保できますか？興味のある分野（せどり、ライティング、SNS運用など）があれば教えてください。\n' +
      'それをもとに、月10万円を目指せる副業プランを一緒に考えます。',
    'agent'
  );
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  addBubble(text, 'user');
  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn.disabled = true;

  const loadingBubble = addBubble('考え中...', 'loading');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, sessionId }),
    });
    const data = await res.json();

    loadingBubble.remove();

    if (!res.ok) {
      addBubble(`エラー: ${data.error || '不明なエラー'}`, 'system');
      return;
    }

    if (data.sessionId) {
      sessionId = data.sessionId;
      localStorage.setItem(SESSION_KEY, sessionId);
    }

    addBubble(data.reply, 'agent');
  } catch (err) {
    loadingBubble.remove();
    addBubble('通信エラーが発生しました。もう一度お試しください。', 'system');
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
});

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});

resetBtn.addEventListener('click', async () => {
  if (sessionId) {
    await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  }
  localStorage.removeItem(SESSION_KEY);
  sessionId = null;
  chatEl.innerHTML = '';
  addWelcome();
});

addWelcome();
