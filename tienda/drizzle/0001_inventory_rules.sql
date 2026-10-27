CREATE TRIGGER validate_order_stock BEFORE INSERT ON orders WHEN NEW.type='product'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM products p JOIN categories c ON p.category_id=c.id WHERE p.id=NEW.product_id AND p.published=1 AND c.active=1 AND p.status='Disponible' AND (p.unlimited=1 OR p.stock>=NEW.quantity)) THEN RAISE(ABORT,'STOCK_UNAVAILABLE') END;
END;
--> statement-breakpoint
CREATE TRIGGER reserve_order_stock AFTER INSERT ON orders
BEGIN
 INSERT INTO order_history(order_id,status,note,created_at) VALUES(NEW.id,NEW.status,'Solicitud recibida',NEW.created_at);
 INSERT INTO order_items(order_id,product_id,quantity,unit_price,product_name) SELECT NEW.id,id,NEW.quantity,price,name FROM products WHERE id=NEW.product_id;
 UPDATE orders SET data=json_set(data,'$.total',(SELECT price*NEW.quantity/100.0 FROM products WHERE id=NEW.product_id),'$.productName',(SELECT name FROM products WHERE id=NEW.product_id)) WHERE id=NEW.id AND NEW.type='product';
 INSERT INTO inventory_movements(product_id,order_id,delta,reason,created_at) SELECT id,NEW.id,-NEW.quantity,'Apartado',NEW.created_at FROM products WHERE id=NEW.product_id AND unlimited=0;
 UPDATE products SET stock=stock-NEW.quantity WHERE id=NEW.product_id AND unlimited=0;
END;
--> statement-breakpoint
CREATE TRIGGER validate_reopened_stock BEFORE UPDATE OF status ON orders WHEN OLD.status='Cancelado' AND NEW.status!='Cancelado' AND NEW.type='product'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND (unlimited=1 OR stock>=NEW.quantity)) THEN RAISE(ABORT,'STOCK_UNAVAILABLE') END;
END;
--> statement-breakpoint
CREATE TRIGGER restore_cancelled_stock AFTER UPDATE OF status ON orders WHEN OLD.status!='Cancelado' AND NEW.status='Cancelado'
BEGIN
 INSERT INTO inventory_movements(product_id,order_id,delta,reason,created_at) SELECT id,NEW.id,NEW.quantity,'Cancelación',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM products WHERE id=NEW.product_id AND unlimited=0;
 UPDATE products SET stock=stock+NEW.quantity WHERE id=NEW.product_id AND unlimited=0;
END;
--> statement-breakpoint
CREATE TRIGGER reserve_reopened_stock AFTER UPDATE OF status ON orders WHEN OLD.status='Cancelado' AND NEW.status!='Cancelado'
BEGIN
 INSERT INTO inventory_movements(product_id,order_id,delta,reason,created_at) SELECT id,NEW.id,-NEW.quantity,'Reactivación',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM products WHERE id=NEW.product_id AND unlimited=0;
 UPDATE products SET stock=stock-NEW.quantity WHERE id=NEW.product_id AND unlimited=0;
END;
