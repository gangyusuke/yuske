# スマホ副業AIエージェント

スマホだけで完結できる副業を提案し、月10万円の収入を目指すための計画を一緒に
考えるAIエージェントです。Claude API（Anthropic SDK）を使い、ユーザーの状況を
ヒアリングしながら現実的な副業プランと収入試算を提示します。

## 構成

- `server.js` — Express製のバックエンド。Claude APIとの対話・ツール呼び出し
  （収入計算）を行うエージェントループを実装。
- `public/` — スマホブラウザ向けのチャットUI（素のHTML/CSS/JS）。
- 会話履歴はサーバーのメモリ上にセッションIDごとに保持（永続化はしません）。

## セットアップ

```bash
npm install
cp .env.example .env
# .env に自分の ANTHROPIC_API_KEY を設定
npm start
```

ブラウザ（スマホ推奨）で `http://localhost:3000` にアクセスしてください。

## 使い方

1. 1日に使える作業時間や興味のある分野をチャットで伝える
2. エージェントが必要に応じて質問しつつ、スマホ完結型の副業を提案
3. 目標月収（デフォルト10万円）に対して必要な稼働時間・時給をツール計算で提示
4. 「おすすめの副業」「1日の稼働時間の目安」「月10万円到達までのステップ」をまとめて回答

## 注意事項

- 収益を保証するものではありません。あくまで計画づくりの補助ツールです。
- `ANTHROPIC_API_KEY` は `.env` にのみ保存し、リポジトリにコミットしないでください。

## fantasy/ — ESPN Fantasy Football 運用自動化ボット

ESPNのフレンドリーグ（8人・フルPPR）の週次運用を自動化するボット。GitHub Actions
で30分おきに実行し、以下を行います。

- **自動実行（機械的な操作。ルールベース）**
  - ロック前に Out / IR / Suspended になった先発選手を、条件を満たすベンチ選手と
    自動で入れ替え（Lineup Protection がオフのリーグ向け）
  - Out / IR / Suspended のベンチ選手を、空いているIR枠へ自動移動
- **自動実行（判断が要る操作。Claudeエージェントが決定）**
  - 火曜: `fantasy/waiverAgent.js` が Claude にロースターとFAトレンドを渡し、
    ダッシュボードの Doctrine / Cut list をシステムプロンプトに埋め込んだ上で
    add/drop を決定 → ウェイバー請求を送信
- **Discord通知のみ（自動実行はしない）**
  - 水曜: ウェイバー結果確認・取りこぼし回収・IRチェックのリマインド
  - 金曜: Questionable 選手の出場可否確認リマインド
  - 日曜夜: 最終ラインナップ確認リマインド
  - トレードは相手チームの合意が要るため、意図的に自動化の対象外（通知もまだ未実装）

### 仕組みと注意点

ESPN Fantasy には公式の書き込みAPIが存在しないため、`fantasy/espnClient.js` の
書き込み処理（`setLineupSlot` / `submitWaiverClaim`）はコミュニティによる
リバースエンジニアリングに基づく実装で、**未検証**です。特に `submitWaiverClaim`
は優先権処理を伴う分さらに検証が薄いです。そのため `DRY_RUN=true`（デフォルト）の
間は実際の書き込みを一切行わず、「実行するはずだった内容（Claudeの判断理由つき）」を
Discordに通知するだけにしています。数週間分の通知内容が正しいことを確認してから
`DRY_RUN=false` に切り替えてください。それでも書き込みが反映されない場合は、
通知内容を見てESPNアプリから手動で操作する運用に切り替えるのが安全です。

読み取り系（ロースター・フリーエージェント・NFLの試合日程）は広く使われている
実績のあるエンドポイントを使用しています。

### セットアップ（はじめから通して）

1. **ESPNの認証情報を取得**
   ブラウザでESPN Fantasyにログインした状態で開発者ツールを開く
   （Chromeなら F12 → Application タブ → Storage → Cookies → `https://fantasy.espn.com`）。
   一覧から `SWID`（`{XXXXXXXX-...}` の形式、中括弧ごとコピー）と `espn_s2`
   （非常に長い文字列）の値をそれぞれコピーする。
2. **Discord Webhookを発行**
   1. 通知を受け取りたいDiscordサーバーの、通知先にしたいテキストチャンネルを開く
   2. チャンネル名の右の歯車アイコン（チャンネルの編集）→「連携サービス」→「ウェブフック」
   3. 「新しいウェブフック」を作成し、名前を適当に付ける（例: `Gladiators Bot`）
   4. 「ウェブフックURLをコピー」を押してURLを控える
   （サーバーの管理権限がない場合は、自分だけのテスト用サーバーを新規作成してそこに
   チャンネルを作るのが手軽）
3. **GitHub Actions の Secrets を設定**
   このリポジトリの GitHub 上で Settings → Secrets and variables → Actions →
   "New repository secret" から、以下をひとつずつ登録する。
   - `ESPN_SWID` / `ESPN_S2` — 手順1で取得した値
   - `FANTASY_LEAGUE_ID` — 例: `616270740`
   - `FANTASY_TEAM_ID` — 自分のチームID（ESPNのチームURLの数字部分）
   - `FANTASY_YEAR` — シーズン年、例: `2026`
   - `DISCORD_WEBHOOK_URL` — 手順2で取得したURL
   - `ANTHROPIC_API_KEY` — ウェイバー判断エージェントが使うAPIキー（上のスマホ副業
     エージェントと同じキーを共用してよい）
   - `DRY_RUN` — `true`（まずは書き込みなしで動作確認）

   ブラウザのフォームに貼る代わりに、`gh` CLI からでも登録できる。
   `--body` を付けずに実行すると値を非表示で受け取るので、シェル履歴に残らない。
   `ESPN_S2` やAPIキーのような機密性の高い値はこちらが安全。
   ```bash
   gh auth login                      # 初回のみ
   gh secret set ESPN_S2              # プロンプトに貼り付ける
   gh secret set FANTASY_YEAR --body 2026   # 機密でない値は直接指定でよい
   gh secret list                     # 名前だけ一覧表示（値は出ない）
   ```
4. **PRをマージする**
   `.github/workflows/fantasy-bot.yml` はデフォルトブランチにマージされたあと
   スケジュール実行が有効になる（GitHub Actionsの仕様のため、PRの状態では動かない）。
5. **動作確認**
   マージ後、Actions タブ → "Fantasy Bot" → "Run workflow" で手動実行できる。
   `mode` を選べるので、まず `check` で疎通確認するとよい。
   ```bash
   gh workflow run fantasy-bot.yml -f mode=check   # 必ずDiscordにテスト通知を送る
   gh run watch                                    # 進行を見る
   gh run view --log-failed                        # 失敗したステップのログだけ見る
   ```
   `mode=run` は通常の判定を1回実行する。ただし `fantasy/run.js` は通知対象が
   ない日（火・水・金・日以外で、かつスワップ/IR対象の選手もいない場合）には
   Discordへ何も送らず「通知対象なし」で正常終了する。そのため疎通確認の目的では
   `mode=check` を使うこと。

   ローカルで試したい場合は `.env` に同じ変数を設定して以下を実行する。ただし
   認証情報が平文でディスクに残るので、上記の `gh` 経由での確認を推奨する。
   ```bash
   npm install
   npm run fantasy:check   # 環境変数・ESPN認証・Discord通知の疎通を一括チェック
   npm run fantasy         # 実際の判定ロジックを1回実行（DRY_RUNなら書き込みなし）
   ```
6. **本番切り替え**
   Discordに届く提案内容（スワップ・IR移動・ウェイバー判断）を数週間チェックし、
   問題なければ Secrets の `DRY_RUN` を `false` に変更する。以降は完全に無人で回る。

## FOCUS.md — 週末の集中リマインド

`FOCUS.md` に「いま何に集中するか」のメモを書いておくと、GitHub Actions
（`.github/workflows/focus-reminder.yml`）が毎週土日の朝 8:50（JST）に内容を Discord へ送る。
方針が変わったら `FOCUS.md` を書き換えるだけでよい。

- 送信先: Secret `FOCUS_DISCORD_WEBHOOK_URL`。未設定なら fantasy ボットと同じ `DISCORD_WEBHOOK_URL` に送る
- 手動テスト: Actions → "Focus Reminder" → "Run workflow"（または `gh workflow run focus-reminder.yml`）
