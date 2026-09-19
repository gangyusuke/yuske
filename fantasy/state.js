// 実行間の状態（重複通知/重複アクションの防止）を JSON ファイルで永続化する。
// GitHub Actions 上では実行後にこのファイルをコミットして次回実行に引き継ぐ想定。

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '.state');
const STATE_FILE = path.join(STATE_DIR, 'last-run.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { executedActions: [], dailyNotices: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

module.exports = { loadState, saveState };
