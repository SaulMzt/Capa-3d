"""Install an HTML fallback redirect on the former InfinityFree storefront.

The Apache redirect may be bypassed by the host's browser challenge. This
entry page ensures visitors still reach the current Netlify storefront.
"""

import argparse
import ftplib
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REMOTE = "capa3d.site.je/htdocs/index.html"
DESTINATION = "https://capa3d-pruebas.netlify.app/"
REDIRECT_HTML = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url={DESTINATION}">
  <link rel="canonical" href="{DESTINATION}">
  <title>CAPA 3D se ha trasladado</title>
</head>
<body>
  <p>CAPA 3D ahora está en <a href="{DESTINATION}">{DESTINATION}</a>.</p>
</body>
</html>
""".encode("utf-8")


def download(ftp):
    parts = []
    ftp.retrbinary("RETR " + REMOTE, parts.append)
    return b"".join(parts)


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
        if original == REDIRECT_HTML:
            print("La página de redirección ya está instalada.")
            return
        if b"capa3d-pruebas.netlify.app" in original and b"http-equiv=\"refresh\"" in original:
            raise RuntimeError("Existe otra redirección en la página remota; revisar manualmente.")
        print(f"Página actual: {len(original)} bytes. Destino: {DESTINATION}")
        if not args.apply:
            print("Modo de comprobación: el servidor no se modificó.")
            return
        backup_dir = ROOT / ".private/backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = backup_dir / f"legacy-index-{stamp}.html"
        backup.write_bytes(original)
        try:
            ftp.storbinary("STOR " + REMOTE, io.BytesIO(REDIRECT_HTML))
            if hashlib.sha256(download(ftp)).digest() != hashlib.sha256(REDIRECT_HTML).digest():
                raise RuntimeError("La verificación de la página remota falló.")
        except Exception:
            ftp.storbinary("STOR " + REMOTE, io.BytesIO(original))
            raise
        for path in (ROOT / "ftp-site/index.html", ROOT / "ftp-dist/index.html"):
            path.write_bytes(REDIRECT_HTML)
        print(f"Página de redirección instalada. Respaldo: {backup.name}")
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


if __name__ == "__main__":
    main()
