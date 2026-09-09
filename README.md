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

- **自動実行（機械的な操作のみ）**
  - ロック前に Out / IR / Suspended になった先発選手を、条件を満たすベンチ選手と
    自動で入れ替え（Lineup Protection がオフのリーグ向け）
  - Out / IR / Suspended のベンチ選手を、空いているIR枠へ自動移動
- **Discord通知のみ（判断が必要なため自動実行しない）**
  - 火曜: ウェイバー候補（所有率トレンド上位、特に薄いポジション）
  - 水曜: ウェイバー結果確認・取りこぼし回収・IRチェックのリマインド
  - 金曜: Questionable 選手の出場可否確認リマインド
  - 日曜夜: 最終ラインナップ確認リマインド

### 仕組みと注意点

ESPN Fantasy には公式の書き込みAPIが存在しないため、`fantasy/espnClient.js` の
書き込み処理（`setLineupSlot`）はコミュニティによるリバースエンジニアリングに
基づく実装で、**未検証**です。そのため `DRY_RUN=true`（デフォルト）の間は実際の
書き込みを行わず、「実行するはずだった内容」をDiscordに通知するだけにしています。
数週間分の通知内容が正しいことを確認してから `DRY_RUN=false` に切り替えてください。

読み取り系（ロースター・フリーエージェント・NFLの試合日程）は広く使われている
実績のあるエンドポイントを使用しています。

### セットアップ

1. **ESPNの認証情報を取得**
   ブラウザでESPN Fantasyにログインした状態で開発者ツールを開き、
   `espn.com` の Cookie から `SWID`（`{...}` を含む）と `espn_s2` の値をコピー。
2. **Discord Webhookを発行**
   通知を受け取りたいDiscordチャンネルの「連携サービス」→「ウェブフック」から
   Webhook URLを発行。
3. **GitHub Actions の Secrets を設定**（リポジトリの Settings → Secrets and
   variables → Actions）
   - `ESPN_SWID` / `ESPN_S2`
   - `FANTASY_LEAGUE_ID`（例: `616270740`）
   - `FANTASY_TEAM_ID`（自分のチームID）
   - `FANTASY_YEAR`（シーズン年、例: `2026`）
   - `DISCORD_WEBHOOK_URL`
   - `DRY_RUN`（`true` で開始し、動作確認後に `false` へ）
4. `.github/workflows/fantasy-bot.yml` のスケジュール実行は、デフォルトブランチに
   マージされたあと有効になります（GitHub Actionsの仕様）。

ローカルで試す場合は `.env` に同じ変数を設定して `npm run fantasy` を実行して
ください。
