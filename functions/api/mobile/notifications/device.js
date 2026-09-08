// ============================================
// mobile/notifications/device.js
// ثبت و مدیریت دستگاه Notification اپ مدیریت Android
// مستقل از Telegram / Email / SMS / Web Push
// ============================================

import {
  getMobileUser,
  mobileUnauthorized
} from "../../../lib/mobile-auth";

// ============================================
// Response helper
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

// ============================================
// Helpers
// ============================================

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizePlatform(value) {
  return normalizeText(value).toLowerCase();
}

function isValidDeviceId(value) {
  return (
    value.length >= 8 &&
    value.length <= 255
  );
}

function isValidPushToken(value) {
  return (
    value.length >= 10 &&
    value.length <= 4096
  );
}

function isValidAppVersion(value) {
  return (
    !value ||
    value.length <= 50
  );
}

function isValidDeviceName(value) {
  return (
    !value ||
    value.length <= 255
  );
}

// ============================================
// POST
// ثبت یا به‌روزرسانی دستگاه Android
// ============================================

export async function onRequestPost(
  context
) {
  try {
    // ==========================================
    // احراز هویت اپ مدیریت
    // ==========================================

    const auth =
      await getMobileUser(
        context
      );

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    // ==========================================
    // فقط Admin / Super Admin
    // ==========================================

    const userId =
      Number(
        auth.user?.id || 0
      );

    if (!userId) {
      return json(
        {
          success: false,
          error:
            "شناسه مدیر معتبر نیست."
        },
        403
      );
    }

    // ==========================================
    // دریافت Body
    // ==========================================

    const body =
      await context.request
        .json()
        .catch(
          () => null
        );

    if (!body) {
      return json(
        {
          success: false,
          error:
            "اطلاعات ارسال‌شده معتبر نیست."
        },
        400
      );
    }

    const deviceId =
      normalizeText(
        body.device_id
      );

    const pushToken =
      normalizeText(
        body.push_token
      );

    const platform =
      normalizePlatform(
        body.platform ||
          "android"
      );

    const deviceName =
      normalizeText(
        body.device_name
      );

    const appVersion =
      normalizeText(
        body.app_version
      );

    // ==========================================
    // اعتبارسنجی
    // ==========================================

    if (!deviceId) {
      return json(
        {
          success: false,
          error:
            "device_id الزامی است."
        },
        400
      );
    }

    if (!isValidDeviceId(deviceId)) {
      return json(
        {
          success: false,
          error:
            "device_id معتبر نیست."
        },
        400
      );
    }

    if (!pushToken) {
      return json(
        {
          success: false,
          error:
            "push_token الزامی است."
        },
        400
      );
    }

    if (!isValidPushToken(pushToken)) {
      return json(
        {
          success: false,
          error:
            "push_token معتبر نیست."
        },
        400
      );
    }

    if (
      platform !==
      "android"
    ) {
      return json(
        {
          success: false,
          error:
            "این endpoint فقط برای Android است."
        },
        400
      );
    }

    if (
      !isValidDeviceName(
        deviceName
      )
    ) {
      return json(
        {
          success: false,
          error:
            "نام دستگاه بیش از حد طولانی است."
        },
        400
      );
    }

    if (
      !isValidAppVersion(
        appVersion
      )
    ) {
      return json(
        {
          success: false,
          error:
            "نسخه برنامه معتبر نیست."
        },
        400
      );
    }

    const userAgent =
      context.request.headers.get(
        "user-agent"
      ) || "";

    // ==========================================
    // بررسی دستگاه موجود بر اساس device_id
    // ==========================================

    const existingByDevice =
      await context.env.DB
        .prepare(`
          SELECT
            id,
            user_id,
            device_id,
            push_token,
            platform,
            device_name,
            app_version,
            is_active
          FROM admin_mobile_devices
          WHERE device_id = ?
          LIMIT 1
        `)
        .bind(
          deviceId
        )
        .first();

    // ==========================================
    // اگر دستگاه قبلاً ثبت شده
    // ==========================================

    if (
      existingByDevice
    ) {
      // ----------------------------------------
      // دستگاه متعلق به مدیر دیگری است
      // ----------------------------------------

      if (
        Number(
          existingByDevice.user_id
        ) !== userId
      ) {
        return json(
          {
            success: false,
            error:
              "این دستگاه قبلاً برای حساب مدیریت دیگری ثبت شده است."
          },
          409
        );
      }

      // ----------------------------------------
      // به‌روزرسانی دستگاه
      // ----------------------------------------

      try {
        await context.env.DB
          .prepare(`
            UPDATE admin_mobile_devices
            SET
              push_token = ?,
              platform = ?,
              device_name = ?,
              app_version = ?,
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP,
              last_used_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(
            pushToken,
            platform,
            deviceName || null,
            appVersion || null,
            Number(
              existingByDevice.id
            )
          )
          .run();
      } catch (error) {
        // --------------------------------------
        // جلوگیری از Conflict توکن
        // --------------------------------------

        if (
          String(
            error?.message ||
            ""
          )
            .toLowerCase()
            .includes(
              "unique"
            )
        ) {
          return json(
            {
              success: false,
              error:
                "این Push Token قبلاً برای دستگاه دیگری ثبت شده است."
            },
            409
          );
        }

        throw error;
      }

      return json({
        success: true,
        mode: "update",
        message:
          "دستگاه اعلان Android با موفقیت به‌روزرسانی شد.",
        device: {
          id:
            Number(
              existingByDevice.id
            ),

          user_id:
            userId,

          device_id:
            deviceId,

          platform,

          device_name:
            deviceName || null,

          app_version:
            appVersion || null,

          is_active:
            true
        }
      });
    }

    // ==========================================
    // بررسی Push Token موجود
    // ==========================================

    const existingByToken =
      await context.env.DB
        .prepare(`
          SELECT
            id,
            user_id,
            device_id,
            is_active
          FROM admin_mobile_devices
          WHERE push_token = ?
          LIMIT 1
        `)
        .bind(
          pushToken
        )
        .first();

    if (
      existingByToken
    ) {
      // ----------------------------------------
      // اگر توکن متعلق به همین مدیر باشد
      // دستگاه را با device_id جدید به‌روزرسانی کن
      // ----------------------------------------

      if (
        Number(
          existingByToken.user_id
        ) === userId
      ) {
        await context.env.DB
          .prepare(`
            UPDATE admin_mobile_devices
            SET
              device_id = ?,
              platform = ?,
              device_name = ?,
              app_version = ?,
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP,
              last_used_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(
            deviceId,
            platform,
            deviceName || null,
            appVersion || null,
            Number(
              existingByToken.id
            )
          )
          .run();

        return json({
          success: true,
          mode: "update_token",
          message:
            "Push Token دستگاه با موفقیت به‌روزرسانی شد.",
          device: {
            id:
              Number(
                existingByToken.id
              ),

            user_id:
              userId,

            device_id:
              deviceId,

            platform,

            device_name:
              deviceName || null,

            app_version:
              appVersion || null,

            is_active:
              true
          }
        });
      }

      // ----------------------------------------
      // توکن متعلق به مدیر دیگر
      // ----------------------------------------

      return json(
        {
          success: false,
          error:
            "این Push Token قبلاً برای حساب مدیریت دیگری ثبت شده است."
        },
        409
      );
    }

    // ==========================================
    // ایجاد دستگاه جدید
    // ==========================================

    const insertResult =
      await context.env.DB
        .prepare(`
          INSERT INTO admin_mobile_devices (
            user_id,
            device_id,
            push_token,
            platform,
            device_name,
            app_version,
            is_active,
            created_at,
            updated_at,
            last_used_at
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `)
        .bind(
          userId,
          deviceId,
          pushToken,
          platform,
          deviceName || null,
          appVersion || null
        )
        .run();

    const deviceIdDb =
      Number(
        insertResult?.meta
          ?.last_row_id ||
          0
      );

    // ==========================================
    // ثبت موفق
    // ==========================================

    return json(
      {
        success: true,

        mode: "create",

        message:
          "دستگاه اعلان Android با موفقیت ثبت شد.",

        device: {
          id:
            deviceIdDb,

          user_id:
            userId,

          device_id:
            deviceId,

          platform,

          device_name:
            deviceName || null,

          app_version:
            appVersion || null,

          is_active:
            true
        }
      },
      201
    );

  } catch (error) {
    console.error(
      "Mobile Android notification device registration error:",
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
// DELETE
// غیرفعال کردن دستگاه فعلی
// ============================================

export async function onRequestDelete(
  context
) {
  try {
    // ==========================================
    // احراز هویت
    // ==========================================

    const auth =
      await getMobileUser(
        context
      );

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    const userId =
      Number(
        auth.user?.id || 0
      );

    if (!userId) {
      return json(
        {
          success: false,
          error:
            "شناسه مدیر معتبر نیست."
        },
        403
      );
    }

    // ==========================================
    // Body
    // ==========================================

    const body =
      await context.request
        .json()
        .catch(
          () => null
        );

    const deviceId =
      normalizeText(
        body?.device_id
      );

    if (!deviceId) {
      return json(
        {
          success: false,
          error:
            "device_id الزامی است."
        },
        400
      );
    }

    // ==========================================
    // غیرفعال کردن دستگاه
    // ==========================================

    const result =
      await context.env.DB
        .prepare(`
          UPDATE admin_mobile_devices
          SET
            is_active = 0,
            updated_at = CURRENT_TIMESTAMP,
            last_used_at = CURRENT_TIMESTAMP
          WHERE
            device_id = ?
            AND user_id = ?
        `)
        .bind(
          deviceId,
          userId
        )
        .run();

    const affectedRows =
      Number(
        result?.meta
          ?.changes ||
          0
      );

    return json({
      success: true,

      message:
        affectedRows > 0
          ? "دستگاه اعلان غیرفعال شد."
          : "دستگاه ثبت‌شده‌ای برای غیرفعال‌سازی پیدا نشد.",

      deactivated:
        affectedRows > 0
    });

  } catch (error) {
    console.error(
      "Mobile Android notification device delete error:",
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