// Claude にウェイバー(add/drop)の判断をさせるエージェント。
// ダッシュボードの「Doctrine」「Cut list」節をそのままシステムプロンプトに埋め込み、
// 判断基準がチームの方針からブレないようにしている。

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-5';

const DOCTRINE = `
あなたは8人フルPPRのESPNフレンドリーグ「Gotanda Gladiators」のウェイバー担当エージェントです。
以下のリーグ固有の原則に従って、今週のウェイバー請求（add/drop）を判断してください。

- ウェイバー優先権は毎週、順位の逆順にリセットされる。温存する価値はゼロ。使わない週はその週の権利を捨てているのと同じ。
- 8人リーグはFA人材が潤沢（104人しかドラフトされていない）。ベンチ下位1〜2枠は毎週入れ替わって当然の枠。
- 切っていい: 2人目のQB/TE、先週使わなかったD/ST・K、所有率トレンドが落ちている選手、
  チームの3番手以下になったWR、怪我から戻ったが役割が戻っていない選手。
- 切ってはいけない: 1〜2週不調なだけの主力、バイウィーク中の主力、Out指定でもIR運用でカバーできる主力、
  他チームのエースの控えRB（そのエースが倒れた瞬間に価値が跳ね上がる）。
- 迷ったら動かない方が安全。良い候補がなければ無理にadd/dropを提案せず、moves は空配列でよい。
- 1回の判断で提案する move は最大2件まで。
- reason は日本語で1〜2文、具体的に。
`.trim();

const TOOL = {
  name: 'propose_waiver_moves',
  description:
    '今週のウェイバー請求として実行すべき add/drop の組み合わせを提案する。良い候補がなければ moves: [] を返す。',
  input_schema: {
    type: 'object',
    properties: {
      moves: {
        type: 'array',
        maxItems: 2,
        items: {
          type: 'object',
          properties: {
            addPlayerId: { type: 'number', description: 'FAから獲得する選手のplayerId' },
            addPlayerName: { type: 'string' },
            dropPlayerId: { type: 'number', description: '入れ替えに出す自チームの選手のplayerId' },
            dropPlayerName: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['addPlayerId', 'addPlayerName', 'dropPlayerId', 'dropPlayerName', 'reason'],
        },
      },
    },
    required: ['moves'],
  },
};

function buildUserPrompt({ roster, freeAgents, week }) {
  const rosterLines = roster.map(
    (p) => `- id=${p.id} [${p.slot}] ${p.name} (${p.pos}, ${p.team}) status=${p.status} 今週予測=${p.projected}点`
  );
  const faLines = freeAgents.map(
    (p) =>
      `- id=${p.id} ${p.name} (${p.pos}) status=${p.status} 所有率=${p.percentOwned.toFixed(1)}% 7日変化=${p.percentChange.toFixed(1)}`
  );
  return [
    `Week ${week} のウェイバー判断をしてください。`,
    '',
    '## 現在のロースター',
    ...rosterLines,
    '',
    '## フリーエージェント候補（所有率トレンド上位）',
    ...faLines,
  ].join('\n');
}

async function decideWaiverMoves({ roster, freeAgents, week, apiKey }) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');
  if (freeAgents.length === 0) return [];

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: DOCTRINE,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'propose_waiver_moves' },
    messages: [{ role: 'user', content: buildUserPrompt({ roster, freeAgents, week }) }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  return toolUse?.input?.moves || [];
}

module.exports = { decideWaiverMoves };
