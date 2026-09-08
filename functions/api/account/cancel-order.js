import { getCurrentUser } from "../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeOrderId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOrderNumber(value) {
  const result = normalizeText(value);
  return result || null;
}

/**
 * برگرداندن موجودی محصولات سفارش
 * فقط زمانی اجرا می‌شود که سفارش واقعاً از وضعیت غیرلغو به cancelled تغییر کند.
 */
async function restoreProductStock(db, orderId) {
  const orderItemsResult = await db
    .prepare(`
      SELECT
        product_id,
        quantity
      FROM order_items
      WHERE order_id = ?
        AND product_id IS NOT NULL
    `)
    .bind(orderId)
    .all();

  const orderItems = Array.isArray(orderItemsResult?.results)
    ? orderItemsResult.results
    : [];

  if (!orderItems.length) {
    return {
      success: true,
      restored: []
    };
  }

  const quantities = new Map();

  for (const item of orderItems) {
    const productId = Number(item?.product_id);
    const quantity = Math.max(
      0,
      Number.parseInt(item?.quantity, 10) || 0
    );

    if (!Number.isInteger(productId) || productId <= 0) {
      continue;
    }

    if (quantity <= 0) {
      continue;
    }

    quantities.set(
      productId,
      (quantities.get(productId) || 0) + quantity
    );
  }

  const restored = [];

  for (const [productId, quantity] of quantities) {
    const updateResult = await db
      .prepare(`
        UPDATE products
        SET
          stock_quantity = COALESCE(stock_quantity, 0) + ?,
          in_stock = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(quantity, productId)
      .run();

    const changes = Number(
      updateResult?.meta?.changes || 0
    );

    if (changes !== 1) {
      throw new Error(
        `product-stock-restore-failed:${productId}`
      );
    }

    const product = await db
      .prepare(`
        SELECT
          id,
          name,
          COALESCE(stock_quantity, 0) AS stock_quantity,
          COALESCE(in_stock, 0) AS in_stock
        FROM products
        WHERE id = ?
        LIMIT 1
      `)
      .bind(productId)
      .first();

    restored.push({
      product_id: productId,
      product_name: product?.name || "",
      restored_quantity: quantity,
      stock_quantity: Math.max(
        0,
        Number.parseInt(product?.stock_quantity, 10) || 0
      ),
      in_stock: Number(product?.in_stock) === 1
    });
  }

  return {
    success: true,
    restored
  };
}

/**
 * POST /api/account/cancel-order
 *
 * Body:
 * {
 *   order_id: 123
 * }
 *
 * یا:
 * {
 *   order_number: "TT-20260823-123456"
 * }
 */
export async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return json(
        {
          success: false,
          error: "unauthorized"
        },
        401
      );
    }

    const body = await context.request
      .json()
      .catch(() => null);

    if (!body || typeof body !== "object") {
      return json(
        {
          success: false,
          error: "payload-invalid"
        },
        400
      );
    }

    const orderId = normalizeOrderId(
      body.order_id ?? body.orderId ?? body.id
    );

    const orderNumber = normalizeOrderNumber(
      body.order_number ?? body.orderNumber
    );

    if (!orderId && !orderNumber) {
      return json(
        {
          success: false,
          error: "order-identifier-required"
        },
        400
      );
    }

    let order = null;

    if (orderId) {
      order = await context.env.DB
        .prepare(`
          SELECT
            id,
            user_id,
            order_number,
            status,
            payment_status
          FROM orders
          WHERE id = ?
            AND user_id = ?
          LIMIT 1
        `)
        .bind(orderId, user.id)
        .first();
    } else {
      order = await context.env.DB
        .prepare(`
          SELECT
            id,
            user_id,
            order_number,
            status,
            payment_status
          FROM orders
          WHERE order_number = ?
            AND user_id = ?
          LIMIT 1
        `)
        .bind(orderNumber, user.id)
        .first();
    }

    if (!order) {
      return json(
        {
          success: false,
          error: "order-not-found"
        },
        404
      );
    }

    const currentStatus = normalizeText(
      order.status
    ).toLowerCase();

    /**
     * جلوگیری از افزایش دوباره موجودی.
     *
     * اگر سفارش قبلاً لغو شده باشد،
     * دیگر restoreProductStock اجرا نمی‌شود.
     */
    if (currentStatus === "cancelled") {
      return json({
        success: true,
        already_cancelled: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: "cancelled"
        },
        message: "این سفارش قبلاً لغو شده است و موجودی دوباره افزایش نیافت."
      });
    }

    /**
     * فقط سفارش‌های payment_pending قابل لغو توسط کاربر هستند.
     */
    if (currentStatus !== "payment_pending") {
      return json(
        {
          success: false,
          error: "order-cannot-be-cancelled",
          status: currentStatus
        },
        409
      );
    }

    /**
     * ابتدا وضعیت سفارش به cancelled تغییر می‌کند.
     *
     * شرط AND status = 'payment_pending' بسیار مهم است:
     * اگر دو درخواست همزمان ارسال شوند،
     * فقط یکی موفق می‌شود و فقط همان یکی موجودی را برمی‌گرداند.
     */
    const cancelResult = await context.env.DB
      .prepare(`
        UPDATE orders
        SET
          status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
          AND status = 'payment_pending'
      `)
      .bind(order.id, user.id)
      .run();

    const changes = Number(
      cancelResult?.meta?.changes || 0
    );

    if (changes !== 1) {
      /**
       * وضعیت را دوباره بررسی می‌کنیم.
       * ممکن است درخواست دیگری همزمان سفارش را لغو کرده باشد.
       */
      const latestOrder = await context.env.DB
        .prepare(`
          SELECT
            id,
            order_number,
            status
          FROM orders
          WHERE id = ?
            AND user_id = ?
          LIMIT 1
        `)
        .bind(order.id, user.id)
        .first();

      if (
        normalizeText(latestOrder?.status).toLowerCase() ===
        "cancelled"
      ) {
        return json({
          success: true,
          already_cancelled: true,
          order: {
            id: latestOrder.id,
            order_number: latestOrder.order_number,
            status: "cancelled"
          },
          message:
            "این سفارش قبلاً لغو شده است و موجودی دوباره افزایش نیافت."
        });
      }

      return json(
        {
          success: false,
          error: "order-cancel-failed"
        },
        409
      );
    }

    /**
     * چون تغییر وضعیت از payment_pending به cancelled
     * فقط یک‌بار موفق شده، موجودی نیز فقط یک‌بار برمی‌گردد.
     */
    const stockRestoreResult =
      await restoreProductStock(
        context.env.DB,
        order.id
      );

    return json({
      success: true,
      already_cancelled: false,
      message:
        "سفارش لغو شد و موجودی محصولات به تعداد خریداری‌شده بازگردانده شد.",
      order: {
        id: order.id,
        order_number: order.order_number,
        status: "cancelled"
      },
      stock_updates:
        stockRestoreResult.restored
    });
  } catch (error) {
    console.error(
      "خطا در لغو سفارش و بازگرداندن موجودی:",
      error
    );

    return json(
      {
        success: false,
        error: String(
          error?.message || error
        )
      },
      500
    );
  }
}