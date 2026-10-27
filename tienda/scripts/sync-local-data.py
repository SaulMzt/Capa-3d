import sqlite3,pathlib
folder=pathlib.Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');sources=[p for p in folder.glob('*.sqlite') if p.name!='metadata.sqlite'];assert len(sources)==1,'Se esperaba una sola base local';source=sqlite3.connect(sources[0]);source.row_factory=sqlite3.Row;dest=sqlite3.connect('ftp-dist/database/capa.sqlite');dest.execute('PRAGMA foreign_keys=OFF');tables=['product_images','order_items','order_history','inventory_movements','orders','products','categories','settings','admins'];
for table in tables:dest.execute('DELETE FROM '+table)
for table in reversed(tables):
 rows=source.execute('SELECT * FROM '+table).fetchall()
 if not rows:continue
 columns=rows[0].keys();placeholders=','.join('?' for _ in columns)
 dest.executemany('INSERT INTO '+table+'('+','.join(columns)+') VALUES('+placeholders+')',[tuple(row) for row in rows])
 print('copied',table,len(rows))
dest.commit();dest.execute('PRAGMA foreign_keys=ON');issues=dest.execute('PRAGMA foreign_key_check').fetchall();assert not issues,issues
print('Pedidos activos migrados:',dest.execute('SELECT COUNT(*) FROM orders').fetchone()[0]);dest.close();source.close()
