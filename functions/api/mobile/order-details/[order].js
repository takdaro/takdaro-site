// ============================================
// mobile/order-details/[order].js
// جزئیات سفارش + تغییر وضعیت برای پنل موبایل
// ============================================

import {
  getMobileUser,
  mobileUnauthorized
} from "../../../lib/mobile-auth";

import {
  sendOrderStatusChangedNotification,
  sendUserOrderStatusChangedNotification,
  sendOrderCancelledNotification,
  sendUserOrderCancelledNotification,
  sendCashbackAppliedNotification
} from "../../../lib/notification.js";

// ============================================
// Helpers
// ============================================

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

// ============================================
// Order
// ============================================

async function getOrderByNumber(
  db,
  orderNumber
) {
  return await db
    .prepare(`
      SELECT
        o.id,
        o.user_id,
        o.order_number,
        o.address_id,
        o.status,
        o.payment_status,
        o.subtotal_amount,
        o.shipping_amount,
        o.total_amount,

        COALESCE(
          o.wallet_used_amount,
          0
        ) AS wallet_used_amount,

        COALESCE(
          o.cashback_amount,
          0
        ) AS cashback_amount,

        COALESCE(
          o.cashback_status,
          'none'
        ) AS cashback_status,

        o.notes,
        o.created_at,
        o.updated_at,

        u.full_name,
        u.email,
        u.phone,

        a.full_name AS address_full_name,
        a.address_line AS address_line,
        a.postal_code AS postal_code,
        a.phone AS address_phone,
        a.city AS address_city,
        a.state AS address_state

      FROM orders o

      LEFT JOIN users u
        ON u.id = o.user_id

      LEFT JOIN addresses a
        ON a.id = o.address_id

      WHERE o.order_number = ?

      LIMIT 1
    `)
    .bind(orderNumber)
    .first();
}

// ============================================
// Order Items
// ============================================

async function getOrderItems(
  db,
  orderId
) {
  const result =
    await db
      .prepare(`
        SELECT
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price
        FROM order_items
        WHERE order_id = ?
        ORDER BY id DESC
      `)
      .bind(orderId)
      .all();

  return Array.isArray(
    result?.results
  )
    ? result.results
    : [];
}

// ============================================
// Restore Stock
// ============================================

async function restoreProductStock(
  db,
  orderId
) {
  const items =
    await getOrderItems(
      db,
      orderId
    );

  if (!items.length) {
    return {
      success: true,
      restored: []
    };
  }

  const quantities =
    new Map();

  for (const item of items) {
    const productId =
      Number(
        item?.product_id
      );

    const quantity =
      Math.max(
        0,
        Math.round(
          normalizeNumber(
            item?.quantity
          )
        )
      );

    if (
      !productId ||
      quantity <= 0
    ) {
      continue;
    }

    quantities.set(
      productId,
      (
        quantities.get(
          productId
        ) || 0
      ) + quantity
    );
  }

  const restored = [];

  for (
    const [
      productId,
      quantity
    ] of quantities
  ) {
    const result =
      await db
        .prepare(`
          UPDATE products
          SET
            stock_quantity =
              COALESCE(
                stock_quantity,
                0
              ) + ?,
            in_stock = 1,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          quantity,
          productId
        )
        .run();

    const changes =
      Number(
        result?.meta?.changes || 0
      );

    if (changes !== 1) {
      return {
        success: false,
        error:
          "stock_restore_failed",
        product_id:
          productId
      };
    }

    const product =
      await db
        .prepare(`
          SELECT
            id,
            name,
            COALESCE(
              stock_quantity,
              0
            ) AS stock_quantity,
            COALESCE(
              in_stock,
              0
            ) AS in_stock
          FROM products
          WHERE id = ?
          LIMIT 1
        `)
        .bind(productId)
        .first();

    restored.push({
      product_id:
        productId,

      product_name:
        product?.name || "",

      restored_quantity:
        quantity,

      stock_quantity:
        Math.max(
          0,
          normalizeNumber(
            product?.stock_quantity
          )
        ),

      in_stock:
        Number(
          product?.in_stock
        ) === 1
    });
  }

  return {
    success: true,
    restored
  };
}

// ============================================
// Cashback helpers
// ============================================

async function hasCompletedCashbackTx(
  db,
  userId,
  orderId
) {
  const row =
    await db
      .prepare(`
        SELECT id
        FROM wallet_transactions
        WHERE user_id = ?
          AND order_id = ?
          AND type = 'cashback'
          AND status = 'completed'
        LIMIT 1
      `)
      .bind(
        userId,
        orderId
      )
      .first();

  return !!row;
}

async function hasCashbackReversalTx(
  db,
  userId,
  orderId
) {
  const row =
    await db
      .prepare(`
        SELECT id
        FROM wallet_transactions
        WHERE user_id = ?
          AND order_id = ?
          AND type = 'debit'
          AND source =
            'cashback_reversal'
          AND status = 'completed'
        LIMIT 1
      `)
      .bind(
        userId,
        orderId
      )
      .first();

  return !!row;
}

async function applyCashbackIfNeeded(
  db,
  order,
  actorUserId
) {
  const orderId =
    Number(
      order?.id || 0
    );

  const userId =
    Number(
      order?.user_id || 0
    );

  const cashbackAmount =
    Math.max(
      0,
      Math.round(
        normalizeNumber(
          order?.cashback_amount
        )
      )
    );

  if (
    !orderId ||
    !userId ||
    cashbackAmount <= 0
  ) {
    await db
      .prepare(`
        UPDATE orders
        SET
          cashback_status = 'none',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(orderId)
      .run();

    return {
      applied: false,
      reason: "no_cashback"
    };
  }

  if (
    String(
      order.cashback_status ||
        ""
    ).toLowerCase() ===
    "completed"
  ) {
    return {
      applied: false,
      reason:
        "already_completed"
    };
  }

  const alreadyDone =
    await hasCompletedCashbackTx(
      db,
      userId,
      orderId
    );

  if (alreadyDone) {
    await db
      .prepare(`
        UPDATE orders
        SET
          cashback_status =
            'completed',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(orderId)
      .run();

    return {
      applied: false,
      reason:
        "transaction_exists"
    };
  }

  const user =
    await db
      .prepare(`
        SELECT
          id,
          COALESCE(
            wallet_balance,
            0
          ) AS wallet_balance
        FROM users
        WHERE id = ?
        LIMIT 1
      `)
      .bind(userId)
      .first();

  if (!user) {
    return {
      applied: false,
      reason:
        "user_not_found"
    };
  }

  const balanceBefore =
    Math.max(
      0,
      normalizeNumber(
        user.wallet_balance
      )
    );

  const balanceAfter =
    balanceBefore +
    cashbackAmount;

  await db.batch([
    db
      .prepare(`
        UPDATE users
        SET
          wallet_balance = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        balanceAfter,
        userId
      ),

    db
      .prepare(`
        INSERT INTO wallet_transactions (
          user_id,
          type,
          amount,
          balance_before,
          balance_after,
          status,
          source,
          description,
          note,
          order_id,
          order_number,
          reference_type,
          reference_id,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (
          ?,
          'cashback',
          ?,
          ?,
          ?,
          'completed',
          'order_completion',
          ?,
          ?,
          ?,
          ?,
          'order',
          ?,
          ?,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `)
      .bind(
        userId,
        cashbackAmount,
        balanceBefore,
        balanceAfter,
        `Cashback for completed order ${order.order_number}`,
        `کش‌بک سفارش ${order.order_number}`,
        orderId,
        order.order_number,
        String(orderId),
        actorUserId || null
      ),

    db
      .prepare(`
        UPDATE orders
        SET
          cashback_status =
            'completed',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(orderId)
  ]);

  return {
    applied: true,
    amount:
      cashbackAmount
  };
}

async function reverseCashbackIfNeeded(
  db,
  order,
  actorUserId
) {
  const orderId =
    Number(
      order?.id || 0
    );

  const userId =
    Number(
      order?.user_id || 0
    );

  const cashbackAmount =
    Math.max(
      0,
      Math.round(
        normalizeNumber(
          order?.cashback_amount
        )
      )
    );

  if (
    !orderId ||
    !userId ||
    cashbackAmount <= 0
  ) {
    return {
      reversed: false,
      reason:
        "no_cashback"
    };
  }

  if (
    String(
      order.cashback_status ||
        ""
    ).toLowerCase() !==
    "completed"
  ) {
    return {
      reversed: false,
      reason:
        "not_completed"
    };
  }

  const alreadyReversed =
    await hasCashbackReversalTx(
      db,
      userId,
      orderId
    );

  if (alreadyReversed) {
    await db
      .prepare(`
        UPDATE orders
        SET
          cashback_status =
            'reversed',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(orderId)
      .run();

    return {
      reversed: false,
      reason:
        "already_reversed"
    };
  }

  const cashbackExists =
    await hasCompletedCashbackTx(
      db,
      userId,
      orderId
    );

  if (!cashbackExists) {
    await db
      .prepare(`
        UPDATE orders
        SET
          cashback_status =
            'none',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(orderId)
      .run();

    return {
      reversed: false,
      reason:
        "cashback_tx_missing"
    };
  }

  const user =
    await db
      .prepare(`
        SELECT
          id,
          COALESCE(
            wallet_balance,
            0
          ) AS wallet_balance
        FROM users
        WHERE id = ?
        LIMIT 1
      `)
      .bind(userId)
      .first();

  if (!user) {
    return {
      reversed: false,
      reason:
        "user_not_found"
    };
  }

  const balanceBefore =
    Math.max(
      0,
      normalizeNumber(
        user.wallet_balance
      )
    );

  const reversalAmount =
    Math.min(
      balanceBefore,
      cashbackAmount
    );

  const balanceAfter =
    Math.max(
      0,
      balanceBefore -
        reversalAmount
    );

  await db.batch([
    db
      .prepare(`
        UPDATE users
        SET
          wallet_balance = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        balanceAfter,
        userId
      ),

    db
      .prepare(`
        INSERT INTO wallet_transactions (
          user_id,
          type,
          amount,
          balance_before,
          balance_after,
          status,
          source,
          description,
          note,
          order_id,
          order_number,
          reference_type,
          reference_id,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (
          ?,
          'debit',
          ?,
          ?,
          ?,
          'completed',
          'cashback_reversal',
          ?,
          ?,
          ?,
          ?,
          'order',
          ?,
          ?,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `)
      .bind(
        userId,
        reversalAmount,
        balanceBefore,
        balanceAfter,
        `Cashback reversal for order ${order.order_number}`,
        `برگشت کش‌بک سفارش ${order.order_number}`,
        orderId,
        order.order_number,
        String(orderId),
        actorUserId || null
      ),

    db
      .prepare(`
        UPDATE orders
        SET
          cashback_status =
            'reversed',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(orderId)
  ]);

  return {
    reversed: true,
    amount:
      reversalAmount
  };
}

// ============================================
// Canonical Statuses
// ============================================

const ALLOWED_STATUSES = [
  "payment_pending",
  "payment_success",
  "payment_failed",
  "order_confirmed",
  "courier_delivery",
  "bus_shipping",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "returned"
];

function getPaymentStatusForOrderStatus(
  status,
  currentPaymentStatus = "pending"
) {
  const statusMap = {
    payment_pending:
      "pending",

    payment_success:
      "paid",

    payment_failed:
      "failed",

    order_confirmed:
      "paid",

    courier_delivery:
      "paid",

    bus_shipping:
      "paid",

    shipped:
      "paid",

    delivered:
      "paid",

    completed:
      "paid",

    cancelled:
      currentPaymentStatus,

    returned:
      currentPaymentStatus
  };

  return (
    statusMap[status] ||
    "pending"
  );
}

// ============================================
// Build Order Response
// ============================================

function buildOrderResponse(
  order,
  items
) {
  const shippingAddress =
    order.address_id
      ? {
          full_name:
            order.address_full_name ||
            "",

          address_line:
            order.address_line ||
            "",

          postal_code:
            order.postal_code ||
            "",

          phone:
            order.address_phone ||
            "",

          city:
            order.address_city ||
            "",

          state:
            order.address_state ||
            ""
        }
      : null;

  const payableAmount =
    Math.max(
      0,
      normalizeNumber(
        order.total_amount
      ) -
        normalizeNumber(
          order.wallet_used_amount
        )
    );

  return {
    id:
      Number(
        order.id || 0
      ),

    order_number:
      order.order_number ||
      "",

    status:
      order.status ||
      "payment_pending",

    payment_status:
      order.payment_status ||
      "pending",

    subtotal_amount:
      normalizeNumber(
        order.subtotal_amount
      ),

    shipping_amount:
      normalizeNumber(
        order.shipping_amount
      ),

    total_amount:
      normalizeNumber(
        order.total_amount
      ),

    wallet_used_amount:
      normalizeNumber(
        order.wallet_used_amount
      ),

    payable_amount:
      payableAmount,

    cashback_amount:
      normalizeNumber(
        order.cashback_amount
      ),

    cashback_status:
      order.cashback_status ||
      "none",

    notes:
      order.notes ||
      "",

    created_at:
      order.created_at ||
      null,

    updated_at:
      order.updated_at ||
      null,

    full_name:
      order.full_name ||
      "",

    email:
      order.email ||
      "",

    phone:
      order.phone ||
      "",

    items_count:
      items.length,

    items,

    shipping_address:
      shippingAddress,

    address:
      shippingAddress
  };
}

// ============================================
// GET - جزئیات سفارش
// ============================================

export async function onRequestGet(
  context
) {
  try {
    const auth =
      await getMobileUser(
        context
      );

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    const orderNumber =
      decodeURIComponent(
        context.params?.order ||
          ""
      ).trim();

    if (!orderNumber) {
      return json(
        {
          success: false,
          error:
            "order_number_required"
        },
        400
      );
    }

    const order =
      await getOrderByNumber(
        context.env.DB,
        orderNumber
      );

    if (!order) {
      return json(
        {
          success: false,
          error:
            "order_not_found"
        },
        404
      );
    }

    const items =
      await getOrderItems(
        context.env.DB,
        order.id
      );

    return json({
      success: true,
      order:
        buildOrderResponse(
          order,
          items
        )
    });
  } catch (error) {
    console.error(
      "Mobile order details GET error:",
      error
    );

    return json(
      {
        success: false,
        error:
          String(
            error?.message ||
              error
          )
      },
      500
    );
  }
}

// ============================================
// POST - تغییر وضعیت سفارش
// ============================================

export async function onRequestPost(
  context
) {
  try {
    const auth =
      await getMobileUser(
        context
      );

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    const body =
      await context.request
        .json()
        .catch(
          () => null
        );

    const orderNumber =
      normalizeText(
        context.params?.order ||
          body?.order_number ||
          ""
      );

    const nextStatus =
      normalizeText(
        body?.status
      ).toLowerCase();

    if (!orderNumber) {
      return json(
        {
          success: false,
          error:
            "order_number_required"
        },
        400
      );
    }

    if (
      !nextStatus ||
      !ALLOWED_STATUSES.includes(
        nextStatus
      )
    ) {
      return json(
        {
          success: false,
          error:
            "invalid_order_status",
          allowed:
            ALLOWED_STATUSES
        },
        400
      );
    }

    const currentOrder =
      await getOrderByNumber(
        context.env.DB,
        orderNumber
      );

    if (!currentOrder) {
      return json(
        {
          success: false,
          error:
            "order_not_found"
        },
        404
      );
    }

    const oldStatus =
      String(
        currentOrder.status ||
          "payment_pending"
      ).toLowerCase();

    const oldPaymentStatus =
      String(
        currentOrder.payment_status ||
          "pending"
      ).toLowerCase();

    const finalStatus =
      nextStatus;

    const finalPaymentStatus =
      getPaymentStatusForOrderStatus(
        finalStatus,
        oldPaymentStatus
      );

    // ======================================
    // Update order
    // ======================================

    await context.env.DB
      .prepare(`
        UPDATE orders
        SET
          status = ?,
          payment_status = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        finalStatus,
        finalPaymentStatus,
        currentOrder.id
      )
      .run();

    // ======================================
    // Restore stock on first cancellation
    // ======================================

    let stockRestoreResult =
      null;

    if (
      oldStatus !== "cancelled" &&
      finalStatus === "cancelled"
    ) {
      stockRestoreResult =
        await restoreProductStock(
          context.env.DB,
          currentOrder.id
        );

      if (
        !stockRestoreResult.success
      ) {
        return json(
          {
            success: false,
            error:
              stockRestoreResult.error ||
              "stock_restore_failed",

            product_id:
              stockRestoreResult.product_id ||
              null
          },
          500
        );
      }
    }

    // ======================================
    // Cashback
    // ======================================

    const updatedOrder =
      await getOrderByNumber(
        context.env.DB,
        orderNumber
      );

    let cashbackResult =
      null;

    if (
      finalStatus ===
      "completed"
    ) {
      cashbackResult =
        await applyCashbackIfNeeded(
          context.env.DB,
          updatedOrder,
          auth.user.id
        );
    } else if (
      finalStatus !==
        "completed" &&
      String(
        updatedOrder.cashback_status ||
          ""
      ).toLowerCase() ===
        "completed"
    ) {
      cashbackResult =
        await reverseCashbackIfNeeded(
          context.env.DB,
          updatedOrder,
          auth.user.id
        );
    }

    const finalOrder =
      await getOrderByNumber(
        context.env.DB,
        orderNumber
      );

    const items =
      await getOrderItems(
        context.env.DB,
        finalOrder.id
      );

    const payableAmount =
      Math.max(
        0,
        normalizeNumber(
          finalOrder.total_amount
        ) -
          normalizeNumber(
            finalOrder.wallet_used_amount
          )
      );

    // ======================================
    // Notifications
    // ======================================

    let notificationResults = {
      admin: null,
      user: null,
      adminSuccess: false,
      userSuccess: false
    };

    try {
      let baseUrl = "";

      try {
        const urlResult =
          await context.env.DB
            .prepare(`
              SELECT setting_value
              FROM app_settings
              WHERE setting_key =
                'site_base_url'
              LIMIT 1
            `)
            .first();

        if (urlResult) {
          baseUrl =
            urlResult.setting_value ||
            "";
        }
      } catch (_) {
        baseUrl = "";
      }

      if (!baseUrl) {
        const requestUrl =
          new URL(
            context.request.url
          );

        baseUrl =
          `${requestUrl.protocol}//${requestUrl.host}`;
      }

      const orderData = {
        orderId:
          finalOrder.id,

        orderNumber:
          finalOrder.order_number,

        totalAmount:
          normalizeNumber(
            finalOrder.total_amount
          ),

        shippingAmount:
          normalizeNumber(
            finalOrder.shipping_amount
          ),

        walletUsedAmount:
          normalizeNumber(
            finalOrder.wallet_used_amount
          ),

        payableAmount,

        cashbackAmount:
          normalizeNumber(
            finalOrder.cashback_amount
          ),

        status:
          finalStatus,

        paymentStatus:
          finalPaymentStatus,

        createdAt:
          finalOrder.created_at ||
          new Date().toISOString()
      };

      const userData = {
        id:
          finalOrder.user_id,

        fullName:
          finalOrder.full_name ||
          "",

        email:
          finalOrder.email ||
          "",

        phone:
          finalOrder.phone ||
          ""
      };

      // --------------------------------------
      // تغییر وضعیت
      // --------------------------------------

      if (
        finalStatus !==
        oldStatus
      ) {
        if (
          finalStatus ===
          "cancelled"
        ) {
          let refundAmount = 0;

          if (
            finalPaymentStatus ===
              "paid" ||
            finalPaymentStatus ===
              "completed"
          ) {
            refundAmount =
              payableAmount;
          }

          try {
            notificationResults.admin =
              await sendOrderCancelledNotification(
                context.env,
                orderData,
                userData,
                refundAmount
              );

            if (
              notificationResults.admin
                ?.success
            ) {
              notificationResults.adminSuccess =
                true;
            }

            notificationResults.user =
              await sendUserOrderCancelledNotification(
                context.env,
                orderData,
                userData,
                refundAmount,
                baseUrl
              );

            if (
              notificationResults.user
                ?.success
            ) {
              notificationResults.userSuccess =
                true;
            }
          } catch (
            sendError
          ) {
            notificationResults.admin = {
              success: false,
              error:
                String(
                  sendError?.message ||
                    sendError
                )
            };

            notificationResults.user =
              notificationResults.admin;
          }
        } else {
          try {
            notificationResults.admin =
              await sendOrderStatusChangedNotification(
                context.env,
                orderData,
                userData,
                oldStatus,
                finalStatus
              );

            if (
              notificationResults.admin
                ?.success
            ) {
              notificationResults.adminSuccess =
                true;
            }
          } catch (
            sendError
          ) {
            notificationResults.admin = {
              success: false,
              error:
                String(
                  sendError?.message ||
                    sendError
                )
            };
          }
        }
      }

      // --------------------------------------
      // اعلان کاربر
      // --------------------------------------

      if (
        finalStatus !==
          oldStatus &&
        finalStatus !==
          "cancelled"
      ) {
        try {
          notificationResults.user =
            await sendUserOrderStatusChangedNotification(
              context.env,
              orderData,
              userData,
              oldStatus,
              finalStatus,
              "",
              baseUrl
            );

          if (
            notificationResults.user
              ?.success
          ) {
            notificationResults.userSuccess =
              true;
          }
        } catch (
          sendError
        ) {
          notificationResults.user = {
            success: false,
            error:
              String(
                sendError?.message ||
                  sendError
              )
          };
        }
      }

      // --------------------------------------
      // اعلان Cashback
      // --------------------------------------

      if (
        finalStatus ===
          "completed" &&
        cashbackResult?.applied
      ) {
        try {
          const userWallet =
            await context.env.DB
              .prepare(`
                SELECT
                  wallet_balance
                FROM users
                WHERE id = ?
                LIMIT 1
              `)
              .bind(
                finalOrder.user_id
              )
              .first();

          const cashbackOrderData = {
            orderId:
              finalOrder.id,

            orderNumber:
              finalOrder.order_number,

            status:
              finalStatus,

            createdAt:
              finalOrder.created_at ||
              new Date().toISOString()
          };

          const cashbackUserData = {
            id:
              finalOrder.user_id,

            fullName:
              finalOrder.full_name ||
              "",

            email:
              finalOrder.email ||
              "",

            phone:
              finalOrder.phone ||
              ""
          };

          await sendCashbackAppliedNotification(
            context.env,
            cashbackOrderData,
            cashbackUserData,
            cashbackResult.amount,
            userWallet?.wallet_balance ||
              0
          );
        } catch (
          cashbackError
        ) {
          console.error(
            "Mobile cashback notification error:",
            cashbackError
          );
        }
      }
    } catch (
      notificationError
    ) {
      console.error(
        "Mobile notification error:",
        notificationError
      );
    }

    return json({
      success: true,

      message:
        "order_updated",

      stock_restore_result:
        stockRestoreResult,

      cashback_result:
        cashbackResult,

      notification_results: {
        admin_sent:
          notificationResults.adminSuccess,

        user_sent:
          notificationResults.userSuccess
      },

      order:
        buildOrderResponse(
          finalOrder,
          items
        )
    });
  } catch (error) {
    console.error(
      "Mobile order details POST error:",
      error
    );

    return json(
      {
        success: false,
        error:
          String(
            error?.message ||
              error
          )
      },
      500
    );
  }
}