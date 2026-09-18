-- Migration 003: Create persistent shopping carts
-- Handmatige terugrol: voer die volgende stellings in hierdie volgorde uit.
-- DROP INDEX IF EXISTS idx_cart_items_cart_id
-- DROP TABLE IF EXISTS cart_items
-- DROP TABLE IF EXISTS carts

CREATE TABLE IF NOT EXISTS carts (
    cart_id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
    cart_item_id INTEGER PRIMARY KEY,
    cart_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
    UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
