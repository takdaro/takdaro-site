// ============================================
// API مدیریت اعلان‌ها (فقط ادمین)
// ============================================

import { requireAdmin } from '../../lib/admin.js';
import { 
  getChannelSettings, 
  saveChannelSettings, 
  toggleChannel,
  sendOrderCreatedNotification,
  testTelegramNotification,
  getNotificationLogs,
  getNotificationStats,
  testSmsNotification
} from '../../lib/notification.js';

import {
  getSmsSettings,
  saveSmsSettings,
  getSmsStats,
  getGatewayLogs,
  getIncomingSms,
  getSmsTemplate,
  getAllSmsTemplates,
  saveSmsTemplate,
  toggleSmsTemplate,
  renderSmsTemplate
} from '../../lib/sms.js';

function json(data, status = 200) {
  return Response.json(data, { status });
}

// ============================================
// GET - دریافت تنظیمات و تاریخچه
// ============================================
export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const url = new URL(context.request.url);
    const action = url.searchParams.get('action') || 'settings';
    const channel = url.searchParams.get('channel') || 'telegram';

    // ============================================
    // دریافت لیست Template‌های SMS
    // ============================================
    if (action === 'sms_templates') {
      const templates = await getAllSmsTemplates(context.env);
      return json({
        success: true,
        data: templates
      });
    }

    // ============================================
    // دریافت یک Template خاص
    // ============================================
    if (action === 'sms_template') {
      const eventType = url.searchParams.get('eventType');
      if (!eventType) {
        return json({ success: false, error: 'eventType الزامی است.' }, 400);
      }
      
      const template = await getSmsTemplate(context.env, eventType);
      return json({
        success: true,
        data: template
      });
    }

    // ============================================
    // دریافت پیش‌نمایش Template
    // ============================================
    if (action === 'sms_template_preview') {
      const eventType = url.searchParams.get('eventType');
      const template = await getSmsTemplate(context.env, eventType);
      
      if (!template) {
        return json({ success: false, error: 'Template یافت نشد.' }, 404);
      }

      const sampleData = {
        customer_name: 'کاربر تست',
        customer_phone: '09123456789',
        order_number: 'TT-20260819-123456',
        amount: '2500000',
        payment_status: 'pending',
        order_status: 'pending',
        tracking_code: 'TRK-12345678'
      };

      const rendered = renderSmsTemplate(template.message_template, sampleData);

      return json({
        success: true,
        data: {
          template: template,
          rendered: rendered,
          sample_data: sampleData
        }
      });
    }

    // ============================================
    // دریافت تنظیمات یک کانال خاص
    // ============================================
    if (action === 'settings') {
      if (channel === 'sms') {
        const settings = await getSmsSettings(context.env);
        return json({
          success: true,
          channel: 'sms',
          is_enabled: settings.is_enabled,
          config: {
            admin_phone: settings.admin_phone || '',
            gateway_url: settings.gateway_url || '',
            polling_interval: settings.polling_interval || 30,
            max_sms_per_minute: settings.max_sms_per_minute || 10,
            retry_interval: settings.retry_interval || 300,
            default_sender: settings.default_sender || '',
            event_order_created_admin: settings.event_order_created_admin,
            event_order_created_user: settings.event_order_created_user,
            event_order_status_changed_user: settings.event_order_status_changed_user,
            event_payment_success_admin: settings.event_payment_success_admin,
            event_payment_success_user: settings.event_payment_success_user,
            event_order_cancelled_user: settings.event_order_cancelled_user
          },
          updated_at: settings.updated_at
        });
      }

      const settings = await getChannelSettings(context.env, channel);
      
      if (!settings) {
        return json({
          success: true,
          channel: channel,
          is_enabled: false,
          config: getDefaultConfig(channel),
          message: 'تنظیمات یافت نشد، از مقادیر پیش‌فرض استفاده کنید.'
        });
      }

      const safeConfig = { ...settings.config };
      if (safeConfig.bot_token) {
        const token = safeConfig.bot_token;
        if (token.length > 10) {
          safeConfig.bot_token_display = token.substring(0, 6) + '...' + token.substring(token.length - 4);
        } else {
          safeConfig.bot_token_display = '••••••••';
        }
      }

      return json({
        success: true,
        channel: channel,
        is_enabled: settings.is_enabled,
        config: safeConfig,
        has_token: !!settings.config?.bot_token,
        updated_at: settings.updated_at
      });
    }

    // ============================================
    // دریافت تاریخچه اعلان‌ها
    // ============================================
    if (action === 'logs') {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const status = url.searchParams.get('status') || null;
      const eventType = url.searchParams.get('event_type') || null;
      const channelFilter = url.searchParams.get('channel') || null;

      const result = await getNotificationLogs(context.env, {
        channel: channelFilter,
        eventType: eventType,
        status: status,
        limit: limit,
        offset: offset
      });

      return json({
        success: true,
        ...result
      });
    }

    // ============================================
    // دریافت آمار اعلان‌ها
    // ============================================
    if (action === 'stats') {
      const stats = await getNotificationStats(context.env);
      return json({
        success: true,
        stats: stats
      });
    }

    // ============================================
    // دریافت آمار SMS
    // ============================================
    if (action === 'sms_stats') {
      const stats = await getSmsStats(context.env);
      return json({
        success: true,
        stats: stats
      });
    }

    // ============================================
    // دریافت لاگ‌های Gateway
    // ============================================
    if (action === 'gateway_logs') {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const direction = url.searchParams.get('direction') || null;
      const status = url.searchParams.get('status') || null;

      const result = await getGatewayLogs(context.env, {
        direction: direction,
        status: status,
        limit: limit,
        offset: offset
      });

      return json({
        success: true,
        ...result
      });
    }

    // ============================================
    // دریافت SMS‌های دریافتی
    // ============================================
    if (action === 'sms_inbox') {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const sender = url.searchParams.get('sender') || null;
      const status = url.searchParams.get('status') || null;
      const processed = url.searchParams.get('processed') !== null 
        ? url.searchParams.get('processed') === 'true' 
        : undefined;

      const result = await getIncomingSms(context.env, {
        sender: sender,
        status: status,
        processed: processed,
        limit: limit,
        offset: offset
      });

      return json({
        success: true,
        ...result
      });
    }

    return json({
      success: false,
      error: 'action نامعتبر است.'
    }, 400);

  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}

// ============================================
// POST - ذخیره تنظیمات و ارسال تست
// ============================================
export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ success: false, error: 'payload نامعتبر است.' }, 400);
    }

    const action = body.action || 'save_settings';
    const channel = body.channel || 'telegram';
    const adminUser = adminCheck.user;

    // ============================================
    // ذخیره یا به‌روزرسانی Template SMS
    // ============================================
    if (action === 'save_sms_template') {
      const { eventType, title, messageTemplate, isEnabled } = body;

      if (!eventType || !title || !messageTemplate) {
        return json({
          success: false,
          error: 'eventType, title و messageTemplate الزامی هستند.'
        }, 400);
      }

      await saveSmsTemplate(context.env, {
        eventType,
        title,
        messageTemplate,
        isEnabled: isEnabled !== undefined ? isEnabled : true
      });

      const template = await getSmsTemplate(context.env, eventType);

      return json({
        success: true,
        message: 'Template با موفقیت ذخیره شد.',
        data: template
      });
    }

    // ============================================
    // فعال/غیرفعال کردن Template
    // ============================================
    if (action === 'toggle_sms_template') {
      const { eventType, isEnabled } = body;

      if (!eventType) {
        return json({
          success: false,
          error: 'eventType الزامی است.'
        }, 400);
      }

      await toggleSmsTemplate(context.env, eventType, isEnabled);

      const template = await getSmsTemplate(context.env, eventType);

      return json({
        success: true,
        message: `Template ${isEnabled ? 'فعال' : 'غیرفعال'} شد.`,
        data: template
      });
    }

    // ============================================
    // ارسال پیام آزمایشی SMS با Template
    // ============================================
    if (action === 'test_sms_template') {
      const { phoneNumber, eventType } = body;

      if (!phoneNumber) {
        return json({
          success: false,
          error: 'شماره تلفن برای ارسال پیام آزمایشی مشخص نیست.'
        }, 400);
      }

      if (!eventType) {
        return json({
          success: false,
          error: 'eventType برای Template مشخص نیست.'
        }, 400);
      }

      const testResult = await testSmsNotification(
        context.env,
        phoneNumber,
        adminUser.id,
        eventType
      );

      if (testResult.success) {
        return json({
          success: true,
          message: 'پیام آزمایشی SMS با Template با موفقیت ارسال شد.',
          log_id: testResult.log_id
        });
      } else {
        return json({
          success: false,
          error: testResult.error || 'ارسال پیام آزمایشی SMS انجام نشد.',
          log_id: testResult.log_id
        }, 500);
      }
    }

    // ============================================
    // ذخیره تنظیمات SMS
    // ============================================
    if (action === 'save_settings') {
      if (channel === 'sms') {
        const config = body.config || {};
        
        if (config.admin_phone && !config.admin_phone.trim()) {
          return json({
            success: false,
            error: 'شماره ادمین معتبر نیست.'
          }, 400);
        }

        await saveSmsSettings(context.env, {
          is_enabled: config.is_enabled !== undefined ? config.is_enabled : false,
          admin_phone: config.admin_phone || '',
          gateway_url: config.gateway_url || '',
          polling_interval: config.polling_interval || 30,
          max_sms_per_minute: config.max_sms_per_minute || 10,
          retry_interval: config.retry_interval || 300,
          default_sender: config.default_sender || '',
          event_order_created_admin: config.event_order_created_admin === true || config.event_order_created_admin === 1,
          event_order_created_user: config.event_order_created_user === true || config.event_order_created_user === 1,
          event_order_status_changed_user: config.event_order_status_changed_user === true || config.event_order_status_changed_user === 1,
          event_payment_success_admin: config.event_payment_success_admin === true || config.event_payment_success_admin === 1,
          event_payment_success_user: config.event_payment_success_user === true || config.event_payment_success_user === 1,
          event_order_cancelled_user: config.event_order_cancelled_user === true || config.event_order_cancelled_user === 1
        }, adminUser.id);

        const updatedSettings = await getSmsSettings(context.env);

        return json({
          success: true,
          message: 'تنظیمات SMS با موفقیت ذخیره شد.',
          channel: 'sms',
          settings: updatedSettings
        });
      }

      const config = body.config || {};

      if (channel === 'telegram') {
        if (config.bot_token && config.bot_token.trim()) {
          if (config.bot_token.trim().length < 20) {
            return json({
              success: false,
              error: 'توکن ربات تلگرام معتبر نیست (حداقل 20 کاراکتر).'
            }, 400);
          }
        }
        if (!config.chat_id || !config.chat_id.trim()) {
          return json({
            success: false,
            error: 'شناسه چت (Chat ID) الزامی است.'
          }, 400);
        }
      }

      const result = await saveChannelSettings(
        context.env, 
        channel, 
        config, 
        adminUser.id
      );

      return json({
        success: true,
        message: 'تنظیمات با موفقیت ذخیره شد.',
        channel: channel,
        config: result.config
      });
    }

    // ============================================
    // فعال/غیرفعال کردن کانال
    // ============================================
    if (action === 'toggle') {
      const enabled = body.enabled === true;
      
      const result = await toggleChannel(
        context.env,
        channel,
        enabled,
        adminUser.id
      );

      return json({
        success: true,
        message: `کانال ${channel} ${enabled ? 'فعال' : 'غیرفعال'} شد.`,
        channel: channel,
        is_enabled: enabled
      });
    }

    // ============================================
    // ارسال پیام آزمایشی تلگرام
    // ============================================
    if (action === 'test_telegram') {
      let botToken = body.bot_token;
      let chatId = body.chat_id;

      if (!botToken || !chatId) {
        const settings = await getChannelSettings(context.env, 'telegram');
        if (settings && settings.config) {
          botToken = botToken || settings.config.bot_token;
          chatId = chatId || settings.config.chat_id;
        }
      }

      if (!botToken || !chatId) {
        return json({
          success: false,
          error: 'توکن ربات و شناسه چت الزامی است یا تنظیمات ذخیره‌شده وجود ندارد.'
        }, 400);
      }

      const testResult = await testTelegramNotification(
        context.env,
        botToken,
        chatId,
        adminUser.id
      );

      if (testResult.success) {
        return json({
          success: true,
          message: 'پیام آزمایشی با موفقیت ارسال شد.',
          log_id: testResult.log_id
        });
      } else {
        return json({
          success: false,
          error: testResult.error || 'ارسال پیام آزمایشی انجام نشد.',
          log_id: testResult.log_id
        }, 500);
      }
    }

    // ============================================
    // ارسال پیام آزمایشی SMS
    // ============================================
    if (action === 'test_sms') {
      const phoneNumber = body.phone_number || body.phone;
      let testPhone = phoneNumber;

      if (!testPhone) {
        const settings = await getSmsSettings(context.env);
        testPhone = settings.admin_phone;
      }

      if (!testPhone) {
        return json({
          success: false,
          error: 'شماره تلفن برای ارسال پیام آزمایشی مشخص نیست.'
        }, 400);
      }

      const testResult = await testSmsNotification(
        context.env,
        testPhone,
        adminUser.id,
        'order_created'
      );

      if (testResult.success) {
        return json({
          success: true,
          message: 'پیام آزمایشی SMS با موفقیت به صف ارسال اضافه شد.',
          log_id: testResult.log_id
        });
      } else {
        return json({
          success: false,
          error: testResult.error || 'ارسال پیام آزمایشی SMS انجام نشد.',
          log_id: testResult.log_id
        }, 500);
      }
    }

    // ============================================
    // ارسال مجدد یک اعلان
    // ============================================
    if (action === 'resend') {
      const logId = body.log_id;
      if (!logId) {
        return json({
          success: false,
          error: 'شناسه لاگ الزامی است.'
        }, 400);
      }

      const logResult = await context.env.DB
        .prepare(`
          SELECT 
            id,
            event_type,
            channel,
            recipient,
            subject,
            content,
            order_id
          FROM notification_logs
          WHERE id = ?
        `)
        .bind(logId)
        .first();

      if (!logResult) {
        return json({
          success: false,
          error: 'لاگ یافت نشد.'
        }, 404);
      }

      if (logResult.channel === 'telegram') {
        const settings = await getChannelSettings(context.env, 'telegram');
        if (!settings || !settings.is_enabled) {
          return json({
            success: false,
            error: 'کانال تلگرام فعال نیست.'
          }, 400);
        }

        const config = settings.config || {};
        const botToken = config.bot_token;
        const chatId = config.chat_id;

        if (!botToken || !chatId) {
          return json({
            success: false,
            error: 'تنظیمات تلگرام کامل نیست.'
          }, 400);
        }

        const sendResult = await sendTelegramMessage(botToken, chatId, logResult.content);

        if (sendResult.success) {
          await updateLogStatus(context.env, logId, 'sent');
          return json({
            success: true,
            message: 'پیام با موفقیت ارسال مجدد شد.',
            log_id: logId
          });
        } else {
          await updateLogStatus(context.env, logId, 'failed', sendResult.error);
          return json({
            success: false,
            error: sendResult.error || 'ارسال مجدد انجام نشد.',
            log_id: logId
          }, 500);
        }
      }

      return json({
        success: false,
        error: `ارسال مجدد برای کانال ${logResult.channel} فعلاً پشتیبانی نمی‌شود.`
      }, 400);
    }

    return json({
      success: false,
      error: 'action نامعتبر است.'
    }, 400);

  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}

// ============================================
// توابع کمکی
// ============================================

function getDefaultConfig(channel) {
  const defaults = {
    telegram: {
      bot_token: '',
      chat_id: ''
    },
    email: {
      provider: 'smtp',
      host: '',
      port: 587,
      secure: false,
      username: '',
      password: '',
      from_email: '',
      from_name: '',
      recipients: []
    },
    sms: {
      provider: '',
      sender: '',
      recipients: []
    }
  };

  return defaults[channel] || {};
}

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload = {
    chat_id: String(chatId),
    text: String(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || 'ارسال پیام انجام نشد.');
    }

    return {
      success: true,
      message_id: data.result?.message_id
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}

async function updateLogStatus(env, logId, status, errorMessage = null) {
  await env.DB
    .prepare(`
      UPDATE notification_logs
      SET 
        status = ?,
        error_message = COALESCE(?, error_message),
        sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
      WHERE id = ?
    `)
    .bind(status, errorMessage, status, logId)
    .run();
}