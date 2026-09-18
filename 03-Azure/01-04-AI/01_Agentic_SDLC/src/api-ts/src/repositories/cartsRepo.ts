import { getDatabase, DatabaseConnection } from '../db/sqlite';
import { Cart, CartItem } from '../models/cart';
import { handleDatabaseError, NotFoundError, ValidationError } from '../utils/errors';
import { DatabaseRow, mapDatabaseRows, objectToCamelCase } from '../utils/sql';

interface CartRow extends DatabaseRow {
  cart_id: number;
  created_at: string;
}

interface ProductPriceRow {
  price: number;
  discount: number | null;
}

export class CartsRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async create(): Promise<Cart> {
    try {
      const result = await this.db.run('INSERT INTO carts DEFAULT VALUES');
      return await this.getById(result.lastID || 0);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async getById(cartId: number): Promise<Cart> {
    this.validatePositiveInteger(cartId, 'cartId');

    try {
      const cartRow = await this.db.get<CartRow>(
        'SELECT cart_id, created_at FROM carts WHERE cart_id = ?',
        [cartId],
      );
      if (!cartRow) {
        throw new NotFoundError('Cart', cartId);
      }

      const rows = await this.db.all<DatabaseRow>(
        `SELECT
           ci.cart_item_id,
           ci.product_id,
           p.name,
           p.img_name,
           ci.quantity,
           ci.unit_price,
           ROUND(ci.unit_price * ci.quantity, 2) AS line_total
         FROM cart_items ci
         INNER JOIN products p ON p.product_id = ci.product_id
         WHERE ci.cart_id = ?
         ORDER BY ci.cart_item_id`,
        [cartId],
      );
      const items = mapDatabaseRows<CartItem>(rows);

      return {
        ...objectToCamelCase<Pick<Cart, 'cartId' | 'createdAt'>>(cartRow),
        items,
        itemCount: items.reduce((count, item) => count + item.quantity, 0),
        total: this.roundCurrency(
          items.reduce((total, item) => total + item.lineTotal, 0),
        ),
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async addItem(cartId: number, productId: number, quantity: number): Promise<Cart> {
    this.validatePositiveInteger(cartId, 'cartId');
    this.validatePositiveInteger(productId, 'productId');
    this.validatePositiveInteger(quantity, 'quantity');

    try {
      const addItem = this.db.db.transaction(() => {
        this.requireCart(cartId);
        const product = this.db.db
          .prepare('SELECT price, discount FROM products WHERE product_id = ?')
          .get(productId) as ProductPriceRow | undefined;
        if (!product) {
          throw new NotFoundError('Product', productId);
        }

        const unitPrice = this.roundCurrency(product.price * (1 - (product.discount ?? 0)));
        this.db.db
          .prepare(
            `INSERT INTO cart_items (cart_id, product_id, quantity, unit_price)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(cart_id, product_id) DO UPDATE SET
               quantity = cart_items.quantity + excluded.quantity`,
          )
          .run(cartId, productId, quantity, unitPrice);
      });

      addItem();
      return await this.getById(cartId);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async updateItem(cartId: number, productId: number, quantity: number): Promise<Cart> {
    this.validatePositiveInteger(cartId, 'cartId');
    this.validatePositiveInteger(productId, 'productId');
    this.validatePositiveInteger(quantity, 'quantity');

    try {
      this.requireCart(cartId);
      const result = await this.db.run(
        'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
        [quantity, cartId, productId],
      );
      if (result.changes === 0) {
        throw new NotFoundError('Cart item', productId);
      }

      return await this.getById(cartId);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async removeItem(cartId: number, productId: number): Promise<void> {
    this.validatePositiveInteger(cartId, 'cartId');
    this.validatePositiveInteger(productId, 'productId');

    try {
      this.requireCart(cartId);
      const result = await this.db.run(
        'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cartId, productId],
      );
      if (result.changes === 0) {
        throw new NotFoundError('Cart item', productId);
      }
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  private requireCart(cartId: number): void {
    const cart = this.db.db.prepare('SELECT 1 FROM carts WHERE cart_id = ?').get(cartId);
    if (!cart) {
      throw new NotFoundError('Cart', cartId);
    }
  }

  private validatePositiveInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new ValidationError(`${field} must be a positive integer`);
    }
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

export async function createCartsRepository(isTest: boolean = false): Promise<CartsRepository> {
  const db = await getDatabase(isTest);
  return new CartsRepository(db);
}

let cartsRepo: CartsRepository | null = null;

export async function getCartsRepository(isTest: boolean = false): Promise<CartsRepository> {
  const isTestEnv = isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTestEnv) {
    return createCartsRepository(true);
  }
  if (!cartsRepo) {
    cartsRepo = await createCartsRepository(false);
  }
  return cartsRepo;
}
