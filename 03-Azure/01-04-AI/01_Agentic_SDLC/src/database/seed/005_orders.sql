-- Seed data for orders
INSERT INTO orders (order_id, branch_id, order_date, name, description, status) VALUES 
(1, 1, '2026-09-10T10:00:00.000Z', 'Q2 Feline Tech Refresh', 'Quarterly smart cat tech product refresh', 'pending'),
(2, 1, '2026-09-12T11:15:00.000Z', 'Cat Enrichment Bundle', 'Monthly cat entertainment systems restock', 'processing'),
(3, 2, '2026-09-14T08:30:00.000Z', 'Autumn Care Pack', 'Seasonal wellness and comfort upgrades for the branch', 'shipped');
