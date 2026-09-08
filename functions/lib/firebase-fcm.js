// ============================================
// Firebase FCM Service
// Takdaro Site
//
// وظایف:
// 1. خواندن Firebase Service Account از Secret
// 2. ساخت OAuth 2.0 Access Token
// 3. ارسال Notification با FCM HTTP v1
// 4. ارسال به تمام دستگاه‌های فعال ادمین
// 5. ثبت Log در admin_mobile_notification_logs
// 6. غیرفعال کردن Device Tokenهای منقضی/نامعتبر
//
// Secret مورد نیاز Cloudflare:
// FIREBASE_SERVICE_ACCOUNT
//
// این فایل مستقل از:
// Telegram / SMS / Email / Web Push
// ============================================

// ============================================
// Constants
// ============================================

const GOOGLE_OAUTH_TOKEN_URL =
  'https://oauth2.googleapis.com/token';

const FIREBASE_MESSAGING_SCOPE =
  'https://www.googleapis.com/auth/firebase.messaging';

const ACCESS_TOKEN_CACHE_TTL_MS =
  50 * 60 * 1000;

const ACCESS_TOKEN_SKEW_SECONDS =
  60;

// Cache فقط در همان isolate نگه داشته می‌شود.
// در صورت اجرای isolate جدید، Token دوباره ساخته می‌شود.
let accessTokenCache = {
  accessToken: '',
  expiresAt: 0,
  projectId: '',
};

// ============================================
// Helpers
// ============================================

function asString(value) {
  return String(value ?? '');
}

function normalizeText(value) {
  return asString(value).trim();
}

function getErrorMessage(error) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    const message = error.message;

    if (
      typeof message === 'string' &&
      message.trim()
    ) {
      return message;
    }
  }

  return String(
    error || 'خطای ناشناخته'
  );
}

function jsonStringifySafe(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

// ============================================
// Base64URL
// ============================================

function base64UrlEncodeBytes(bytes) {
  let binary = '';

  const chunkSize = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        Math.min(
          i + chunkSize,
          bytes.length
        )
      )
    );
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlEncodeString(value) {
  const bytes =
    new TextEncoder().encode(
      value
    );

  return base64UrlEncodeBytes(
    bytes
  );
}

function base64UrlDecodeToBytes(value) {
  const normalized =
    value
      .replace(/-/g, '+')
      .replace(/_/g, '/');

  const padded =
    normalized +
    '='.repeat(
      (4 -
        (normalized.length % 4)) %
        4
    );

  const binary =
    atob(padded);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}

// ============================================
// PEM -> DER
// ============================================

function pemToArrayBuffer(
  pem
) {
  const normalized =
    String(pem)
      .replace(
        /-----BEGIN PRIVATE KEY-----/g,
        ''
      )
      .replace(
        /-----END PRIVATE KEY-----/g,
        ''
      )
      .replace(
        /\s+/g,
        ''
      );

  if (!normalized) {
    throw new Error(
      'private_key در Firebase Service Account خالی است.'
    );
  }

  const bytes =
    base64UrlDecodeToBytes(
      normalized
    );

  return bytes.buffer;
}

// ============================================
// خواندن Firebase Service Account
// ============================================

function getFirebaseServiceAccount(
  env
) {
  const raw =
    normalizeText(
      env?.FIREBASE_SERVICE_ACCOUNT
    );

  if (!raw) {
    throw new Error(
      'Secret به نام FIREBASE_SERVICE_ACCOUNT در Cloudflare پیدا نشد.'
    );
  }

  let serviceAccount;

  try {
    serviceAccount =
      JSON.parse(raw);
  } catch {
    throw new Error(
      'مقدار FIREBASE_SERVICE_ACCOUNT یک JSON معتبر نیست.'
    );
  }

  const projectId =
    normalizeText(
      serviceAccount?.project_id
    );

  const clientEmail =
    normalizeText(
      serviceAccount?.client_email
    );

  const privateKey =
    normalizeText(
      serviceAccount?.private_key
    );

  if (!projectId) {
    throw new Error(
      'project_id در Firebase Service Account وجود ندارد.'
    );
  }

  if (!clientEmail) {
    throw new Error(
      'client_email در Firebase Service Account وجود ندارد.'
    );
  }

  if (!privateKey) {
    throw new Error(
      'private_key در Firebase Service Account وجود ندارد.'
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

// ============================================
// Import RSA Private Key
// ============================================

async function importServiceAccountPrivateKey(
  privateKeyPem
) {
  const keyData =
    pemToArrayBuffer(
      privateKeyPem
    );

  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name:
        'RSASSA-PKCS1-v1_5',
      hash:
        'SHA-256',
    },
    false,
    ['sign']
  );
}

// ============================================
// ساخت Service Account JWT
// ============================================

async function createServiceAccountJwt(
  serviceAccount
) {
  const privateKey =
    await importServiceAccountPrivateKey(
      serviceAccount.privateKey
    );

  const now =
    Math.floor(
      Date.now() / 1000
    );

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss:
      serviceAccount.clientEmail,

    scope:
      FIREBASE_MESSAGING_SCOPE,

    aud:
      GOOGLE_OAUTH_TOKEN_URL,

    iat:
      now,

    exp:
      now + 3600,
  };

  const encodedHeader =
    base64UrlEncodeString(
      JSON.stringify(header)
    );

  const encodedPayload =
    base64UrlEncodeString(
      JSON.stringify(payload)
    );

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`;

  const signature =
    await crypto.subtle.sign(
      {
        name:
          'RSASSA-PKCS1-v1_5',
      },
      privateKey,
      new TextEncoder().encode(
        unsignedToken
      )
    );

  const encodedSignature =
    base64UrlEncodeBytes(
      new Uint8Array(
        signature
      )
    );

  return `${unsignedToken}.${encodedSignature}`;
}

// ============================================
// دریافت OAuth Access Token
// ============================================

async function getFirebaseAccessToken(
  env
) {
  const serviceAccount =
    getFirebaseServiceAccount(
      env
    );

  const now =
    Date.now();

  if (
    accessTokenCache.accessToken &&
    accessTokenCache.projectId ===
      serviceAccount.projectId &&
    accessTokenCache.expiresAt >
      now +
        ACCESS_TOKEN_SKEW_SECONDS *
          1000
  ) {
    return {
      accessToken:
        accessTokenCache.accessToken,

      projectId:
        serviceAccount.projectId,
    };
  }

  const assertion =
    await createServiceAccountJwt(
      serviceAccount
    );

  const body =
    new URLSearchParams();

  body.set(
    'grant_type',
    'urn:ietf:params:oauth:grant-type:jwt-bearer'
  );

  body.set(
    'assertion',
    assertion
  );

  const response =
    await fetch(
      GOOGLE_OAUTH_TOKEN_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',

          Accept:
            'application/json',
        },

        body:
          body.toString(),
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok ||
    !data?.access_token
  ) {
    const errorDescription =
      data?.error_description ||
      data?.error ||
      `HTTP ${response.status}`;

    throw new Error(
      `دریافت Firebase Access Token ناموفق بود: ${errorDescription}`
    );
  }

  const expiresIn =
    Number(
      data.expires_in || 3600
    );

  accessTokenCache = {
    accessToken:
      String(
        data.access_token
      ),

    expiresAt:
      now +
      Math.max(
        60,
        expiresIn - 60
      ) *
        1000,

    projectId:
      serviceAccount.projectId,
  };

  return {
    accessToken:
      accessTokenCache.accessToken,

    projectId:
      serviceAccount.projectId,
  };
}

// ============================================
// ثبت Log
// ============================================

async function createNotificationLog(
  env,
  {
    deviceId,
    userId,
    eventType,
    title,
    body,
    data,
    status = 'pending',
    errorMessage = null,
    orderId = null,
  }
) {
  try {
    const result =
      await env.DB
        .prepare(`
          INSERT INTO admin_mobile_notification_logs (
            device_id,
            user_id,
            event_type,
            title,
            body,
            data,
            status,
            error_message,
            order_id,
            created_at
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            CURRENT_TIMESTAMP
          )
        `)
        .bind(
          deviceId || null,
          userId || null,
          eventType ||
            'notification',
          title || null,
          body || null,
          jsonStringifySafe(
            data
          ),
          status,
          errorMessage ||
            null,
          orderId || null
        )
        .run();

    return Number(
      result?.meta
        ?.last_row_id || 0
    );
  } catch (error) {
    console.error(
      'FCM createNotificationLog error:',
      getErrorMessage(
        error
      )
    );

    return 0;
  }
}

// ============================================
// به‌روزرسانی Log
// ============================================

async function updateNotificationLog(
  env,
  logId,
  {
    status,
    errorMessage = null,
  }
) {
  if (!logId) {
    return;
  }

  try {
    await env.DB
      .prepare(`
        UPDATE admin_mobile_notification_logs
        SET
          status = ?,
          error_message = ?,
          sent_at = CASE
            WHEN ? = 'sent'
            THEN CURRENT_TIMESTAMP
            ELSE sent_at
          END
        WHERE id = ?
      `)
      .bind(
        status,
        errorMessage ||
          null,
        status,
        logId
      )
      .run();
  } catch (error) {
    console.error(
      'FCM updateNotificationLog error:',
      getErrorMessage(
        error
      )
    );
  }
}

// ============================================
// غیرفعال کردن Device
// ============================================

async function deactivateDevice(
  env,
  deviceId
) {
  if (!deviceId) {
    return;
  }

  try {
    await env.DB
      .prepare(`
        UPDATE admin_mobile_devices
        SET
          is_active = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        deviceId
      )
      .run();
  } catch (error) {
    console.error(
      'FCM deactivateDevice error:',
      getErrorMessage(
        error
      )
    );
  }
}

// ============================================
// به‌روزرسانی استفاده از Device
// ============================================

async function touchDevice(
  env,
  deviceId
) {
  if (!deviceId) {
    return;
  }

  try {
    await env.DB
      .prepare(`
        UPDATE admin_mobile_devices
        SET
          last_used_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        deviceId
      )
      .run();
  } catch (error) {
    console.error(
      'FCM touchDevice error:',
      getErrorMessage(
        error
      )
    );
  }
}

// ============================================
// ساخت Payload
// ============================================

function normalizeFcmData(
  data
) {
  if (
    !data ||
    typeof data !== 'object'
  ) {
    return {};
  }

  const result = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      data
    )
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      continue;
    }

    result[
      String(key)
    ] = String(value);
  }

  return result;
}

// ============================================
// ارسال به یک Device Token
// ============================================

async function sendToDevice(
  env,
  {
    accessToken,
    projectId,
    device,
    title,
    body,
    data,
    eventType,
    orderId,
  }
) {
  const deviceDbId =
    Number(
      device?.id || 0
    );

  const userId =
    Number(
      device?.user_id || 0
    );

  const pushToken =
    normalizeText(
      device?.push_token
    );

  if (
    !deviceDbId ||
    !pushToken
  ) {
    return {
      success: false,
      skipped: true,
      device_id:
        deviceDbId,
      error:
        'Device یا Push Token معتبر نیست.',
    };
  }

  const logId =
    await createNotificationLog(
      env,
      {
        deviceId:
          deviceDbId,

        userId:
          userId || null,

        eventType:
          eventType ||
          'notification',

        title:
          title || null,

        body:
          body || null,

        data:
          normalizeFcmData(
            data
          ),

        status:
          'pending',

        orderId:
          orderId || null,
      }
    );

  const endpoint =
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/messages:send`;

  const payload = {
    message: {
      token:
        pushToken,

      notification: {
        title:
          title || '',

        body:
          body || '',
      },

      data:
        normalizeFcmData(
          data
        ),

      android: {
        priority:
          'high',

        notification: {
          channel_id:
            'takdaro_admin_orders',

          sound:
            'default',

          default_vibrate_timings:
            true,
        },
      },
    },
  };

  try {
    const response =
      await fetch(
        endpoint,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Content-Type':
              'application/json',

            Accept:
              'application/json',
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    const responseData =
      await response
        .json()
        .catch(
          () => null
        );

    // ----------------------------------------
    // موفق
    // ----------------------------------------

    if (
      response.ok &&
      responseData?.name
    ) {
      await updateNotificationLog(
        env,
        logId,
        {
          status:
            'sent',
        }
      );

      await touchDevice(
        env,
        deviceDbId
      );

      return {
        success: true,

        device_id:
          deviceDbId,

        user_id:
          userId || null,

        log_id:
          logId,

        message_name:
          responseData.name,
      };
    }

    // ----------------------------------------
    // تشخیص Token نامعتبر / منقضی
    // ----------------------------------------

    const responseText =
      JSON.stringify(
        responseData || {}
      );

    const isInvalidToken =
      responseText.includes(
        'UNREGISTERED'
      ) ||
      responseText.includes(
        'registration-token-not-registered'
      );

    const isInvalidArgument =
      responseText.includes(
        'INVALID_ARGUMENT'
      );

    const errorMessage =
      responseData?.error
        ?.message ||
      responseData?.error
        ?.status ||
      responseText ||
      `HTTP ${response.status}`;

    await updateNotificationLog(
      env,
      logId,
      {
        status:
          'failed',

        errorMessage:
          String(
            errorMessage
          ),
      }
    );

    if (
      isInvalidToken
    ) {
      await deactivateDevice(
        env,
        deviceDbId
      );
    }

    return {
      success: false,

      device_id:
        deviceDbId,

      user_id:
        userId || null,

      log_id:
        logId,

      status:
        response.status,

      error:
        String(
          errorMessage
        ),

      invalid_token:
        isInvalidToken,

      invalid_argument:
        isInvalidArgument,
    };
  } catch (error) {
    const errorMessage =
      getErrorMessage(
        error
      );

    await updateNotificationLog(
      env,
      logId,
      {
        status:
          'failed',

        errorMessage,
      }
    );

    return {
      success: false,

      device_id:
        deviceDbId,

      user_id:
        userId || null,

      log_id:
        logId,

      error:
        errorMessage,
    };
  }
}

// ============================================
// ارسال Notification به یک Device
// ============================================

export async function sendFirebaseFcmNotification(
  env,
  {
    deviceId = null,
    userId = null,
    title = '',
    body = '',
    data = {},
    eventType = 'notification',
    orderId = null,
  } = {}
) {
  try {
    const {
      accessToken,
      projectId,
    } =
      await getFirebaseAccessToken(
        env
      );

    let device;

    // ----------------------------------------
    // ارسال به Device مشخص
    // ----------------------------------------

    if (deviceId) {
      device =
        await env.DB
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
            WHERE
              id = ?
              AND is_active = 1
            LIMIT 1
          `)
          .bind(
            Number(
              deviceId
            )
          )
          .first();

      if (!device) {
        return {
          success: false,
          error:
            'دستگاه فعال پیدا نشد.',
          results: [],
        };
      }

      const result =
        await sendToDevice(
          env,
          {
            accessToken,
            projectId,
            device,
            title,
            body,
            data,
            eventType,
            orderId,
          }
        );

      return {
        success:
          result.success,

        project_id:
          projectId,

        results:
          [result],
      };
    }

    // ----------------------------------------
    // ارسال به Deviceهای یک User
    // ----------------------------------------

    if (userId) {
      const devices =
        await env.DB
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
            WHERE
              user_id = ?
              AND platform = 'android'
              AND is_active = 1
            ORDER BY
              id ASC
          `)
          .bind(
            Number(
              userId
            )
          )
          .all();

      const rows =
        Array.isArray(
          devices?.results
        )
          ? devices.results
          : [];

      if (
        rows.length === 0
      ) {
        return {
          success: false,
          error:
            'هیچ دستگاه فعال Android برای این مدیر پیدا نشد.',
          results: [],
        };
      }

      const results =
        await Promise.all(
          rows.map(
            (device) =>
              sendToDevice(
                env,
                {
                  accessToken,
                  projectId,
                  device,
                  title,
                  body,
                  data,
                  eventType,
                  orderId,
                }
              )
          )
        );

      const successCount =
        results.filter(
          (item) =>
            item.success
        ).length;

      return {
        success:
          successCount > 0,

        project_id:
          projectId,

        summary: {
          total:
            results.length,

          success:
            successCount,

          failed:
            results.length -
            successCount,
        },

        results,
      };
    }

    // ----------------------------------------
    // ارسال به تمام Deviceهای فعال Android
    // ----------------------------------------

    const devices =
      await env.DB
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
          WHERE
            platform = 'android'
            AND is_active = 1
          ORDER BY
            id ASC
        `)
        .all();

    const rows =
      Array.isArray(
        devices?.results
      )
        ? devices.results
        : [];

    if (
      rows.length === 0
    ) {
      return {
        success: false,
        error:
          'هیچ دستگاه فعال Android پیدا نشد.',
        results: [],
      };
    }

    const results =
      await Promise.all(
        rows.map(
          (device) =>
            sendToDevice(
              env,
              {
                accessToken,
                projectId,
                device,
                title,
                body,
                data,
                eventType,
                orderId,
              }
            )
        )
      );

    const successCount =
      results.filter(
        (item) =>
          item.success
      ).length;

    return {
      success:
        successCount > 0,

      project_id:
        projectId,

      summary: {
        total:
          results.length,

        success:
          successCount,

        failed:
          results.length -
          successCount,
      },

      results,
    };
  } catch (error) {
    const errorMessage =
      getErrorMessage(
        error
      );

    console.error(
      'Firebase FCM notification error:',
      errorMessage
    );

    return {
      success: false,

      error:
        errorMessage,

      results: [],
    };
  }
}

// ============================================
// ارسال Notification مخصوص ادمین
// ============================================

export async function sendAdminFirebaseFcmNotification(
  env,
  {
    title = 'Takdaro Admin',
    body = '',
    data = {},
    eventType = 'notification',
    orderId = null,
  } = {}
) {
  return sendFirebaseFcmNotification(
    env,
    {
      title,
      body,
      data,
      eventType,
      orderId,
    }
  );
}

// ============================================
// تست اتصال FCM
// ============================================
//
// این تابع Notification آزمایشی را فقط
// به User مشخص ارسال می‌کند.
//

export async function testFirebaseFcmNotification(
  env,
  userId
) {
  return sendFirebaseFcmNotification(
    env,
    {
      userId,

      title:
        '🔔 تست اعلان Takdaro Admin',

      body:
        'اتصال Firebase FCM با موفقیت تست شد.',

      eventType:
        'test',

      data: {
        type:
          'test',

        source:
          'takdaro_admin',
      },
    }
  );
}