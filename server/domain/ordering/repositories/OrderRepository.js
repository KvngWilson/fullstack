const BaseRepository = require("../../../data/repositories/BaseRepository");

/**
 * Order Repository
 * Manages database operations for orders, cart, and variant stock
 */
class OrderRepository extends BaseRepository {
  constructor(pool) {
    super(pool, "orders");
  }

  _buildOrderNumber() {
    const ts = Date.now().toString().slice(-8);
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `ORD-${ts}-${rand}`;
  }

  async getCartByUserId(userId) {
    const cartResult = await this.pool.query(
      "SELECT id FROM carts WHERE user_id = $1",
      [userId],
    );

    if (cartResult.rows.length === 0) {
      return null;
    }

    const cartId = cartResult.rows[0].id;

    const itemsResult = await this.pool.query(
      `SELECT
        ci.id AS cart_item_id,
        ci.product_variant_id,
        ci.quantity
      FROM cart_items ci
      WHERE ci.cart_id = $1`,
      [cartId],
    );

    return {
      id: cartId,
      items: itemsResult.rows,
    };
  }

  async addressesBelongToUser(userId, shippingAddressId, billingAddressId) {
    const result = await this.pool.query(
      "SELECT id FROM addresses WHERE id = ANY($1) AND user_id = $2",
      [[shippingAddressId, billingAddressId], userId],
    );

    return result.rows.length === 2;
  }

  async getVariantById(client, variantId) {
    const result = await client.query(
      `SELECT id, price_minor_units, stock_quantity
       FROM product_variants
       WHERE id = $1 AND deleted_at IS NULL`,
      [variantId],
    );

    return result.rows[0] || null;
  }

  async getVariantsByIds(client, variantIds) {
    if (!variantIds || variantIds.length === 0) {
      return [];
    }

    const result = await client.query(
      `SELECT id, price_cents AS price_minor_units, stock AS stock_quantity
       FROM product_variants
       WHERE id = ANY($1) AND deleted_at IS NULL`,
      [variantIds],
    );

    return result.rows;
  }

  async createOrderRecord(client, { userId, status = "pending", total }) {
    const totalCents = Math.max(0, Math.round(Number(total || 0) * 100));
    const result = await client.query(
      `INSERT INTO orders (user_id, order_number, status, payment_status, currency, subtotal_cents, tax_cents, shipping_cents, total_cents)
       VALUES ($1, $2, $3, 'pending', 'USD', 0, 0, 0, $4)
       RETURNING *`,
      [userId, this._buildOrderNumber(), status, totalCents],
    );

    return result.rows[0] || null;
  }

  async addOrderItem(client, { orderId, productVariantId, quantity, unitPrice }) {
    const unitPriceCents = Math.max(0, Math.round(Number(unitPrice || 0) * 100));
    const subtotalCents = unitPriceCents * Number(quantity || 0);
    await client.query(
      `INSERT INTO order_items (order_id, product_variant_id, quantity, unit_price_cents, subtotal_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, productVariantId, quantity, unitPriceCents, subtotalCents],
    );
  }

  async clearUserCart(client, userId) {
    await client.query(
      `DELETE FROM cart_items
       WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1)`,
      [userId],
    );
  }

  async _snapshotOrderAddress(client, orderId, addressId, type) {
    const result = await client.query(
      `SELECT first_name, last_name, phone, street, city, state, postal_code, country
       FROM addresses
       WHERE id = $1`,
      [addressId],
    );

    if (!result.rows.length) return;

    const addr = result.rows[0];

    await client.query(
      `INSERT INTO order_addresses (
        order_id, type, first_name, last_name, phone, street, city, state, postal_code, country
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        orderId,
        type,
        addr.first_name,
        addr.last_name,
        addr.phone,
        addr.street,
        addr.city,
        addr.state,
        addr.postal_code,
        addr.country,
      ],
    );
  }

  async snapshotOrderAddress(client, orderId, addressId, type) {
    return this._snapshotOrderAddress(client, orderId, addressId, type);
  }

  async findByIdWithItems(orderId) {
    const orderResult = await this.pool.query("SELECT * FROM orders WHERE id = $1", [
      orderId,
    ]);

    if (!orderResult.rows.length) {
      return null;
    }

    const order = orderResult.rows[0];

    const itemsResult = await this.pool.query(
      `SELECT
        oi.id as order_item_id,
        oi.product_variant_id,
        oi.quantity,
        oi.unit_price_cents,
        pv.sku,
        pv.attributes,
        p.id as product_id,
        p.name as product_name
      FROM order_items oi
      JOIN product_variants pv ON oi.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE oi.order_id = $1`,
      [orderId],
    );

    order.items = itemsResult.rows.map((item) => ({
      ...item,
      unit_price: Number(item.unit_price_cents || 0) / 100,
    }));
    return order;
  }

  async findByUserId(userId, options = {}) {
    const { status, page = 1, pageSize = 20 } = options;

    const limit = Math.min(100, Number.parseInt(pageSize, 10) || 20);
    const offset = (Math.max(1, Number.parseInt(page, 10) || 1) - 1) * limit;

    let query = `
      SELECT
        o.id,
        ROUND((o.total_cents::numeric / 100), 2) AS total,
        o.status,
        o.created_at,
        o.updated_at,
        COUNT(*) OVER() as total_count
      FROM orders o
      WHERE o.user_id = $1 AND o.deleted_at IS NULL
    `;

    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex += 1;
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    const totalCount = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count, 10) : 0;
    const orders = result.rows.map(({ total_count, ...order }) => order);

    return {
      orders,
      pagination: {
        page: Number.parseInt(page, 10) || 1,
        pageSize: limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    };
  }

  async updateStatus(orderId, newStatus) {
    const validStatuses = [
      "pending",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const result = await this.pool.query(
      `UPDATE orders
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [newStatus, orderId],
    );

    return result.rows[0] || null;
  }

  async findById(orderId) {
    const result = await this.pool.query(
      `SELECT *
       FROM orders
       WHERE id = $1 AND deleted_at IS NULL`,
      [orderId],
    );

    return result.rows[0] || null;
  }

  async getUserById(userId) {
    const result = await this.pool.query(
      `SELECT id, email
       FROM users
       WHERE id = $1`,
      [userId],
    );

    return result.rows[0] || null;
  }
}

module.exports = OrderRepository;