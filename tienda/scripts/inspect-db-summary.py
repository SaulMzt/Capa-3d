"""Print schema names and counts from the newest private backup, without row data."""
from pathlib import Path
import sqlite3

backup = max((Path(__file__).resolve().parents[1] / '.private' / 'backups').glob('capa-live-*.sqlite'))
with sqlite3.connect(f'file:{backup.as_posix()}?mode=ro', uri=True) as db:
    names = [row[0] for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )]
    for name in names:
        count = db.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        print(f'{name}: {count}')
    print(f'backup_size: {backup.stat().st_size} bytes')
    if __import__('sys').argv[1:] == ['--schema']:
        for name, definition in db.execute(
            "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ):
            print(definition)
