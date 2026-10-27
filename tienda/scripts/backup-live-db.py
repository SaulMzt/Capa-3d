"""Download and verify a private point-in-time copy of the live SQLite file.

This is a safety copy, not a cutover snapshot. A final migration must quiesce
writes and verify the database again before switching the storefront.
"""

import ftplib
import json
import pathlib
import sqlite3
from datetime import datetime, timezone


project = pathlib.Path(__file__).resolve().parents[1]
credentials = json.loads((project / ".private" / "ftp.json").read_text())
backups = project / ".private" / "backups"
backups.mkdir(parents=True, exist_ok=True)
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
destination = backups / f"capa-live-{stamp}.sqlite"
temporary = destination.with_suffix(".sqlite.part")

connection = ftplib.FTP_TLS()
try:
    connection.connect(credentials["host"], credentials["port"], timeout=30)
    connection.login(credentials["username"], credentials["password"])
    connection.prot_p()
    with temporary.open("wb") as output:
        connection.retrbinary(
            "RETR capa3d.site.je/htdocs/database/capa.sqlite", output.write
        )
finally:
    try:
        connection.quit()
    except Exception:
        connection.close()

try:
    db = sqlite3.connect(f"file:{temporary.as_posix()}?mode=ro", uri=True)
    try:
        result = db.execute("PRAGMA integrity_check").fetchone()[0]
        if result != "ok":
            raise RuntimeError(f"SQLite integrity_check: {result}")
        count = db.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()[0]
    finally:
        db.close()
    temporary.replace(destination)
    print(f"Verified private backup: {destination.name}, {destination.stat().st_size} bytes, {count} schema entries")
except Exception:
    temporary.unlink(missing_ok=True)
    raise
