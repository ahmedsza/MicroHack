import Database from 'better-sqlite3';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MigrationRunner } from '../db/migrate';
import { DatabaseConnection } from '../db/sqlite';
import { NotFoundError, ValidationError } from '../utils/errors';
import { CartsRepository } from './cartsRepo';

describe('CartsRepository', () => {
  let db: DatabaseConnection;
  let repository: CartsRepository;

  beforeEach(async () => {
    db = new DatabaseConnection(new Database(':memory:'));
    db.db.pragma('foreign_keys = ON');
    const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
    await new MigrationRunner(db, migrationsDir).runMigrations();

    await db.run(
      `INSERT INTO suppliers
         (supplier_id, name, description, contact_person, email, phone, active, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 'Supplier', null, null, null, null, 1, 1],
    );
    await db.run(
      `INSERT INTO products
         (product_id, supplier_id, name, description, price, sku, unit, img_name, discount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        1, 1, 'Discounted product', null, 19.99, 'SKU-1', 'each', 'one.png', 0.15,
        2, 1, 'Full-price product', null, 5.25, 'SKU-2', 'each', 'two.png', 0,
      ],
    );
    repository = new CartsRepository(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('creates and reads an empty cart', async () => {
    const created = await repository.create();
    const loaded = await repository.getById(created.cartId);

    expect(created).toMatchObject({ items: [], itemCount: 0, total: 0 });
    expect(created.createdAt).toBeTruthy();
    expect(loaded).toEqual(created);
  });

  it('snapshots a rounded discounted price and increments one existing line', async () => {
    const cart = await repository.create();

    await repository.addItem(cart.cartId, 1, 2);
    await db.run('UPDATE products SET price = ?, discount = ? WHERE product_id = ?', [100, 0, 1]);
    const updated = await repository.addItem(cart.cartId, 1, 1);
    const rowCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM cart_items WHERE cart_id = ?',
      [cart.cartId],
    );

    expect(updated.items).toEqual([
      expect.objectContaining({
        productId: 1,
        quantity: 3,
        unitPrice: 16.99,
        lineTotal: 50.97,
      }),
    ]);
    expect(updated).toMatchObject({ itemCount: 3, total: 50.97 });
    expect(rowCount?.count).toBe(1);
  });

  it('sets an absolute quantity and calculates aggregate totals', async () => {
    const cart = await repository.create();
    await repository.addItem(cart.cartId, 1, 1);
    await repository.addItem(cart.cartId, 2, 2);

    const updated = await repository.updateItem(cart.cartId, 1, 3);

    expect(updated.items.map((item) => item.quantity)).toEqual([3, 2]);
    expect(updated.itemCount).toBe(5);
    expect(updated.total).toBe(61.47);
  });

  it('removes an existing line', async () => {
    const cart = await repository.create();
    await repository.addItem(cart.cartId, 2, 1);

    await repository.removeItem(cart.cartId, 2);

    await expect(repository.getById(cart.cartId)).resolves.toMatchObject({
      items: [],
      itemCount: 0,
      total: 0,
    });
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid positive integers: %s', async (value) => {
    const cart = await repository.create();

    await expect(repository.addItem(cart.cartId, value, 1)).rejects.toBeInstanceOf(ValidationError);
    await expect(repository.addItem(cart.cartId, 1, value)).rejects.toBeInstanceOf(ValidationError);
    await expect(repository.updateItem(cart.cartId, 1, value)).rejects.toBeInstanceOf(ValidationError);
  });

  it('reports missing carts, products, and lines', async () => {
    const cart = await repository.create();

    await expect(repository.getById(999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(repository.addItem(cart.cartId, 999, 1)).rejects.toBeInstanceOf(NotFoundError);
    await expect(repository.updateItem(cart.cartId, 1, 1)).rejects.toBeInstanceOf(NotFoundError);
    await expect(repository.removeItem(cart.cartId, 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('cascades cart deletion and restricts deletion of referenced products', async () => {
    const cart = await repository.create();
    await repository.addItem(cart.cartId, 1, 1);

    expect(() => db.db.prepare('DELETE FROM products WHERE product_id = ?').run(1)).toThrow();
    await db.run('DELETE FROM carts WHERE cart_id = ?', [cart.cartId]);
    const item = await db.get('SELECT 1 FROM cart_items WHERE cart_id = ?', [cart.cartId]);

    expect(item).toBeUndefined();
  });
});
