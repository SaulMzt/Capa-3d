"""Redirect old browser pages to Netlify, keeping old API and assets available.

Uses FTPS, saves the original .htaccess privately, and verifies the uploaded
file byte-for-byte. Run without --apply to inspect the intended change.
"""

import argparse
import ftplib
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REMOTE = "capa3d.site.je/htdocs/.htaccess"
MARKER = "# CAPA3D-NETLIFY-REDIRECT"
RULES = """# CAPA3D-NETLIFY-REDIRECT
# Keep the former API and static files available to already-open clients.
RewriteCond %{REQUEST_URI} !^/(api(?:/|$)|api\\.php$|mobile\\.php$|assets/|uploads/|mobile-preview/|sw\\.js$|favicon\\.svg$|hero\\.(?:png|webp)$|catalog\\.(?:png|webp)$) [NC]
RewriteRule ^(.*)$ https://capa3d-pruebas.netlify.app/$1 [R=302,L]
"""


def download(ftp):
    chunks = []
    ftp.retrbinary("RETR " + REMOTE, chunks.append)
    return b"".join(chunks)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    config = json.loads((ROOT / ".private/ftp.json").read_text(encoding="utf-8"))
    ftp = ftplib.FTP_TLS()
    ftp.connect(config["host"], config["port"], timeout=30)
    ftp.login(config["username"], config["password"])
    ftp.prot_p()
    try:
        original = download(ftp)
        text = original.decode("utf-8")
        if MARKER in text:
            print("La redirección ya está instalada; no se modificó nada.")
            return
        if text.count("RewriteEngine On") != 1 or "DirectoryIndex index.html" not in text:
            raise RuntimeError("La configuración remota no coincide con la esperada; no se modificó.")
        newline = "\r\n" if b"\r\n" in original else "\n"
        replacement = ("RewriteEngine On" + newline + RULES.replace("\n", newline)).rstrip(newline)
        updated = text.replace("RewriteEngine On", replacement, 1).encode("utf-8")
        print("La redirección enviará páginas y rutas de la tienda a https://capa3d-pruebas.netlify.app/")
        print("La API y los archivos existentes quedan excluidos. Estado HTTP: 302.")
        if not args.apply:
            print("Modo de comprobación: el servidor no se modificó.")
            return
        backup_dir = ROOT / ".private/backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = backup_dir / f"legacy-htaccess-{stamp}.txt"
        backup.write_bytes(original)
        try:
            ftp.storbinary("STOR " + REMOTE, io.BytesIO(updated))
            if hashlib.sha256(download(ftp)).digest() != hashlib.sha256(updated).digest():
                raise RuntimeError("La verificación del archivo remoto falló.")
        except Exception:
            ftp.storbinary("STOR " + REMOTE, io.BytesIO(original))
            raise
        (ROOT / "ftp-site/.htaccess").write_bytes(updated)
        (ROOT / "ftp-dist/.htaccess").write_bytes(updated)
        print(f"Redirección instalada y verificada. Copia de seguridad: {backup.name}")
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


if __name__ == "__main__":
    main()
