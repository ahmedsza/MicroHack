/**
 * Repository for orders data access
 */

import { getDatabase, DatabaseConnection } from '../db/sqlite';
import { Order, OrderHistory, OrderHistoryItem } from '../models/order';
import { handleDatabaseError, NotFoundError } from '../utils/errors';
import { buildInsertSQL, buildUpdateSQL, objectToCamelCase, mapDatabaseRows, DatabaseRow } from '../utils/sql';

export class OrdersRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Get all orders
   */
  async findAll(): Promise<Order[]> {
    try {
      const rows = await this.db.all<DatabaseRow>('SELECT * FROM orders ORDER BY order_id');
      return mapDatabaseRows<Order>(rows);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Get order by ID
   */
  async findById(id: number): Promise<Order | null> {
    try {
      const row = await this.db.get<DatabaseRow>('SELECT * FROM orders WHERE order_id = ?', [id]);
      return row ? objectToCamelCase<Order>(row) : null;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Create a new order
   */
  async create(order: Omit<Order, 'orderId'>): Promise<Order> {
    try {
      const { sql, values } = buildInsertSQL('orders', order);
      const result = await this.db.run(sql, values);

      const createdOrder = await this.findById(result.lastID || 0);
      if (!createdOrder) {
        throw new Error('Failed to retrieve created order');
      }

      return createdOrder;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Update order by ID
   */
  async update(id: number, order: Partial<Omit<Order, 'orderId'>>): Promise<Order> {
    try {
      const { sql, values } = buildUpdateSQL('orders', order, 'order_id = ?');
      const result = await this.db.run(sql, [...values, id]);

      if (result.changes === 0) {
        throw new NotFoundError('Order', id);
      }

      const updatedOrder = await this.findById(id);
      if (!updatedOrder) {
        throw new Error('Failed to retrieve updated order');
      }

      return updatedOrder;
    } catch (error) {
      handleDatabaseError(error, 'Order', id);
    }
  }

  /**
   * Delete order by ID
   */
  async delete(id: number): Promise<void> {
    try {
      const result = await this.db.run('DELETE FROM orders WHERE order_id = ?', [id]);

      if (result.changes === 0) {
        throw new NotFoundError('Order', id);
      }
    } catch (error) {
      handleDatabaseError(error, 'Order', id);
    }
  }

  /**
   * Check if order exists
   */
  async exists(id: number): Promise<boolean> {
    try {
      const result = await this.db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM orders WHERE order_id = ?',
        [id],
      );
      return (result?.count || 0) > 0;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Find orders by branch ID
   */
  async findByBranchId(branchId: number): Promise<Order[]> {
    try {
      const rows = await this.db.all<DatabaseRow>(
        'SELECT * FROM orders WHERE branch_id = ? ORDER BY order_date DESC',
        [branchId],
      );
      return mapDatabaseRows<Order>(rows);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Find orders by status
   */
  async findByStatus(status: string): Promise<Order[]> {
    try {
      const rows = await this.db.all<DatabaseRow>(
        'SELECT * FROM orders WHERE status = ? ORDER BY order_date DESC',
        [status],
      );
      return mapDatabaseRows<Order>(rows);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Find orders by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<Order[]> {
    try {
      const rows = await this.db.all<DatabaseRow>(
        'SELECT * FROM orders WHERE order_date >= ? AND order_date <= ? ORDER BY order_date DESC',
        [startDate, endDate],
      );
      return mapDatabaseRows<Order>(rows);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Find detailed order history for a branch.
   */
  async findOrderHistoryByBranchId(branchId: number): Promise<OrderHistory[]> {
    try {
      const orders = await this.findByBranchId(branchId);
      if (orders.length === 0) {
        return [];
      }

      const detailedHistory = await Promise.all(
        orders.map(async (order) => this.buildOrderHistory(order)),
      );

      return detailedHistory;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Find one detailed order record by ID.
   */
  async findOrderHistoryById(id: number): Promise<OrderHistory | null> {
    try {
      const order = await this.findById(id);
      if (!order) {
        return null;
      }

      return this.buildOrderHistory(order);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Deze functie bouwt een order-history record op met de orderregels en totaalwaarde.
   */
  private async buildOrderHistory(order: Order): Promise<OrderHistory> {
    const rows = await this.db.all<DatabaseRow>(
      `SELECT od.order_detail_id, od.order_id, od.product_id, od.quantity, od.unit_price, od.notes,
              p.name, p.description
       FROM order_details od
       LEFT JOIN products p ON p.product_id = od.product_id
       WHERE od.order_id = ?
       ORDER BY od.order_detail_id`,
      [order.orderId],
    );

    const items: OrderHistoryItem[] = rows.map((row) => {
      const item = objectToCamelCase<Record<string, unknown>>(row);
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unitPrice ?? 0);
      const total = quantity * unitPrice;

      return {
        orderDetailId: Number(item.orderDetailId ?? 0),
        productId: Number(item.productId ?? 0),
        quantity,
        unitPrice,
        total,
        notes: typeof item.notes === 'string' ? item.notes : null,
        name: typeof item.name === 'string' ? item.name : undefined,
        description: typeof item.description === 'string' ? item.description : null,
      };
    });

    return {
      ...order,
      total: items.reduce((sum, item) => sum + item.total, 0),
      items,
    };
  }
}

// Factory function to create repository instance
export async function createOrdersRepository(isTest: boolean = false): Promise<OrdersRepository> {
  const db = await getDatabase(isTest);
  return new OrdersRepository(db);
}

// Singleton instance for default usage
let ordersRepo: OrdersRepository | null = null;

export async function getOrdersRepository(isTest: boolean = false): Promise<OrdersRepository> {
  const isTestEnv = isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTestEnv) {
    return createOrdersRepository(true);
  }
  if (!ordersRepo) {
    ordersRepo = await createOrdersRepository(false);
  }
  return ordersRepo;
}
