---
description: 出資者向け週次/月次レポート草案を生成する（report-writerサブエージェントに委任）
argument-hint: [週次 または 月次]（省略時は週次）
---

`report-writer` サブエージェントを使って、$ARGUMENTS で指定された種別
（「週次」または「月次」、省略時は週次）のレポート草案を、以下を元に
`templates/weekly_report.md` の形式で作成すること。

- `data/creatives.csv` の実績・判定結果
- `docs/04_budget.md` の予算消化状況・撤退基準への抵触状況・収支シミュレーションとの比較
- `docs/00_assumptions.md` の未検証事項のうち、今回のレポート期間で
  進捗・解消したもの

作成した草案は `reports/YYYY-MM-DD_weekly.md`（月次の場合は`_monthly.md`）
として新規ファイルに保存すること。**出資者への実際の送付は人間が行う**旨を
必ず明記して報告すること。
