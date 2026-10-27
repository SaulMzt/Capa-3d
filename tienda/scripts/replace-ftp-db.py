import ftplib,json,pathlib,sqlite3
c=json.loads(pathlib.Path('.private/ftp.json').read_text());f=ftplib.FTP_TLS();f.connect(c['host'],c['port'],timeout=25);f.login(c['username'],c['password']);f.prot_p();remote='htdocs/database/capa.sqlite';backup=pathlib.Path('.private/ftp-backup/capa.sqlite');backup.parent.mkdir(parents=True,exist_ok=True)
with backup.open('wb') as out:f.retrbinary('RETR '+remote,out.write)
current=sqlite3.connect(backup);n=current.execute('SELECT COUNT(*) FROM orders').fetchone()[0];current.close()
if n:raise RuntimeError('La base remota ya tiene pedidos: revisión manual necesaria antes de reemplazarla.')
local=pathlib.Path('ftp-dist/database/capa.sqlite');
with local.open('rb') as inp:f.storbinary('STOR '+remote,inp,blocksize=65536)
assert f.size(remote)==local.stat().st_size
print('Base SQLite actualizada por FTPS con los pedidos locales; respaldo remoto guardado localmente.');f.quit()
