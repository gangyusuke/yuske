// FOCUS.md の内容を Discord に送る週末リマインダー。
// 送信先は FOCUS_DISCORD_WEBHOOK_URL、未設定なら fantasy ボットと同じ DISCORD_WEBHOOK_URL を使う。

const fs = require('fs');
const path = require('path');
const { sendDiscord } = require('../fantasy/notify');

async function main() {
  const memo = fs.readFileSync(path.join(__dirname, '..', 'FOCUS.md'), 'utf8').trim();
  const today = new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  const webhookUrl = process.env.FOCUS_DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  await sendDiscord(webhookUrl, `🎯 **週末の集中リマインド**（${today}）\n\n${memo}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
