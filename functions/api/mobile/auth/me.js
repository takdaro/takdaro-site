// ============================================
// mobile/auth/me.js
// بررسی Session اپ مدیریت
// ============================================

import {
  getMobileUser,
  mobileUnauthorized
} from "../../../lib/mobile-auth";

// ============================================
// GET - اطلاعات کاربر و Session فعلی
// ============================================

export async function onRequestGet(context) {
  try {
    const result =
      await getMobileUser(context);

    if (!result.ok) {
      return mobileUnauthorized(
        result.reason
      );
    }

    return Response.json(
      {
        success: true,

        user: result.user,

        session: result.session
      },
      {
        status: 200
      }
    );

  } catch (error) {
    console.error(
      "Mobile auth me error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          "خطا در بررسی نشست ورود."
      },
      {
        status: 500
      }
    );
  }
}