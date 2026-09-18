/**
 * @swagger
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       required: [cartItemId, productId, name, imgName, quantity, unitPrice, lineTotal]
 *       properties:
 *         cartItemId:
 *           type: integer
 *         productId:
 *           type: integer
 *         name:
 *           type: string
 *         imgName:
 *           type: string
 *           nullable: true
 *         quantity:
 *           type: integer
 *           minimum: 1
 *         unitPrice:
 *           type: number
 *           format: double
 *           minimum: 0
 *         lineTotal:
 *           type: number
 *           format: double
 *           minimum: 0
 *     Cart:
 *       type: object
 *       required: [cartId, createdAt, items, itemCount, total]
 *       properties:
 *         cartId:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 *         itemCount:
 *           type: integer
 *           minimum: 0
 *         total:
 *           type: number
 *           format: double
 *           minimum: 0
 *     AddCartItemRequest:
 *       type: object
 *       required: [productId, quantity]
 *       additionalProperties: false
 *       properties:
 *         productId:
 *           type: integer
 *           minimum: 1
 *         quantity:
 *           type: integer
 *           minimum: 1
 *     UpdateCartItemRequest:
 *       type: object
 *       required: [quantity]
 *       additionalProperties: false
 *       properties:
 *         quantity:
 *           type: integer
 *           minimum: 1
 */
export interface CartItem {
  cartItemId: number;
  productId: number;
  name: string;
  imgName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Cart {
  cartId: number;
  createdAt: string;
  items: CartItem[];
  itemCount: number;
  total: number;
}

export interface AddCartItemRequest {
  productId: number;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}
