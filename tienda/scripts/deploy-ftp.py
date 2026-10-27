import ftplib,json,pathlib,sys,shutil
target_root=sys.argv[1].strip('/') if len(sys.argv)>1 else 'capa3d.site.je/htdocs'
if target_root not in {'capa3d.site.je/htdocs','htdocs'}:raise SystemExit('Unexpected FTP document root')
config=json.loads(pathlib.Path('.private/ftp.json').read_text());root=pathlib.Path('ftp-dist').resolve()
for name in ['api.php','ai-products.php','ai-makerworld.php','maintenance.php','.htaccess']:
 shutil.copy2(pathlib.Path('ftp-site')/name,root/name)
shutil.copy2(pathlib.Path('ftp-site/database/.htaccess'),root/'database/.htaccess')
files=[p for p in root.rglob('*') if p.is_file() and p.name not in {'hero.png','catalog.png','file.svg','globe.svg','window.svg'}]
files.sort(key=lambda p:(p.name in {'index.html','.htaccess'} and p.parent==root,p.name=='index.html',str(p)))
client=ftplib.FTP_TLS();client.connect(config['host'],config['port'],timeout=30);client.login(config['username'],config['password']);client.prot_p();client.set_pasv(True)
def exists(path):
 try:return bool(client.size(path))
 except ftplib.error_perm:return False
def mkdir(path):
 try:client.mkd(path)
 except ftplib.error_perm as e:
  if not str(e).startswith('550'):raise
def upload(p):
 relative=p.relative_to(root).as_posix();target=target_root+'/'+relative;parents=pathlib.PurePosixPath(target).parents
 for directory in reversed(parents[:-1]):mkdir(str(directory))
 if relative=='database/capa.sqlite' and exists(target):
  print('PRESERVED database/capa.sqlite (existing live data)');return
 if relative.startswith('uploads/thumbs/opt-'):
  try:
   chunks=[];client.retrbinary('RETR '+target,chunks.append);existing=b''.join(chunks)
   if 100<len(existing)<150000 and existing[:4]==b'RIFF' and existing[8:12]==b'WEBP':
    print('PRESERVED',relative,'(valid optimized image)');return
  except ftplib.error_perm:
   pass
 expected=p.stat().st_size
 if relative.startswith('assets/') and exists(target) and client.size(target)==expected:
  print('PRESERVED',relative,'(matching hashed asset)');return
 for attempt in range(3):
  with p.open('rb') as h:client.storbinary('STOR '+target,h,blocksize=65536)
  size=client.size(target)
  if size==expected:break
  print('RETRY',relative,'size',size,'expected',expected,'attempt',attempt+1)
 else:raise RuntimeError(f'Upload size mismatch: {relative} ({size})')
 print('UPLOADED',relative,p.stat().st_size)
try:
 for p in files:upload(p)
 print('COMPLETE',len(files),'files checked by size over FTPS')
finally:client.quit()
