const express = require('express');
const path = require('path');
let dotenvLoaded = false;
try { require('dotenv').config(); dotenvLoaded = true; } catch {}

const app = express();
const PORT = Number(process.env.PORT || 3000);

function hasValidApiKey(value) {
  if (!value) return false;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  const placeholders = new Set([
    'your_real_api_key_here',
    'your_api_key_here',
    'paste_your_api_key_here',
    'replace_me',
    'sk-your-key-here',
    'gsk_your_key_here',
  ]);
  return !placeholders.has(trimmed.toLowerCase());
}

function getProviderConfig() {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const useGroq = hasValidApiKey(groqKey);

  if (useGroq) {
    return {
      provider: 'groq',
      apiKey: groqKey,
      baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
      model: process.env.GROQ_MODEL || process.env.AI_MODEL || 'llama-3.3-70b-versatile',
      temperature: Number(process.env.GROQ_TEMPERATURE || process.env.AI_TEMPERATURE || 0.55),
    };
  }

  return {
    provider: 'openai',
    apiKey: openaiKey,
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4.1-mini',
    temperature: Number(process.env.OPENAI_TEMPERATURE || process.env.AI_TEMPERATURE || 0.55),
  };
}

const BASE_SYSTEM_PROMPT = `You are Mini-Me, a private personal AI assistant.

Core identity:
- Think like a sharp planner, writer, researcher, and problem-solver.
- Sound natural, calm, confident, and human.
- Be genuinely useful, not generic.
- Avoid hype, filler, robotic phrasing, and weak disclaimers.

Response quality rules:
- Prefer specific, actionable guidance over vague advice.
- If the user asks for ideas, make each idea distinct, modern, and usable.
- If the user asks for a plan, turn it into clear priorities, concrete steps, or a realistic sequence.
- If the user asks for writing help, draft polished text they can actually send.
- If the user asks for learning help, explain simply and step by step.
- If there is an obvious best recommendation, lead with it and briefly explain why.
- If the request is broad, make a reasonable assumption and give a strong first draft instead of stalling.
- Use the user's saved notes and preferences actively when they are relevant.

Style:
- Clear, direct, practical, and structured.
- Concise by default, but never shallow.
- Use clean sections, numbered steps, or bullets when that improves usefulness.
- Make answers skimmable: short paragraphs, strong labels, and clear spacing.
- Do not repeat the user's question back to them.
- Do not give generic self-help filler.
- End with one useful next step only when it genuinely helps.

Goal:
Make Mini-Me feel like a reliable personal assistant that helps the user think clearly and act quickly.`;

function buildUserMemorySection(memoryProfile = {}) {
  const lines = [];
  if (memoryProfile.preferredName) lines.push(`Preferred name: ${memoryProfile.preferredName}`);
  if (memoryProfile.responseStyle) lines.push(`Preferred response style: ${memoryProfile.responseStyle}`);
  if (memoryProfile.focusAreas?.length) lines.push(`Common focus areas: ${memoryProfile.focusAreas.join(', ')}`);
  if (memoryProfile.lastActiveGoal) lines.push(`Recent goal or topic: ${memoryProfile.lastActiveGoal}`);
  if (memoryProfile.customInstructions) lines.push(`Custom instructions: ${memoryProfile.customInstructions}`);
  return lines.length ? `\nUser memory profile:\n${lines.join('\n')}` : '';
}

function normalizeProviderError(provider, status, message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('quota') || text.includes('billing')) {
    return `${provider === 'groq' ? 'Groq' : 'OpenAI'} quota or billing issue. Check your API account and try again.`;
  }
  if (text.includes('rate limit') || text.includes('too many requests')) {
    return `${provider === 'groq' ? 'Groq' : 'OpenAI'} is rate-limiting requests right now. Wait a moment and try again.`;
  }
  if (text.includes('invalid api key') || text.includes('authentication')) {
    return `The ${provider === 'groq' ? 'Groq' : 'OpenAI'} API key was rejected. Check your .env file and restart the server.`;
  }
  if (status >= 500) {
    return `${provider === 'groq' ? 'Groq' : 'OpenAI'} is temporarily unavailable. Try again in a moment.`;
  }
  return message || `${provider} returned an error.`;
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

app.get('/api/health', (_req, res) => {
  const providerConfig = getProviderConfig();
  res.json({
    ok: true,
    dotenvLoaded,
    provider: providerConfig.provider,
    hasApiKey: hasValidApiKey(providerConfig.apiKey),
    model: providerConfig.model,
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const providerConfig = getProviderConfig();
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const responseStyle = typeof req.body?.responseStyle === 'string' ? req.body.responseStyle : 'balanced';
    const responseQuality = typeof req.body?.responseQuality === 'string' ? req.body.responseQuality : 'premium';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 4000) : '';
    const attachmentText = typeof req.body?.attachmentText === 'string' ? req.body.attachmentText.trim().slice(0, 12000) : '';
    const memoryProfile = typeof req.body?.memoryProfile === 'object' && req.body?.memoryProfile ? req.body.memoryProfile : {};

    if (!messages.length) return res.status(400).json({ error: 'No messages were provided.' });
    if (!hasValidApiKey(providerConfig.apiKey)) {
      return res.status(500).json({
        error: providerConfig.provider === 'groq'
          ? 'Missing valid GROQ_API_KEY in .env.'
          : 'Missing valid OPENAI_API_KEY in .env.',
      });
    }

    const cleanMessages = messages
      .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
      .map((m) => ({ role: m.role, content: m.content }));

    const stylePrompt = responseStyle === 'concise'
      ? 'Keep replies concise and direct, but still specific and actionable. Prefer 1 short paragraph or 3-5 crisp bullets.'
      : responseStyle === 'detailed'
      ? 'Give fuller explanations with useful detail, thoughtful structure, and practical next steps. Go deeper without becoming bloated.'
      : 'Keep replies balanced: clear, useful, specific, and not too long. Prefer strong recommendations over generic possibilities.';

    let extraContext = buildUserMemorySection(memoryProfile);
    if (notes) extraContext += `\nSaved notes:\n${notes}`;
    if (attachmentText) extraContext += `\nAttached file text:\n${attachmentText}`;
    const qualityPrompt = responseQuality === 'deep'
      ? 'Quality mode: Deep. Think through the request carefully, cover edge cases, and give a more complete answer without rambling.'
      : responseQuality === 'fast'
      ? 'Quality mode: Fast. Prioritize speed and clarity. Give the best useful answer in fewer words.'
      : 'Quality mode: Premium. Before finalizing, mentally check: is this specific, polished, useful, and easy to act on? Improve weak wording and remove filler.';


    const intelligencePrompt = `
Extra intelligence rules:
- Never answer with bland placeholders like “do a task” or “take care of yourself.” Use concrete examples.
- If the user asks for a plan, make it priority-aware or time-aware when possible.
- If the user asks for ideas, avoid bland filler ideas; make each idea distinct and explain the angle briefly.
- If the user asks for recommendations, give a best option first, then brief alternatives if helpful.
- If the user seems to want execution, give them a usable draft, checklist, or step sequence.
- If the answer can be improved by tailoring it to the user's notes, memory profile, or attached text, actively use that context.
- Remember and reuse stable preferences naturally without saying “based on your memory” unless it matters.
- Use a confident assistant tone: direct, useful, calm, never robotic.
- When the user is vague, make a smart assumption and move forward confidently.`;

    const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: providerConfig.model,
        temperature: providerConfig.temperature,
        messages: [
          { role: 'system', content: `${BASE_SYSTEM_PROMPT}\n${stylePrompt}\n${qualityPrompt}\n${intelligencePrompt}${extraContext}` },
          ...cleanMessages,
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: normalizeProviderError(providerConfig.provider, response.status, data?.error?.message || `${providerConfig.provider} returned an error.`),
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: `${providerConfig.provider} returned an empty reply.` });
    res.json({ reply, provider: providerConfig.provider, model: providerConfig.model });
  } catch (error) {
    console.error('Mini-Me backend error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Mini-Me could not reach the AI service.' });
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const target = req.path === '/' ? 'index.html' : req.path.slice(1);
  return res.sendFile(path.join(__dirname, target), (err) => {
    if (err) res.status(404).sendFile(path.join(__dirname, 'index.html'));
  });
});

app.listen(PORT, () => console.log(`Mini-Me server running on http://localhost:${PORT}`));
