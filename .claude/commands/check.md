---
description: 入稿前コンプライアンスチェックリストを走らせる（compliance-checkerサブエージェントに委任）
argument-hint: [creative_id または台本テキスト]
---

`compliance-checker` サブエージェントを使って、$ARGUMENTS で指定された
クリエイティブ（`data/creatives.csv` の creative_id、または直接貼り付けられた
台本テキスト）を、以下と照合して一次チェックすること。

- `docs/02_compliance.md` の薬機法/景表法NG-OK対応表、媒体ポリシー
  チェックリスト、NGワード早見リスト、不動産案件特有の規制ポイント
- `docs/01_offers.md` の案件固有の確認事項（ASP未確認の断定表現の使用禁止等）

指摘事項があれば該当箇所・問題点・言い換え案を具体的に列挙すること。
**最終的な入稿可否判断は必ず人間が行う**旨を必ず明記し、
「チェック通過＝入稿OK」という趣旨の表現は使わないこと。
