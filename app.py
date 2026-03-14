"""
Sistema de intercambio de portapapeles, imágenes y archivos en red local.
Servidor Flask que escucha en 0.0.0.0 para acceso desde la LAN.
"""

import os
import socket
import uuid
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, render_template, url_for

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200 MB máximo por archivo

# Directorios de almacenamiento (se crean al iniciar)
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
IMAGES_DIR = UPLOADS_DIR / "images"
FILES_DIR = UPLOADS_DIR / "files"

# Historial del portapapeles: lista de {"text": str, "updated": float}, sin límite de tamaño de texto
CLIPBOARD_HISTORY_MAX = 200
clipboard_history = []

# Metadatos de imágenes y archivos (nombre, id, fecha)
images_meta = []
files_meta = []


def ensure_dirs():
    """Crea los directorios de subida si no existen."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    FILES_DIR.mkdir(parents=True, exist_ok=True)


def get_local_ip():
    """Obtiene la IP local del host para mostrar en la interfaz."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        try:
            s.close()
        except Exception:
            pass
    return ip


def scan_uploads():
    """Actualiza listas de imágenes y archivos desde disco. Sin duplicados por nombre."""
    global images_meta, files_meta
    images_meta = []
    seen_names = set()
    for f in sorted(IMAGES_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.name not in seen_names:
            seen_names.add(f.name)
            st = f.stat()
            images_meta.append({
                "id": f.stem,
                "name": f.name,
                "size": st.st_size,
                "updated": st.st_mtime,
            })
    files_meta = []
    seen_names = set()
    for f in sorted(FILES_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.name not in seen_names:
            seen_names.add(f.name)
            files_meta.append({
                "id": f.stem,
                "name": f.name,
                "size": f.stat().st_size,
            })


# ---------- Rutas de página ----------

@app.route("/")
def index():
    """Página principal con la interfaz de las tres secciones."""
    ensure_dirs()
    scan_uploads()
    return render_template(
        "index.html",
        local_ip=get_local_ip(),
        port=request.environ.get("SERVER_PORT", "5000"),
    )


# ---------- API Portapapeles (historial) ----------

@app.route("/api/clipboard", methods=["GET"])
def get_clipboard():
    """Devuelve el historial del portapapeles (todas las pegadas)."""
    import time
    return jsonify({
        "history": [
            {"text": e["text"], "updated": e["updated"]}
            for e in clipboard_history
        ],
    })


@app.route("/api/clipboard", methods=["POST"])
def set_clipboard():
    """Añade una pegada al historial. Acepta textos inmensos y conserva formato."""
    import time
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    if not isinstance(text, str):
        text = str(text)
    clipboard_history.append({
        "text": text,
        "updated": time.time(),
    })
    while len(clipboard_history) > CLIPBOARD_HISTORY_MAX:
        clipboard_history.pop(0)
    return jsonify({"ok": True})


@app.route("/api/clipboard/<int:index>", methods=["DELETE"])
def delete_clipboard_entry(index):
    """Borra una entrada del historial por índice."""
    if 0 <= index < len(clipboard_history):
        clipboard_history.pop(index)
    return jsonify({"ok": True})


# ---------- API Imágenes ----------

@app.route("/api/images", methods=["GET"])
def list_images():
    """Lista las imágenes subidas."""
    scan_uploads()
    return jsonify({"images": images_meta})


@app.route("/api/images", methods=["POST"])
def upload_image():
    """Sube una o más imágenes (sin duplicar por nombre)."""
    ensure_dirs()
    uploaded = []
    seen = set()
    for f in request.files.getlist("file"):
        if f and f.filename:
            ext = Path(f.filename).suffix or ".png"
            fid = str(uuid.uuid4())
            name = f"{fid}{ext}"
            if name in seen:
                continue
            seen.add(name)
            path = IMAGES_DIR / name
            f.save(path)
            uploaded.append({"id": fid, "name": name})
    for key in request.files:
        if key == "file":
            continue
        f = request.files[key]
        if f and f.filename:
            ext = Path(f.filename).suffix or ".png"
            fid = str(uuid.uuid4())
            name = f"{fid}{ext}"
            if name in seen:
                continue
            seen.add(name)
            path = IMAGES_DIR / name
            f.save(path)
            uploaded.append({"id": fid, "name": name})
    scan_uploads()
    return jsonify({"ok": True, "uploaded": uploaded})


@app.route("/api/images/<file_id>")
def get_image(file_id):
    """Devuelve una imagen por ID (nombre sin extensión)."""
    for f in IMAGES_DIR.iterdir():
        if f.is_file() and f.stem == file_id:
            return send_from_directory(IMAGES_DIR, f.name, as_attachment=False)
    return "", 404


@app.route("/api/images/<file_id>/download")
def download_image(file_id):
    """Descarga una imagen por ID."""
    for f in IMAGES_DIR.iterdir():
        if f.is_file() and f.stem == file_id:
            return send_from_directory(IMAGES_DIR, f.name, as_attachment=True, download_name=f.name)
    return "", 404


@app.route("/api/images/<file_id>", methods=["DELETE"])
def delete_image(file_id):
    """Borra una imagen por ID."""
    for f in IMAGES_DIR.iterdir():
        if f.is_file() and f.stem == file_id:
            try:
                f.unlink()
                scan_uploads()
                return jsonify({"ok": True})
            except Exception:
                return "", 500
    return "", 404


# ---------- API Archivos ----------

@app.route("/api/files", methods=["GET"])
def list_files():
    """Lista los archivos subidos."""
    scan_uploads()
    return jsonify({"files": files_meta})


@app.route("/api/files", methods=["POST"])
def upload_file():
    """Sube uno o más archivos. Si existe el mismo nombre, se sobrescribe (evita duplicados)."""
    ensure_dirs()
    uploaded = []
    for key in request.files:
        f = request.files[key]
        if f and f.filename:
            name = f.filename
            path = FILES_DIR / name
            f.save(path)  # sobrescribe si existe → un solo archivo por nombre
            uploaded.append({"name": name, "id": path.stem})
    scan_uploads()
    return jsonify({"ok": True, "uploaded": uploaded})


def _find_file_by_id(file_id):
    """Encuentra archivo por id (stem); si hay varios con mismo stem, devuelve el primero."""
    for f in FILES_DIR.iterdir():
        if f.is_file() and f.stem == file_id:
            return f
    return None


@app.route("/api/files/<path:file_id>/download")
def download_file(file_id):
    """Descarga un archivo por ID (stem del nombre, puede contener puntos)."""
    f = _find_file_by_id(file_id)
    if f:
        return send_from_directory(FILES_DIR, f.name, as_attachment=True, download_name=f.name)
    return "", 404


@app.route("/api/files/<path:file_id>", methods=["DELETE"])
def delete_file(file_id):
    """Borra un archivo por ID."""
    f = _find_file_by_id(file_id)
    if f:
        try:
            f.unlink()
            scan_uploads()
            return jsonify({"ok": True})
        except Exception:
            return "", 500
    return "", 404


# ---------- API Liberar todo ----------

@app.route("/api/clear", methods=["POST"])
def clear_all():
    """Borra todo: historial del portapapeles, todas las imágenes y todos los archivos."""
    global clipboard_history
    clipboard_history = []
    for f in IMAGES_DIR.iterdir():
        if f.is_file():
            try:
                f.unlink()
            except Exception:
                pass
    for f in FILES_DIR.iterdir():
        if f.is_file():
            try:
                f.unlink()
            except Exception:
                pass
    scan_uploads()
    return jsonify({"ok": True})


# ---------- Arranque ----------

if __name__ == "__main__":
    ensure_dirs()
    port = int(os.environ.get("PORT", 8080))
    ip = get_local_ip()
    print("\n" + "=" * 50)
    print("  Servidor de intercambio en red local")
    print("=" * 50)
    print(f"  Acceso desde esta máquina:  http://127.0.0.1:{port}")
    print(f"  Acceso desde la red (LAN):  http://{ip}:{port}")
    print("=" * 50 + "\n")
    app.run(host="0.0.0.0", port=port, debug=True, threaded=True)
