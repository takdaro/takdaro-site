// ============================================
// SMS Gateway - Cloudflare Worker
// ============================================

import { verifyToken } from './lib/auth.js';
import {
  getPendingSms,
  markSmsAsSent,
  markSmsAsFailed,
  updateSmsStatus,
  saveIncomingSms,
  logGatewayActivity,
  getSmsStats
} from './lib/sms.js';

// ============================================
// پاسخ JSON
// ============================================

function json(data, status = 200) {
  return Response.json(data, { status });
}

// ============================================
// GET /api/sms/health
// ============================================

async function handleHealth(request, env) {
  try {
    // تست اتصال D1
    const db = env.DB;
    const result = await db.prepare('SELECT 1 as test').first();

    return json({
      success: true,
      service: 'sms-gateway',
      status: 'healthy',
      database: result?.test === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({
      success: false,
      service: 'sms-gateway',
      status: 'unhealthy',
      database: 'error',
      error: String(error?.message || error),
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ============================================
// GET /api/sms/outbox
// ============================================

async function handleOutbox(request, env) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    // فقط پیام‌های pending و retry
    const pendingMessages = await getPendingSms(env, limit);

    // دریافت تنظیمات SMS
    const smsSettings = await env.DB
      .prepare(`SELECT admin_phone, default_sender FROM sms_settings LIMIT 1`)
      .first();

    return json({
      success: true,
      data: {
        messages: pendingMessages,
        total: pendingMessages.length,
        gateway_info: {
          admin_phone: smsSettings?.admin_phone || '',
          default_sender: smsSettings?.default_sender || '',
          poll_interval: 30
        }
      }
    });
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}

// ============================================
// POST /api/sms/status
// ============================================

async function handleStatus(request, env) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ success: false, error: 'payload_invalid' }, 400);
    }

    const { messageId, status, errorMessage, gatewayIp } = body;

    if (!messageId) {
      return json({ success: false, error: 'messageId_required' }, 400);
    }

    if (!status || !['sent', 'failed', 'retry'].includes(status)) {
      return json({ success: false, error: 'invalid_status' }, 400);
    }

    let result;
    if (status === 'sent') {
      result = await markSmsAsSent(env, messageId);
    } else if (status === 'failed') {
      result = await markSmsAsFailed(env, messageId, errorMessage || 'ارسال ناموفق بود');
    } else {
      // retry: فقط وضعیت را به retry تغییر بده
      result = await updateSmsStatus(env, messageId, 'retry', errorMessage);
    }

    if (!result.success) {
      return json({
        success: false,
        error: result.error || 'update_failed'
      }, 500);
    }

    return json({
      success: true,
      message: 'status_updated',
      data: {
        messageId,
        status,
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}

// ============================================
// POST /api/sms/inbox
// ============================================

async function handleInbox(request, env) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ success: false, error: 'payload_invalid' }, 400);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [body];
    const gatewayIp = body.gateway_ip || request.headers.get('CF-Connecting-IP') || 'unknown';

    const results = [];
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const msg of messages) {
      const { messageId, sender, recipient, message, receivedAt } = msg;

      if (!messageId || !sender || !recipient || !message) {
        results.push({
          messageId: messageId || 'unknown',
          success: false,
          error: 'missing_fields'
        });
        errorCount++;
        continue;
      }

      // بررسی تکراری (حتی اگر Unique Constraint نباشد)
      const existing = await env.DB
        .prepare(`SELECT id FROM sms_inbox WHERE message_id = ? LIMIT 1`)
        .bind(messageId)
        .first();

      if (existing) {
        results.push({
          messageId: messageId,
          success: false,
          error: 'duplicate_message',
          duplicate: true
        });
        duplicateCount++;
        continue;
      }

      const saveResult = await saveIncomingSms(env, {
        messageId,
        sender,
        recipient,
        message,
        receivedAt: receivedAt || new Date().toISOString()
      });

      if (saveResult.success) {
        results.push({
          messageId,
          success: true,
          id: saveResult.id
        });
        successCount++;
      } else {
        results.push({
          messageId,
          success: false,
          error: saveResult.error || 'save_failed'
        });
        errorCount++;
      }
    }

    await logGatewayActivity(env, {
      direction: 'inbound',
      messageId: null,
      gatewayAction: 'receive_batch',
      requestPayload: JSON.stringify({ total: messages.length }),
      responsePayload: JSON.stringify({ success: successCount, duplicate: duplicateCount, error: errorCount }),
      status: errorCount > 0 ? 'failed' : 'success',
      errorMessage: errorCount > 0 ? `${errorCount} پیام با خطا مواجه شد` : null,
      durationMs: null,
      gatewayIp: gatewayIp
    });

    return json({
      success: true,
      data: {
        total_received: messages.length,
        success_count: successCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        results: results
      }
    });
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}

// ============================================
// ورودی اصلی Worker
// ============================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ============================================
    // بررسی Authentication
    // ============================================
    const authResult = verifyToken(request, env);
    if (!authResult.valid) {
      return json({
        success: false,
        error: authResult.error || 'unauthorized'
      }, 401);
    }

    // ============================================
    // Routing
    // ============================================

    // GET /api/sms/health
    if (path === '/api/sms/health' && request.method === 'GET') {
      return handleHealth(request, env);
    }

    // GET /api/sms/outbox
    if (path === '/api/sms/outbox' && request.method === 'GET') {
      return handleOutbox(request, env);
    }

    // POST /api/sms/status
    if (path === '/api/sms/status' && request.method === 'POST') {
      return handleStatus(request, env);
    }

    // POST /api/sms/inbox
    if (path === '/api/sms/inbox' && request.method === 'POST') {
      return handleInbox(request, env);
    }

    // 404 Not Found
    return json({
      success: false,
      error: 'not_found',
      path: path
    }, 404);
  }
};