"""Publish the signed Android APK on the existing free FTP host.

This is a fallback while Netlify Free pauses production deployments. It keeps
the old site's redirect for pages but excludes /descargas/ for APK downloads.
"""

import argparse
import ftplib
import hashlib
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTACCESS = "capa3d.site.je/htdocs/.htaccess"
DIRECTORY = "capa3d.site.je/htdocs/descargas"


def download(ftp, remote):
    parts = []
    ftp.retrbinary("RETR " + remote, parts.append)
    return b"".join(parts)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("apk", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    apk = args.apk.resolve(strict=True)
    if not re.fullmatch(r"CAPA-3D-Admin-\d+\.\d+\.\d+-Netlify\.apk", apk.name):
        raise ValueError("Nombre de APK inesperado.")
    target = apk.name.replace("-Netlify.apk", ".apk")
    data = apk.read_bytes()
    if not data.startswith(b"PK\x03\x04") or len(data) > 10_000_000:
        raise ValueError("El APK no es válido para este alojamiento.")
    config = json.loads((ROOT / ".private/ftp.json").read_text(encoding="utf-8"))
    ftp = ftplib.FTP_TLS()
    ftp.connect(config["host"], config["port"], timeout=30)
    ftp.login(config["username"], config["password"])
    ftp.prot_p()
    try:
        original = download(ftp, HTACCESS)
        lines = original.decode("utf-8").splitlines(keepends=True)
        redirect = next((i for i, line in enumerate(lines) if line.startswith("RewriteCond %{REQUEST_URI} !^/") and "mobile-preview/" in line), None)
        if redirect is None or "CAPA3D-NETLIFY-REDIRECT" not in original.decode("utf-8"):
            raise RuntimeError("La redirección remota cambió; revisar antes de publicar.")
        if "descargas/" not in lines[redirect]:
            lines[redirect] = lines[redirect].replace("|uploads/|", "|uploads/|descargas/|", 1)
        updated = "".join(lines).encode("utf-8")
        print(f"APK: {target}, {len(data)} bytes; enlace: https://capa3d.site.je/descargas/{target}")
        if not args.apply:
            print("Modo de comprobación: no se modificó el servidor.")
            return
        backups = ROOT / ".private/backups"
        backups.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        (backups / f"legacy-htaccess-before-apk-{stamp}.txt").write_bytes(original)
        try:
            ftp.mkd(DIRECTORY)
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise
        remote_apk = DIRECTORY + "/" + target
        try:
            ftp.storbinary("STOR " + remote_apk, io.BytesIO(data))
            if hashlib.sha256(download(ftp, remote_apk)).digest() != hashlib.sha256(data).digest():
                raise RuntimeError("La verificación del APK remoto falló.")
            if updated != original:
                ftp.storbinary("STOR " + HTACCESS, io.BytesIO(updated))
                if download(ftp, HTACCESS) != updated:
                    raise RuntimeError("La verificación de .htaccess falló.")
        except Exception:
            if updated != original:
                ftp.storbinary("STOR " + HTACCESS, io.BytesIO(original))
            raise
        (ROOT / "ftp-site/.htaccess").write_bytes(updated)
        (ROOT / "ftp-dist/.htaccess").write_bytes(updated)
        print("APK y configuración FTP verificados byte por byte.")
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


if __name__ == "__main__":
    main()
