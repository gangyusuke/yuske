// ESPN Fantasy Football の非公開API（v3）に対する薄いラッパー。
// 公式ドキュメントは存在しないため、コミュニティによるリバースエンジニアリング結果に基づいている。
// 読み取り系（league/roster/free agents）は広く使われている実績のあるエンドポイント。
// 書き込み系（setLineupSlot / moveToIR）は未検証。DRY_RUN=true で挙動を確認してから使うこと。

const READ_BASE = (year, leagueId) =>
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}`;
const WRITE_BASE = (year, leagueId) =>
  `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}`;

// ESPNの proTeamId -> チーム略称。community定数（espn-api の PRO_TEAM_MAP 相当）。
const PRO_TEAM_MAP = {
  0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN',
  8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT',
  24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX',
  33: 'BAL', 34: 'HOU',
};

function authHeaders() {
  const { ESPN_SWID, ESPN_S2 } = process.env;
  if (!ESPN_SWID || !ESPN_S2) {
    throw new Error('ESPN_SWID / ESPN_S2 が設定されていません（.env を確認してください）');
  }
  return { Cookie: `SWID=${ESPN_SWID}; espn_s2=${ESPN_S2}` };
}

async function espnGet(url, { headers = {} } = {}) {
  const res = await fetch(url, { headers: { ...authHeaders(), ...headers } });
  if (!res.ok) {
    throw new Error(`ESPN API GET failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

async function espnWrite(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ESPN API write failed: ${res.status} ${res.statusText} ${text} (${url})`);
  }
  return res.json().catch(() => ({}));
}

async function getLeagueSnapshot({ year, leagueId }) {
  const url = `${READ_BASE(year, leagueId)}?view=mRoster&view=mTeam&view=mSettings&view=mMatchup&view=mMatchupScore`;
  return espnGet(url);
}

async function getFreeAgents({ year, leagueId, scoringPeriodId, limit = 60 }) {
  const url = `${READ_BASE(year, leagueId)}?view=kona_player_info&scoringPeriodId=${scoringPeriodId}`;
  const filter = {
    players: {
      filterStatus: { value: ['FREEAGENT', 'WAIVERS'] },
      sortPercChanged: { sortAsc: false, sortPriority: 1 },
      limit,
    },
  };
  return espnGet(url, { headers: { 'X-Fantasy-Filter': JSON.stringify(filter) } });
}

// NFLの試合開始時刻（=ロック時刻）は公開のscoreboard APIから取得する。認証不要。
async function getNflWeekSchedule({ week }) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NFL schedule fetch failed: ${res.status}`);
  return res.json();
}

/**
 * [実験的/未検証] スタメン枠の入れ替え。
 * ESPNの非公開transactions APIを使う想定の実装だが、実際のペイロード仕様は
 * コミュニティ資料からの推測を含む。DRY_RUN=true で数週間ログを確認し、
 * 実際にESPNのUI上で反映されることを確認してから DRY_RUN=false に切り替えること。
 */
async function setLineupSlot({ year, leagueId, teamId, playerId, fromLineupSlotId, toLineupSlotId }) {
  const url = `${WRITE_BASE(year, leagueId)}/transactions/`;
  const body = {
    isLeagueManager: false,
    teamId,
    type: 'ROSTER',
    memberId: process.env.ESPN_SWID,
    items: [{ playerId, type: 'LINEUP', fromLineupSlotId, toLineupSlotId }],
  };
  return espnWrite(url, body);
}

const BENCH_SLOT_ID = 20;

/**
 * [実験的/未検証] ウェイバー請求（add + drop）の送信。
 * setLineupSlot よりさらに検証が薄い書き込み（優先権処理を伴う非同期トランザクションのため）。
 * DRY_RUN=true で提案内容とログを何週か確認し、納得してから有効化すること。
 * うまく動かない場合は、通知内容を見てESPNアプリから手動で請求する運用に切り替えるのが安全。
 */
async function submitWaiverClaim({ year, leagueId, teamId, addPlayerId, dropPlayerId }) {
  const url = `${WRITE_BASE(year, leagueId)}/transactions/`;
  const items = [{ playerId: addPlayerId, type: 'ADD', fromLineupSlotId: -1, toLineupSlotId: BENCH_SLOT_ID }];
  if (dropPlayerId) {
    items.push({ playerId: dropPlayerId, type: 'DROP', fromLineupSlotId: BENCH_SLOT_ID, toLineupSlotId: -1 });
  }
  const body = {
    isLeagueManager: false,
    teamId,
    type: 'WAIVER',
    memberId: process.env.ESPN_SWID,
    items,
  };
  return espnWrite(url, body);
}

module.exports = {
  getLeagueSnapshot,
  getFreeAgents,
  getNflWeekSchedule,
  setLineupSlot,
  submitWaiverClaim,
  PRO_TEAM_MAP,
};
