#!/usr/bin/env python3
"""data/raw/*.csv を集計し、撤退基準(docs/04_budget.md)を適用して
data/creatives.csv の実績・判定列を更新する。

使い方:
    python3 scripts/analyze.py

依存: pandas（標準ライブラリ以外はこれのみ）
"""

from __future__ import annotations

import glob
import os
import sys

import pandas as pd

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(REPO_ROOT, "data", "raw")
CREATIVES_CSV = os.path.join(REPO_ROOT, "data", "creatives.csv")

REQUIRED_RAW_COLUMNS = ["date", "platform", "creative_id", "spend", "impressions", "clicks", "cv"]

# --- 撤退基準の閾値（docs/04_budget.md と同期させること。すべて <!-- 推定 --> ） ---
REWARD = 10_000          # 報酬単価（確定）
APPROVAL_RATE = 0.98      # 承認率の仮定 <!-- 推定 -->
BREAKEVEN_CPA = REWARD * APPROVAL_RATE  # 損益分岐CPA = 9,800円
TARGET_CPA = 6_000        # 実務上の目標CPA（安全マージン込み） <!-- 推定 -->
STOP_CV_ZERO_MULTIPLIER = 2   # CV0のまま target_cpa の何倍消化したら停止するか
CTR_THRESHOLD = 0.005     # CTR閾値 0.5% <!-- 推定 -->
CPM_RISE_THRESHOLD = 0.20  # 前期間比CPM上昇率のしきい値 20% <!-- 推定 -->
INCREASE_CPA_RATIO = 0.5  # target_cpa に対してこの比率以下なら増額
MIN_CV_FOR_INCREASE = 3   # 増額判定に必要な最低CV数


def load_raw_data(raw_dir: str) -> pd.DataFrame:
    paths = sorted(glob.glob(os.path.join(raw_dir, "*.csv")))
    if not paths:
        print(f"[警告] {raw_dir} にCSVが見つかりません。処理を終了します。")
        sys.exit(1)

    frames = []
    for path in paths:
        df = pd.read_csv(path, dtype={"creative_id": str, "platform": str, "date": str})
        missing = [c for c in REQUIRED_RAW_COLUMNS if c not in df.columns]
        if missing:
            print(f"[警告] {path} に必須カラムがありません: {missing}。このファイルをスキップします。")
            continue

        before = len(df)
        df = df.dropna(subset=REQUIRED_RAW_COLUMNS)
        skipped = before - len(df)
        if skipped:
            print(f"[警告] {path}: 欠損値のある行を{skipped}件スキップしました。")

        frames.append(df[REQUIRED_RAW_COLUMNS])

    if not frames:
        print("[エラー] 有効な生データがありませんでした。")
        sys.exit(1)

    return pd.concat(frames, ignore_index=True)


def compute_cpm_rising(group: pd.DataFrame) -> bool:
    """同一creative_idのデータを日付順に前半/後半へ分割し、
    CPM（spend / impressions * 1000）が20%以上上昇していればTrue。
    日付が1種類しかない場合はトレンド判定不能としてFalseを返す。
    """
    dates = sorted(group["date"].unique())
    if len(dates) < 2:
        return False

    mid = len(dates) // 2
    if mid == 0:
        return False
    first_dates = set(dates[:mid])
    second_dates = set(dates[mid:])

    first = group[group["date"].isin(first_dates)]
    second = group[group["date"].isin(second_dates)]

    first_imp = first["impressions"].sum()
    second_imp = second["impressions"].sum()
    if first_imp == 0 or second_imp == 0:
        return False

    cpm_first = first["spend"].sum() / first_imp * 1000
    cpm_second = second["spend"].sum() / second_imp * 1000
    if cpm_first == 0:
        return False

    return (cpm_second - cpm_first) / cpm_first >= CPM_RISE_THRESHOLD


def judge(spend: float, impressions: int, clicks: int, cv: int, cpm_rising: bool) -> tuple[str, str]:
    """撤退基準（docs/04_budget.md 3章）を優先順位どおりに適用し、
    (verdict, note) を返す。"""

    stop_threshold = STOP_CV_ZERO_MULTIPLIER * TARGET_CPA

    if cv == 0:
        if spend >= stop_threshold:
            return "stop", f"CV0のまま許容CPAの{STOP_CV_ZERO_MULTIPLIER}倍({stop_threshold:,.0f}円)を消化。撤退基準に該当"
        return "continue", "CV0だが消化額はまだ閾値未満。様子見"

    cpa = spend / cv
    ctr = clicks / impressions if impressions else 0.0

    if cpa > BREAKEVEN_CPA:
        return "stop", f"CPA({cpa:,.0f}円)が損益分岐({BREAKEVEN_CPA:,.0f}円)を超過"

    if ctr < CTR_THRESHOLD and cpm_rising:
        return "decrease", f"CTR({ctr:.2%})が閾値({CTR_THRESHOLD:.1%})未満、かつCPM上昇。クリエイティブ疲弊の兆候"

    if cpa <= TARGET_CPA * INCREASE_CPA_RATIO and cv >= MIN_CV_FOR_INCREASE:
        return "increase", f"CPA({cpa:,.0f}円)が目標CPAの{INCREASE_CPA_RATIO:.0%}以下、CV{cv}件で好調。増額推奨"

    if cpa <= TARGET_CPA:
        return "continue", f"CPA({cpa:,.0f}円)が目標CPA({TARGET_CPA:,.0f}円)以下。継続"

    return "decrease", f"CPA({cpa:,.0f}円)が目標CPAを超過（損益分岐は下回る）。減額して様子見"


def aggregate(raw: pd.DataFrame) -> pd.DataFrame:
    records = []
    for creative_id, group in raw.groupby("creative_id"):
        spend = group["spend"].sum()
        impressions = int(group["impressions"].sum())
        clicks = int(group["clicks"].sum())
        cv = int(group["cv"].sum())
        platform = group["platform"].iloc[0]

        ctr = clicks / impressions if impressions else 0.0
        cpc = spend / clicks if clicks else 0.0
        cpa = spend / cv if cv else None

        cpm_rising = compute_cpm_rising(group)
        verdict, note = judge(spend, impressions, clicks, cv, cpm_rising)

        records.append(
            {
                "creative_id": creative_id,
                "platform": platform,
                "spend": round(spend, 2),
                "imp": impressions,
                "ctr": round(ctr, 4),
                "cpc": round(cpc, 2) if clicks else "",
                "cv": cv,
                "cpa": round(cpa, 2) if cpa is not None else "",
                "verdict": verdict,
                "note": note,
            }
        )
    return pd.DataFrame(records)


def update_creatives_csv(results: pd.DataFrame, creatives_csv: str) -> None:
    creatives = pd.read_csv(creatives_csv, dtype=str, keep_default_na=False)
    creatives = creatives.set_index("creative_id")

    unmatched = []
    for _, row in results.iterrows():
        cid = row["creative_id"]
        if cid not in creatives.index:
            unmatched.append(cid)
            continue

        creatives.loc[cid, "spend"] = str(row["spend"])
        creatives.loc[cid, "imp"] = str(row["imp"])
        creatives.loc[cid, "ctr"] = str(row["ctr"])
        creatives.loc[cid, "cpc"] = str(row["cpc"])
        creatives.loc[cid, "cv"] = str(row["cv"])
        creatives.loc[cid, "cpa"] = str(row["cpa"])
        creatives.loc[cid, "verdict"] = str(row["verdict"])
        creatives.loc[cid, "note"] = str(row["note"])
        creatives.loc[cid, "status"] = "stopped" if row["verdict"] == "stop" else "live"

    if unmatched:
        print(f"[警告] data/creatives.csv に存在しないcreative_idがありました（未反映）: {unmatched}")

    creatives.reset_index().to_csv(creatives_csv, index=False)


def main() -> None:
    raw = load_raw_data(RAW_DIR)
    results = aggregate(raw)

    print("=== 判定結果 ===")
    for _, row in results.iterrows():
        print(f"{row['creative_id']:20s} verdict={row['verdict']:9s} cpa={row['cpa']!s:>10s} note={row['note']}")

    update_creatives_csv(results, CREATIVES_CSV)
    print(f"\n{CREATIVES_CSV} を更新しました。")


if __name__ == "__main__":
    main()
