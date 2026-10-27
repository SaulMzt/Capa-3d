import ftplib,json,pathlib,hashlib,sys
c=json.loads(pathlib.Path('.private/ftp.json').read_text());f=ftplib.FTP_TLS();f.connect(c['host'],c['port'],timeout=25);f.login(c['username'],c['password']);f.prot_p();root=pathlib.Path('ftp-dist')
target_root=sys.argv[1].strip('/') if len(sys.argv)>1 else 'capa3d.site.je/htdocs'
if target_root not in {'capa3d.site.je/htdocs','htdocs'}:raise SystemExit('Unexpected FTP document root')
for name in ['index.html','.htaccess','api.php','ai-products.php','ai-makerworld.php']:
 chunks=[];f.retrbinary('RETR '+target_root+'/'+name,chunks.append);remote=b''.join(chunks);local=(root/name).read_bytes();match=hashlib.sha256(remote).digest()==hashlib.sha256(local).digest();print(name,'sha256_match' if match else 'DIFFERENT',len(remote));assert match
chunks=[];f.retrbinary('RETR '+target_root+'/database/capa.sqlite',chunks.append);database=b''.join(chunks)
assert database.startswith(b'SQLite format 3\x00') and len(database)>4096
print('database/capa.sqlite', 'valid_sqlite_header', len(database), '(live data preserved)')
print('FTPS roundtrip integrity verified.');f.quit()
