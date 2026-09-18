import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { errorHandler } from '../utils/errors';
import cartRouter from './cart';

let app: express.Express;

describe('Cart API', () => {
  beforeEach(async () => {
    await closeDatabase();
    const db = await getDatabase(true);
    await runMigrations(true);
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

    app = express();
    app.use(express.json());
    app.use('/api/carts', cartRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  async function createCart(): Promise<number> {
    const response = await request(app).post('/api/carts');
    expect(response.status).toBe(201);
    return response.body.cartId as number;
  }

  it('creates and reads an empty cart aggregate', async () => {
    const cartId = await createCart();

    const response = await request(app).get(`/api/carts/${cartId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ cartId, items: [], itemCount: 0, total: 0 });
    expect(response.body.createdAt).toBeTruthy();
  });

  it('persists repeated adds and preserves the discounted price snapshot', async () => {
    const cartId = await createCart();
    const firstAdd = await request(app)
      .post(`/api/carts/${cartId}/items`)
      .send({ productId: 1, quantity: 2 });
    expect(firstAdd.status).toBe(200);

    const db = await getDatabase();
    await db.run('UPDATE products SET price = ?, discount = ? WHERE product_id = ?', [100, 0, 1]);
    const secondAdd = await request(app)
      .post(`/api/carts/${cartId}/items`)
      .send({ productId: 1, quantity: 1 });
    const loaded = await request(app).get(`/api/carts/${cartId}`);

    expect(secondAdd.status).toBe(200);
    expect(loaded.body).toMatchObject({ itemCount: 3, total: 50.97 });
    expect(loaded.body.items).toEqual([
      expect.objectContaining({
        productId: 1,
        name: 'Discounted product',
        imgName: 'one.png',
        quantity: 3,
        unitPrice: 16.99,
        lineTotal: 50.97,
      }),
    ]);
  });

  it('replaces quantity and removes a line', async () => {
    const cartId = await createCart();
    await request(app)
      .post(`/api/carts/${cartId}/items`)
      .send({ productId: 2, quantity: 2 });

    const update = await request(app)
      .put(`/api/carts/${cartId}/items/2`)
      .send({ quantity: 4 });
    const removal = await request(app).delete(`/api/carts/${cartId}/items/2`);
    const loaded = await request(app).get(`/api/carts/${cartId}`);

    expect(update.status).toBe(200);
    expect(update.body).toMatchObject({ itemCount: 4, total: 21 });
    expect(update.body.items[0]).toMatchObject({ productId: 2, quantity: 4, lineTotal: 21 });
    expect(removal.status).toBe(204);
    expect(removal.body).toEqual({});
    expect(loaded.body).toMatchObject({ items: [], itemCount: 0, total: 0 });
  });

  it.each(['0', '-1', '1.5', 'abc', '9007199254740992'])(
    'rejects invalid cart path ID %s',
    async (cartId) => {
      const response = await request(app).get(`/api/carts/${cartId}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it.each([
    {},
    { productId: 1 },
    { quantity: 1 },
    { productId: '1', quantity: 1 },
    { productId: 1.5, quantity: 1 },
    { productId: 0, quantity: 1 },
    { productId: -1, quantity: 1 },
    { productId: 1, quantity: '1' },
    { productId: 1, quantity: 1.5 },
    { productId: 1, quantity: 0 },
    { productId: 1, quantity: -1 },
    { productId: 1, quantity: 1, unitPrice: 0.01 },
  ])('rejects invalid add body %#', async (body) => {
    const cartId = await createCart();

    const response = await request(app).post(`/api/carts/${cartId}/items`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    {},
    { quantity: '2' },
    { quantity: 2.5 },
    { quantity: 0 },
    { quantity: -2 },
    { quantity: 2, total: 10 },
  ])('rejects invalid update body %#', async (body) => {
    const cartId = await createCart();

    const response = await request(app).put(`/api/carts/${cartId}/items/1`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid product path IDs', async () => {
    const cartId = await createCart();

    const update = await request(app)
      .put(`/api/carts/${cartId}/items/not-a-number`)
      .send({ quantity: 1 });
    const removal = await request(app).delete(`/api/carts/${cartId}/items/0`);

    expect(update.status).toBe(400);
    expect(removal.status).toBe(400);
  });

  it('returns 404 for missing carts, products, and cart lines', async () => {
    const cartId = await createCart();

    const missingCart = await request(app).get('/api/carts/999');
    const missingProduct = await request(app)
      .post(`/api/carts/${cartId}/items`)
      .send({ productId: 999, quantity: 1 });
    const missingUpdateLine = await request(app)
      .put(`/api/carts/${cartId}/items/1`)
      .send({ quantity: 1 });
    const missingDeleteLine = await request(app).delete(`/api/carts/${cartId}/items/1`);

    expect(missingCart.status).toBe(404);
    expect(missingProduct.status).toBe(404);
    expect(missingUpdateLine.status).toBe(404);
    expect(missingDeleteLine.status).toBe(404);
  });
});
