CREATE TABLE IF NOT EXISTS customer_accounts(id TEXT PRIMARY KEY,contact_type TEXT NOT NULL,contact TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customer_sessions(token_hash TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customer_orders(order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,customer_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_customer_orders_customer ON customer_orders(customer_id);
