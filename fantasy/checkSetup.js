// セットアップの動作確認用スクリプト。
// 必須envの有無、ESPN認証、Discord通知が一通り機能するかを1コマンドでチェックする。
require('dotenv').config();

const espn = require('./espnClient');
const { sendDiscord } = require('./notify');

const REQUIRED = [
  'ESPN_SWID', 'ESPN_S2', 'FANTASY_LEAGUE_ID', 'FANTASY_TEAM_ID', 'FANTASY_YEAR',
  'DISCORD_WEBHOOK_URL', 'ANTHROPIC_API_KEY',
];

async function main() {
  console.log('=== fantasy bot セットアップチェック ===\n');

  let missing = false;
  for (const key of REQUIRED) {
    const ok = Boolean(process.env[key]);
    console.log(`${ok ? '✅' : '❌'} ${key}`);
    if (!ok) missing = true;
  }
  if (missing) {
    console.log('\n未設定の環境変数があります。.env またはGitHub Secretsを確認してください。');
    process.exitCode = 1;
    return;
  }

  console.log('\n--- ESPN API 疎通確認 ---');
  try {
    const league = await espn.getLeagueSnapshot({
      year: Number(process.env.FANTASY_YEAR),
      leagueId: process.env.FANTASY_LEAGUE_ID,
    });
    const team = (league.teams || []).find((t) => t.id === Number(process.env.FANTASY_TEAM_ID));
    if (!team) {
      console.log(`❌ FANTASY_TEAM_ID=${process.env.FANTASY_TEAM_ID} がリーグ内に見つかりません`);
      process.exitCode = 1;
      return;
    }
    console.log(`✅ ESPN認証OK。チーム: ${team.name || team.id}、現在Week ${league.scoringPeriodId}`);
  } catch (err) {
    console.log(`❌ ESPN APIへの接続に失敗: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log('\n--- Discord Webhook 疎通確認 ---');
  try {
    await sendDiscord(
      process.env.DISCORD_WEBHOOK_URL,
      '✅ fantasy bot のセットアップチェックです。この通知が届いていればDiscord連携は完了です。'
    );
    console.log('✅ Discordへテスト通知を送信しました。チャンネルを確認してください。');
  } catch (err) {
    console.log(`❌ Discord Webhookへの送信に失敗: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log('\n全項目OK。まずは DRY_RUN=true のまま数日〜1週間ほど本番運用し、');
  console.log('Discordに届く提案内容を確認してから DRY_RUN=false に切り替えてください。');
}

main();
