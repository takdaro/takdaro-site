function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

async function getCurrentUserId(context) {
  const cookieString = context.request.headers.get("Cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  const session = await context.env.DB
    .prepare("SELECT user_id FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first();

  return session?.user_id ?? null;
}

function normalizeDigits(value) {
  const map = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
  };

  return String(value ?? "").replace(/[۰-۹]/g, (digit) => map[digit]);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  const normalized = normalizeDigits(value).replace(/[^\d]/g, "");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function generateOrderNumber() {
  const now = new Date();
  const datePart = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0")
  ].join("");

  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `TT-${datePart}-${randomPart}`;
}

function validatePayload(body) {
  if (!body || typeof body !== "object") {
    return "payload-invalid";
  }

  const address = body.address || {};
  const order = body.order || {};
  const items = Array.isArray(order.items) ? order.items : [];

  if (!address.full_name || !address.address_line || !address.city || !address.state) {
    return "address-invalid";
  }

  if (!items.length) {
    return "items-empty";
  }

  if (!Number.isFinite(Number(order.total_amount)) || Number(order.total_amount) <= 0) {
    return "total-invalid";
  }

  return null;
}

function extractItemName(item) {
  return normalizeText(
    item?.product_name ||
    item?.name ||
    item?.title ||
    item?.product?.name ||
    "محصول"
  );
}

function extractItemQuantity(item) {
  const quantity = normalizeNumber(item?.quantity);
  return quantity > 0 ? quantity : 1;
}

function extractItemUnitPrice(item) {
  const directPrice = normalizeNumber(item?.unit_price);
  if (directPrice > 0) return directPrice;

  const price = normalizeNumber(item?.price);
  if (price > 0) return price;

  const productPrice = normalizeNumber(item?.product?.price);
  if (productPrice > 0) return productPrice;

  const total = normalizeNumber(item?.total_price || item?.total);
  const quantity = extractItemQuantity(item);
  if (total > 0 && quantity > 0) {
    return Math.floor(total / quantity);
  }

  return 0;
}

export async function onRequestPost(context) {
  try {
    const userId = await getCurrentUserId(context);

    if (!userId) {
      return Response.json(
        { success: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await context.request.json();
    const validationError = validatePayload(body);

    if (validationError) {
      return Response.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const address = body.address || {};
    const order = body.order || {};
    const items = Array.isArray(order.items) ? order.items : [];

    const fullName = normalizeText(address.full_name);
    const addressLine = normalizeText(address.address_line);
    const postalCode = normalizeDigits(address.postal_code).replace(/[^\d]/g, "");
    const phone = normalizeDigits(address.phone).replace(/[^\d]/g, "");
    const city = normalizeText(address.city);
    const state = normalizeText(address.state);

    const shippingAmount = normalizeNumber(order.shipping_amount);
    const totalAmount = normalizeNumber(order.total_amount);

    let orderNumber = generateOrderNumber();
    let existingOrder = await context.env.DB
      .prepare("SELECT id FROM orders WHERE order_number = ?")
      .bind(orderNumber)
      .first();

    while (existingOrder) {
      orderNumber = generateOrderNumber();
      existingOrder = await context.env.DB
        .prepare("SELECT id FROM orders WHERE order_number = ?")
        .bind(orderNumber)
        .first();
    }

    const existingShippingAddress = await context.env.DB
      .prepare(`
        SELECT id
        FROM addresses
        WHERE user_id = ? AND type = 'shipping'
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      `)
      .bind(userId)
      .first();

    let addressId = null;

    if (existingShippingAddress?.id) {
      await context.env.DB
        .prepare(`
          UPDATE addresses
          SET
            full_name = ?,
            address_line = ?,
            postal_code = ?,
            phone = ?,
            city = ?,
            state = ?,
            is_default = 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `)
        .bind(
          fullName,
          addressLine,
          postalCode,
          phone,
          city,
          state,
          existingShippingAddress.id,
          userId
        )
        .run();

      addressId = existingShippingAddress.id;
    } else {
      const addressInsert = await context.env.DB
        .prepare(`
          INSERT INTO addresses (
            user_id,
            type,
            full_name,
            address_line,
            postal_code,
            phone,
            city,
            state,
            is_default,
            created_at,
            updated_at
          )
          VALUES (?, 'shipping', ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `)
        .bind(
          userId,
          fullName,
          addressLine,
          postalCode,
          phone,
          city,
          state
        )
        .run();

      addressId = addressInsert.meta?.last_row_id ?? null;
    }

    const orderInsert = await context.env.DB
      .prepare(`
        INSERT INTO orders (
          user_id,
          order_number,
          status,
          total_amount,
          shipping_amount,
          discount_amount,
          payment_status,
          shipping_address_id,
          billing_address_id,
          created_at
        )
        VALUES (?, ?, 'pending', ?, ?, 0, 'pending', ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        userId,
        orderNumber,
        totalAmount,
        shippingAmount,
        addressId,
        addressId
      )
      .run();

    const orderId = orderInsert.meta?.last_row_id ?? null;

    if (!orderId) {
      return Response.json(
        { success: false, error: "order-create-failed" },
        { status: 500 }
      );
    }

    for (const item of items) {
      const productName = extractItemName(item);
      const quantity = extractItemQuantity(item);
      const unitPrice = extractItemUnitPrice(item);
      const totalPrice = quantity * unitPrice;

      await context.env.DB
        .prepare(`
          INSERT INTO order_items (
            order_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(
          orderId,
          productName,
          quantity,
          unitPrice,
          totalPrice
        )
        .run();
    }

    return Response.json({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        status: "pending",
        payment_status: "pending",
        total_amount: totalAmount,
        shipping_amount: shippingAmount,
        shipping_address_id: addressId,
        billing_address_id: addressId,
        items_count: items.length
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}