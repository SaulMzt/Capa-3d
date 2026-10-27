import pathlib,json,sqlite3,hashlib,secrets,shutil
root=pathlib.Path('ftp-dist');root.mkdir(exist_ok=True);private=pathlib.Path('.private');access=json.loads((private/'access.json').read_text());data=json.loads((private/'ftp-seed.json').read_text());dbdir=root/'database';dbdir.mkdir(exist_ok=True);target=dbdir/'capa.sqlite'
if target.exists():target.unlink()
db=sqlite3.connect(target);db.execute('PRAGMA foreign_keys=ON');db.executescript('''
CREATE TABLE categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,active INTEGER NOT NULL,sort INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT NOT NULL,category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,price INTEGER NOT NULL,stock INTEGER NOT NULL,unlimited INTEGER NOT NULL,published INTEGER NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX idx_products_category_published ON products(category_id,published);
CREATE TABLE product_images(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,url TEXT NOT NULL,sort INTEGER NOT NULL);
CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,request_key TEXT NOT NULL UNIQUE,token_hash TEXT NOT NULL,type TEXT NOT NULL,product_id TEXT REFERENCES products(id) ON DELETE SET NULL,quantity INTEGER NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX idx_orders_status_date ON orders(status,created_at);
CREATE TABLE order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,product_id TEXT,quantity INTEGER NOT NULL,unit_price INTEGER NOT NULL,product_name TEXT NOT NULL);
CREATE TABLE order_history(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,status TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE inventory_movements(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id TEXT,order_id INTEGER,delta INTEGER NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE settings(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE admins(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE TABLE customer_accounts(id TEXT PRIMARY KEY,contact_type TEXT NOT NULL,contact TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE customer_sessions(token_hash TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE TABLE customer_orders(order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,customer_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE);
CREATE INDEX idx_customer_orders_customer ON customer_orders(customer_id);
CREATE TABLE order_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,sender TEXT NOT NULL CHECK(sender IN ('admin','customer')),body TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX idx_order_messages_order ON order_messages(order_id,id);
CREATE TABLE push_subscriptions(id INTEGER PRIMARY KEY AUTOINCREMENT,endpoint_hash TEXT NOT NULL,endpoint TEXT NOT NULL,customer_id TEXT REFERENCES customer_accounts(id) ON DELETE CASCADE,order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,created_at TEXT NOT NULL,UNIQUE(endpoint_hash,customer_id,order_id));
CREATE INDEX idx_push_order ON push_subscriptions(order_id);
CREATE INDEX idx_push_customer ON push_subscriptions(customer_id);
CREATE TABLE ai_drafts(id TEXT PRIMARY KEY,product_json TEXT NOT NULL,meta_json TEXT NOT NULL,status TEXT NOT NULL,duplicate_id TEXT,duplicate_decision TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE ai_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,role TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE ai_events(id INTEGER PRIMARY KEY AUTOINCREMENT,draft_id TEXT,action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE rate_limits(k TEXT PRIMARY KEY,n INTEGER NOT NULL,expires INTEGER NOT NULL);
''')
for c in data['categories']:db.execute('INSERT INTO categories VALUES(?,?,?,?,?)',(c['id'],c['name'],int(c['active']),c['sort'],json.dumps(c,ensure_ascii=False)))
for p in data['products']:
 db.execute('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?)',(p['id'],p['name'],p['categoryId'],round(p['price']*100),p['stock'],int(p['unlimited']),int(p['published']),p['status'],json.dumps(p,ensure_ascii=False),p['createdAt']))
 for i,url in enumerate(p['images']):db.execute('INSERT INTO product_images VALUES(?,?,?,?)',(secrets.token_hex(16),p['id'],url,i))
db.execute("INSERT INTO settings VALUES('store',?)",(json.dumps(data['settings'],ensure_ascii=False),));db.execute("INSERT INTO settings VALUES('seeded','true')")
salt=secrets.token_hex(32);hash=hashlib.pbkdf2_hmac('sha256',access['password'].encode(),salt.encode(),100000).hex();db.execute('INSERT INTO admins VALUES(?,?,?,?,datetime("now"))',('owner',access['email'],hash,salt));db.commit();db.close()
for source,dest in [('ftp-site/.htaccess','.htaccess'),('ftp-site/.user.ini','.user.ini'),('ftp-site/api.php','api.php'),('ftp-site/maintenance.php','maintenance.php'),('ftp-site/database/.htaccess','database/.htaccess'),('ftp-site/uploads/.htaccess','uploads/.htaccess')]:
 p=root/dest;p.parent.mkdir(exist_ok=True,parents=True);shutil.copyfile(source,p)
(dbdir/'config.php').write_text('<?php return '+repr(access['code']).replace('\\','\\\\')+';')
print('Paquete estático, API PHP y base SQLite preparados. Credenciales omitidas de la salida.')
