"""Claude Code <-> Blender の MCP ブリッジサーバー。

Blender 側で起動している addon/blender_mcp_addon.py のローカル TCP サーバー
(既定: 127.0.0.1:9876) に接続し、その操作を MCP ツールとして Claude Code に公開する。

起動方法:
    pip install -r requirements.txt
    python blender_mcp_server.py

Claude Code から使うには .mcp.json に登録する (../mcp.json.example 参照)。
"""

from __future__ import annotations

import json
import os
import socket
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

HOST = os.environ.get("BLENDER_MCP_HOST", "127.0.0.1")
PORT = int(os.environ.get("BLENDER_MCP_PORT", "9876"))

mcp = FastMCP("blender")


def _send_command(command_type: str, params: Optional[dict] = None, timeout: float = 30.0) -> Any:
    payload = json.dumps({"type": command_type, "params": params or {}}) + "\n"
    try:
        with socket.create_connection((HOST, PORT), timeout=timeout) as sock:
            sock.sendall(payload.encode("utf-8"))
            sock.settimeout(timeout)
            buffer = b""
            while b"\n" not in buffer:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                buffer += chunk
    except (ConnectionRefusedError, OSError) as exc:
        raise RuntimeError(
            "Blender に接続できません。Blender 側で Claude MCP アドオンのサーバーを"
            f"起動しているか確認してください ({HOST}:{PORT})。詳細: {exc}"
        ) from exc

    line, _, _ = buffer.partition(b"\n")
    if not line:
        raise RuntimeError("Blender からの応答が空でした。")
    response = json.loads(line.decode("utf-8"))
    if response.get("error"):
        raise RuntimeError(response["error"])
    return response.get("result")


@mcp.tool()
def get_scene_info() -> dict:
    """現在の Blender シーンの情報 (シーン名・オブジェクト一覧) を取得する。"""
    return _send_command("get_scene_info")


@mcp.tool()
def get_object_info(name: str) -> dict:
    """指定した名前のオブジェクトの詳細 (位置・回転・スケール・頂点数など) を取得する。"""
    return _send_command("get_object_info", {"name": name})


@mcp.tool()
def create_object(
    object_type: str,
    name: Optional[str] = None,
    location: Optional[list[float]] = None,
) -> dict:
    """Blender シーンにプリミティブオブジェクトを作成する。

    object_type: CUBE / SPHERE / CYLINDER / CONE / PLANE / TORUS / EMPTY のいずれか。
    location: [x, y, z]。省略時は原点。
    """
    return _send_command(
        "create_object",
        {"object_type": object_type, "name": name, "location": location or [0, 0, 0]},
    )


@mcp.tool()
def delete_object(name: str) -> dict:
    """指定した名前のオブジェクトをシーンから削除する。"""
    return _send_command("delete_object", {"name": name})


@mcp.tool()
def set_transform(
    name: str,
    location: Optional[list[float]] = None,
    rotation_euler: Optional[list[float]] = None,
    scale: Optional[list[float]] = None,
) -> dict:
    """オブジェクトの位置・回転(ラジアン, XYZオイラー)・スケールを設定する。指定しない項目は変更しない。"""
    params: dict[str, Any] = {"name": name}
    if location is not None:
        params["location"] = location
    if rotation_euler is not None:
        params["rotation_euler"] = rotation_euler
    if scale is not None:
        params["scale"] = scale
    return _send_command("set_transform", params)


@mcp.tool()
def set_material(
    name: str,
    color: Optional[list[float]] = None,
    material_name: Optional[str] = None,
) -> dict:
    """オブジェクトにマテリアルを設定する。color は [R, G, B, A] (各 0.0〜1.0)。"""
    return _send_command(
        "set_material",
        {"name": name, "color": color or [0.8, 0.8, 0.8, 1.0], "material_name": material_name},
    )


@mcp.tool()
def execute_blender_code(code: str) -> dict:
    """任意の Python コードを Blender 内 (bpy が使えるコンテキスト) で実行する。

    値を呼び出し元に返したい場合は `result` という変数に代入すること。
    このツールは Blender 内で任意コードを実行できるため、信頼できる指示のみで使うこと。
    """
    return _send_command("execute_code", {"code": code})


@mcp.tool()
def render_viewport(path: Optional[str] = None) -> dict:
    """現在のシーンをレンダリングして画像ファイル(PNG)として保存する。path 省略時は一時ディレクトリに保存。"""
    return _send_command("render_viewport", {"path": path})


if __name__ == "__main__":
    mcp.run(transport="stdio")
