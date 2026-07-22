import { requireAdmin } from "../../../lib/admin";

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const orderNumber = String(context.params.order || "").trim();
    if (!orderNumber) {
      return Response.json(
        { success: false, error: "order required" },
        { status: 400 }
      );
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
          o.shipping_address_id,
          o.billing_address_id,
          u.id AS user_id,
          u.full_name,
          u.email,
          u.phone
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.order_number = ?
      `)
      .bind(orderNumber)
      .first();

    if (!order) {
      return Response.json(
        { success: false, error: "order not found" },
        { status: 404 }
      );
    }

    const items = await context.env.DB
      .prepare(`
        SELECT id, product_name, quantity, unit_price, total_price, created_at
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `)
      .bind(order.id)
      .all();

    let shipping_address = null;
    let billing_address = null;

    if (order.shipping_address_id) {
      shipping_address = await context.env.DB
        .prepare(`
          SELECT id, type, full_name, address_line, postal_code, phone, city, state, is_default
          FROM addresses
          WHERE id = ?
        `)
        .bind(order.shipping_address_id)
        .first();
    }

    if (order.billing_address_id) {
      billing_address = await context.env.DB
        .prepare(`
          SELECT id, type, full_name, address_line, postal_code, phone, city, state, is_default
          FROM addresses
          WHERE id = ?
        `)
        .bind(order.billing_address_id)
        .first();
    }

    return Response.json({
      success: true,
      order: {
        ...order,
        items: items.results || [],
        shipping_address,
        billing_address
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}