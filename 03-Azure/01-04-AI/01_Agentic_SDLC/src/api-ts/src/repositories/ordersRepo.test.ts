import Database from 'better-sqlite3';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MigrationRunner } from '../db/migrate';
import { DatabaseConnection } from '../db/sqlite';
import { OrdersRepository } from './ordersRepo';

describe('OrdersRepository', () => {
  let db: DatabaseConnection;
  let repository: OrdersRepository;

  beforeEach(async () => {
    db = new DatabaseConnection(new Database(':memory:'));
    db.db.pragma('foreign_keys = ON');
    const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
    await new MigrationRunner(db, migrationsDir).runMigrations();

    await db.run(
      `INSERT INTO headquarters (headquarters_id, name, description, address, contact_person, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 'HQ', 'Main HQ', '123 Main', 'Jane', 'jane@example.com', '555-0001'],
    );
    await db.run(
      `INSERT INTO branches (branch_id, headquarters_id, name, description, address, contact_person, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 1, 'Branch One', 'Primary branch', '1 First St', 'John', 'john@example.com', '555-0101'],
    );
    await db.run(
      `INSERT INTO suppliers (supplier_id, name, description, contact_person, email, phone, active, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 'Supplier', 'Test supplier', 'Steve', 'steve@example.com', '555-0202', 1, 1],
    );
    await db.run(
      `INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit, img_name, discount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        1,
        1,
        'Test product',
        'A product',
        19.99,
        'SKU-1',
        'piece',
        'item.png',
        0,
      ],
    );
    await db.run(
      `INSERT INTO orders (order_id, branch_id, order_date, name, description, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 1, '2026-09-18T00:00:00.000Z', 'Test order', 'First order', 'pending'],
    );
    await db.run(
      `INSERT INTO order_details (order_detail_id, order_id, product_id, quantity, unit_price, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 1, 1, 2, 19.99, 'Second batch'],
    );

    repository = new OrdersRepository(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('returns order history for a branch with totals and line details', async () => {
    const history = await repository.findOrderHistoryByBranchId(1);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      orderId: 1,
      branchId: 1,
      name: 'Test order',
      status: 'pending',
      total: 39.98,
    });
    expect(history[0].items).toEqual([
      expect.objectContaining({
        productId: 1,
        quantity: 2,
        unitPrice: 19.99,
        total: 39.98,
        name: 'Test product',
      }),
    ]);
  });

  it('returns an empty array when the branch has no orders', async () => {
    await expect(repository.findOrderHistoryByBranchId(999)).resolves.toEqual([]);
  });
});
