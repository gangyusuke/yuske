---
description: data/raw/の実績CSVを取り込んで撤退基準判定を行い、次の打ち手を提案する
argument-hint: (引数なし。data/raw/内の全CSVが対象)
---

以下を実行すること：

1. `python3 scripts/analyze.py` を実行し、`data/raw/*.csv` を集計して
   `data/creatives.csv` の実績・判定列（verdict/note等）を更新する
2. 更新結果を読み込み、`performance-analyst` サブエージェントを使って
   `docs/04_budget.md` の3フェーズ予算配分・撤退基準を踏まえた次の打ち手
   （どのクリエイティブを増額/維持/減額/停止すべきか、案件上限への余裕度、
   テスト許容損失額への到達状況、新規テスト枠の使い方）を提案する
3. 提案はあくまで提案に留め、実際の予算増減・広告アカウント操作は行わない
   （→ docs/05_workflow.md の責任分界に従い、実行は人間が行う）
