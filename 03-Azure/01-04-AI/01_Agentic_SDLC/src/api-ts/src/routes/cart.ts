/**
 * @swagger
 * tags:
 *   name: Carts
 *   description: API endpoints for persistent shopping carts
 *
 * /api/carts:
 *   post:
 *     summary: Create an empty cart
 *     tags: [Carts]
 *     responses:
 *       201:
 *         description: Cart created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *
 * /api/carts/{cartId}:
 *   get:
 *     summary: Get a cart aggregate
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Cart aggregate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid cart ID
 *       404:
 *         description: Cart not found
 *
 * /api/carts/{cartId}/items:
 *   post:
 *     summary: Add a product or increment its existing cart quantity
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddCartItemRequest'
 *     responses:
 *       200:
 *         description: Updated cart aggregate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Cart or product not found
 *
 * /api/carts/{cartId}/items/{productId}:
 *   put:
 *     summary: Replace a cart line quantity
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCartItemRequest'
 *     responses:
 *       200:
 *         description: Updated cart aggregate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Cart line not found
 *   delete:
 *     summary: Remove a product from a cart
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       204:
 *         description: Cart line removed
 *       400:
 *         description: Invalid path ID
 *       404:
 *         description: Cart or cart line not found
 */

import express from 'express';
import { AddCartItemRequest, UpdateCartItemRequest } from '../models/cart';
import { getCartsRepository } from '../repositories/cartsRepo';
import { ValidationError } from '../utils/errors';

const router = express.Router();

function parsePathId(value: string, field: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(`${field} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return parsed;
}

function parseBody(body: unknown, fields: string[]): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('request body must be a JSON object');
  }

  const requestBody = body as Record<string, unknown>;
  const unexpectedField = Object.keys(requestBody).find((field) => !fields.includes(field));
  if (unexpectedField) {
    throw new ValidationError(`${unexpectedField} is not allowed`);
  }
  return requestBody;
}

function parsePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return value as number;
}

router.post('/', async (_req, res, next) => {
  try {
    const repository = await getCartsRepository();
    const cart = await repository.create();
    res.status(201).json(cart);
  } catch (error) {
    next(error);
  }
});

router.get('/:cartId', async (req, res, next) => {
  try {
    const cartId = parsePathId(req.params.cartId, 'cartId');
    const repository = await getCartsRepository();
    res.json(await repository.getById(cartId));
  } catch (error) {
    next(error);
  }
});

router.post('/:cartId/items', async (req, res, next) => {
  try {
    const cartId = parsePathId(req.params.cartId, 'cartId');
    const body = parseBody(req.body, ['productId', 'quantity']);
    const request: AddCartItemRequest = {
      productId: parsePositiveInteger(body.productId, 'productId'),
      quantity: parsePositiveInteger(body.quantity, 'quantity'),
    };
    const repository = await getCartsRepository();
    res.json(await repository.addItem(cartId, request.productId, request.quantity));
  } catch (error) {
    next(error);
  }
});

router.put('/:cartId/items/:productId', async (req, res, next) => {
  try {
    const cartId = parsePathId(req.params.cartId, 'cartId');
    const productId = parsePathId(req.params.productId, 'productId');
    const body = parseBody(req.body, ['quantity']);
    const request: UpdateCartItemRequest = {
      quantity: parsePositiveInteger(body.quantity, 'quantity'),
    };
    const repository = await getCartsRepository();
    res.json(await repository.updateItem(cartId, productId, request.quantity));
  } catch (error) {
    next(error);
  }
});

router.delete('/:cartId/items/:productId', async (req, res, next) => {
  try {
    const cartId = parsePathId(req.params.cartId, 'cartId');
    const productId = parsePathId(req.params.productId, 'productId');
    const repository = await getCartsRepository();
    await repository.removeItem(cartId, productId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
