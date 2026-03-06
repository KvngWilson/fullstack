const logger = require("../../../shared/utils/logger");
const { sendEmailJob } = require("../../../infrastructure/email/email");

async function getOrderDetailsForConfirmation(client, orderId) {
  const orderDetails = await client.query(
    `SELECT o.id, o.total, u.email,
            json_agg(json_build_object(
              'name', p.name,
              'quantity', oi.quantity,
              'price', oi.price_at_time,
              'subtotal', (oi.quantity * oi.price_at_time)
            )) as items
     FROM orders o
     JOIN users u ON o.user_id = u.id
     JOIN order_items oi ON o.id = oi.order_id
     JOIN product_variants pv ON oi.product_variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     WHERE o.id = $1
     GROUP BY o.id, o.total, u.email`,
    [orderId],
  );

  return orderDetails.rows[0] || null;
}

async function sendConfirmationEmailSafely(client, orderId) {
  const order = await getOrderDetailsForConfirmation(client, orderId);
  if (!order) return;

  try {
    await sendEmailJob({
      to: order.email,
      templateName: 'orderConfirmation',
      templateData: {
        orderId: order.id,
        items: order.items || [],
        total: order.total,
        orderUrl: `${process.env.APP_URL || 'http://localhost:5000'}/orders/${order.id}`,
      },
    });
  } catch (emailError) {
    logger.error("Failed to send order confirmation email", {
      error: emailError.message,
      orderId,
    });
  }
}

async function applyOrderInventoryUpdate(client, orderId) {
  const orderItems = await client.query(
    "SELECT product_variant_id, quantity FROM order_items WHERE order_id = $1",
    [orderId],
  );

  for (const item of orderItems.rows) {
    await client.query(
      `UPDATE product_variants
       SET stock = GREATEST(stock - $1, 0)
       WHERE id = $2`,
      [item.quantity, item.product_variant_id],
    );
  }
}

async function processSuccessfulOrderPayment(client, orderId) {
  const orderCheck = await client.query("SELECT status FROM orders WHERE id = $1", [
    orderId,
  ]);

  if (!orderCheck.rows.length) return;
  if (orderCheck.rows[0].status === "paid") return;

  await client.query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2`,
    ["paid", orderId],
  );

  await applyOrderInventoryUpdate(client, orderId);
  await sendConfirmationEmailSafely(client, orderId);
}

async function withTransaction(pool, workFn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await workFn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  processSuccessfulOrderPayment,
  withTransaction,
};
