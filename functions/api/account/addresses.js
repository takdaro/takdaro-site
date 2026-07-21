function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function normalizePhone(value) {
  if (!value) return "";
  return String(value).trim().replace(/[^\d+]/g, "");
}

function normalizeDigits(value) {
  if (!value) return "";
  const map = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
  };

  return String(value)
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}

function json(data, status = 200) {
  return Response.json(data, { status });
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

function parseAddressIdFromUrl(requestUrl) {
  const url = new URL(requestUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  const apiIndex = parts.indexOf("api");
  if (apiIndex === -1) return { addressId: null, isDefaultRoute: false };

  const rest = parts.slice(apiIndex + 1);
  if (rest[0] !== "account" || rest[1] !== "addresses") {
    return { addressId: null, isDefaultRoute: false };
  }

  const addressId = rest[2] || null;
  const isDefaultRoute = rest[3] === "default";

  return { addressId, isDefaultRoute };
}

function readAddressPayload(body) {
  return {
    type: String(body.type || "").trim(),
    full_name: String(body.full_name || body.fullname || "").trim(),
    address_line: String(body.address_line || body.addressline || "").trim(),
    postal_code: normalizeDigits(String(body.postal_code || body.postalcode || "").trim()),
    phone: normalizePhone(normalizeDigits(body.phone || "")),
    city: String(body.city || "").trim(),
    state: String(body.state || "").trim(),
    is_default:
      body.is_default === 1 ||
      body.is_default === "1" ||
      body.is_default === true ||
      body.isdefault === 1 ||
      body.isdefault === "1" ||
      body.isdefault === true
        ? 1
        : 0
  };
}

function validateAddressInput(data) {
  if (!["billing", "shipping"].includes(data.type)) {
    return "invalid address type";
  }

  if (!data.full_name || !data.address_line) {
    return "full_name and address_line required";
  }

  if (!data.phone) {
    return "phone required";
  }

  if (!data.city || !data.state) {
    return "city and state required";
  }

  if (!data.postal_code) {
    return "postal_code required";
  }

  return null;
}

async function getAddressById(context, userId, addressId) {
  return context.env.DB
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
        is_default,
        created_at,
        updated_at
      FROM addresses
      WHERE id = ? AND user_id = ?
    `)
    .bind(addressId, userId)
    .first();
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  const { addressId, isDefaultRoute } = parseAddressIdFromUrl(context.request.url);

  try {
    const userId = await getCurrentUserId(context);

    if (!userId) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    if (method === "GET" && !addressId) {
      const addresses = await context.env.DB
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
            is_default,
            created_at,
            updated_at
          FROM addresses
          WHERE user_id = ?
          ORDER BY is_default DESC, created_at DESC
        `)
        .bind(userId)
        .all();

      return json({
        success: true,
        addresses: addresses.results || []
      });
    }

    if (method === "POST" && !addressId) {
      const body = await context.request.json();
      const data = readAddressPayload(body);
      const validationError = validateAddressInput(data);

      if (validationError) {
        return json({ success: false, error: validationError }, 400);
      }

      if (data.is_default) {
        await context.env.DB
          .prepare("UPDATE addresses SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND type = ?")
          .bind(userId, data.type)
          .run();
      }

      const result = await context.env.DB
        .prepare(`
          INSERT INTO addresses (
            user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `)
        .bind(
          userId,
          data.type,
          data.full_name,
          data.address_line,
          data.postal_code,
          data.phone,
          data.city,
          data.state,
          data.is_default
        )
        .run();

      const address = await getAddressById(context, userId, result.meta?.last_row_id);

      return json({
        success: true,
        address
      });
    }

    if (method === "PUT" && addressId) {
      const existing = await getAddressById(context, userId, addressId);

      if (!existing) {
        return json({ success: false, error: "address not found" }, 404);
      }

      const body = await context.request.json();
      const data = readAddressPayload(body);
      const validationError = validateAddressInput(data);

      if (validationError) {
        return json({ success: false, error: validationError }, 400);
      }

      if (data.is_default) {
        await context.env.DB
          .prepare("UPDATE addresses SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND type = ?")
          .bind(userId, data.type)
          .run();
      }

      await context.env.DB
        .prepare(`
          UPDATE addresses
          SET
            type = ?,
            full_name = ?,
            address_line = ?,
            postal_code = ?,
            phone = ?,
            city = ?,
            state = ?,
            is_default = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `)
        .bind(
          data.type,
          data.full_name,
          data.address_line,
          data.postal_code,
          data.phone,
          data.city,
          data.state,
          data.is_default,
          addressId,
          userId
        )
        .run();

      const address = await getAddressById(context, userId, addressId);

      return json({
        success: true,
        address
      });
    }

    if (method === "DELETE" && addressId) {
      const existing = await getAddressById(context, userId, addressId);

      if (!existing) {
        return json({ success: false, error: "address not found" }, 404);
      }

      await context.env.DB
        .prepare("DELETE FROM addresses WHERE id = ? AND user_id = ?")
        .bind(addressId, userId)
        .run();

      return json({
        success: true
      });
    }

    if (method === "POST" && addressId && isDefaultRoute) {
      const existing = await getAddressById(context, userId, addressId);

      if (!existing) {
        return json({ success: false, error: "address not found" }, 404);
      }

      await context.env.DB
        .prepare("UPDATE addresses SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND type = ?")
        .bind(userId, existing.type)
        .run();

      await context.env.DB
        .prepare("UPDATE addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")
        .bind(addressId, userId)
        .run();

      const address = await getAddressById(context, userId, addressId);

      return json({
        success: true,
        address
      });
    }

    return json({ success: false, error: "method not allowed" }, 405);
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}