# CapCut AI キャラクター用プロンプト

`character-essentials.md` の要素をプロンプトに落とし込むためのテンプレート。

## テンプレート（日本語）

```
【キャラ名】〇〇
【どういう存在か】（例：夜空のかけらから生まれた、見習いの星の妖精）
【性格】（例：がんばり屋だけどドジ。落ち込んでもすぐ立ち直る）
【見た目】
・（ベース）2.5頭身のデフォルメ、丸いシルエット
・（目）大きな瞳の中に小さな星形のハイライト ← 特徴的な目
・（独自記号）頭に三日月形のアホ毛／ほっぺに星マーク ← 独自記号
・（色）パステルラベンダー＋クリーム色、差し色にゴールド
【表情・ポーズ】少し照れた笑顔で、両手で小さな星を大事そうに抱えている
【背景】シンプルな白背景（キャラ設定画として）
【画風】日本のアニメ・ゆるキャラ風、やわらかい線、フラットな塗り、高品質
```

## テンプレート（英語・精度が上がりやすい）

```
A cute chibi mascot character, 2.5 heads tall, round soft silhouette.
Big sparkling eyes with small star-shaped highlights inside the pupils (signature eyes).
A crescent-moon shaped ahoge on the head and a small star mark on the cheek (signature symbols).
Pastel lavender and cream color palette with gold accents.
Shy, gentle smile, holding a tiny glowing star with both hands carefully.
Personality: hardworking but clumsy, always bounces back.
Japanese anime / yuru-chara style, clean soft lines, flat colors, simple white background,
character design sheet, high quality.
```

## 要素ごとの入れ方

| 重要要素 | プロンプトでの表現 |
| --- | --- |
| かわいい（入口） | chibi, round, big eyes, pastel |
| 憧れる | 夢に向かう姿（例：星を集めて一人前を目指す） |
| 支え・自己肯定感 | 優しい表情、寄り添うポーズ、「そのままでいい」雰囲気 |
| 重ねる（共感） | 欠点を入れる（ドジ、寝ぐせ、ちょっと不器用） |
| 守る・庇護欲 | 小ささ、子どもっぽい比率、少し不安げ／照れた表情 |
| アイデンティティ | 色・モチーフをはっきり（持ち物や身につける記号） |
| 物語性 | 「どういう存在か」「何を目指しているか」を一文で入れる |
| 目が特徴的 | 瞳の形・ハイライトを具体的に指定 |
| 独自記号 | 頭・頬・しっぽ等に固有マークを1〜2個（多すぎない） |

## コツ

1. **まず設定画（白背景・全身）を作る** → 気に入った1枚を「参照画像」にして表情差分・ポーズ違いを作ると、ブレにくい
2. **固定する要素（目・記号・色）は毎回同じ文言で入れる**（ブランド統一）
3. 記号は1〜2個に絞る。多いとAIが崩しやすく、覚えてもらいにくい
4. 物語は明るめに（ポテンシャル指標「ストーリーの明るさ」）
5. 仲間キャラを作る場合も同じテンプレートで、色とモチーフだけ変える（キャラ数を増やせる設計）
