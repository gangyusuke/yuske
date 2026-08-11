require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5';

// In-memory conversation store, keyed by session id (per-server-instance, non-persistent).
const sessions = new Map();

const SYSTEM_PROMPT = `あなたは「スマホ副業プランナー」というAIエージェントです。
ユーザーがスマートフォンだけで実行できる副業を見つけ、月10万円の収入を得るための
具体的な計画を立てるのを手伝います。

振る舞いのルール:
- ユーザーの状況（1日に使える時間、興味・スキル、初期資金の有無など）が不明な場合は、
  提案の前に短く質問して確認してください。一度に聞く質問は2〜3個までにしてください。
- 副業を提案するときは、スマホだけで完結できるものに限定してください
  （フリマ・せどり、クラウドソーシング、SNS運用代行、ライブ配信、オンライン秘書など）。
- 収入試算が必要なときは calculate_income_plan ツールを使い、憶測で数字を出さないでください。
- 最終的な回答は「おすすめの副業」「1日の稼働時間の目安」「月10万円到達までのステップ」を
  簡潔にまとめてください。
- 誇大な収益保証はせず、現実的な範囲で助言してください。
- 日本語で、簡潔かつ具体的に answer してください。`;

const tools = [
  {
    name: 'calculate_income_plan',
    description:
      '副業の収入計画を計算する。時給と稼働時間から月収を試算する(forward)、' +
      '目標月収と時給から必要な稼働時間を逆算する(required_hours)、' +
      '目標月収と稼働時間から必要な時給を逆算する(required_rate)のいずれかを行う。',
    input_schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['forward', 'required_hours', 'required_rate'],
          description: '計算モード',
        },
        hourly_wage_yen: { type: 'number', description: '時給（円）' },
        hours_per_day: { type: 'number', description: '1日あたりの稼働時間' },
        days_per_month: { type: 'number', description: '1ヶ月あたりの稼働日数' },
        target_monthly_income_yen: { type: 'number', description: '目標月収（円）' },
      },
      required: ['mode'],
    },
  },
];

function runTool(name, input) {
  if (name !== 'calculate_income_plan') {
    return { error: `unknown tool: ${name}` };
  }

  const days = input.days_per_month ?? 22;

  if (input.mode === 'forward') {
    const wage = input.hourly_wage_yen ?? 0;
    const hours = input.hours_per_day ?? 0;
    return {
      monthly_income_yen: Math.round(wage * hours * days),
      hours_per_day: hours,
      days_per_month: days,
      hourly_wage_yen: wage,
    };
  }

  if (input.mode === 'required_hours') {
    const target = input.target_monthly_income_yen ?? 100000;
    const wage = input.hourly_wage_yen ?? 0;
    if (!wage) return { error: 'hourly_wage_yen is required for required_hours mode' };
    const totalHours = target / wage;
    return {
      target_monthly_income_yen: target,
      hourly_wage_yen: wage,
      days_per_month: days,
      required_hours_per_day: Math.round((totalHours / days) * 100) / 100,
      required_total_hours_per_month: Math.round(totalHours * 100) / 100,
    };
  }

  if (input.mode === 'required_rate') {
    const target = input.target_monthly_income_yen ?? 100000;
    const hours = input.hours_per_day ?? 0;
    if (!hours) return { error: 'hours_per_day is required for required_rate mode' };
    const requiredRate = target / (hours * days);
    return {
      target_monthly_income_yen: target,
      hours_per_day: hours,
      days_per_month: days,
      required_hourly_wage_yen: Math.round(requiredRate),
    };
  }

  return { error: `unknown mode: ${input.mode}` };
}

async function runAgentTurn(messages) {
  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });

  // Agentic tool-use loop: keep executing tools until Claude returns a final answer.
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    messages.push({ role: 'assistant', content: response.content });

    const toolResults = toolUseBlocks.map((block) => ({
      type: 'tool_result',
      tool_use_id: block.id,
      content: JSON.stringify(runTool(block.name, block.input)),
    }));
    messages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });
  }

  const textBlocks = response.content.filter((b) => b.type === 'text');
  const replyText = textBlocks.map((b) => b.text).join('\n');
  messages.push({ role: 'assistant', content: response.content });

  return replyText;
}

app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません。' });
    }

    const { message, sessionId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const sid = sessionId || crypto.randomUUID();
    const messages = sessions.get(sid) || [];
    messages.push({ role: 'user', content: message });

    const reply = await runAgentTurn(messages);
    sessions.set(sid, messages);

    res.json({ reply, sessionId: sid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '内部エラーが発生しました。' });
  }
});

app.post('/api/reset', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) sessions.delete(sessionId);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`スマホ副業AIエージェント起動: http://localhost:${PORT}`);
});
