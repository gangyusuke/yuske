"""Claude MCP Bridge - Blender アドオン

Blender をローカル TCP サーバーとして起動し、Claude Code から MCP (server/blender_mcp_server.py)
経由で送られてくるコマンドを Blender のメインスレッド上で実行する。

インストール方法:
    Blender > Edit > Preferences > Add-ons > Install... でこのファイルを選択して有効化。
    3D ビューポートのサイドバー (N キー) に "Claude MCP" タブが表示される。
"""

bl_info = {
    "name": "Claude MCP Bridge",
    "author": "yuske",
    "version": (1, 0, 0),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > Claude MCP",
    "description": "Blender を Claude Code と MCP 経由で接続するローカルブリッジ",
    "category": "Interface",
}

import json
import queue
import socket
import threading
import traceback

import bpy

HOST = "127.0.0.1"
DEFAULT_PORT = 9876

_server_socket = None
_server_thread = None
_running = False
_request_queue = queue.Queue()
_timer_registered = False


def _object_to_dict(obj):
    return {
        "name": obj.name,
        "type": obj.type,
        "location": list(obj.location),
        "rotation_euler": list(obj.rotation_euler),
        "scale": list(obj.scale),
    }


def _handle_command(command):
    """Blender のメインスレッドで実行される。command は {"type": ..., "params": {...}}"""
    cmd_type = command.get("type")
    params = command.get("params") or {}

    if cmd_type == "get_scene_info":
        scene = bpy.context.scene
        return {
            "scene_name": scene.name,
            "object_count": len(scene.objects),
            "objects": [_object_to_dict(o) for o in scene.objects],
        }

    if cmd_type == "get_object_info":
        name = params.get("name")
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise ValueError(f"object not found: {name}")
        info = _object_to_dict(obj)
        if obj.type == "MESH":
            info["vertex_count"] = len(obj.data.vertices)
            info["polygon_count"] = len(obj.data.polygons)
        return info

    if cmd_type == "create_object":
        obj_type = str(params.get("object_type", "CUBE")).upper()
        location = params.get("location") or [0, 0, 0]
        name = params.get("name")

        creators = {
            "CUBE": lambda: bpy.ops.mesh.primitive_cube_add(location=location),
            "SPHERE": lambda: bpy.ops.mesh.primitive_uv_sphere_add(location=location),
            "CYLINDER": lambda: bpy.ops.mesh.primitive_cylinder_add(location=location),
            "CONE": lambda: bpy.ops.mesh.primitive_cone_add(location=location),
            "PLANE": lambda: bpy.ops.mesh.primitive_plane_add(location=location),
            "TORUS": lambda: bpy.ops.mesh.primitive_torus_add(location=location),
            "EMPTY": lambda: bpy.ops.object.empty_add(location=location),
        }
        if obj_type not in creators:
            raise ValueError(f"unsupported object_type: {obj_type}")
        creators[obj_type]()
        new_obj = bpy.context.active_object
        if name:
            new_obj.name = name
        return _object_to_dict(new_obj)

    if cmd_type == "delete_object":
        name = params.get("name")
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise ValueError(f"object not found: {name}")
        bpy.data.objects.remove(obj, do_unlink=True)
        return {"deleted": name}

    if cmd_type == "set_transform":
        name = params.get("name")
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise ValueError(f"object not found: {name}")
        if "location" in params and params["location"] is not None:
            obj.location = params["location"]
        if "rotation_euler" in params and params["rotation_euler"] is not None:
            obj.rotation_euler = params["rotation_euler"]
        if "scale" in params and params["scale"] is not None:
            obj.scale = params["scale"]
        return _object_to_dict(obj)

    if cmd_type == "set_material":
        name = params.get("name")
        color = params.get("color") or [0.8, 0.8, 0.8, 1.0]
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise ValueError(f"object not found: {name}")
        mat_name = params.get("material_name") or f"{name}_material"
        mat = bpy.data.materials.get(mat_name) or bpy.data.materials.new(mat_name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = color
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        return {"object": name, "material": mat_name}

    if cmd_type == "execute_code":
        code = params.get("code", "")
        local_vars = {}
        exec(code, {"bpy": bpy}, local_vars)
        return {"executed": True, "result": local_vars.get("result")}

    if cmd_type == "render_viewport":
        import os
        import tempfile

        path = params.get("path") or os.path.join(tempfile.gettempdir(), "blender_mcp_render.png")
        scene = bpy.context.scene
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        return {"path": path}

    raise ValueError(f"unknown command type: {cmd_type}")


def _process_queue():
    """bpy.app.timers に登録され、メインスレッドで定期実行される。"""
    while not _request_queue.empty():
        command, result_holder, event = _request_queue.get()
        try:
            result_holder["result"] = _handle_command(command)
            result_holder["error"] = None
        except Exception as exc:  # noqa: BLE001 - Blender 側の実行エラーをそのまま返す
            result_holder["result"] = None
            result_holder["error"] = f"{exc}\n{traceback.format_exc()}"
        event.set()
    return 0.05 if _running else None


def _client_loop(conn):
    buffer = b""
    try:
        while _running:
            chunk = conn.recv(65536)
            if not chunk:
                break
            buffer += chunk
            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                if not line.strip():
                    continue
                try:
                    command = json.loads(line.decode("utf-8"))
                except json.JSONDecodeError as exc:
                    conn.sendall((json.dumps({"error": f"invalid json: {exc}"}) + "\n").encode("utf-8"))
                    continue

                event = threading.Event()
                result_holder = {}
                _request_queue.put((command, result_holder, event))
                event.wait(timeout=30)

                if not event.is_set():
                    response = {"error": "timeout waiting for Blender main thread"}
                elif result_holder.get("error"):
                    response = {"error": result_holder["error"]}
                else:
                    response = {"result": result_holder["result"]}

                conn.sendall((json.dumps(response) + "\n").encode("utf-8"))
    except (ConnectionResetError, BrokenPipeError, OSError):
        pass
    finally:
        conn.close()


def _server_loop(port):
    global _server_socket
    _server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    _server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    _server_socket.bind((HOST, port))
    _server_socket.listen(5)
    _server_socket.settimeout(1.0)
    while _running:
        try:
            conn, _addr = _server_socket.accept()
        except socket.timeout:
            continue
        except OSError:
            break
        threading.Thread(target=_client_loop, args=(conn,), daemon=True).start()
    try:
        _server_socket.close()
    except OSError:
        pass


def start_server(port=DEFAULT_PORT):
    global _server_thread, _running, _timer_registered
    if _running:
        return
    _running = True
    _server_thread = threading.Thread(target=_server_loop, args=(port,), daemon=True)
    _server_thread.start()
    if not _timer_registered:
        bpy.app.timers.register(_process_queue, first_interval=0.1)
        _timer_registered = True


def stop_server():
    global _running, _server_socket, _timer_registered
    _running = False
    if _server_socket:
        try:
            _server_socket.close()
        except OSError:
            pass
    _timer_registered = False


class CLAUDEMCP_OT_start_server(bpy.types.Operator):
    bl_idname = "claudemcp.start_server"
    bl_label = "Start Claude MCP Server"
    bl_description = "Claude Code から接続できるローカルサーバーを起動する"

    def execute(self, context):
        start_server(context.scene.claude_mcp_port)
        self.report({"INFO"}, f"Claude MCP server started on port {context.scene.claude_mcp_port}")
        return {"FINISHED"}


class CLAUDEMCP_OT_stop_server(bpy.types.Operator):
    bl_idname = "claudemcp.stop_server"
    bl_label = "Stop Claude MCP Server"
    bl_description = "Claude MCP サーバーを停止する"

    def execute(self, context):
        stop_server()
        self.report({"INFO"}, "Claude MCP server stopped")
        return {"FINISHED"}


class CLAUDEMCP_PT_panel(bpy.types.Panel):
    bl_label = "Claude MCP"
    bl_idname = "CLAUDEMCP_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Claude MCP"

    def draw(self, context):
        layout = self.layout
        layout.prop(context.scene, "claude_mcp_port")
        status = "起動中" if _running else "停止中"
        layout.label(text=f"状態: {status}")
        row = layout.row(align=True)
        row.operator("claudemcp.start_server", icon="PLAY")
        row.operator("claudemcp.stop_server", icon="PAUSE")


classes = (
    CLAUDEMCP_OT_start_server,
    CLAUDEMCP_OT_stop_server,
    CLAUDEMCP_PT_panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.claude_mcp_port = bpy.props.IntProperty(
        name="Port", default=DEFAULT_PORT, min=1024, max=65535
    )


def unregister():
    stop_server()
    for cls in classes:
        bpy.utils.unregister_class(cls)
    del bpy.types.Scene.claude_mcp_port


if __name__ == "__main__":
    register()
