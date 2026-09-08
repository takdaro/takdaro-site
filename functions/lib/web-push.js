// ============================================
// Takdaro Web Push Service
// فایل: functions/lib/web-push.js
// بدون وابستگی خارجی - سازگار با Cloudflare Workers
// ============================================

const textEncoder = new TextEncoder();

// ============================================
// Base64URL
// ============================================

function base64UrlToBytes(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding = "=".repeat(
    (4 - (normalized.length % 4)) % 4
  );

  const binary = atob(
    normalized + padding
  );

  const bytes = new Uint8Array(
    binary.length
  );

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function bytesToBase64Url(bytes) {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(
      bytes[i]
    );
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// ============================================
// ترکیب Uint8Arrayها
// ============================================

function concatBytes(...arrays) {
  const length = arrays.reduce(
    (total, array) =>
      total + array.length,
    0
  );

  const result =
    new Uint8Array(length);

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

// ============================================
// اعداد Big Endian
// ============================================

function uint16Bytes(value) {
  return new Uint8Array([
    (value >> 8) & 0xff,
    value & 0xff
  ]);
}

function uint32Bytes(value) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ]);
}

// ============================================
// تبدیل DER ECDSA به JOSE
// ============================================

function derToJose(
  signature,
  size = 32
) {
  const bytes = new Uint8Array(
    signature
  );

  // برخی پیاده‌سازی‌های Web Crypto
  // مستقیماً r || s برمی‌گردانند.
  if (bytes.length === size * 2) {
    return bytes;
  }

  if (bytes[0] !== 0x30) {
    throw new Error(
      "فرمت امضای ECDSA معتبر نیست."
    );
  }

  let offset = 2;

  // طول DER چندبایتی
  if (bytes[1] & 0x80) {
    offset += bytes[1] & 0x7f;
  }

  if (bytes[offset] !== 0x02) {
    throw new Error(
      "امضای ECDSA معتبر نیست."
    );
  }

  const rLength =
    bytes[offset + 1];

  let r = bytes.slice(
    offset + 2,
    offset + 2 + rLength
  );

  offset =
    offset +
    2 +
    rLength;

  if (bytes[offset] !== 0x02) {
    throw new Error(
      "امضای ECDSA معتبر نیست."
    );
  }

  const sLength =
    bytes[offset + 1];

  let s = bytes.slice(
    offset + 2,
    offset + 2 + sLength
  );

  // حذف صفرهای ابتدای عدد
  while (
    r.length > size &&
    r[0] === 0
  ) {
    r = r.slice(1);
  }

  while (
    s.length > size &&
    s[0] === 0
  ) {
    s = s.slice(1);
  }

  const result =
    new Uint8Array(size * 2);

  result.set(
    r.slice(-size),
    size -
      Math.min(size, r.length)
  );

  result.set(
    s.slice(-size),
    size * 2 -
      Math.min(size, s.length)
  );

  return result;
}

// ============================================
// تبدیل کلید خصوصی VAPID به CryptoKey
// ============================================

async function importVapidPrivateKey(
  privateKeyBase64Url
) {
  const privateKeyBytes =
    base64UrlToBytes(
      privateKeyBase64Url
    );

  if (
    privateKeyBytes.length !== 32
  ) {
    throw new Error(
      "VAPID_PRIVATE_KEY باید یک کلید خصوصی P-256 با طول 32 بایت باشد."
    );
  }

  return crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    false,
    ["sign"]
  );
}

// ============================================
// ساخت VAPID JWT
// ============================================

async function createVapidAuthorization(
  endpoint,
  vapidPrivateKey,
  vapidPublicKey,
  vapidSubject
) {
  const endpointUrl =
    new URL(endpoint);

  // audience فقط scheme + host
  const audience =
    `${endpointUrl.protocol}//${endpointUrl.host}`;

  const now =
    Math.floor(Date.now() / 1000);

  const header = {
    typ: "JWT",
    alg: "ES256"
  };

  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: vapidSubject
  };

  const encodedHeader =
    bytesToBase64Url(
      textEncoder.encode(
        JSON.stringify(header)
      )
    );

  const encodedPayload =
    bytesToBase64Url(
      textEncoder.encode(
        JSON.stringify(payload)
      )
    );

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`;

  const privateKey =
    await importVapidPrivateKey(
      vapidPrivateKey
    );

  const signature =
    await crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: "SHA-256"
      },
      privateKey,
      textEncoder.encode(
        unsignedToken
      )
    );

  const joseSignature =
    derToJose(
      signature,
      32
    );

  const jwt =
    `${unsignedToken}.${bytesToBase64Url(
      joseSignature
    )}`;

  return (
    `vapid t=${jwt}, k=${vapidPublicKey}`
  );
}

// ============================================
// HKDF Extract
// ============================================

async function hkdfExtract(
  salt,
  ikm
) {
  const key =
    await crypto.subtle.importKey(
      "raw",
      ikm,
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const result =
    await crypto.subtle.sign(
      "HMAC",
      key,
      salt
    );

  return new Uint8Array(result);
}

// ============================================
// HKDF Expand
// ============================================

async function hkdfExpand(
  prk,
  info,
  length
) {
  const key =
    await crypto.subtle.importKey(
      "raw",
      prk,
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  let previous =
    new Uint8Array(0);

  let output =
    new Uint8Array(0);

  let counter = 1;

  while (
    output.length < length
  ) {
    const input =
      concatBytes(
        previous,
        info,
        new Uint8Array([
          counter
        ])
      );

    const signed =
      await crypto.subtle.sign(
        "HMAC",
        key,
        input
      );

    previous =
      new Uint8Array(signed);

    output =
      concatBytes(
        output,
        previous
      );

    counter++;

    if (counter > 255) {
      throw new Error(
        "HKDF Expand بیش از حد مجاز طولانی شد."
      );
    }
  }

  return output.slice(
    0,
    length
  );
}

// ============================================
// تولید مواد اولیه کلید Web Push
//
// RFC 8291:
// 1. ECDH shared secret
// 2. HKDF-Extract(auth, sharedSecret)
// 3. WebPush info
// ============================================

async function deriveKeyMaterial(
  subscriptionPublicKey,
  authSecret
) {
  const receiverPublicKey =
    base64UrlToBytes(
      subscriptionPublicKey
    );

  const receiverAuthSecret =
    base64UrlToBytes(
      authSecret
    );

  if (
    receiverPublicKey.length !== 65
  ) {
    throw new Error(
      "کلید عمومی Subscription معتبر نیست."
    );
  }

  if (
    receiverAuthSecret.length !== 16
  ) {
    throw new Error(
      "Auth Secret مربوط به Subscription معتبر نیست."
    );
  }

  const receiverKey =
    await crypto.subtle.importKey(
      "raw",
      receiverPublicKey,
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      false,
      []
    );

  const senderKeyPair =
    await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      true,
      ["deriveBits"]
    );

  const sharedSecret =
    await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: receiverKey
      },
      senderKeyPair.privateKey,
      256
    );

  const senderPublicKeyRaw =
    new Uint8Array(
      await crypto.subtle.exportKey(
        "raw",
        senderKeyPair.publicKey
      )
    );

  if (
    senderPublicKeyRaw.length !== 65
  ) {
    throw new Error(
      "کلید عمومی Sender معتبر نیست."
    );
  }

  // WebPush: info\0 ||
  // receiverPublicKey ||
  // senderPublicKey
  const authInfo =
    concatBytes(
      textEncoder.encode(
        "WebPush: info\0"
      ),
      receiverPublicKey,
      senderPublicKeyRaw
    );

  // PRK اولیه
  const ikm =
    await hkdfExtract(
      receiverAuthSecret,
      new Uint8Array(
        sharedSecret
      )
    );

  // keyMaterial همان PRK
  // مرحله اول Web Push
  return {
    ikm,
    receiverPublicKey,
    senderPublicKeyRaw,
    authInfo
  };
}

// ============================================
// رمزنگاری Payload با AES-128-GCM
//
// Content-Encoding: aes128gcm
// ============================================

async function encryptPayload(
  subscription,
  payload
) {
  const subscriptionPublicKey =
    subscription?.p256dh;

  const authSecret =
    subscription?.auth;

  if (
    !subscriptionPublicKey ||
    !authSecret
  ) {
    throw new Error(
      "کلیدهای Push Subscription ناقص هستند."
    );
  }

  const {
    ikm,
    receiverPublicKey,
    senderPublicKeyRaw,
    authInfo
  } =
    await deriveKeyMaterial(
      subscriptionPublicKey,
      authSecret
    );

  // ==========================================
  // Salt تصادفی 16 بایتی
  // ==========================================

  const salt =
    crypto.getRandomValues(
      new Uint8Array(16)
    );

  // ==========================================
  // PRK نهایی
  //
  // این قسمت اصلاح مهم نسخه جدید است:
  // salt واقعاً در HKDF-Extract استفاده می‌شود.
  // ==========================================

  const prk =
    await hkdfExtract(
      salt,
      ikm
    );

  // ==========================================
  // CEK
  // ==========================================

  const cekInfo =
    textEncoder.encode(
      "Content-Encoding: aes128gcm\0"
    );

  const contentEncryptionKey =
    await hkdfExpand(
      prk,
      cekInfo,
      16
    );

  // ==========================================
  // Nonce
  // ==========================================

  const nonceInfo =
    textEncoder.encode(
      "Content-Encoding: nonce\0"
    );

  const nonce =
    await hkdfExpand(
      prk,
      nonceInfo,
      12
    );

  // ==========================================
  // AES-GCM Key
  // ==========================================

  const aesKey =
    await crypto.subtle.importKey(
      "raw",
      contentEncryptionKey,
      {
        name: "AES-GCM"
      },
      false,
      ["encrypt"]
    );

  // ==========================================
  // Payload
  // ==========================================

  const plainPayload =
    textEncoder.encode(
      JSON.stringify(payload)
    );

  // ==========================================
  // Record Padding
  //
  // برای یک Record:
  // payload + delimiter 0x02
  // ==========================================

  const plaintext =
    concatBytes(
      plainPayload,
      new Uint8Array([0x02])
    );

  // ==========================================
  // AES-128-GCM
  // ==========================================

  const encrypted =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        tagLength: 128
      },
      aesKey,
      plaintext
    );

  // ==========================================
  // Record Size
  //
  // مطابق Content-Encoding: aes128gcm
  // ==========================================

  const recordSize = 4096;

  // ==========================================
  // Header
  //
  // salt: 16 bytes
  // rs: 4 bytes
  // keyid length: 1 byte
  // keyid: sender public key (65 bytes)
  // ==========================================

  const header =
    concatBytes(
      salt,
      uint32Bytes(
        recordSize
      ),
      new Uint8Array([
        senderPublicKeyRaw.length
      ]),
      senderPublicKeyRaw
    );

  return concatBytes(
    header,
    new Uint8Array(encrypted)
  );
}

// ============================================
// ثبت لاگ اعلان
// ============================================

async function logNotification(
  env,
  {
    eventType,
    recipient,
    subject,
    content,
    status,
    errorMessage = null,
    orderId = null
  }
) {
  try {
    await env.DB
      .prepare(
        `
        INSERT INTO notification_logs (
          event_type,
          channel,
          recipient,
          subject,
          content,
          status,
          error_message,
          order_id,
          created_at,
          sent_at
        )
        VALUES (
          ?,
          'web_push',
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          CURRENT_TIMESTAMP,
          ?
        )
        `
      )
      .bind(
        eventType ||
          "unknown",

        recipient ||
          "",

        subject ||
          "",

        content ||
          "",

        status ||
          "pending",

        errorMessage,

        orderId,

        status === "sent"
          ? new Date().toISOString()
          : null
      )
      .run();

  } catch (error) {
    console.error(
      "Web Push log error:",
      error
    );
  }
}

// ============================================
// غیرفعال کردن Subscription نامعتبر
// ============================================

async function deactivateSubscription(
  env,
  endpoint
) {
  try {
    await env.DB
      .prepare(
        `
        UPDATE push_subscriptions
        SET
          is_active = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE endpoint = ?
        `
      )
      .bind(endpoint)
      .run();

  } catch (error) {
    console.error(
      "Deactivate Push Subscription error:",
      error
    );
  }
}

// ============================================
// ارسال Push به یک Subscription
// ============================================

export async function sendWebPush(
  env,
  subscription,
  payload,
  options = {}
) {
  const eventType =
    options.eventType ||
    "web_push";

  const orderId =
    options.orderId ||
    null;

  const endpoint =
    subscription?.endpoint;

  if (!endpoint) {
    return {
      success: false,
      error:
        "Push endpoint وجود ندارد."
    };
  }

  // ==========================================
  // VAPID
  // ==========================================

  const vapidPrivateKey =
    env.VAPID_PRIVATE_KEY;

  const vapidPublicKey =
    env.VAPID_PUBLIC_KEY ||
    "BD6jfJKFfeZJs42Si5sIErSxzxt7n_dy0GlH4eM7YHtjOAM0hDWonJArCNv38wxFrG8JchIis6iJBbpe5Eil54Q";

  const vapidSubject =
    env.VAPID_SUBJECT ||
    "mailto:info@takdaro.com";

  if (!vapidPrivateKey) {
    const error =
      "VAPID_PRIVATE_KEY در Cloudflare تنظیم نشده است.";

    await logNotification(
      env,
      {
        eventType,
        recipient: endpoint,
        subject:
          payload?.title || "",
        content:
          payload?.body || "",
        status: "failed",
        errorMessage: error,
        orderId
      }
    );

    return {
      success: false,
      error
    };
  }

  try {
    // ========================================
    // ساخت Authorization
    // ========================================

    const authorization =
      await createVapidAuthorization(
        endpoint,
        vapidPrivateKey,
        vapidPublicKey,
        vapidSubject
      );

    // ========================================
    // رمزنگاری Payload
    // ========================================

    const encryptedPayload =
      await encryptPayload(
        subscription,
        payload
      );

    // ========================================
    // ارسال به Push Service
    // ========================================

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            Authorization:
              authorization,

            "Content-Encoding":
              "aes128gcm",

            "Content-Type":
              "application/octet-stream",

            TTL: String(
              options.ttl ||
              60 * 60
            ),

            Urgency:
              options.urgency ||
              "normal"
          },

          body:
            encryptedPayload
        }
      );

    // ========================================
    // Subscription منقضی/حذف شده
    // ========================================

    if (
      response.status === 404 ||
      response.status === 410
    ) {
      await deactivateSubscription(
        env,
        endpoint
      );

      const error =
        `Subscription منقضی یا حذف شده است. HTTP ${response.status}`;

      await logNotification(
        env,
        {
          eventType,
          recipient: endpoint,
          subject:
            payload?.title || "",
          content:
            payload?.body || "",
          status: "failed",
          errorMessage: error,
          orderId
        }
      );

      return {
        success: false,
        expired: true,
        status:
          response.status,
        error
      };
    }

    // ========================================
    // خطای Push Service
    // ========================================

    if (!response.ok) {
      const responseText =
        await response.text();

      const error =
        `Push Service Error ${response.status}: ${responseText}`;

      await logNotification(
        env,
        {
          eventType,
          recipient: endpoint,
          subject:
            payload?.title || "",
          content:
            payload?.body || "",
          status: "failed",
          errorMessage: error,
          orderId
        }
      );

      return {
        success: false,
        status:
          response.status,
        error
      };
    }

    // ========================================
    // موفق
    // ========================================

    await logNotification(
      env,
      {
        eventType,
        recipient: endpoint,
        subject:
          payload?.title || "",
        content:
          payload?.body || "",
        status: "sent",
        orderId
      }
    );

    return {
      success: true,
      status:
        response.status
    };

  } catch (error) {
    const errorMessage =
      String(
        error?.message ||
        error
      );

    console.error(
      "Web Push send error:",
      error
    );

    await logNotification(
      env,
      {
        eventType,
        recipient: endpoint,
        subject:
          payload?.title || "",
        content:
          payload?.body || "",
        status: "failed",
        errorMessage,
        orderId
      }
    );

    return {
      success: false,
      error:
        errorMessage
    };
  }
}

// ============================================
// دریافت Subscriptionهای فعال یک کاربر
// ============================================

export async function getUserPushSubscriptions(
  env,
  userId
) {
  if (!userId) {
    return [];
  }

  try {
    const result =
      await env.DB
        .prepare(
          `
          SELECT
            id,
            user_id,
            endpoint,
            p256dh,
            auth,
            user_agent
          FROM push_subscriptions
          WHERE user_id = ?
            AND is_active = 1
          ORDER BY id DESC
          `
        )
        .bind(userId)
        .all();

    return (
      result?.results || []
    );

  } catch (error) {
    console.error(
      "Get user Push Subscriptions error:",
      error
    );

    return [];
  }
}

// ============================================
// ارسال Push به تمام دستگاه‌های یک کاربر
// ============================================

export async function sendUserWebPushNotification(
  env,
  userId,
  payload,
  options = {}
) {
  const subscriptions =
    await getUserPushSubscriptions(
      env,
      userId
    );

  if (
    !subscriptions.length
  ) {
    return {
      success: false,
      error:
        "هیچ دستگاه فعالی برای اعلان Web Push این کاربر ثبت نشده است.",
      results: []
    };
  }

  const results =
    await Promise.all(
      subscriptions.map(
        (subscription) =>
          sendWebPush(
            env,
            subscription,
            payload,
            options
          )
      )
    );

  return {
    success:
      results.some(
        (result) =>
          result.success
      ),

    results
  };
}

// ============================================
// ارسال Push به یک Subscription با ID
// ============================================

export async function sendPushToSubscriptionId(
  env,
  subscriptionId,
  payload,
  options = {}
) {
  try {
    const subscription =
      await env.DB
        .prepare(
          `
          SELECT
            id,
            user_id,
            endpoint,
            p256dh,
            auth,
            user_agent
          FROM push_subscriptions
          WHERE id = ?
            AND is_active = 1
          LIMIT 1
          `
        )
        .bind(
          subscriptionId
        )
        .first();

    if (!subscription) {
      return {
        success: false,
        error:
          "Push Subscription فعال پیدا نشد."
      };
    }

    return sendWebPush(
      env,
      subscription,
      payload,
      options
    );

  } catch (error) {
    return {
      success: false,
      error: String(
        error?.message ||
        error
      )
    };
  }
}