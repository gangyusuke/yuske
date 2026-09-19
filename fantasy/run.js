require('dotenv').config();

const espn = require('./espnClient');
const rules = require('./rules');
const waiverAgent = require('./waiverAgent');
const { sendDiscord } = require('./notify');
const { loadState, saveState } = require('./state');

const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';

function jstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function jstDateKey(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (JST基準のズレたUTC時刻をそのまま使う)
}
function jstWeekday(d) {
  // getUTCDay() を JST補正済みの Date に対して使う（0=日,1=月,...6=土）
  return d.getUTCDay();
}

async function main() {
  const YEAR = Number(process.env.FANTASY_YEAR);
  const LEAGUE_ID = process.env.FANTASY_LEAGUE_ID;
  const TEAM_ID = Number(process.env.FANTASY_TEAM_ID);
  const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

  if (!YEAR || !LEAGUE_ID || !TEAM_ID) {
    throw new Error('FANTASY_YEAR / FANTASY_LEAGUE_ID / FANTASY_TEAM_ID を .env で設定してください');
  }

  const state = loadState();
  const messages = [];
  const now = new Date();
  const jNow = jstNow();
  const todayKey = jstDateKey(jNow);
  const weekday = jstWeekday(jNow); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  const league = await espn.getLeagueSnapshot({ year: YEAR, leagueId: LEAGUE_ID });
  const week = league.scoringPeriodId;
  const team = (league.teams || []).find((t) => t.id === TEAM_ID);
  if (!team) throw new Error(`teamId=${TEAM_ID} がリーグ内に見つかりません`);

  const nflSchedule = await espn.getNflWeekSchedule({ week });
  const kickoffMap = rules.buildKickoffMap(nflSchedule);

  // --- 1. ロック前の Out/IR/Suspended スターターの自動スワップ ---
  const swapPlans = rules.planLineupSwaps({
    roster: team.roster,
    week,
    kickoffMap,
    proTeamMap: espn.PRO_TEAM_MAP,
    now,
  });

  // planIRMoves は「今回のスワップ後にベンチにいる選手」を対象にしたいので、
  // 実際の書き込みが済んだか(DRY_RUNか)にかかわらず、ローカルのロースター状態を
  // スワップ後の想定状態に更新してからIR判定を行う。
  const rosterEntries = team.roster.entries || [];
  const entryById = new Map(rosterEntries.map((e) => [e.playerPoolEntry.player.id, e]));

  for (const plan of swapPlans) {
    const key = `swap-${week}-${plan.outPlayer.id}`;
    if (state.executedActions.includes(key)) continue;

    const label = `**[ラインナップ]** ${plan.outPlayer.name}(${plan.outPlayer.status}) → ${plan.inPlayer.name}(予測${plan.inPlayer.projected}点) に差し替え${DRY_RUN ? '（提案・DRY_RUN）' : ''}`;
    messages.push(label);

    if (!DRY_RUN) {
      try {
        await espn.setLineupSlot({
          year: YEAR, leagueId: LEAGUE_ID, teamId: TEAM_ID,
          playerId: plan.outPlayer.id, fromLineupSlotId: plan.slotId, toLineupSlotId: rules.SLOT.BENCH,
        });
        await espn.setLineupSlot({
          year: YEAR, leagueId: LEAGUE_ID, teamId: TEAM_ID,
          playerId: plan.inPlayer.id, fromLineupSlotId: rules.SLOT.BENCH, toLineupSlotId: plan.slotId,
        });
        state.executedActions.push(key);
      } catch (err) {
        messages.push(`⚠️ 差し替えの書き込みに失敗しました: ${err.message}（手動で対応してください）`);
        continue; // 書き込みに失敗した場合はロースター状態を更新しない
      }
    } else {
      state.executedActions.push(key);
    }

    // ローカル状態を更新（DRY_RUNでも「実行したと仮定した場合」のIR判定に使う）
    const outEntry = entryById.get(plan.outPlayer.id);
    const inEntry = entryById.get(plan.inPlayer.id);
    if (outEntry) outEntry.lineupSlotId = rules.SLOT.BENCH;
    if (inEntry) inEntry.lineupSlotId = plan.slotId;
  }

  // --- 2. Out/IR/Suspended のベンチ選手をIR枠へ ---
  const irPlans = rules.planIRMoves({ roster: { entries: rosterEntries }, settings: league.settings });
  for (const plan of irPlans) {
    const key = `ir-${week}-${plan.player.id}`;
    if (state.executedActions.includes(key)) continue;

    messages.push(`**[IR]** ${plan.player.name}(${plan.player.status}) をIR枠へ移動${DRY_RUN ? '（提案・DRY_RUN）' : ''}`);

    if (!DRY_RUN) {
      try {
        await espn.setLineupSlot({
          year: YEAR, leagueId: LEAGUE_ID, teamId: TEAM_ID,
          playerId: plan.player.id, fromLineupSlotId: plan.fromSlotId, toLineupSlotId: rules.SLOT.IR,
        });
        state.executedActions.push(key);
      } catch (err) {
        messages.push(`⚠️ IR移動の書き込みに失敗しました: ${err.message}（手動で対応してください）`);
      }
    } else {
      state.executedActions.push(key);
    }
  }

  // --- 3. 曜日ごとの定期リマインド（1日1回まで） ---
  const noticeKey = (type) => `${todayKey}:${type}`;

  if (weekday === 2 && !state.dailyNotices[noticeKey('waiver-tue')]) {
    const fa = await espn.getFreeAgents({ year: YEAR, leagueId: LEAGUE_ID, scoringPeriodId: week });
    const { focused, overall } = rules.buildWaiverSuggestions({ freeAgentsResponse: fa, focusPositions: ['RB'] });
    const candidateMap = new Map();
    for (const p of [...focused, ...overall]) candidateMap.set(p.id, p);
    const candidates = [...candidateMap.values()].slice(0, 12);

    const rosterForAgent = rosterEntries.map((e) => {
      const p = e.playerPoolEntry.player;
      return {
        id: p.id,
        name: p.fullName,
        pos: rules.POS_NAME[p.defaultPositionId] || '?',
        team: espn.PRO_TEAM_MAP[p.proTeamId] || '?',
        status: p.injuryStatus,
        projected: rules.projectedPoints(p, week),
        slot: e.lineupSlotId === rules.SLOT.BENCH ? 'BE' : 'START',
      };
    });

    let moves = [];
    try {
      moves = await waiverAgent.decideWaiverMoves({
        roster: rosterForAgent,
        freeAgents: candidates,
        week,
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    } catch (err) {
      messages.push(`⚠️ **[ウェイバー]** 判断エージェントの呼び出しに失敗しました: ${err.message}`);
    }

    if (moves.length === 0) {
      messages.push(
        '📋 **火曜: ウェイバー判断**\n' +
        'エージェントが今週の候補を評価し、良いadd/drop候補なしと判断しました（優先権は来週また逆順リセットされます）。'
      );
    } else {
      for (const move of moves) {
        const key = `waiver-${week}-${move.addPlayerId}-${move.dropPlayerId}`;
        if (state.executedActions.includes(key)) continue;

        messages.push(
          `📋 **[ウェイバー]** ${move.dropPlayerName} → ${move.addPlayerName} を請求${DRY_RUN ? '（提案・DRY_RUN）' : ''}\n理由: ${move.reason}`
        );

        if (!DRY_RUN) {
          try {
            await espn.submitWaiverClaim({
              year: YEAR, leagueId: LEAGUE_ID, teamId: TEAM_ID,
              addPlayerId: move.addPlayerId, dropPlayerId: move.dropPlayerId,
            });
          } catch (err) {
            messages.push(`⚠️ ウェイバー請求の書き込みに失敗しました: ${err.message}（ESPNアプリで手動対応してください）`);
          }
        }
        state.executedActions.push(key);
      }
    }
    state.dailyNotices[noticeKey('waiver-tue')] = true;
  }

  if (weekday === 3 && !state.dailyNotices[noticeKey('waiver-wed')]) {
    messages.push('📋 **水曜: ウェイバー結果の確認・取りこぼしの回収・IRチェック**\n請求が通ったか確認し、外れた選手は先着FAで拾えないか見てください。上のIR提案も合わせて確認を。');
    state.dailyNotices[noticeKey('waiver-wed')] = true;
  }

  if (weekday === 5 && !state.dailyNotices[noticeKey('status-fri')]) {
    const questionable = (team.roster.entries || [])
      .filter((e) => e.playerPoolEntry.player.injuryStatus === 'QUESTIONABLE')
      .map((e) => e.playerPoolEntry.player.fullName);
    messages.push(
      `🚦 **金曜: 出場ステータス確定日**\n` +
      (questionable.length
        ? `Questionable: ${questionable.join(', ')}\n出場可否を確認し、ダメなら控えと入れ替えてください。`
        : 'Questionable の選手はいません。')
    );
    state.dailyNotices[noticeKey('status-fri')] = true;
  }

  if (weekday === 0 && !state.dailyNotices[noticeKey('final-sun')]) {
    messages.push('🔒 **日曜夜: 最終ラインナップ確認**\n日本時間 月曜2:00 に主要ロックがかかります。Inactive発表を確認し、最終チェックを。');
    state.dailyNotices[noticeKey('final-sun')] = true;
  }

  // --- 4. 通知送信 ---
  if (messages.length > 0) {
    const header = `**Gladiators 運用ボット** — Week ${week}${DRY_RUN ? ' [DRY RUN]' : ''}\n`;
    await sendDiscord(WEBHOOK, header + messages.join('\n\n'));
  } else {
    console.log('[fantasy-bot] 通知対象なし');
  }

  saveState(state);
}

main().catch((err) => {
  console.error('[fantasy-bot] エラー:', err);
  process.exitCode = 1;
});
