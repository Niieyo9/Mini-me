const config = window.MINIME_CONFIG || { apiEndpoint: '/api/chat', modelName: 'Mini-Me' };
const isFilePreview = window.location.protocol === 'file:';

const STORAGE_KEY = 'minime_stable_chats_v17';
const SETTINGS_KEY = 'minime_stable_settings_v17';
const SMART_MEMORY_KEY = 'minime_smart_memory_v31';

const conversationEl = document.getElementById('conversation');
const historyListEl = document.getElementById('historyList');
const emptyHistoryEl = document.getElementById('emptyHistory');
const historyCountEl = document.getElementById('historyCount');
const historySearchEl = document.getElementById('historySearch');
const chatTitleEl = document.getElementById('chatTitle');
const messageCountEl = document.getElementById('messageCount');
const modeLabelEl = document.getElementById('modeLabel');
const chatStatusLabelEl = document.getElementById('chatStatusLabel');
const voiceLabelEl = document.getElementById('voiceLabel');
const greetingTitleEl = document.getElementById('greetingTitle');
const liveTimeEl = document.getElementById('liveTime');
const liveDateEl = document.getElementById('liveDate');
const styleSelectEl = document.getElementById('styleSelect');
const qualitySelectEl = document.getElementById('qualitySelect');
const notesInputEl = document.getElementById('notesInput');
let liveMemoryEl = null;
let panelStatsEl = null;
let panelToastEl = null;
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const clearChatButton = document.getElementById('clearChatButton');
const exportChatButton = document.getElementById('exportChatButton');
const exportAllButton = document.getElementById('exportAllButton');
const newChatButton = document.getElementById('newChatButton');
const starterButtons = document.querySelectorAll('.starter-chip');
const voiceToggleButton = document.getElementById('voiceToggle');
const micButton = document.getElementById('micButton');
const attachButton = document.getElementById('attachButton');
const attachmentStatus = document.getElementById('attachmentStatus');
const voicePanel = document.getElementById('voicePanel');
const closeVoiceButton = document.getElementById('closeVoiceButton');
const voiceStatusEl = document.getElementById('voiceStatus');
const voiceTranscriptEl = document.getElementById('voiceTranscript');
const clearTranscriptButton = document.getElementById('clearTranscriptButton');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const removeFileButton = document.getElementById('removeFileButton');
const statusBannerEl = document.getElementById('statusBanner');
const composerNoteEl = document.getElementById('composerNote');
const menuToggleButton = document.getElementById('menuToggle');
const closeDrawerButton = document.getElementById('closeDrawer');
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const openVoiceButton = document.getElementById('openVoiceButton');
const panelOverlay = document.getElementById('panelOverlay');
const themeButtons = document.querySelectorAll('.theme-btn');
const textSizeButtons = document.querySelectorAll('.text-size-btn');

let chats = loadChats();
let settings = loadSettings();
let smartMemory = loadSmartMemory();
let currentChatId = settings.lastChatId || chats[0]?.id || null;
let attachedFileText = '';
let isVoiceOutputEnabled = Boolean(settings.voiceOutput);
let recognition = null;
let isRecording = false;
let backendState = isFilePreview ? 'preview' : 'checking';

if (!currentChatId || !chats.some((entry) => entry.id === currentChatId)) {
  currentChatId = chats[0]?.id || null;
}
if (!currentChatId) currentChatId = createChat().id;


function applyThemePreference(theme = 'colorful') {
  const safeTheme = ['colorful', 'midnight', 'graphite'].includes(theme) ? theme : 'colorful';
  document.body.classList.remove('theme-colorful', 'theme-midnight', 'theme-graphite');
  document.body.classList.add('theme-' + safeTheme);
  themeButtons.forEach((button) => button.classList.toggle('active', button.dataset.theme === safeTheme));
  settings.theme = safeTheme;
}

function applyTextSizePreference(size = 'comfortable') {
  const safeSize = size === 'large' ? 'large' : 'comfortable';
  document.body.classList.toggle('text-large', safeSize === 'large');
  textSizeButtons.forEach((button) => button.classList.toggle('active', button.dataset.textSize === safeSize));
  settings.textSize = safeSize;
}

function initThemeControls() {
  themeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyThemePreference(button.dataset.theme);
      persistSettings();
      setStatus('Theme updated: ' + button.textContent.trim() + '.', 'neutral');
      highlightPanel(document.getElementById('settingsSection'));
    });
  });
  textSizeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyTextSizePreference(button.dataset.textSize);
      persistSettings();
      setStatus('Text size updated for easier reading.', 'neutral');
      highlightPanel(document.getElementById('settingsSection'));
    });
  });
}

function updateGreetingClock() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (greetingTitleEl) greetingTitleEl.textContent = `${greeting} 👋`;
  if (liveTimeEl) liveTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (liveDateEl) liveDateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}


function loadSmartMemory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SMART_MEMORY_KEY) || '{}');
    return {
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences.slice(0, 12) : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts.slice(0, 12) : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects.slice(0, 8) : [],
      lastUpdated: parsed.lastUpdated || null,
    };
  } catch {
    return { preferences: [], facts: [], projects: [], lastUpdated: null };
  }
}

function persistSmartMemory() {
  localStorage.setItem(SMART_MEMORY_KEY, JSON.stringify(smartMemory));
}

function normalizeMemoryText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:,-]+|[\s.!,;:-]+$/g, '')
    .trim();
}

function addMemoryItem(type, value) {
  const clean = normalizeMemoryText(value).slice(0, 120);
  if (!clean || clean.length < 4) return false;
  const list = smartMemory[type] || smartMemory.facts;
  const exists = list.some((item) => item.toLowerCase() === clean.toLowerCase());
  if (exists) return false;
  list.unshift(clean);
  const limits = { preferences: 12, facts: 12, projects: 8 };
  smartMemory[type] = list.slice(0, limits[type] || 12);
  smartMemory.lastUpdated = new Date().toISOString();
  persistSmartMemory();
  return true;
}

function extractSmartMemoryFromText(text) {
  const raw = normalizeMemoryText(text);
  if (!raw) return 0;
  const lower = raw.toLowerCase();
  let added = 0;

  const rememberMatch = raw.match(/(?:remember that|remember|note that|save this|keep in mind)\s+(.+)/i);
  if (rememberMatch) added += addMemoryItem('facts', rememberMatch[1]) ? 1 : 0;

  const preferMatch = raw.match(/(?:i prefer|i like|i want|from now on|going forward)\s+(.+)/i);
  if (preferMatch) added += addMemoryItem('preferences', preferMatch[1]) ? 1 : 0;

  const nameMatch = raw.match(/(?:my name is|call me)\s+([a-zA-Z0-9_ -]{2,40})/i);
  if (nameMatch) added += addMemoryItem('facts', `Preferred name: ${nameMatch[1].trim()}`) ? 1 : 0;

  if (/\b(project|app|website|business|brand|song|album|platform)\b/i.test(raw) && /\b(i am building|i'm building|we are building|working on|my project|this app)\b/i.test(lower)) {
    added += addMemoryItem('projects', raw) ? 1 : 0;
  }

  return added;
}

function clearSmartMemory() {
  smartMemory = { preferences: [], facts: [], projects: [], lastUpdated: null };
  persistSmartMemory();
  renderSmartMemoryPanel();
  setStatus('Smart memory cleared.', 'neutral');
}

function renderSmartMemoryPanel() {
  const memorySection = document.getElementById('memorySection');
  if (!memorySection) return;
  const chips = memorySection.querySelector('.memory-chips');
  if (!chips) return;

  const entries = [
    ...smartMemory.preferences.map((text) => ({ type: 'Preference', text })),
    ...smartMemory.projects.map((text) => ({ type: 'Project', text })),
    ...smartMemory.facts.map((text) => ({ type: 'Memory', text })),
  ].slice(0, 6);

  chips.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('span');
    empty.className = 'memory-chip smart-empty';
    empty.textContent = 'Smart memory is ready. Tell Mini-Me “remember…” or add notes above.';
    chips.appendChild(empty);
  } else {
    entries.forEach((entry) => {
      const chip = document.createElement('span');
      chip.className = 'memory-chip smart-memory-chip';
      chip.innerHTML = `<strong>${escapeHtml(entry.type)}</strong> ${escapeHtml(entry.text)}`;
      chips.appendChild(chip);
    });
  }

  if (liveMemoryEl) {
    const count = smartMemory.preferences.length + smartMemory.facts.length + smartMemory.projects.length;
    liveMemoryEl.innerHTML = `<strong>Smart memory</strong><br>${count ? `${count} useful detail${count === 1 ? '' : 's'} saved for better replies.` : 'No saved details yet.'}`;
  }
}

function initSmartMemoryControls() {
  const memorySection = document.getElementById('memorySection');
  if (!memorySection || memorySection.querySelector('.memory-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'memory-actions';
  actions.innerHTML = `
    <button class="mini-link memory-save" type="button">Save note</button>
    <button class="mini-link memory-clear" type="button">Clear memory</button>
  `;
  const chips = memorySection.querySelector('.memory-chips');
  memorySection.insertBefore(actions, chips || null);
  actions.querySelector('.memory-save')?.addEventListener('click', () => {
    const value = notesInputEl?.value || '';
    const added = addMemoryItem('facts', value);
    renderSmartMemoryPanel();
    setStatus(added ? 'Saved to smart memory.' : 'That memory is already saved or too short.', added ? 'success' : 'neutral');
  });
  actions.querySelector('.memory-clear')?.addEventListener('click', clearSmartMemory);
}

function createInitialMessages() {
  const now = Date.now();
  return [
    {
      role: 'user',
      content: 'Give me a 7 day plan to improve my productivity and focus.',
      timestamp: now - 120000,
    },
    {
      role: 'assistant',
      content: `Here’s a 7 day productivity and focus plan customized for you:\n\n<strong>Day 1: Reset & Reflect</strong>\nSet clear goals and prioritize what truly matters.\n\n<strong>Day 2: Time Blocking</strong>\nStructure your day with deep work blocks.\n\n<strong>Day 3: Eliminate Distractions</strong>\nRemove digital clutter and time wasters.\n\n<strong>Day 4: Build Momentum</strong>\nFocus on one big task and finish it.\n\n<strong>Day 5: Optimize Energy</strong>\nImprove sleep, hydration and movement.\n\n<strong>Day 6: Review & Adjust</strong>\nEvaluate progress and adjust your plan.\n\n<strong>Day 7: Plan Ahead</strong>\nPrepare for the week ahead with clarity.\n\nWant me to break down any day in detail?`,
      timestamp: now - 60000,
    }
  ];
}


function createInitialAssistantMessage() {
  return {
    role: 'assistant',
    content: `Hi — I’m Mini-Me. Ask me for ideas, planning, writing help, or step-by-step support and I’ll keep it clear and practical.`,
    timestamp: Date.now(),
  };
}

function createChat(title = 'New Chat') {
  const chat = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  chats.unshift(chat);
  persistChats();
  return chat;
}

function loadChats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function persistSettings() {
  settings.lastChatId = currentChatId;
  settings.lastDraft = chatInput?.value || settings.lastDraft || '';
  settings.historySearch = historySearchEl?.value || '';
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getCurrentChat() {
  return chats.find((chat) => chat.id === currentChatId) || chats[0];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function autoResizeTextarea() {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 140)}px`;
}

function setDrawerOpen(open) {
  if (!drawer || !drawerOverlay) return;
  drawer.classList.toggle('open', open);
  drawerOverlay.classList.toggle('open', open);
  document.body.classList.toggle('drawer-open', open);
}

function getBackendLabel() {
  if (backendState === 'preview') return 'Preview';
  if (backendState === 'checking') return 'Checking';
  if (backendState === 'live') return 'Live';
  if (backendState === 'missing_key') return 'Missing Key';
  if (backendState === 'server_error') return 'Server Error';
  return 'Offline';
}

function setStatus(message, tone = 'neutral') {
  if (!statusBannerEl) return;
  statusBannerEl.textContent = message;
  statusBannerEl.className = `status-banner status-${tone}`;
}

function updateSessionLabels() {
  const currentChat = getCurrentChat();
  if (messageCountEl) messageCountEl.textContent = String(currentChat.messages.length);
  if (modeLabelEl) modeLabelEl.textContent = getBackendLabel();
  if (chatStatusLabelEl) chatStatusLabelEl.textContent = getBackendLabel();
  if (voiceLabelEl) voiceLabelEl.textContent = isVoiceOutputEnabled ? 'On' : 'Off';
  if (voiceToggleButton) voiceToggleButton.setAttribute('aria-pressed', String(isVoiceOutputEnabled));
  if (chatTitleEl) chatTitleEl.textContent = currentChat.title || 'New Chat';

  if (backendState === 'live') {
    setStatus('Live AI is connected and ready.', 'success');
  } else if (backendState === 'checking') {
    setStatus('Mini-Me is checking the live service…', 'neutral');
  } else if (backendState === 'preview') {
    setStatus('You are viewing the local file version. Open http://localhost:3000/chat.html for live AI.', 'warning');
  } else if (backendState === 'missing_key') {
    setStatus('The server is running, but the API key is missing or invalid. Check your .env file.', 'danger');
  } else if (backendState === 'server_error') {
    setStatus('The server responded with an error. Restart it and check /api/health.', 'danger');
  } else {
    setStatus('Mini-Me cannot reach the local server right now. Make sure npm start is still running.', 'danger');
  }
}

function createMessageElement(message) {
  const article = document.createElement('article');
  article.className = `chat-message-card ${message.role === 'user' ? 'user' : 'ai'}`;

  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  if (message.role === 'user') {
    avatar.textContent = 'You';
  } else {
    avatar.classList.add('logo-avatar');
    const avatarImg = document.createElement('img');
    avatarImg.src = 'assets/logo.png';
    avatarImg.alt = 'Mini Me';
    avatar.appendChild(avatarImg);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const speaker = document.createElement('span');
  speaker.textContent = message.role === 'user' ? 'You' : (config.modelName || 'Mini-Me');

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = formatDate(message.timestamp || Date.now());

  meta.append(speaker, time);

  const body = document.createElement('div');
  body.className = 'message-body' + (message.typing ? ' typing-cursor' : '');
  body.innerHTML = renderTextToHtml(message.content);
  bubble.append(meta, body);

  if (message.role === 'assistant') {
    const actionRow = document.createElement('div');
    actionRow.className = 'message-actions';

    const speakBtn = document.createElement('button');
    speakBtn.className = 'ghost-action small';
    speakBtn.type = 'button';
    speakBtn.textContent = 'Read aloud';
    speakBtn.addEventListener('click', () => speakText(message.content));

    actionRow.appendChild(speakBtn);
    bubble.appendChild(actionRow);
  }

  article.append(avatar, bubble);
  return article;
}

function ensureV12PanelElements() {
  const memorySection = document.getElementById('memorySection');
  const tasksSection = document.getElementById('tasksSection');
  const focusSection = document.getElementById('focusSection');
  if (memorySection && !liveMemoryEl) {
    liveMemoryEl = document.createElement('div');
    liveMemoryEl.className = 'live-memory';
    liveMemoryEl.textContent = 'Smart memory is ready.';
    const chips = memorySection.querySelector('.memory-chips');
    memorySection.insertBefore(liveMemoryEl, chips || null);
  }
  if (tasksSection && !panelStatsEl) {
    panelStatsEl = document.createElement('div');
    panelStatsEl.className = 'panel-stat-row';
    tasksSection.appendChild(panelStatsEl);
  }
  if (focusSection && !panelToastEl) {
    panelToastEl = document.createElement('div');
    panelToastEl.className = 'panel-toast';
    panelToastEl.textContent = 'Tap here to load a focus prompt.';
    focusSection.appendChild(panelToastEl);
  }
}

function updateDynamicPanels() {
  ensureV12PanelElements();
  const currentChat = getCurrentChat();
  const userMessages = currentChat.messages.filter((m) => m.role === 'user');
  const assistantMessages = currentChat.messages.filter((m) => m.role === 'assistant');
  const lastUser = userMessages[userMessages.length - 1]?.content || '';
  renderSmartMemoryPanel();
  if (panelStatsEl) {
    panelStatsEl.innerHTML = `
      <span><strong>${currentChat.messages.length}</strong> msgs</span>
      <span><strong>${userMessages.length}</strong> asks</span>
      <span><strong>${assistantMessages.length}</strong> replies</span>`;
  }
  if (panelToastEl) {
    const style = styleSelectEl?.value || 'balanced';
    const quality = qualitySelectEl?.value || 'premium';
    panelToastEl.textContent = `Mode: ${style} • ${quality}. Last focus: ${lastUser.slice(0, 42)}${lastUser.length > 42 ? '…' : ''}`;
  }
}

function renderTextToHtml(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeAssistantReply(reply, currentChat) {
  const assistantMessage = { role: 'assistant', content: '', timestamp: Date.now(), typing: true };
  currentChat.messages.push(assistantMessage);
  currentChat.updatedAt = Date.now();
  removeTypingIndicator();
  renderAll();
  const cards = [...conversationEl.querySelectorAll('.chat-message-card.ai')];
  const card = cards[cards.length - 1];
  const body = card?.querySelector('.message-body');
  body?.classList.add('typing-cursor');
  const text = String(reply || 'Done.');
  const chunkSize = text.length > 900 ? 14 : text.length > 420 ? 8 : 4;
  for (let i = 0; i < text.length; i += chunkSize) {
    assistantMessage.content = text.slice(0, i + chunkSize);
    if (body) body.innerHTML = renderTextToHtml(assistantMessage.content);
    conversationEl.scrollTop = conversationEl.scrollHeight;
    await sleep(12);
  }
  assistantMessage.content = text;
  delete assistantMessage.typing;
  body?.classList.remove('typing-cursor');
  persistChats();
  updateDynamicPanels();
}


function createEmptyStateElement() {
  const wrapper = document.createElement('section');
  wrapper.className = 'empty-chat-state';
  wrapper.innerHTML = `
    <div class="empty-orb"><img src="assets/logo.png" alt="Mini Me logo"></div>
    <h3>What do you want to work on?</h3>
    <p>Start with a plan, write something clean, or brainstorm ideas. Mini-Me will keep it structured and practical.</p>
    <div class="empty-chip-row">
      <button type="button" data-prompt="Help me plan my day with clear priorities.">Plan</button>
      <button type="button" data-prompt="Write a clean professional message for me.">Write</button>
      <button type="button" data-prompt="Give me fresh ideas for my project.">Ideas</button>
    </div>`;
  wrapper.querySelectorAll('button[data-prompt]').forEach((button) => {
    button.addEventListener('click', async () => {
      chatInput.value = button.dataset.prompt || '';
      autoResizeTextarea();
      await handleSubmit(chatInput.value);
    });
  });
  return wrapper;
}

function renderConversation() {
  const currentChat = getCurrentChat();
  conversationEl.innerHTML = '';
  if (!currentChat.messages.length) {
    conversationEl.appendChild(createEmptyStateElement());
  } else {
    currentChat.messages.forEach((message) => conversationEl.appendChild(createMessageElement(message)));
  }
  updateSessionLabels();
  updateDynamicPanels();
  requestAnimationFrame(() => { conversationEl.scrollTop = conversationEl.scrollHeight; });
}

function renderHistory() {
  const query = historySearchEl.value.trim().toLowerCase();
  const filtered = chats.filter((chat) => {
    if (!query) return true;
    return chat.title.toLowerCase().includes(query) || chat.messages.some((m) => m.content.toLowerCase().includes(query));
  });

  historyListEl.innerHTML = '';
  filtered.forEach((chat) => {
    const item = document.createElement('div');
    item.className = `history-item${chat.id === currentChatId ? ' active' : ''}`;

    const main = document.createElement('button');
    main.className = 'history-main';
    main.type = 'button';
    main.innerHTML = `<span class="history-item-title">${escapeHtml(chat.title)}</span><span class="history-item-time">${formatDate(chat.updatedAt)}</span>`;
    main.addEventListener('click', () => {
      currentChatId = chat.id;
      persistSettings();
      renderAll();
  setActivePanel('chatSection');
      setDrawerOpen(false);
    });

    const actions = document.createElement('div');
    actions.className = 'history-actions';

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'history-action-btn';
    renameBtn.textContent = '✎';
    renameBtn.addEventListener('click', () => renameChat(chat.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'history-action-btn';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => deleteChat(chat.id));

    actions.append(renameBtn, deleteBtn);
    item.append(main, actions);
    historyListEl.appendChild(item);
  });

  historyCountEl.textContent = String(chats.length);
  emptyHistoryEl.style.display = filtered.length ? 'none' : 'block';
}

function renderAll() {
  renderConversation();
  renderHistory();
  initSmartMemoryControls();
  renderSmartMemoryPanel();
}

function setComposerDisabled(disabled) {
  chatInput.disabled = disabled;
  sendButton.disabled = disabled;
  starterButtons.forEach((btn) => { btn.disabled = disabled; });
}

function addTypingIndicator() {
  const article = document.createElement('article');
  article.className = 'chat-message-card ai typing-row';
  article.id = 'typingIndicator';
  article.innerHTML = '<span class="avatar">MM</span><div class="bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
  conversationEl.appendChild(article);
  conversationEl.scrollTop = conversationEl.scrollHeight;
}

function removeTypingIndicator() {
  document.getElementById('typingIndicator')?.remove();
}

function renameChat(chatId) {
  const chat = chats.find((entry) => entry.id === chatId);
  if (!chat) return;
  const nextTitle = prompt('Rename chat', chat.title);
  if (!nextTitle) return;
  chat.title = nextTitle.trim().slice(0, 80) || chat.title;
  chat.updatedAt = Date.now();
  persistChats();
  renderAll();
}

function deleteChat(chatId) {
  if (!confirm('Delete this chat?')) return;
  chats = chats.filter((entry) => entry.id !== chatId);
  if (!chats.length) currentChatId = createChat().id;
  if (!chats.some((entry) => entry.id === currentChatId)) currentChatId = chats[0].id;
  persistChats();
  persistSettings();
  renderAll();
}

function exportText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function chatToText(chat) {
  return `${chat.title}\n\n${chat.messages.map((m) => `${m.role === 'user' ? 'You' : 'Mini-Me'}: ${m.content}`).join('\n\n')}`;
}

async function checkBackendHealth() {
  if (isFilePreview) {
    backendState = 'preview';
    updateSessionLabels();
    return;
  }
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json();
    backendState = data?.ok ? (data?.hasApiKey ? 'live' : 'missing_key') : 'server_error';
  } catch {
    backendState = 'offline';
  }
  updateSessionLabels();
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function buildMemoryProfile() {
  const notes = (notesInputEl.value || '').trim();
  const focusAreas = [];
  if (/plan|schedule|priority/i.test(notes)) focusAreas.push('planning');
  if (/write|email|caption|message/i.test(notes)) focusAreas.push('writing');
  if (/study|school|learn|exam/i.test(notes)) focusAreas.push('study');
  if (/business|idea|client|project/i.test(notes)) focusAreas.push('business');
  const currentChat = getCurrentChat();
  const lastUserMessage = [...currentChat.messages].reverse().find((m) => m.role === 'user')?.content || '';
  return {
    responseStyle: styleSelectEl.value,
    responseQuality: qualitySelectEl?.value || 'premium',
    focusAreas,
    lastActiveGoal: lastUserMessage.slice(0, 180),
    customInstructions: notes.slice(0, 400),
    smartMemory: {
      preferences: smartMemory.preferences.slice(0, 8),
      facts: smartMemory.facts.slice(0, 8),
      projects: smartMemory.projects.slice(0, 5),
    },
  };
}

function normalizeServiceError(errorMessage) {
  const text = String(errorMessage || '').toLowerCase();
  if (text.includes('quota') || text.includes('billing')) return 'The AI provider account needs quota or billing attention. Check your API dashboard and try again.';
  if (text.includes('rate limit')) return 'The AI provider is rate-limiting requests right now. Wait a moment and try again.';
  if (text.includes('missing valid groq_api_key') || text.includes('missing valid openai_api_key')) return 'The API key is missing or invalid. Check your .env file and restart the server.';
  if (text.includes('failed to fetch') || text.includes('networkerror')) return 'Mini-Me could not reach the local server. Make sure npm start is still running and reload the page.';
  return String(errorMessage || 'Mini-Me could not reach the live chat service.');
}

function expandCommand(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return text;
  const [command, ...rest] = trimmed.split(/\s+/);
  const detail = rest.join(' ').trim();
  if (command === '/plan') return `Help me plan this clearly and practically: ${detail || 'my day'}`;
  if (command === '/write') return `Write this for me professionally and naturally: ${detail || 'a short message'}`;
  if (command === '/ideas') return `Give me practical, specific ideas for this: ${detail || 'what I am working on'}`;
  if (command === '/study') return `Teach me this simply and clearly, step by step: ${detail || 'the topic I need help with'}`;
  return text;
}

async function fetchAssistantReply() {
  if (!config.apiEndpoint || isFilePreview) throw new Error('Open the site from http://localhost:3000/chat.html to use live AI.');
  if (backendState === 'missing_key') throw new Error('The API key is missing or invalid. Check your .env file and restart the server.');
  if (backendState === 'server_error' || backendState === 'offline') throw new Error('The local Mini-Me server is not ready yet. Check /api/health and restart npm start.');

  const currentChat = getCurrentChat();
  const payload = {
    messages: currentChat.messages,
    responseStyle: styleSelectEl.value,
    responseQuality: qualitySelectEl?.value || 'premium',
    notes: notesInputEl.value,
    attachmentText: attachedFileText,
    memoryProfile: buildMemoryProfile(),
  };

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(normalizeServiceError(data.error || `Request failed with status ${response.status}`));
  return data.reply || 'Mini-Me returned an empty response.';
}

async function handleSubmit(rawValue) {
  const userMessage = expandCommand(rawValue).trim();
  if (!userMessage) {
    setStatus('Type a message first.', 'warning');
    chatInput.focus();
    return;
  }

  const currentChat = getCurrentChat();
  currentChat.messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
  const learnedCount = extractSmartMemoryFromText(userMessage);
  if (learnedCount) setStatus(`Saved ${learnedCount} new memory detail${learnedCount === 1 ? '' : 's'}.`, 'success');
  if (currentChat.messages.filter((m) => m.role === 'user').length === 1 && currentChat.title === 'New Chat') {
    currentChat.title = userMessage.slice(0, 44);
  }
  currentChat.updatedAt = Date.now();
  persistChats();
  persistSettings();
  renderConversation();

  chatInput.value = '';
  settings.lastDraft = '';
  persistSettings();
  autoResizeTextarea();
  setComposerDisabled(true);
  setStatus(`Mini-Me is thinking in ${qualitySelectEl?.value || 'premium'} quality mode…`, 'neutral');
  addTypingIndicator();

  try {
    const reply = await fetchAssistantReply();
    await typeAssistantReply(reply, currentChat);
    currentChat.updatedAt = Date.now();
    persistChats();
    renderAll();
    setStatus('Reply polished and delivered.', 'success');
    if (isVoiceOutputEnabled) speakText(reply);
  } catch (error) {
    removeTypingIndicator();
    const friendly = normalizeServiceError(error instanceof Error ? error.message : String(error));
    currentChat.messages.push({ role: 'assistant', content: `Mini-Me could not complete that request. ${friendly}`, timestamp: Date.now() });
    currentChat.updatedAt = Date.now();
    persistChats();
    renderAll();
    setStatus(friendly, 'danger');
  } finally {
    setComposerDisabled(false);
    chatInput.focus();
  }
}

function resetCurrentChat() {
  const currentChat = getCurrentChat();
  currentChat.messages = [];
  currentChat.title = 'New Chat';
  currentChat.updatedAt = Date.now();
  persistChats();
  renderAll();
  setStatus('Current chat cleared.', 'neutral');
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    attachedFileText = typeof reader.result === 'string' ? reader.result.slice(0, 12000) : '';
    fileNameEl.textContent = file.name;
    attachmentStatus?.classList.remove('hidden');
    setStatus(`Attached ${file.name}. Mini-Me can use its text in the next reply.`, 'success');
  };
  reader.readAsText(file);
}

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition || null;
}

function setVoiceStatus(message, type = 'neutral') {
  if (voiceStatusEl) voiceStatusEl.textContent = message;
  if (voicePanel) {
    voicePanel.classList.remove('voice-ok', 'voice-warning', 'voice-error');
    voicePanel.classList.add(type === 'error' ? 'voice-error' : type === 'warning' ? 'voice-warning' : 'voice-ok');
  }
}

async function requestMicrophoneAccess() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    const message = window.location.protocol === 'file:'
      ? 'Voice input needs localhost. Start with npm start, then open http://localhost:3000/chat.html.'
      : 'Microphone permission was blocked. Allow microphone access in the browser and try again.';
    if (voicePanel) voicePanel.classList.remove('hidden');
    setVoiceStatus(message, 'error');
    setStatus(message, 'warning');
    return false;
  }
}

function initVoiceInput() {
  if (!micButton || !chatInput) return;
  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) {
    micButton.disabled = false;
    micButton.classList.add('unsupported');
    micButton.title = 'Voice input works best in Chrome or Microsoft Edge.';
    setVoiceStatus('Voice input is not supported in this browser. Use Chrome or Microsoft Edge.', 'warning');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';
  recognition.maxAlternatives = 1;

  let baseText = '';
  let finalTranscript = '';

  recognition.onstart = () => {
    isRecording = true;
    baseText = chatInput.value.trim();
    finalTranscript = '';
    micButton.classList.add('recording');
    micButton.setAttribute('aria-pressed', 'true');
    document.body.classList.add('is-listening');
    if (voicePanel) voicePanel.classList.remove('hidden');
    setVoiceStatus('Listening... speak clearly. Click the mic again to stop.', 'neutral');
  };

  recognition.onend = () => {
    isRecording = false;
    micButton.classList.remove('recording');
    micButton.setAttribute('aria-pressed', 'false');
    document.body.classList.remove('is-listening');
    const captured = (voiceTranscriptEl?.value || '').trim();
    if (captured) {
      setVoiceStatus('Voice captured. You can edit it or send it now.', 'neutral');
      chatInput.focus();
    } else {
      setVoiceStatus('No speech detected. Tap the mic and try again.', 'warning');
    }
  };

  recognition.onerror = (event) => {
    isRecording = false;
    micButton.classList.remove('recording');
    micButton.setAttribute('aria-pressed', 'false');
    document.body.classList.remove('is-listening');
    let message = 'Voice input stopped. Try again.';
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      message = 'Microphone permission was blocked. Click the lock icon in the browser address bar and allow microphone access.';
    } else if (event.error === 'no-speech') {
      message = 'No speech was detected. Tap the mic and speak again.';
    } else if (event.error === 'network') {
      message = 'The browser speech service lost connection. Try Chrome or Microsoft Edge with internet access.';
    } else if (event.error === 'audio-capture') {
      message = 'No microphone was found. Check your mic connection and Windows input settings.';
    }
    if (voicePanel) voicePanel.classList.remove('hidden');
    setVoiceStatus(message, 'error');
    setStatus(message, 'warning');
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += piece + ' ';
      else interim += piece;
    }
    const spoken = (finalTranscript + interim).replace(/\s+/g, ' ').trim();
    const combined = [baseText, spoken].filter(Boolean).join(baseText && spoken ? ' ' : '').trim();
    if (voiceTranscriptEl) voiceTranscriptEl.value = spoken;
    chatInput.value = combined;
    settings.lastDraft = combined;
    persistSettings();
    autoResizeTextarea();
  };
}

async function toggleVoiceInput() {
  if (!micButton || micButton.disabled) return;
  if (!recognition) {
    if (voicePanel) voicePanel.classList.remove('hidden');
    setVoiceStatus('Voice input works best in Chrome or Microsoft Edge. Start the app on localhost, not by double-clicking the file.', 'warning');
    return;
  }
  if (isRecording) {
    recognition.stop();
    return;
  }
  const allowed = await requestMicrophoneAccess();
  if (!allowed) return;
  try {
    recognition.start();
  } catch (error) {
    setVoiceStatus('Voice input is already starting. Wait a second and try again.', 'warning');
  }
}
chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await handleSubmit(chatInput.value);
});

chatInput.addEventListener('input', () => {
  settings.lastDraft = chatInput.value;
  persistSettings();
  autoResizeTextarea();
});
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

clearChatButton.addEventListener('click', resetCurrentChat);
newChatButton.addEventListener('click', () => {
  currentChatId = createChat().id;
  persistSettings();
  renderAll();
  setDrawerOpen(false);
  chatInput.focus();
});
exportChatButton.addEventListener('click', () => {
  const currentChat = getCurrentChat();
  exportText(`${currentChat.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'mini-me-chat'}.txt`, chatToText(currentChat));
  setStatus('Current chat exported.', 'success');
});
exportAllButton.addEventListener('click', () => {
  const merged = chats.map((chat) => chatToText(chat)).join('\n\n------------------------------\n\n');
  exportText('mini-me-all-chats.txt', merged);
  setStatus('All chats exported.', 'success');
  setDrawerOpen(false);
});
historySearchEl.addEventListener('input', () => {
  settings.historySearch = historySearchEl.value;
  persistSettings();
  renderHistory();
});
styleSelectEl.addEventListener('change', () => {
  settings.responseStyle = styleSelectEl.value;
  persistSettings();
  setStatus(`Response style saved: ${styleSelectEl.value}.`, 'neutral');
  updateDynamicPanels();
});
qualitySelectEl?.addEventListener('change', () => {
  settings.responseQuality = qualitySelectEl.value;
  persistSettings();
  setStatus(`Response quality saved: ${qualitySelectEl.value}.`, 'neutral');
  updateDynamicPanels();
});
notesInputEl.addEventListener('input', () => {
  settings.notes = notesInputEl.value;
  persistSettings();
  updateDynamicPanels();
});
voiceToggleButton?.addEventListener('click', () => {
  isVoiceOutputEnabled = !isVoiceOutputEnabled;
  settings.voiceOutput = isVoiceOutputEnabled;
  persistSettings();
  updateSessionLabels();
  setStatus(`Voice replies ${isVoiceOutputEnabled ? 'enabled' : 'disabled'}.`, 'neutral');
});

starterButtons.forEach((button) => button.addEventListener('click', async () => {
  settings.lastStarter = button.dataset.prompt || '';
  persistSettings();
  chatInput.value = button.dataset.prompt || '';
  autoResizeTextarea();
  await handleSubmit(chatInput.value);
}));

fileInput?.addEventListener('change', (event) => handleFile(event.target.files?.[0]));
attachButton?.addEventListener('click', () => {
  fileInput?.click();
  setStatus('Choose a text file to attach to this chat.', 'neutral');
});
removeFileButton?.addEventListener('click', () => {
  attachedFileText = '';
  if (fileInput) fileInput.value = '';
  fileNameEl.textContent = 'No file attached';
  attachmentStatus?.classList.add('hidden');
  setStatus('Attached file removed.', 'neutral');
});

micButton?.addEventListener('click', toggleVoiceInput);
openVoiceButton?.addEventListener('click', () => {
  voicePanel.classList.remove('hidden');
});

closeVoiceButton?.addEventListener('click', () => {
  voicePanel.classList.add('hidden');
  if (recognition && isRecording) recognition.stop();
});
clearTranscriptButton?.addEventListener('click', () => {
  voiceTranscriptEl.value = '';
  chatInput.value = '';
  autoResizeTextarea();
  settings.lastDraft = '';
  persistSettings();
});
menuToggleButton?.addEventListener('click', () => setDrawerOpen(true));
closeDrawerButton?.addEventListener('click', () => setDrawerOpen(false));
drawerOverlay?.addEventListener('click', () => setDrawerOpen(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setDrawerOpen(false);
    setMobilePanel('', false);
    if (recognition && isRecording) recognition.stop();
  }
});




function setActivePanel(panelId) {
  document.querySelectorAll('.app-sidebar .sidebar-card, .app-sidebar .utility-card, .chat-stage, .insight-panel .info-card').forEach((el) => {
    el.classList.remove('panel-active');
  });
  document.body.classList.toggle('settings-open', panelId === 'settingsSection');
  if (!panelId) return;
  const target = document.getElementById(panelId);
  target?.classList.add('panel-active');
}

function highlightPanel(section) {
  if (!section) return;
  section.classList.remove('panel-highlight');
  void section.offsetWidth;
  section.classList.add('panel-highlight');
}

function activateNav(target) {
  document.querySelectorAll('.nav-link').forEach((btn) => btn.classList.toggle('active', btn.dataset.target === target));
}

function focusAndDraft(promptText, focusEl, statusText) {
  if (promptText) {
    chatInput.value = promptText;
    settings.lastDraft = promptText;
    persistSettings();
    autoResizeTextarea();
  }
  if (focusEl) {
    focusEl.focus?.();
    const panel = focusEl.closest('.info-card, .chat-stage') || focusEl;
    highlightPanel(panel);
    if (panel.id) setActivePanel(panel.id);
  }
  if (statusText) setStatus(statusText, 'neutral');
  activateNav((focusEl?.closest('.info-card, .chat-stage')?.id || '').replace('Section','').toLowerCase() || 'chat');
}


function setMobilePanel(panelId, open = true) {
  if (!panelOverlay) return;
  document.body.classList.toggle('right-panel-open', open);
  panelOverlay.classList.toggle('open', open);
  document.querySelectorAll('.insight-panel .info-card').forEach((card) => {
    card.classList.toggle('mobile-panel-active', open && card.id === panelId);
  });
  document.querySelectorAll('[data-mobile-panel]').forEach((button) => {
    button.classList.toggle('active', open && button.dataset.mobilePanel === panelId);
  });
  if (open) {
    setActivePanel(panelId);
    highlightPanel(document.getElementById(panelId));
  }
}

function initMobilePanelTabs() {
  document.querySelectorAll('[data-mobile-panel]').forEach((button) => {
    button.addEventListener('click', () => setMobilePanel(button.dataset.mobilePanel, true));
  });
  panelOverlay?.addEventListener('click', () => setMobilePanel('', false));
}

function initInteractiveNavigation() {
  const actions = {
    chat: () => {
      activateNav('chat');
      setActivePanel('chatSection');
      highlightPanel(document.getElementById('chatSection'));
      chatInput.focus();
      setStatus('Chat ready. Type a message or use a shortcut.', 'neutral');
    },
    memory: () => { setMobilePanel('memorySection', window.matchMedia('(max-width: 980px)').matches); focusAndDraft('', document.getElementById('notesInput'), 'Memory panel ready. Add what Mini-Me should remember.'); },
    commands: () => { setMobilePanel('commandsSection', window.matchMedia('(max-width: 980px)').matches); focusAndDraft('/plan ', document.getElementById('commandsSection'), 'Commands panel ready. Tap any smart prompt.'); },
    tasks: () => { activateNav('tasks'); focusAndDraft('Create a practical task list for today with priorities.', document.getElementById('chatSection'), 'Task prompt loaded into the chat composer.'); },
    notes: () => focusAndDraft('', document.getElementById('notesInput'), 'Notes are open. Add context or reminders.'),
    journal: () => focusAndDraft('Help me write a short journal reflection for today.', document.getElementById('chatSection'), 'Journal prompt loaded into the composer.'),
    files: () => {
      activateNav('files');
      setActivePanel('chatSection');
      attachButton?.classList.remove('file-highlight'); void attachButton?.offsetWidth; attachButton?.classList.add('file-highlight');
      fileInput?.click();
      setStatus('Choose a text file to attach to the current chat.', 'neutral');
    },
    settings: () => { setMobilePanel('settingsSection', window.matchMedia('(max-width: 980px)').matches); focusAndDraft('', document.getElementById('styleSelect'), 'Settings are ready. Change the response style here.'); }
  };

  document.querySelectorAll('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      actions[target]?.();
    });
  });

  document.getElementById('searchButton')?.addEventListener('click', () => {
    activateNav('chat');
    setActivePanel('chatSection');
    historySearchEl.focus();
    highlightPanel(document.querySelector('.utility-card'));
    setStatus('Search your saved chats from the left panel.', 'neutral');
  });
  document.getElementById('historyButton')?.addEventListener('click', () => {
    activateNav('chat');
    highlightPanel(document.querySelector('.utility-card'));
    setActivePanel('historySection');
    historySearchEl.focus();
    setStatus('Saved chat history is open on the left panel.', 'neutral');
  });

  document.getElementById('memoryViewAllButton')?.addEventListener('click', () => {
    activateNav('memory');
    setActivePanel('memorySection');
    highlightPanel(document.getElementById('memorySection'));
    notesInputEl.focus();
    setStatus('Memory panel is open. Add or edit what Mini-Me should remember.', 'neutral');
  });

  document.getElementById('shortcutsEditButton')?.addEventListener('click', () => {
    activateNav('tasks');
    setActivePanel('tasksSection');
    highlightPanel(document.getElementById('tasksSection'));
    setStatus('Shortcuts are ready. Tap any quick action to load it into chat.', 'neutral');
  });

  document.getElementById('commandsViewAllButton')?.addEventListener('click', () => {
    activateNav('commands');
    setActivePanel('commandsSection');
    highlightPanel(document.getElementById('commandsSection'));
    focusAndDraft('/plan ', document.getElementById('commandsSection'), 'Commands panel is open. Pick a smart prompt or type your own slash command.');
  });

  document.getElementById('focusSection')?.addEventListener('click', () => {
    activateNav('tasks');
    setActivePanel('focusSection');
    focusAndDraft('Help me stay consistent today with three realistic steps.', document.getElementById('chatSection'), 'Focus prompt loaded into chat.');
  });

  document.getElementById('settingsSection')?.addEventListener('click', () => {
    activateNav('settings');
    setActivePanel('settingsSection');
    highlightPanel(document.getElementById('settingsSection'));
    styleSelectEl.focus();
    setStatus('Settings panel ready. Adjust how Mini-Me responds.', 'neutral');
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  applyThemePreference(settings.theme || 'colorful');
  applyTextSizePreference(settings.textSize || 'comfortable');
  styleSelectEl.value = settings.responseStyle || 'balanced';
  if (qualitySelectEl) qualitySelectEl.value = settings.responseQuality || 'premium';
  notesInputEl.value = settings.notes || '';
  historySearchEl.value = settings.historySearch || '';
  chatInput.value = settings.lastDraft || '';
  initVoiceInput();
  initInteractiveNavigation();
  initThemeControls();
  initMobilePanelTabs();
  initSmartMemoryControls();
  renderAll();
  autoResizeTextarea();
  updateSessionLabels();
  await checkBackendHealth();
});


document.querySelector('.mini-card')?.addEventListener('click', () => {
  setActivePanel('chatSection');
  focusAndDraft('Tell me what Mini-Me can help me with today.', document.getElementById('chatSection'), 'Mini-Me is ready. Ask anything in the main chat.');
});

document.querySelector('.status-card')?.addEventListener('click', () => {
  highlightPanel(document.querySelector('.status-card'));
  setStatus(`Mini-Me status: ${getBackendLabel()}.`, backendState === 'live' ? 'success' : 'neutral');
});

// v11 final: visible feedback for every mapped panel/card click.
(function initV11PremiumFeedback(){
  const clickables = [
    ['memorySection', 'Memory panel is active.'],
    ['commandsSection', 'Commands panel is active.'],
    ['focusSection', 'Focus panel is active.'],
    ['settingsSection', 'Settings panel is active.']
  ];
  clickables.forEach(([id, msg]) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.v11Mapped) return;
    el.dataset.v11Mapped = 'true';
    el.addEventListener('click', (event) => {
      if (event.target.closest('button, textarea, select, input')) return;
      setActivePanel(id);
      highlightPanel(el);
      setStatus(msg, 'neutral');
    });
  });
})();

// v12: polished keyboard shortcuts and premium panel reactions.
document.addEventListener('keydown', (event) => {
  const meta = event.ctrlKey || event.metaKey;
  if (meta && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    historySearchEl?.focus();
    setActivePanel('historySection');
    highlightPanel(document.getElementById('historySection') || document.querySelector('.utility-card'));
    setStatus('Search is active. Type to find saved chats.', 'neutral');
  }
  if (meta && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    currentChatId = createChat().id;
    persistSettings();
    renderAll();
    chatInput.focus();
    setStatus('New chat created.', 'success');
  }
});

function markPanelAction(label) {
  ensureV12PanelElements();
  if (panelToastEl) {
    panelToastEl.textContent = label;
    panelToastEl.classList.remove('panel-toast');
    void panelToastEl.offsetWidth;
    panelToastEl.classList.add('panel-toast');
  }
}

document.querySelectorAll('.shortcut-item, .command-item, .starter-chip').forEach((el) => {
  el.addEventListener('click', () => markPanelAction(`Loaded: ${(el.textContent || 'prompt').trim().slice(0, 34)}`));
});

// v16: premium micro-interactions and mobile drawer polish.
(function initV16MicroInteractions(){
  const interactive = document.querySelectorAll('button, .info-card, .sidebar-card, .chat-stage, .composer-wrap');
  interactive.forEach((el) => {
    if (el.dataset.v16Motion) return;
    el.dataset.v16Motion = 'true';
    el.addEventListener('pointerdown', (event) => {
      el.classList.add('pressed');
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--press-x', `${event.clientX - rect.left}px`);
      el.style.setProperty('--press-y', `${event.clientY - rect.top}px`);
      window.setTimeout(() => el.classList.remove('pressed'), 180);
    });
  });

  const mobileQuery = window.matchMedia('(max-width: 980px)');
  const syncMobileState = () => {
    document.body.classList.toggle('is-mobile-view', mobileQuery.matches);
    if (!mobileQuery.matches) setDrawerOpen(false);
  };
  mobileQuery.addEventListener?.('change', syncMobileState);
  syncMobileState();
})();


// v17: installable app registration.
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// v25: Unified Command Engine (/plan, #plan, panel clicks, autocomplete)
(function initCommandEngine(){
  const input=document.getElementById('chatInput'), palette=document.getElementById('commandPalette'), note=document.getElementById('composerNote');
  if(!input||!palette)return;
  const COMMANDS=[
    {id:'plan',aliases:['#plan'],label:'/plan',desc:'Structure a clear step-by-step plan',template:'Help me create a clear, practical plan for: '},
    {id:'write',aliases:['#write'],label:'/write',desc:'Draft clean messages, posts, emails, or scripts',template:'Help me write this clearly and naturally: '},
    {id:'ideas',aliases:['#ideas','#brainstorm'],label:'/ideas',desc:'Generate fresh angles and useful concepts',template:'Give me practical, fresh ideas for: '},
    {id:'study',aliases:['#study','#explain'],label:'/study',desc:'Explain a topic simply, step by step',template:'Teach me this simply, step by step: '},
    {id:'summarize',aliases:['#summarize','#summary'],label:'/summarize',desc:'Turn long text into clean points',template:'Summarize this clearly with key points: '},
    {id:'motivate',aliases:['#motivate'],label:'/motivate',desc:'Give realistic encouragement and next actions',template:'Give me realistic motivation and a short action list for: '}
  ];
  let activeIndex=0, currentMatches=[...COMMANDS];
  const findCommand=(token)=>{const n=String(token||'').trim().toLowerCase();return COMMANDS.find(c=>n===`/${c.id}`||n===c.id||c.aliases.includes(n));};
  const closePalette=()=>{palette.classList.add('hidden');palette.innerHTML='';};
  const leadingToken=()=>{const v=input.value.slice(0,input.selectionStart||input.value.length);const m=v.match(/(^|\s)([\/#][\w-]*)$/);return m?m[2].toLowerCase():'';};
  const renderPalette=(query='/')=>{const q=query.replace(/^[\/#]/,'').toLowerCase();currentMatches=COMMANDS.filter(c=>!q||c.id.includes(q)||c.aliases.some(a=>a.includes(q))||c.desc.toLowerCase().includes(q));if(!currentMatches.length)return closePalette();activeIndex=Math.min(activeIndex,currentMatches.length-1);palette.innerHTML=currentMatches.map((c,i)=>`<button class="command-suggestion ${i===activeIndex?'active':''}" type="button" data-command="${c.id}" role="option"><strong>${c.label}</strong><small>${c.desc}</small><kbd>Enter</kbd></button>`).join('');palette.classList.remove('hidden');};
  const place=(cmd)=>{if(!cmd)return;input.value=cmd.template;input.focus();input.setSelectionRange(input.value.length,input.value.length);closePalette();if(typeof autoResizeTextarea==='function')autoResizeTextarea();if(typeof setStatus==='function')setStatus(`${cmd.label} mode loaded. Add your details and press Enter.`,'neutral');if(note)note.innerHTML=`Command mode active <span class="command-mode-badge">${cmd.label} ${cmd.desc}</span>`;};
  const expandUnified=(text)=>{const t=String(text||'').trim();if(!t)return text;const [tok,...rest]=t.split(/\s+/);const cmd=findCommand(tok);return cmd?`${cmd.template}${rest.join(' ').trim()||'what I am working on'}`:text;};
  window.expandCommand=expandUnified; try{expandCommand=expandUnified;}catch(e){}
  input.addEventListener('input',()=>{const token=leadingToken();if(token.startsWith('/')||token.startsWith('#'))renderPalette(token);else closePalette();if(note&&!input.value.trim())note.textContent='Enter to send. Shift + Enter for a new line. Type / for commands.';});
  input.addEventListener('keydown',(e)=>{if(palette.classList.contains('hidden'))return;if(e.key==='ArrowDown'){e.preventDefault();activeIndex=(activeIndex+1)%currentMatches.length;renderPalette(leadingToken()||'/');}if(e.key==='ArrowUp'){e.preventDefault();activeIndex=(activeIndex-1+currentMatches.length)%currentMatches.length;renderPalette(leadingToken()||'/');}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();place(currentMatches[activeIndex]);}if(e.key==='Escape')closePalette();});
  palette.addEventListener('click',(e)=>{const b=e.target.closest('[data-command]');if(b)place(findCommand(b.dataset.command));});
  document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',(e)=>{e.preventDefault();place(findCommand(b.dataset.command));}));
  document.addEventListener('click',(e)=>{if(!palette.contains(e.target)&&e.target!==input)closePalette();});
})();

// v28: Smart daily focus + unified focus polish
(function initUnifiedSmartFocus(){
  const focusSection = document.getElementById('focusSection');
  const focusTitle = document.getElementById('focusTitle');
  const focusCopy = document.getElementById('focusCopy');
  const chatInput = document.getElementById('chatInput');
  if (!focusSection || !focusCopy) return;

  const focusItems = [
    { title: 'Finish one thing', copy: 'Pick one important task and complete the first real step.', prompt: 'Help me choose one important task for today and break it into three realistic steps.' },
    { title: 'Build momentum', copy: 'Start small, move clearly, and avoid overthinking.', prompt: 'Help me build momentum today with a simple action plan I can actually follow.' },
    { title: 'Clear priority', copy: 'Separate what matters from what is just noise.', prompt: 'Help me identify my top priority today and remove distractions around it.' },
    { title: 'Create first', copy: 'Turn one idea into a real draft before judging it.', prompt: 'Help me turn one idea into a clear first draft today.' },
    { title: 'Study simply', copy: 'Learn one thing deeply instead of rushing many things.', prompt: 'Help me study one topic today in a simple step-by-step way.' },
    { title: 'Review and refine', copy: 'Improve what already exists instead of starting over.', prompt: 'Help me review what I already have and refine it professionally.' },
    { title: 'Calm execution', copy: 'Do less, but do it with more focus and care.', prompt: 'Help me create a calm, focused execution plan for today.' }
  ];

  const todayKey = new Date().toISOString().slice(0, 10);
  const storageKey = `miniMeFocus:${todayKey}`;
  let selected = null;
  try { selected = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}
  if (!selected) {
    const index = new Date().getDate() % focusItems.length;
    selected = focusItems[index];
    try { localStorage.setItem(storageKey, JSON.stringify(selected)); } catch (_) {}
  }

  if (focusTitle) focusTitle.textContent = selected.title;
  focusCopy.textContent = selected.copy;
  focusSection.dataset.prompt = selected.prompt;

  const loadFocusPrompt = () => {
    const promptText = focusSection.dataset.prompt || selected.prompt;
    if (chatInput) {
      chatInput.value = promptText;
      chatInput.focus();
      chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
      if (typeof autoResizeTextarea === 'function') autoResizeTextarea();
    }
    focusSection.classList.add('is-active');
    window.setTimeout(() => focusSection.classList.remove('is-active'), 740);
    if (typeof setStatus === 'function') setStatus('Today’s Focus loaded into the chat composer.', 'neutral');
  };

  focusSection.addEventListener('click', loadFocusPrompt);
  focusSection.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      loadFocusPrompt();
    }
  });
})();

// v32: Real adjustable side panels. Dragging a panel handle resizes the panel and the chat area together.
(function initAdjustablePanels(){
  const shell = document.querySelector('.chat-app-shell');
  const leftHandle = document.getElementById('leftPanelResizer');
  const rightHandle = document.getElementById('rightPanelResizer');
  if (!shell || !leftHandle || !rightHandle) return;

  const LEFT_KEY = 'miniMe:leftPanelWidth';
  const RIGHT_KEY = 'miniMe:rightPanelWidth';
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function getLimits(){
    const w = shell.clientWidth || shell.getBoundingClientRect().width || window.innerWidth;
    const isCompact = w < 1180;
    return {
      leftMin: isCompact ? 170 : 188,
      leftMax: Math.min(isCompact ? 238 : 300, Math.floor(w * 0.24)),
      rightMin: isCompact ? 230 : 260,
      rightMax: Math.min(isCompact ? 286 : 360, Math.floor(w * 0.28)),
      // Keep the chat protected, but let it shrink enough so the right panel never leaves the viewport.
      minChat: Math.min(Math.max(isCompact ? 360 : 420, Math.floor(w * 0.36)), Math.max(320, w - 520))
    };
  }
  function getPanelWidths(){
    const styles = getComputedStyle(shell);
    const currentLeft = parseFloat(styles.getPropertyValue('--left-panel-width')) || 218;
    const currentRight = parseFloat(styles.getPropertyValue('--right-panel-width')) || 264;
    return { currentLeft, currentRight };
  }

  function applyWidths(left, right, save = true){
    const shellWidth = shell.clientWidth || shell.getBoundingClientRect().width || window.innerWidth;
    const styles = getComputedStyle(shell);
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    const handles = (leftHandle?.offsetWidth || 8) + (rightHandle?.offsetWidth || 8);
    const paddingX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const reserved = (gap * 4) + handles + paddingX + 2;
    const limits = getLimits();
    let nextLeft = clamp(Math.round(left), limits.leftMin, limits.leftMax);
    let nextRight = clamp(Math.round(right), limits.rightMin, limits.rightMax);

    const maxPanelsTogether = Math.max(0, shellWidth - limits.minChat - reserved);
    if (nextLeft + nextRight > maxPanelsTogether) {
      const overflow = nextLeft + nextRight - maxPanelsTogether;
      if (nextRight > limits.rightMin) {
        nextRight = Math.max(limits.rightMin, nextRight - overflow);
      } else {
        nextLeft = Math.max(limits.leftMin, nextLeft - overflow);
      }
    }

    const finalTotal = nextLeft + nextRight + limits.minChat + reserved;
    if (finalTotal > shellWidth) {
      nextRight = Math.max(limits.rightMin, nextRight - (finalTotal - shellWidth));
    }

    shell.style.setProperty('--left-panel-width', nextLeft + 'px');
    shell.style.setProperty('--right-panel-width', nextRight + 'px');
    if (save) {
      try {
        localStorage.setItem(LEFT_KEY, String(nextLeft));
        localStorage.setItem(RIGHT_KEY, String(nextRight));
      } catch (_) {}
    }
  }
  function loadSavedWidths(){
    const { currentLeft, currentRight } = getPanelWidths();
    let savedLeft = currentLeft;
    let savedRight = currentRight;
    try {
      savedLeft = parseFloat(localStorage.getItem(LEFT_KEY)) || currentLeft;
      savedRight = parseFloat(localStorage.getItem(RIGHT_KEY)) || currentRight;
    } catch (_) {}
    applyWidths(savedLeft, savedRight, false);
  }

  function startDrag(side, event){
    if (window.matchMedia('(max-width: 980px)').matches) return;
    event.preventDefault();
    const handle = side === 'left' ? leftHandle : rightHandle;
    const startX = event.clientX || (event.touches && event.touches[0]?.clientX) || 0;
    const { currentLeft, currentRight } = getPanelWidths();
    document.body.classList.add('is-resizing-panels');
    handle.classList.add('active');

    const onMove = (moveEvent) => {
      const x = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0]?.clientX) || startX;
      const delta = x - startX;
      if (side === 'left') applyWidths(currentLeft + delta, currentRight, true);
      if (side === 'right') applyWidths(currentLeft, currentRight - delta, true);
    };

    const onUp = () => {
      document.body.classList.remove('is-resizing-panels');
      handle.classList.remove('active');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  leftHandle.addEventListener('pointerdown', (e) => startDrag('left', e));
  rightHandle.addEventListener('pointerdown', (e) => startDrag('right', e));
  leftHandle.addEventListener('keydown', (e) => {
    if (!['ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const { currentLeft, currentRight } = getPanelWidths();
    applyWidths(currentLeft + (e.key === 'ArrowRight' ? 12 : -12), currentRight, true);
  });
  rightHandle.addEventListener('keydown', (e) => {
    if (!['ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const { currentLeft, currentRight } = getPanelWidths();
    applyWidths(currentLeft, currentRight + (e.key === 'ArrowLeft' ? 12 : -12), true);
  });
  window.addEventListener('resize', () => {
    const { currentLeft, currentRight } = getPanelWidths();
    applyWidths(currentLeft, currentRight, false);
  });
  loadSavedWidths();
})();

// v40: final polished right-panel toggle system.
(function initRightPanelTopToggles(){
  const STORAGE_KEY = 'minime_right_panel_active_v40';
  const memoryBtn = document.getElementById('toggleMemoryPanel');
  const commandsBtn = document.getElementById('toggleCommandsPanel');
  const memoryPanel = document.getElementById('memorySection');
  const commandsPanel = document.getElementById('commandsSection');
  const rightPanel = document.querySelector('.insight-panel');
  const chatInput = document.getElementById('chatInput');
  if (!memoryBtn || !commandsBtn || !memoryPanel || !commandsPanel || !rightPanel) return;

  let activePanel = null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'memory' || saved === 'commands') activePanel = saved;
  } catch (_) {}

  function save() {
    try {
      if (activePanel) localStorage.setItem(STORAGE_KEY, activePanel);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function pulse(btn) {
    btn.classList.remove('just-opened');
    void btn.offsetWidth;
    btn.classList.add('just-opened');
    window.setTimeout(() => btn.classList.remove('just-opened'), 720);
  }

  function setToggleState(btn, isOpen) {
    btn.classList.toggle('is-active', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
  }

  function setPanel(type, options = {}) {
    const { announce = true, animate = true } = options;
    activePanel = type;
    const memoryOpen = type === 'memory';
    const commandsOpen = type === 'commands';
    memoryPanel.classList.toggle('is-collapsed', !memoryOpen);
    commandsPanel.classList.toggle('is-collapsed', !commandsOpen);
    setToggleState(memoryBtn, memoryOpen);
    setToggleState(commandsBtn, commandsOpen);
    rightPanel.classList.toggle('has-open-toggle-panel', Boolean(type));
    if (animate && type) {
      const panel = type === 'memory' ? memoryPanel : commandsPanel;
      panel.classList.remove('panel-peek');
      void panel.offsetWidth;
      panel.classList.add('panel-peek');
      window.setTimeout(() => panel.classList.remove('panel-peek'), 780);
    }
    save();
    if (announce && typeof setStatus === 'function') {
      if (type === 'memory') setStatus('Memory opened. Click 🧠 again to close it.', 'neutral');
      else if (type === 'commands') setStatus('Commands opened. Click ⌘ again to close it.', 'neutral');
      else setStatus('Right panel tucked away.', 'neutral');
    }
  }

  function toggle(type) {
    const next = activePanel === type ? null : type;
    pulse(type === 'memory' ? memoryBtn : commandsBtn);
    setPanel(next, { announce: true, animate: true });
    if (next === 'commands') chatInput?.focus();
    if (next === 'memory') document.getElementById('notesInput')?.focus();
  }

  memoryBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggle('memory');
  });
  commandsBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggle('commands');
  });
  document.getElementById('navMemory')?.addEventListener('click', (event) => {
    event.preventDefault();
    setPanel(activePanel === 'memory' ? null : 'memory', { announce: true, animate: true });
  }, true);
  document.getElementById('navCommands')?.addEventListener('click', (event) => {
    event.preventDefault();
    setPanel(activePanel === 'commands' ? null : 'commands', { announce: true, animate: true });
  }, true);
  document.getElementById('memoryViewAllButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    setPanel('memory', { announce: true, animate: true });
  }, true);
  document.getElementById('commandsViewAllButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    setPanel('commands', { announce: true, animate: true });
  }, true);
  document.addEventListener('keydown', (event) => {
    const meta = event.ctrlKey || event.metaKey;
    if (meta && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      toggle('memory');
    }
    if (meta && event.key === '/') {
      event.preventDefault();
      toggle('commands');
    }
    if (event.key === 'Escape' && activePanel) {
      event.preventDefault();
      setPanel(null, { announce: true, animate: true });
      chatInput?.focus();
    }
  });
  document.getElementById('searchButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    chatInput?.focus();
    if (typeof setStatus === 'function') setStatus('Chat input focused. Start typing your request.', 'neutral');
  });
  setPanel(activePanel, { announce: false, animate: false });
})();

// v39: Micro feedback polish - subtle ripple, soft click tone, mobile vibration, and tiny status toast.
(function initMicroFeedbackPolish(){
  const STORAGE_KEY = 'minime_micro_feedback_v39';
  const toggle = document.getElementById('microFeedbackToggle');
  const label = document.getElementById('microFeedbackLabel');
  let enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
  let audioCtx = null;
  let toastTimer = null;

  const apply = () => {
    document.body.classList.toggle('micro-feedback-off', !enabled);
    if (toggle) toggle.setAttribute('aria-pressed', String(enabled));
    if (label) label.textContent = enabled ? 'On' : 'Off';
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  };

  function softTone(type = 'tap') {
    if (!enabled) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      const freq = type === 'success' ? 520 : type === 'close' ? 280 : 360;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(type === 'success' ? 0.018 : 0.012, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.105);
    } catch (_) {}
  }

  function vibrate(ms = 8) {
    if (!enabled || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (_) {}
  }

  function showMicroToast(text) {
    if (!enabled || !text) return;
    let toast = document.getElementById('microFeedbackToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'microFeedbackToast';
      toast.className = 'micro-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1400);
  }

  function addRipple(el, event) {
    if (!enabled || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('micro-ripple-host');
    const rect = el.getBoundingClientRect();
    const x = ((event?.clientX ?? (rect.left + rect.width / 2)) - rect.left) + 'px';
    const y = ((event?.clientY ?? (rect.top + rect.height / 2)) - rect.top) + 'px';
    const ripple = document.createElement('span');
    ripple.className = 'micro-ripple';
    ripple.style.setProperty('--ripple-x', x);
    ripple.style.setProperty('--ripple-y', y);
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  function feedbackFor(el, event) {
    if (!enabled || !el) return;
    addRipple(el, event);
    el.classList.add('micro-pressing');
    setTimeout(() => el.classList.remove('micro-pressing'), 105);
    if (el.matches('.send-action, .panel-toggle, .menu-action.strong, .command-item, .starter-chip')) {
      el.classList.add('micro-success');
      setTimeout(() => el.classList.remove('micro-success'), 460);
    }
    softTone(el.matches('.send-action, .command-item') ? 'success' : 'tap');
    vibrate(el.matches('.send-action') ? 12 : 7);
  }

  document.addEventListener('pointerdown', (event) => {
    const target = event.target.closest('button, .starter-chip, .command-item, .nav-link, .info-card[role="button"], .menu-action, .theme-btn, .text-size-btn, .mini-toggle');
    if (!target || target.disabled) return;
    feedbackFor(target, event);
  }, { passive: true });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button, .starter-chip, .command-item, .nav-link, .info-card[role="button"], .menu-action, .theme-btn, .text-size-btn, .mini-toggle');
    if (!target || target.disabled) return;
    const id = target.id || '';
    const text = (target.innerText || target.getAttribute('title') || '').trim().replace(/\s+/g, ' ');
    if (id === 'sendButton') showMicroToast('Sending to Mini Me…');
    else if (id === 'toggleMemoryPanel') showMicroToast(target.getAttribute('aria-expanded') === 'true' ? 'Memory ready' : 'Memory closed');
    else if (id === 'toggleCommandsPanel') showMicroToast(target.getAttribute('aria-expanded') === 'true' ? 'Commands ready' : 'Commands closed');
    else if (target.matches('.command-item')) showMicroToast(`${text.split(' ')[0]} loaded`);
    else if (id === 'newChatButton') showMicroToast('New chat started');
    else if (id === 'exportAllButton' || id === 'exportChatButton') showMicroToast('Preparing export…');
  }, true);

  toggle?.addEventListener('click', (event) => {
    event.preventDefault();
    enabled = !enabled;
    apply();
    softTone(enabled ? 'success' : 'close');
    showMicroToast(enabled ? 'Micro feedback on' : 'Micro feedback off');
  });

  window.MiniMeFeedback = { show: showMicroToast, tone: softTone };
  apply();
})();


// v40: reliable live clock + greeting based on local time.
(function initReliableClock(){
  if (window.minime_clock_started_v40) return;
  window.minime_clock_started_v40 = true;
  if (typeof updateGreetingClock === 'function') {
    updateGreetingClock();
    window.setInterval(updateGreetingClock, 1000);
  }
})();

// v46: final right-panel autosize physics. Keeps the right panel inside viewport and lets chat resize with it.
(function initV46RightPanelAutosize(){
  const shell = document.querySelector('.chat-app-shell');
  const leftHandle = document.getElementById('leftPanelResizer');
  const rightHandle = document.getElementById('rightPanelResizer');
  if (!shell || !rightHandle) return;

  const LEFT_KEY = 'miniMe:leftPanelWidth';
  const RIGHT_KEY = 'miniMe:rightPanelWidth';
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function limits(){
    const width = shell.clientWidth || window.innerWidth;
    const compact = width < 1180;
    return {
      leftMin: compact ? 176 : 188,
      leftMax: Math.min(compact ? 238 : 300, Math.floor(width * 0.24)),
      rightMin: compact ? 220 : 230,
      rightMax: Math.min(compact ? 300 : 340, Math.floor(width * 0.26)),
      minChat: compact ? 370 : 420,
      chrome: 8 + 8 + 20 // handles + shell horizontal padding
    };
  }

  function current(){
    const styles = getComputedStyle(shell);
    return {
      left: parseFloat(styles.getPropertyValue('--left-panel-width')) || 218,
      right: parseFloat(styles.getPropertyValue('--right-panel-width')) || 264
    };
  }

  function apply(left, right, save = true){
    const L = limits();
    const shellWidth = shell.clientWidth || window.innerWidth;
    let nextLeft = clamp(Math.round(left), L.leftMin, L.leftMax);
    let nextRight = clamp(Math.round(right), L.rightMin, L.rightMax);

    const maxBothPanels = Math.max(L.leftMin + L.rightMin, shellWidth - L.minChat - L.chrome);
    if (nextLeft + nextRight > maxBothPanels) {
      const overflow = nextLeft + nextRight - maxBothPanels;
      // Preserve the panel being adjusted as much as possible, but never push layout off-screen.
      if (nextRight > L.rightMin) nextRight = Math.max(L.rightMin, nextRight - overflow);
      else nextLeft = Math.max(L.leftMin, nextLeft - overflow);
    }

    shell.style.setProperty('--left-panel-width', nextLeft + 'px');
    shell.style.setProperty('--right-panel-width', nextRight + 'px');

    if (save) {
      try {
        localStorage.setItem(LEFT_KEY, String(nextLeft));
        localStorage.setItem(RIGHT_KEY, String(nextRight));
      } catch (_) {}
    }
  }

  function load(){
    const c = current();
    let savedLeft = c.left;
    let savedRight = c.right;
    try {
      savedLeft = parseFloat(localStorage.getItem(LEFT_KEY)) || c.left;
      savedRight = parseFloat(localStorage.getItem(RIGHT_KEY)) || c.right;
    } catch (_) {}
    apply(savedLeft, savedRight, false);
  }

  function start(side, event){
    if (window.matchMedia('(max-width: 980px)').matches) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startSizes = current();
    document.body.classList.add('is-resizing-panels');

    function move(e){
      const dx = e.clientX - startX;
      if (side === 'right') apply(startSizes.left, startSizes.right - dx, true);
      if (side === 'left') apply(startSizes.left + dx, startSizes.right, true);
    }
    function end(){
      document.body.classList.remove('is-resizing-panels');
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
  }

  rightHandle.addEventListener('pointerdown', (e) => start('right', e), true);
  if (leftHandle) leftHandle.addEventListener('pointerdown', (e) => start('left', e), true);
  window.addEventListener('resize', () => {
    const c = current();
    apply(c.left, c.right, false);
  });
  load();
})();

// v49: weather-aware greeting panel and reliable local time.
(function initWeatherAwareGreetingV49(){
  if (window.minime_weather_greeting_v49) return;
  window.minime_weather_greeting_v49 = true;

  const weatherChip = document.getElementById('weatherChip');
  const weatherIcon = document.getElementById('weatherIcon');
  const weatherLabel = document.getElementById('weatherLabel');
  const topbar = document.querySelector('.app-topbar');
  const CACHE_KEY = 'miniMeWeatherCacheV49';
  const FALLBACK = { latitude: 5.6037, longitude: -0.1870 };

  window.updateGreetingClock = function updateGreetingClockV49() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Good evening';
    let sky = 'evening';

    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning';
      sky = 'morning';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
      sky = 'afternoon';
    }

    if (greetingTitleEl) greetingTitleEl.textContent = `${greeting} 👋`;
    if (liveTimeEl) liveTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (liveDateEl) liveDateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    if (topbar) {
      topbar.classList.remove('sky-morning', 'sky-afternoon', 'sky-evening');
      topbar.classList.add(`sky-${sky}`);
    }
    document.body.dataset.dayPeriod = sky;
  };

  function setWeatherVisual(kind, label, icon){
    if (topbar) {
      topbar.classList.remove('weather-clear', 'weather-cloudy', 'weather-rain', 'weather-storm', 'weather-fog');
      topbar.classList.add('weather-' + kind);
    }
    if (weatherChip) weatherChip.dataset.weather = kind;
    if (weatherIcon) weatherIcon.textContent = icon;
    if (weatherLabel) weatherLabel.textContent = label;
  }

  function classifyWeather(code, cloudCover = 0){
    const n = Number(code);
    const clouds = Number(cloudCover) || 0;
    if ([95, 96, 99].includes(n)) return { kind: 'storm', label: 'Stormy', icon: '⛈️' };
    if ((n >= 51 && n <= 67) || (n >= 80 && n <= 82)) return { kind: 'rain', label: 'Rainy', icon: '🌧️' };
    if ([45, 48].includes(n)) return { kind: 'fog', label: 'Foggy', icon: '🌫️' };
    if (n === 3 || clouds >= 70) return { kind: 'cloudy', label: 'Cloudy', icon: '☁️' };
    if ([1, 2].includes(n) || clouds >= 35) return { kind: 'cloudy', label: 'Partly cloudy', icon: '⛅' };
    return { kind: 'clear', label: 'Sunny', icon: '☀️' };
  }

  async function fetchWeather(coords){
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', coords.latitude);
    url.searchParams.set('longitude', coords.longitude);
    url.searchParams.set('current', 'temperature_2m,weather_code,cloud_cover,is_day');
    url.searchParams.set('timezone', 'auto');
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Weather unavailable');
    return response.json();
  }

  function getPosition(){
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(FALLBACK);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(FALLBACK),
        { enableHighAccuracy: false, timeout: 6500, maximumAge: 30 * 60 * 1000 }
      );
    });
  }

  async function updateWeather(){
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.time < 15 * 60 * 1000) {
        const visual = classifyWeather(cached.code, cached.cloudCover);
        setWeatherVisual(visual.kind, visual.label, visual.icon);
        return;
      }
    } catch (_) {}

    try {
      if (weatherLabel) weatherLabel.textContent = 'Checking';
      const coords = await getPosition();
      const data = await fetchWeather(coords);
      const current = data.current || {};
      const visual = classifyWeather(current.weather_code, current.cloud_cover);
      setWeatherVisual(visual.kind, visual.label, visual.icon);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          time: Date.now(),
          code: current.weather_code,
          cloudCover: current.cloud_cover,
          temperature: current.temperature_2m,
        }));
      } catch (_) {}
    } catch (_) {
      setWeatherVisual('cloudy', 'Weather', '⛅');
    }
  }

  window.updateGreetingClock();
  window.setInterval(window.updateGreetingClock, 1000);
  updateWeather();
  window.setInterval(updateWeather, 15 * 60 * 1000);
})();

// v51 production lock: remove stale duplicate nav items if an older cached HTML is loaded
(function finalProductionDomGuard() {
  function cleanDuplicateSidebarItems() {
    const banned = new Set(['memory', 'commands', 'journal', 'files']);
    document.querySelectorAll('.sidebar-nav .nav-link').forEach((button) => {
      const label = Array.from(button.querySelectorAll('span'))
        .map((span) => span.textContent.trim().toLowerCase())
        .find((text) => banned.has(text));
      const target = (button.dataset && button.dataset.target || '').toLowerCase();
      if (label || banned.has(target)) button.remove();
    });
  }

  function normalizeComposer() {
    const row = document.querySelector('.composer-row');
    const input = document.getElementById('chatInput');
    const attach = document.getElementById('attachButton');
    const mic = document.getElementById('micButton');
    const send = document.getElementById('sendButton');
    if (!row || !input || !attach || !mic || !send) return;
    row.classList.add('composer-row-right-mic');
    input.removeAttribute('style');
    input.rows = 1;
    input.placeholder = 'Message Mini Me... Type / for commands';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      cleanDuplicateSidebarItems();
      normalizeComposer();
    });
  } else {
    cleanDuplicateSidebarItems();
    normalizeComposer();
  }
})();

// v52: premium splash reveal. New style: logo in animated ring, then smooth handoff to app.
(function initPremiumSplash() {
  const SHOW_MS = 1850;
  const MIN_MS = 700;

  function finishSplash() {
    const splash = document.getElementById('splashScreen');
    document.body.classList.add('splash-finished');
    if (!splash) return;
    splash.classList.add('is-hidden');
    window.setTimeout(() => splash.remove(), 700);
  }

  function bootSplash() {
    const splash = document.getElementById('splashScreen');
    const skip = document.getElementById('skipSplash');
    if (!splash) {
      document.body.classList.add('splash-finished');
      return;
    }

    const start = Date.now();
    const close = () => {
      const elapsed = Date.now() - start;
      window.setTimeout(finishSplash, Math.max(0, MIN_MS - elapsed));
    };

    skip?.addEventListener('click', close, { once: true });
    window.setTimeout(close, SHOW_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSplash, { once: true });
  } else {
    bootSplash();
  }
})();

// v53 final preview polish: auto-close open panels on mouse leave + offline sleep logo.
(function initFinalPreviewPolishV53(){
  if (window.minime_final_preview_v53) return;
  window.minime_final_preview_v53 = true;

  function setOfflineState(){
    const isOnline = navigator.onLine !== false;
    document.body.classList.toggle('is-offline', !isOnline);
    const modeLabel = document.getElementById('modeLabel');
    if (modeLabel && !isOnline) modeLabel.textContent = 'Sleeping offline';
  }

  setOfflineState();
  window.addEventListener('online', setOfflineState);
  window.addEventListener('offline', setOfflineState);

  function closeRightTogglePanels(){
    const rightPanel = document.querySelector('.insight-panel');
    const memoryPanel = document.getElementById('memorySection');
    const commandsPanel = document.getElementById('commandsSection');
    const memoryBtn = document.getElementById('toggleMemoryPanel');
    const commandsBtn = document.getElementById('toggleCommandsPanel');

    rightPanel?.classList.remove('has-open-toggle-panel', 'hover-auto-closing');
    memoryPanel?.classList.add('is-collapsed');
    commandsPanel?.classList.add('is-collapsed');
    memoryBtn?.classList.remove('is-active');
    commandsBtn?.classList.remove('is-active');
    memoryBtn?.setAttribute('aria-expanded', 'false');
    commandsBtn?.setAttribute('aria-expanded', 'false');
    try { localStorage.removeItem('minime_right_panel_active_v40'); } catch (_) {}
  }

  function autoCloseOnLeave(element, closeFn, delay = 260){
    if (!element) return;
    let t;
    element.addEventListener('mouseleave', () => {
      element.classList.add('hover-auto-closing');
      t = window.setTimeout(closeFn, delay);
    });
    element.addEventListener('mouseenter', () => {
      window.clearTimeout(t);
      element.classList.remove('hover-auto-closing');
    });
  }

  const rightPanel = document.querySelector('.insight-panel');
  autoCloseOnLeave(rightPanel, closeRightTogglePanels, 300);

  const voicePanel = document.getElementById('voicePanel');
  autoCloseOnLeave(voicePanel, () => voicePanel?.classList.add('hidden'), 300);

  const commandPalette = document.getElementById('commandPalette');
  autoCloseOnLeave(commandPalette, () => commandPalette?.classList.add('hidden'), 220);
})();

// v54 REAL FINAL: apply requested hover-close behavior to every opened floating area.
(function initTrueFinalHoverCloseV54(){
  if (window.minime_true_final_hover_close_v54) return;
  window.minime_true_final_hover_close_v54 = true;

  function getEls(){
    return {
      rightPanel: document.querySelector('.insight-panel'),
      memoryPanel: document.getElementById('memorySection'),
      commandsPanel: document.getElementById('commandsSection'),
      memoryBtn: document.getElementById('toggleMemoryPanel'),
      commandsBtn: document.getElementById('toggleCommandsPanel'),
      voicePanel: document.getElementById('voicePanel'),
      commandPalette: document.getElementById('commandPalette'),
      settingsPanel: document.getElementById('settingsSection'),
      drawer: document.getElementById('drawer'),
      drawerOverlay: document.getElementById('drawerOverlay'),
      panelOverlay: document.getElementById('panelOverlay')
    };
  }

  function closeRightPanels(){
    const { rightPanel, memoryPanel, commandsPanel, memoryBtn, commandsBtn, panelOverlay } = getEls();
    rightPanel?.classList.remove('has-open-toggle-panel', 'hover-auto-closing');
    memoryPanel?.classList.add('is-collapsed');
    commandsPanel?.classList.add('is-collapsed');
    memoryBtn?.classList.remove('is-active', 'just-opened');
    commandsBtn?.classList.remove('is-active', 'just-opened');
    memoryBtn?.setAttribute('aria-expanded', 'false');
    commandsBtn?.setAttribute('aria-expanded', 'false');
    panelOverlay?.classList.remove('show', 'is-visible', 'active');
    try { localStorage.removeItem('minime_right_panel_active_v40'); } catch (_) {}
  }

  function closeVoicePanel(){
    const { voicePanel } = getEls();
    voicePanel?.classList.add('hidden');
    voicePanel?.classList.remove('hover-auto-closing');
  }

  function closeCommandPalette(){
    const { commandPalette } = getEls();
    commandPalette?.classList.add('hidden');
    commandPalette?.classList.remove('hover-auto-closing');
  }

  function closeSettingsPanel(){
    const { settingsPanel } = getEls();
    settingsPanel?.classList.remove('panel-active', 'panel-highlight', 'hover-auto-closing');
    document.body.classList.remove('settings-open');
    document.querySelectorAll('.nav-link').forEach((btn) => {
      if (btn.dataset.target === 'settings') btn.classList.remove('active');
    });
  }

  function closeDrawerIfTemporary(){
    const { drawer, drawerOverlay } = getEls();
    if (!drawer) return;
    if (drawer.classList.contains('open') || drawer.classList.contains('is-open') || document.body.classList.contains('drawer-open')) {
      drawer.classList.remove('open', 'is-open', 'hover-auto-closing');
      drawerOverlay?.classList.remove('show', 'is-visible', 'active');
      document.body.classList.remove('drawer-open');
    }
  }

  function autoCloseOnMouseLeave(element, closeFn, delay = 260){
    if (!element || element.dataset.hoverCloseBound === 'true') return;
    element.dataset.hoverCloseBound = 'true';
    let timer = null;
    element.addEventListener('mouseleave', () => {
      element.classList.add('hover-auto-closing');
      window.clearTimeout(timer);
      timer = window.setTimeout(closeFn, delay);
    });
    element.addEventListener('mouseenter', () => {
      window.clearTimeout(timer);
      element.classList.remove('hover-auto-closing');
    });
  }

  function bind(){
    const { rightPanel, voicePanel, commandPalette, settingsPanel, drawer } = getEls();
    autoCloseOnMouseLeave(rightPanel, closeRightPanels, 280);
    autoCloseOnMouseLeave(voicePanel, closeVoicePanel, 240);
    autoCloseOnMouseLeave(commandPalette, closeCommandPalette, 220);
    autoCloseOnMouseLeave(settingsPanel, closeSettingsPanel, 280);
    autoCloseOnMouseLeave(drawer, closeDrawerIfTemporary, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();


// v55: settings hover auto-close fallback. Keeps Settings consistent with Memory/Commands.
(function initSettingsAutoCloseV55(){
  if (window.minime_settings_autoclose_v55) return;
  window.minime_settings_autoclose_v55 = true;
  function bind(){
    const settingsPanel = document.getElementById('settingsSection');
    if (!settingsPanel || settingsPanel.dataset.settingsHoverCloseBound === 'true') return;
    settingsPanel.dataset.settingsHoverCloseBound = 'true';
    let timer = null;
    settingsPanel.addEventListener('mouseleave', () => {
      settingsPanel.classList.add('hover-auto-closing');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        settingsPanel.classList.remove('panel-active', 'panel-highlight', 'hover-auto-closing');
        document.body.classList.remove('settings-open');
        document.querySelectorAll('.nav-link').forEach((btn) => {
          if (btn.dataset.target === 'settings') btn.classList.remove('active');
        });
      }, 280);
    });
    settingsPanel.addEventListener('mouseenter', () => {
      window.clearTimeout(timer);
      settingsPanel.classList.remove('hover-auto-closing');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();

// v56 FINAL: robust Settings auto-close.
// This fixes the case where Settings is opened from the left sidebar, so the mouse never "entered" the settings tray.
(function initSettingsAutoCloseV56(){
  if (window.minime_settings_autoclose_v56) return;
  window.minime_settings_autoclose_v56 = true;

  const CLOSE_DELAY = 420;
  const OPEN_GRACE = 1200;
  let closeTimer = null;
  let graceUntil = 0;

  function getEls(){
    return {
      settingsPanel: document.getElementById('settingsSection'),
      settingsBtn: document.getElementById('navSettings') || document.querySelector('[data-target="settings"]'),
      insightPanel: document.querySelector('.insight-panel')
    };
  }

  function isSettingsOpen(){
    const { settingsPanel } = getEls();
    return document.body.classList.contains('settings-open') || settingsPanel?.classList.contains('panel-active');
  }

  function closeSettings(){
    const { settingsPanel } = getEls();
    settingsPanel?.classList.remove('panel-active', 'panel-highlight', 'hover-auto-closing');
    document.body.classList.remove('settings-open');
    document.querySelectorAll('.nav-link').forEach((btn) => {
      if (btn.dataset.target === 'settings' || btn.id === 'navSettings') btn.classList.remove('active');
    });
  }

  function clearClose(){
    window.clearTimeout(closeTimer);
    closeTimer = null;
    getEls().settingsPanel?.classList.remove('hover-auto-closing');
  }

  function scheduleClose(delay = CLOSE_DELAY){
    if (!isSettingsOpen()) return;
    if (Date.now() < graceUntil) return;
    clearClose();
    const { settingsPanel } = getEls();
    settingsPanel?.classList.add('hover-auto-closing');
    closeTimer = window.setTimeout(closeSettings, delay);
  }

  function pointInRect(x, y, rect, pad = 0){
    if (!rect) return false;
    return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
  }

  function bind(){
    const { settingsPanel, settingsBtn, insightPanel } = getEls();
    if (!settingsPanel) return;

    // Give the user time to move from the left Settings button into the right Settings tray.
    settingsBtn?.addEventListener('click', () => {
      graceUntil = Date.now() + OPEN_GRACE;
      clearClose();
      window.setTimeout(() => {
        if (!isSettingsOpen()) return;
        // If the cursor has not entered the Settings tray after the grace window, close it.
        scheduleClose(260);
      }, OPEN_GRACE + 40);
    }, true);

    [settingsPanel, settingsBtn, insightPanel].forEach((el) => {
      if (!el || el.dataset.settingsAutoCloseV56 === 'true') return;
      el.dataset.settingsAutoCloseV56 = 'true';
      el.addEventListener('mouseenter', clearClose);
      el.addEventListener('pointerenter', clearClose);
    });

    settingsPanel.addEventListener('mouseleave', () => scheduleClose(260));
    settingsPanel.addEventListener('pointerleave', () => scheduleClose(260));
    insightPanel?.addEventListener('mouseleave', () => {
      if (isSettingsOpen()) scheduleClose(280);
    });

    // Safety net: if Settings is open and the cursor is outside both the Settings tray and the Settings nav button, close it.
    document.addEventListener('mousemove', (event) => {
      if (!isSettingsOpen()) return;
      const { settingsPanel: panel, settingsBtn: btn } = getEls();
      const insidePanel = panel && pointInRect(event.clientX, event.clientY, panel.getBoundingClientRect(), 12);
      const insideButton = btn && pointInRect(event.clientX, event.clientY, btn.getBoundingClientRect(), 8);
      if (insidePanel || insideButton || Date.now() < graceUntil) {
        clearClose();
      } else {
        scheduleClose(360);
      }
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isSettingsOpen()) closeSettings();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
