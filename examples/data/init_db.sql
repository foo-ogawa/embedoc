-- Sample database initialization script

-- Table information
CREATE TABLE IF NOT EXISTS tables (
  table_name TEXT PRIMARY KEY,
  schema_name TEXT DEFAULT 'public',
  table_comment TEXT
);

-- Column information
CREATE TABLE IF NOT EXISTS columns (
  table_name TEXT,
  column_name TEXT,
  data_type TEXT,
  not_null INTEGER DEFAULT 0,
  default_value TEXT,
  column_comment TEXT,
  ordinal_position INTEGER,
  PRIMARY KEY (table_name, column_name)
);

-- Foreign key information
CREATE TABLE IF NOT EXISTS foreign_keys (
  table_name TEXT,
  column_name TEXT,
  ref_table_name TEXT,
  ref_column_name TEXT,
  PRIMARY KEY (table_name, column_name, ref_table_name)
);

-- Sample data: Tables
INSERT OR REPLACE INTO tables VALUES ('users', 'public', 'Table for managing user information');
INSERT OR REPLACE INTO tables VALUES ('orders', 'public', 'Table for managing order information');
INSERT OR REPLACE INTO tables VALUES ('products', 'public', 'Table for managing product information');

-- Sample data: users table columns
INSERT OR REPLACE INTO columns VALUES ('users', 'id', 'integer', 1, NULL, 'User ID', 1);
INSERT OR REPLACE INTO columns VALUES ('users', 'name', 'varchar(100)', 1, NULL, 'User name', 2);
INSERT OR REPLACE INTO columns VALUES ('users', 'email', 'varchar(255)', 1, NULL, 'Email address', 3);
INSERT OR REPLACE INTO columns VALUES ('users', 'created_at', 'timestamp', 1, 'CURRENT_TIMESTAMP', 'Created at', 4);
INSERT OR REPLACE INTO columns VALUES ('users', 'updated_at', 'timestamp', 0, NULL, 'Updated at', 5);

-- Sample data: orders table columns
INSERT OR REPLACE INTO columns VALUES ('orders', 'id', 'integer', 1, NULL, 'Order ID', 1);
INSERT OR REPLACE INTO columns VALUES ('orders', 'user_id', 'integer', 1, NULL, 'User ID', 2);
INSERT OR REPLACE INTO columns VALUES ('orders', 'total_amount', 'decimal(10,2)', 1, '0', 'Total amount', 3);
INSERT OR REPLACE INTO columns VALUES ('orders', 'status', 'varchar(20)', 1, '''pending''', 'Order status', 4);
INSERT OR REPLACE INTO columns VALUES ('orders', 'created_at', 'timestamp', 1, 'CURRENT_TIMESTAMP', 'Created at', 5);

-- Sample data: products table columns
INSERT OR REPLACE INTO columns VALUES ('products', 'id', 'integer', 1, NULL, 'Product ID', 1);
INSERT OR REPLACE INTO columns VALUES ('products', 'name', 'varchar(200)', 1, NULL, 'Product name', 2);
INSERT OR REPLACE INTO columns VALUES ('products', 'price', 'decimal(10,2)', 1, '0', 'Price', 3);
INSERT OR REPLACE INTO columns VALUES ('products', 'stock', 'integer', 1, '0', 'Stock quantity', 4);

-- Sample data: Foreign keys
INSERT OR REPLACE INTO foreign_keys VALUES ('orders', 'user_id', 'users', 'id');
