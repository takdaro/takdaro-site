// ============================================
// Authentication - Bearer Token
// ============================================

/**
 * بررسی Token Authorization
 * @param {Request} request - درخواست HTTP
 * @param {Object} env - محیط Cloudflare
 * @returns {Object} - { valid: boolean, error: string | null }
 */
export function verifyToken(request, env) {
  try {
    // دریافت Header Authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return {
        valid: false,
        error: 'authorization_required'
      };
    }

    // بررسی فرمت: Bearer <TOKEN>
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return {
        valid: false,
        error: 'invalid_auth_format'
      };
    }

    const token = parts[1];

    // دریافت Secret از Environment
    const secret = env.GATEWAY_SECRET;
    if (!secret) {
      return {
        valid: false,
        error: 'gateway_secret_not_configured'
      };
    }

    // مقایسه Token
    if (token !== secret) {
      return {
        valid: false,
        error: 'invalid_token'
      };
    }

    // موفقیت
    return {
      valid: true,
      error: null
    };
  } catch (error) {
    return {
      valid: false,
      error: String(error?.message || error)
    };
  }
}