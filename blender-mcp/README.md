# Blender × Claude Code MCP エージェント

Blender と Claude Code を [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) で
接続し、Claude Code から自然言語で Blender 上のモデリング・マテリアル設定・レンダリングなどを
操作できるようにするブリッジです。

## 仕組み

```
Claude Code  <--stdio (MCP)-->  blender_mcp_server.py  <--TCP(localhost:9876)-->  Blender アドオン
```

1. `addon/blender_mcp_addon.py` を Blender にインストールして有効化すると、Blender が
   ローカル TCP サーバー (既定ポート 9876) として待受を始めます。Blender の API は
   メインスレッドでしか呼べないため、リクエストはキューに積み、`bpy.app.timers` 経由で
   メインスレッド上で実行します。
2. `server/blender_mcp_server.py` は MCP サーバーで、Claude Code と標準入出力 (stdio) で
   通信しつつ、内部では上記の TCP サーバーへコマンドを送って結果を受け取ります。
3. Claude Code に MCP サーバーとして登録すると、Claude が `create_object` や
   `execute_blender_code` などのツールを呼び出せるようになり、会話しながら Blender 上で
   3D 制作を進められます。

## セットアップ

### 1. Blender にアドオンをインストール

1. Blender を起動し、`Edit > Preferences > Add-ons > Install...`
2. `addon/blender_mcp_addon.py` を選択してインストール・有効化
3. 3D ビューポートのサイドバー (`N` キー) に "Claude MCP" タブが表示されるので、
   `Start Claude MCP Server` を押してサーバーを起動 (既定: ポート 9876)

### 2. MCP サーバーの依存関係をインストール

```bash
cd blender-mcp/server
pip install -r requirements.txt
```

### 3. Claude Code に MCP サーバーとして登録

```bash
claude mcp add blender -- python blender-mcp/server/blender_mcp_server.py
```

もしくはプロジェクトルートに `.mcp.json` を置く場合は `mcp.json.example` を参考にしてください。

### 4. 使ってみる

Blender を起動しサーバーを Start した状態で、Claude Code で例えば次のように話しかけます。

- 「Blenderのシーン情報を教えて」
- 「原点に赤い立方体を作って」
- 「今あるCubeを右に2m移動して、少し回転させて」
- 「シーンをレンダリングして画像を見せて」

## 提供する MCP ツール

| ツール | 説明 |
| --- | --- |
| `get_scene_info` | シーン内のオブジェクト一覧などを取得 |
| `get_object_info` | 指定オブジェクトの位置・回転・スケール・頂点数などを取得 |
| `create_object` | プリミティブ (CUBE / SPHERE / CYLINDER / CONE / PLANE / TORUS / EMPTY) を作成 |
| `delete_object` | 指定オブジェクトを削除 |
| `set_transform` | 位置・回転(ラジアン)・スケールを設定 |
| `set_material` | ベースカラー(RGBA)でマテリアルを設定 |
| `execute_blender_code` | 任意の Python コードを Blender 内 (`bpy` あり) で実行 |
| `render_viewport` | 現在のシーンをレンダリングして PNG を保存 |

`execute_blender_code` は他のツールでカバーしきれない操作 (モディファイア追加、複雑な
モデリング処理、アニメーション設定など) を Claude に Python コードとして生成・実行させるための
汎用インターフェースです。

## 注意事項

- `execute_blender_code` は Blender 内で任意の Python コードを実行できるため、
  **信頼できる環境・指示でのみ使用してください**。
- サーバーは `127.0.0.1` (localhost) のみで待受し、認証機構はありません。
  同一マシン上でのローカル利用を前提としています。外部に公開しないでください。
- 同時に扱える Blender インスタンスは 1 つです。
- Blender 3.0 以降 / Python 3.10 以降を想定しています。
