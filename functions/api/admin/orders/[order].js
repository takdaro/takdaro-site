import { requireAdmin } from "../../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeText(value) {
  return String(value || "").trim();
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const orderNumber = normalizeText(context.params.order);
    if (!orderNumber) {
      return json({ success: false, error: "order required" }, 400);
    }

    const order = await context.env.DB
      .prepare(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.total_amount,
          o.shipping_amount,
          o.discount_amount,
          o.payment_status,
          o.created_at,
          o.updated_at,
          o.shipping_address_id,
          o.billing_address_id,
          COALESCE(o.cashback_amount, 0) AS cashback_amount,
          COALESCE(o.cashback_percent, 0) AS cashback_percent,
          COALESCE(o.cashback_status, 'none') AS cashback_status,
          o.cashback_created_txn_id,
          o.cashback_created_at,
          u.id AS user_id,
          u.full_name,
          u.email,
          u.phone
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.order_number = ?
        LIMIT 1
      `)
      .bind(orderNumber)
      .first();

    if (!order) {
      return json({ success: false, error: "order not found" }, 404);
    }

    const itemsResult = await context.env.DB
      .prepare(`
        SELECT
          id,
          product_name,
          quantity,
          unit_price,
          total_price,
          created_at
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `)
      .bind(order.id)
      .all();

    const items = itemsResult?.results || [];

    let shipping_address = null;
    let billing_address = null;
    let cashback_transaction = null;

    if (order.shipping_address_id) {
      shipping_address = await context.env.DB
        .prepare(`
          SELECT
            id,
            type,
            full_name,
            address_line,
            postal_code,
            phone,
            city,
            state,
            is_default
          FROM addresses
          WHERE id = ?
          LIMIT 1
        `)
        .bind(order.shipping_address_id)
        .first();
    }

    if (order.billing_address_id) {
      billing_address = await context.env.DB
        .prepare(`
          SELECT
            id,
            type,
            full_name,
            address_line,
            postal_code,
            phone,
            city,
            state,
            is_default
          FROM addresses
          WHERE id = ?
          LIMIT 1
        `)
        .bind(order.billing_address_id)
        .first();
    }

    if (order.cashback_created_txn_id) {
      cashback_transaction = await context.env.DB
        .prepare(`
          SELECT
            id,
            type,
            amount,
            balance_before,
            balance_after,
            status,
            source,
            description,
            created_at
          FROM wallet_transactions
          WHERE id = ?
          LIMIT 1
        `)
        .bind(order.cashback_created_txn_id)
        .first();
    }

    return json({
      success: true,
      order: {
        ...order,
        items,
        shipping_address,
        billing_address,
        cashback_transaction
      }
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}