"""Verify bulk order cleanup against a disposable copy of the FTP database."""
import sqlite3

source=sqlite3.connect('ftp-dist/database/capa.sqlite')
db=sqlite3.connect(':memory:')
source.backup(db)
source.close()
db.execute('PRAGMA foreign_keys=ON')

product=db.execute('SELECT id,stock FROM products WHERE unlimited=0 LIMIT 1').fetchone()
assert product
before={row[0]:row[1] for row in db.execute('SELECT id,stock FROM products')}
expected={row[0]:row[1] for row in db.execute("SELECT o.product_id,SUM(o.quantity) FROM orders o JOIN products p ON p.id=o.product_id WHERE o.type='product' AND o.status!='Cancelado' AND p.unlimited=0 GROUP BY o.product_id")}
db.execute('BEGIN IMMEDIATE')
returns=list(db.execute("SELECT o.product_id,SUM(o.quantity) FROM orders o JOIN products p ON p.id=o.product_id WHERE o.type='product' AND o.status!='Cancelado' AND p.unlimited=0 GROUP BY o.product_id"))
for product_id,quantity in returns:
    db.execute('UPDATE products SET stock=stock+? WHERE id=?',(quantity,product_id))
db.execute('DELETE FROM inventory_movements WHERE order_id IS NOT NULL')
db.execute('DELETE FROM orders')
for product_id,quantity in returns:
    db.execute('INSERT INTO inventory_movements(product_id,delta,reason,created_at) VALUES(?,?,?,?)',(product_id,quantity,'Inventario devuelto al limpiar pedidos','test'))
db.commit()
assert db.execute('SELECT COUNT(*) FROM orders').fetchone()[0]==0
assert db.execute('SELECT COUNT(*) FROM order_history').fetchone()[0]==0
assert db.execute('SELECT COUNT(*) FROM order_items').fetchone()[0]==0
assert db.execute('SELECT COUNT(*) FROM inventory_movements WHERE order_id IS NOT NULL').fetchone()[0]==0
for product_id,stock in db.execute('SELECT id,stock FROM products'):
    assert stock==before[product_id]+expected.get(product_id,0)
print('Bulk deletion returns reserved stock and removes dependent order data on a disposable database copy.')
