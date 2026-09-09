// ダッシュボード（週次運用の原則）を、判定ロジックとして機械化したもの。
// ここで決めるのは「何をすべきか」の候補（アクション/提案）のみ。
// 実際にESPNへ書き込むかどうかは run.js が DRY_RUN フラグを見て判断する。

const SLOT = { QB: 0, RB: 2, WR: 4, TE: 6, DST: 16, K: 17, BENCH: 20, IR: 21, FLEX: 23 };
const BENCH_SLOTS = new Set([SLOT.BENCH]);
const STARTER_SLOTS = new Set([SLOT.QB, SLOT.RB, SLOT.WR, SLOT.TE, SLOT.DST, SLOT.K, SLOT.FLEX]);

// ロック前に自動でベンチへ落としてよい「出場不可が確定」ステータス。
const LOCKOUT_STATUSES = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION']);
// IR枠に移してよいステータス（QuestionableはNG＝ダッシュボードの原則どおり）。
const IR_ELIGIBLE_STATUSES = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION']);

function projectedPoints(player, week) {
  const stat = (player.stats || []).find(
    (s) => s.scoringPeriodId === week && s.statSourceId === 1
  );
  return stat?.appliedTotal ?? 0;
}

function buildKickoffMap(nflSchedule) {
  const map = {};
  for (const event of nflSchedule.events || []) {
    const date = new Date(event.date);
    for (const competitor of event.competitions?.[0]?.competitors || []) {
      const abbrev = competitor.team?.abbreviation;
      if (abbrev) map[abbrev] = date;
    }
  }
  return map;
}

function kickoffFor(entry, kickoffMap, proTeamMap) {
  const abbrev = proTeamMap[entry.playerPoolEntry.player.proTeamId];
  const kickoff = abbrev ? kickoffMap[abbrev] : null;
  return kickoff instanceof Date && !Number.isNaN(kickoff.getTime()) ? kickoff : null;
}

/**
 * ロック前に Out/IR/Suspended の先発選手を、条件を満たすベンチ選手と入れ替える案を作る。
 * Lineup Protection がオフのリーグ（このダッシュボードの前提）向け。
 */
function planLineupSwaps({ roster, week, kickoffMap, proTeamMap, now = new Date() }) {
  const entries = roster.entries || [];
  const starters = entries.filter((e) => STARTER_SLOTS.has(e.lineupSlotId));
  const benchPool = entries.filter((e) => BENCH_SLOTS.has(e.lineupSlotId));

  const plans = [];

  for (const starter of starters) {
    const player = starter.playerPoolEntry.player;
    const status = player.injuryStatus;
    if (!LOCKOUT_STATUSES.has(status)) continue;

    const kickoff = kickoffFor(starter, kickoffMap, proTeamMap);
    if (!kickoff || now >= kickoff) continue; // ロック済み・時刻不明なら何もしない

    const eligibleSlots = new Set(player.eligibleSlots || []);
    const candidates = benchPool
      .filter((b) => {
        const bp = b.playerPoolEntry.player;
        if (LOCKOUT_STATUSES.has(bp.injuryStatus)) return false;
        const benchKickoff = kickoffFor(b, kickoffMap, proTeamMap);
        if (benchKickoff && now >= benchKickoff) return false; // 既にロック済みの選手は入れられない
        const bEligible = new Set(bp.eligibleSlots || []);
        return bEligible.has(starter.lineupSlotId);
      })
      .sort((a, b) => projectedPoints(b.playerPoolEntry.player, week) - projectedPoints(a.playerPoolEntry.player, week));

    if (candidates.length === 0) continue;

    plans.push({
      slotId: starter.lineupSlotId,
      outPlayer: { id: player.id, name: player.fullName, status },
      inPlayer: {
        id: candidates[0].playerPoolEntry.player.id,
        name: candidates[0].playerPoolEntry.player.fullName,
        projected: projectedPoints(candidates[0].playerPoolEntry.player, week),
      },
      kickoff,
    });
  }

  return plans;
}

/**
 * Out/IR/Suspended のベンチ選手を、空いているIR枠に移す案を作る。
 * 対象はベンチ枠のみ（先発枠のOUT選手は、まず planLineupSwaps でベンチへ
 * 降ろしてから IR へ、という順序を前提にしている）。
 */
function planIRMoves({ roster, settings }) {
  const entries = roster.entries || [];
  const irSlotCount = settings?.rosterSettings?.lineupSlotCounts?.[SLOT.IR] || 0;
  if (irSlotCount === 0) return [];

  const irUsed = entries.filter((e) => e.lineupSlotId === SLOT.IR).length;
  let irFree = irSlotCount - irUsed;
  if (irFree <= 0) return [];

  const plans = [];
  for (const e of entries) {
    if (irFree <= 0) break;
    if (!BENCH_SLOTS.has(e.lineupSlotId)) continue;
    const player = e.playerPoolEntry.player;
    if (!IR_ELIGIBLE_STATUSES.has(player.injuryStatus)) continue;
    plans.push({
      fromSlotId: e.lineupSlotId,
      player: { id: player.id, name: player.fullName, status: player.injuryStatus },
    });
    irFree -= 1;
  }
  return plans;
}

/**
 * トレンド（所有率の増加）を手がかりにしたウェイバー候補の提案。
 * あくまで参考情報 — 通知のみで自動請求はしない（判断が要る領域のため）。
 */
function buildWaiverSuggestions({ freeAgentsResponse, focusPositions = ['RB'], top = 8 }) {
  const players = freeAgentsResponse?.players || [];
  const posName = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST' };

  const scored = players
    .map((p) => {
      const player = p.player;
      return {
        id: player.id,
        name: player.fullName,
        pos: posName[player.defaultPositionId] || '?',
        percentOwned: player.ownership?.percentOwned ?? 0,
        percentChange: player.ownership?.percentChange ?? 0,
        status: player.injuryStatus,
      };
    })
    .filter((p) => p.status !== 'OUT' && p.status !== 'INJURY_RESERVE');

  const focused = scored
    .filter((p) => focusPositions.includes(p.pos))
    .sort((a, b) => b.percentChange - a.percentChange)
    .slice(0, top);

  const overall = scored
    .sort((a, b) => b.percentChange - a.percentChange)
    .slice(0, top);

  return { focused, overall };
}

module.exports = {
  SLOT,
  LOCKOUT_STATUSES,
  IR_ELIGIBLE_STATUSES,
  projectedPoints,
  buildKickoffMap,
  kickoffFor,
  planLineupSwaps,
  planIRMoves,
  buildWaiverSuggestions,
};
