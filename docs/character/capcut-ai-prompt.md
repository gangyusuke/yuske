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

---

## 3キャラ企画 英語プロンプト（2026-09 作成）

元の指定：どのキャラも好きになると人が幸せになる／共感できる子・憧れる子・母性本能をくすぐる子供の3キャラ／2.5頭身・丸いシルエット／全員特徴的な目／それぞれ独自記号／ビビッド寄りの色／表情豊か、憧れる子はクール系／アニメ・ゆるキャラ風、AIっぽさを消す／4コマ漫画を動画にした起承転結、最初の3秒でスキップされない入り

※目・記号・色の具体案は仮。差し替えて使う。

### A. 3キャラ設定画

```
Character design sheet of 3 original mascot characters, standing side by side, full body, front view.
Concept: whichever character you meet, you can't help but love them, and they make you happy.
All three: 2.5 heads tall chibi proportions, round soft silhouettes, very expressive faces.
Each character has unique, never-before-seen eyes and its own signature symbol.
Color palette: between vivid and pastel, leaning vivid — bright, clear, cheerful colors.

1. The relatable one (left): an ordinary, slightly clumsy girl everyone sees themselves in.
   Eyes: irises with soft horizontal stripes like layered sunset bands.
   Signature symbol: a small cloud mark on her forehead.
   Color: coral orange. Expression: awkward, embarrassed grin.

2. The admired one (center): cool, calm, confident — the one everyone wants to be.
   Eyes: sharp almond-shaped eyes with diamond-shaped pupils that shine like a prism.
   Signature symbol: a lightning-bolt shaped streak in her hair.
   Color: electric blue and violet. Expression: cool, slight smile.

3. The little one (right): a small child who makes you want to protect and cheer for them.
   Eyes: huge round eyes with tiny flower-shaped pupils.
   Signature symbol: a little sprout growing on top of the head.
   Color: lemon yellow and mint green. Expression: innocent, curious, a bit teary-eyed.

Style: Japanese anime / yuru-chara style, soft clean hand-drawn lines, flat cel coloring,
simple white background, official character design sheet.
Looks like it was hand-drawn by a professional Japanese illustrator:
consistent line weight, no glossy rendering, no 3D, no airbrushed gradients.
```

### ネガティブプロンプト（AIっぽさを消す）

```
3D render, photorealistic, glossy, shiny skin, airbrushed, excessive gradients,
over-detailed, generic AI art style, uncanny, extra fingers, deformed hands,
messy background, text, watermark, blurry
```

### B. 4コマ動画（起承転結＋最初の3秒フック）

```
A short vertical video in the style of an animated 4-panel Japanese comic (yonkoma),
starring the 3 characters above. Clear story structure: setup, development, twist, punchline.

Hook (0–3 sec): open on an extreme close-up of the characters' unique eyes suddenly
popping wide open with a surprised expression and a bold sound effect — instantly
eye-catching, so viewers don't scroll away.
Panel 1 (setup): the relatable girl tries to do something ordinary and messes it up.
Panel 2 (development): the cool girl steps in and handles it effortlessly.
Panel 3 (twist): the little one does something unexpected and adorable.
Panel 4 (punchline): all three laugh together — warm, happy ending.

Style: Japanese anime / yuru-chara, soft hand-drawn lines, flat cel coloring,
vivid-leaning colors, very expressive faces, simple backgrounds,
comic panel transitions, no 3D, no glossy AI look.
```
