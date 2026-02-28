const BaseRepository = require("./BaseRepository");

class OrderRepository extends BaseRepository {
  constructor(pool) {
    super(pool, "orders");
  }

  async createWithItems(userId, shippingAddressId, billingAddressId, cartItems) {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const totals = await this._calculateOrderTotals(client, cartItems);
      await this._validateStock(client, cartItems);

      const orderResult = await client.query(
        `INSERT INTO orders (user_id, status, total)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, "pending", totals.total],
      );

      const order = orderResult.rows[0];

      for (const item of cartItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_variant_id, quantity, price_at_time)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.product_variant_id, item.quantity, item.unit_price],
        );
      }

      if (shippingAddressId) {
        await this._snapshotOrderAddress(client, order.id, shippingAddressId, "shipping");
      }

      if (billingAddressId) {
        await this._snapshotOrderAddress(client, order.id, billingAddressId, "billing");
      }

      for (const item of cartItems) {
        const updateResult = await client.query(
          `UPDATE product_variants
           SET stock = stock - $1
           WHERE id = $2 AND stock >= $1
           RETURNING stock`,
          [item.quantity, item.product_variant_id],
        );

        if (updateResult.rows.length === 0) {
          throw new Error(
            `Insufficient stock for variant ${item.product_variant_id}`,
          );
        }
      }

      await client.query(
        `DELETE FROM cart_items
         WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1)`,
        [userId],
      );

      await client.query("COMMIT");
      return await this.findByIdWithItems(order.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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

  async _calculateOrderTotals(client, cartItems) {
    let total = 0;

    for (const item of cartItems) {
      const priceResult = await client.query(
        `SELECT price
         FROM product_variants
         WHERE id = $1 AND deleted_at IS NULL`,
        [item.product_variant_id],
      );

      if (!priceResult.rows.length) {
        throw new Error(`Variant ${item.product_variant_id} not found`);
      }

      const unitPrice = Number.parseFloat(priceResult.rows[0].price);
      item.unit_price = unitPrice;
      total += unitPrice * item.quantity;
    }

    return { total: Number.parseFloat(total.toFixed(2)) };
  }

  async _validateStock(client, cartItems) {
    for (const item of cartItems) {
      const result = await client.query(
        `SELECT stock
         FROM product_variants
         WHERE id = $1 AND deleted_at IS NULL`,
        [item.product_variant_id],
      );

      if (!result.rows.length) {
        throw new Error(`Variant ${item.product_variant_id} not found`);
      }

      if (Number(result.rows[0].stock) < item.quantity) {
        throw new Error(
          `Insufficient stock for variant ${item.product_variant_id}. Available: ${result.rows[0].stock}, Requested: ${item.quantity}`,
        );
      }
    }
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
        oi.price_at_time,
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

    order.items = itemsResult.rows;
    return order;
  }

  async findByUserId(userId, options = {}) {
    const { status, page = 1, pageSize = 20 } = options;

    const limit = Math.min(100, Number.parseInt(pageSize, 10) || 20);
    const offset = (Math.max(1, Number.parseInt(page, 10) || 1) - 1) * limit;

    let query = `
      SELECT
        o.id,
        o.total,
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
}

module.exports = OrderRepository;
