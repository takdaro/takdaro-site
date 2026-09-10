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
  testSmsNotification,
  getMobileNotificationSettings,
  saveMobileNotificationSettings,
  toggleMobileNotificationEvent,
  MOBILE_NOTIFICATION_EVENTS
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

import {
  getEmailSettings,
  saveEmailSettings,
  toggleEmailChannel,
  getEmailTemplate,
  getAllEmailTemplates,
  saveEmailTemplate,
  toggleEmailTemplate,
  testEmailNotification,
  seedDefaultEmailTemplates
} from '../../lib/email.js';

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
    // دریافت یک Template خاص SMS
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
    // دریافت پیش‌نمایش Template SMS
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
        order_status: 'payment_pending',
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

      // ============================================
      // 📱 دریافت تنظیمات اعلان موبایل اپ مدیریت
      // ============================================
      if (channel === 'mobile') {
        const settings = await getMobileNotificationSettings(context.env);

        return json({
          success: true,
          channel: 'mobile',
          is_enabled: settings.is_enabled === true,
          events: settings.events || {},
          available_events: MOBILE_NOTIFICATION_EVENTS,
          config: settings.config || {},
          exists: settings.exists === true
        });
      }

      // ============================================
      // ⭐ دریافت تنظیمات Email
      // ============================================
      if (channel === 'email') {
        const settings = await getEmailSettings(context.env);
        const config = settings.config || {};
        
        // پنهان کردن اطلاعات حساس
        const safeConfig = { ...config };
        
        return json({
          success: true,
          channel: 'email',
          is_enabled: settings.is_enabled,
          config: {
            sender_email: safeConfig.sender_email || '',
            sender_name: safeConfig.sender_name || '',
            admin_email: safeConfig.admin_email || '',
            templates: safeConfig.templates || {}
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
      if (channel === 'telegram' && safeConfig.bot_token) {
        const token = safeConfig.bot_token;
        if (token.length > 10) {
          safeConfig.bot_token_display = token.substring(0, 6) + '...' + token.substring(token.length - 4);
        } else {
          safeConfig.bot_token_display = '••••••••';
        }
      }

      delete safeConfig.bot_token;

      return json({
        success: true,
        channel: channel,
        is_enabled: settings.is_enabled,
        config: safeConfig,
        has_token: !!context.env.TELEGRAM_BOT_TOKEN || !!settings.config?.bot_token,
        updated_at: settings.updated_at
      });
    }

    // ============================================
    // ⭐ دریافت لیست Template‌های Email
    // ============================================
    if (action === 'email_templates') {
      const templates = await getAllEmailTemplates(context.env);
      return json({
        success: true,
        data: templates
      });
    }

    // ============================================
    // ⭐ دریافت یک Template خاص Email
    // ============================================
    if (action === 'email_template') {
      const eventType = url.searchParams.get('eventType');
      if (!eventType) {
        return json({ success: false, error: 'eventType الزامی است.' }, 400);
      }
      
      const template = await getEmailTemplate(context.env, eventType);
      return json({
        success: true,
        data: template
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
    // 📱 دریافت تاریخچه Notificationهای موبایل اپ مدیریت
    // ============================================
    if (action === 'mobile_logs') {
      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1),
        100
      );
      const offset = Math.max(
        parseInt(url.searchParams.get('offset') || '0', 10) || 0,
        0
      );
      const status = url.searchParams.get('status') || null;
      const eventType = url.searchParams.get('event_type') || null;

      const where = [];
      const binds = [];

      if (status) {
        where.push('l.status = ?');
        binds.push(status);
      }

      if (eventType) {
        where.push('l.event_type = ?');
        binds.push(eventType);
      }

      const whereSql = where.length
        ? `WHERE ${where.join(' AND ')}`
        : '';

      const countResult = await context.env.DB
        .prepare(`
          SELECT COUNT(*) AS total
          FROM admin_mobile_notification_logs l
          ${whereSql}
        `)
        .bind(...binds)
        .first();

      const result = await context.env.DB
        .prepare(`
          SELECT
            l.id,
            l.device_id,
            l.user_id,
            l.event_type,
            l.title,
            l.body,
            l.data,
            l.status,
            l.error_message,
            l.order_id,
            l.created_at,
            l.sent_at,
            d.device_name,
            d.platform,
            d.app_version
          FROM admin_mobile_notification_logs l
          LEFT JOIN admin_mobile_devices d
            ON d.id = l.device_id
          ${whereSql}
          ORDER BY l.id DESC
          LIMIT ? OFFSET ?
        `)
        .bind(...binds, limit, offset)
        .all();

      return json({
        success: true,
        logs: result?.results || [],
        total: Number(countResult?.total || 0),
        limit,
        offset
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
    // فعال/غیرفعال کردن Template SMS
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

      // ============================================
      // 📱 ذخیره تنظیمات اعلان موبایل
      // ============================================
      if (channel === 'mobile') {
        const config = body.config || {};

        const result = await saveMobileNotificationSettings(
          context.env,
          {
            ...config,
            is_enabled:
              config.is_enabled !== undefined
                ? config.is_enabled === true
                : undefined
          },
          adminUser.id
        );

        return json({
          success: true,
          message: 'تنظیمات اعلان موبایل با موفقیت ذخیره شد.',
          channel: 'mobile',
          is_enabled: result.is_enabled,
          events: result.config?.events || {},
          config: result.config || {}
        });
      }

      // ============================================
      // ⭐ ذخیره تنظیمات Email
      // ============================================
      if (channel === 'email') {
        const config = body.config || {};

        // اعتبارسنجی
        if (config.sender_email && !config.sender_email.trim()) {
          return json({
            success: false,
            error: 'ایمیل فرستنده معتبر نیست.'
          }, 400);
        }

        // ذخیره تنظیمات
        await saveEmailSettings(context.env, config, adminUser.id);

        // فعال/غیرفعال کردن کانال
        if (config.is_enabled !== undefined) {
          await toggleEmailChannel(context.env, config.is_enabled, adminUser.id);
        }

        const updatedSettings = await getEmailSettings(context.env);

        return json({
          success: true,
          message: 'تنظیمات Email با موفقیت ذخیره شد.',
          channel: 'email',
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
    // 📱 تغییر وضعیت یک Event اعلان موبایل
    // ============================================
    if (action === 'toggle_mobile_event') {
      const eventKey = String(body.event_key || '').trim();

      if (!eventKey) {
        return json({
          success: false,
          error: 'event_key الزامی است.'
        }, 400);
      }

      const result = await toggleMobileNotificationEvent(
        context.env,
        eventKey,
        body.enabled === true,
        adminUser.id
      );

      return json({
        success: true,
        message: `اعلان ${eventKey} ${result.config?.events?.[eventKey] ? 'فعال' : 'غیرفعال'} شد.`,
        channel: 'mobile',
        event_key: eventKey,
        enabled: result.config?.events?.[eventKey] === true,
        events: result.config?.events || {}
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
          botToken = botToken || context.env.TELEGRAM_BOT_TOKEN || settings.config.bot_token;
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
    // ⭐ ارسال پیام آزمایشی Email
    // ============================================
    if (action === 'test_email') {
      const recipient = body.recipient || body.email;

      if (!recipient) {
        return json({
          success: false,
          error: 'ایمیل گیرنده برای ارسال پیام آزمایشی مشخص نیست.'
        }, 400);
      }

      const testResult = await testEmailNotification(
        context.env,
        recipient,
        adminUser.id
      );

      if (testResult.success) {
        return json({
          success: true,
          message: 'پیام آزمایشی Email با موفقیت ارسال شد.',
          message_id: testResult.messageId
        });
      } else {
        return json({
          success: false,
          error: testResult.error || 'ارسال پیام آزمایشی Email انجام نشد.',
          message_id: testResult.messageId || null
        }, 500);
      }
    }

    // ============================================
    // ⭐ ذخیره Template Email
    // ============================================
    if (action === 'save_email_template') {
      const { eventType, title, subject, body, isEnabled } = body;

      if (!eventType || !title || !subject || !body) {
        return json({
          success: false,
          error: 'eventType, title, subject و body الزامی هستند.'
        }, 400);
      }

      await saveEmailTemplate(context.env, {
        eventType,
        title,
        subject,
        body,
        isEnabled: isEnabled !== undefined ? isEnabled : true
      }, adminUser.id);

      const template = await getEmailTemplate(context.env, eventType);

      return json({
        success: true,
        message: 'Template Email با موفقیت ذخیره شد.',
        data: template
      });
    }

    // ============================================
    // ⭐ فعال/غیرفعال کردن Template Email
    // ============================================
    if (action === 'toggle_email_template') {
      const { eventType, isEnabled } = body;

      if (!eventType) {
        return json({
          success: false,
          error: 'eventType الزامی است.'
        }, 400);
      }

      await toggleEmailTemplate(context.env, eventType, isEnabled, adminUser.id);

      const template = await getEmailTemplate(context.env, eventType);

      return json({
        success: true,
        message: `Template Email ${isEnabled ? 'فعال' : 'غیرفعال'} شد.`,
        data: template
      });
    }

    // ============================================
    // ⭐ پر کردن Template‌های پیش‌فرض Email
    // ============================================
    if (action === 'seed_email_templates') {
      const result = await seedDefaultEmailTemplates(context.env, adminUser.id);
      
      if (result.success) {
        return json({
          success: true,
          message: 'Template‌های پیش‌فرض با موفقیت اضافه شدند.',
          data: result
        });
      } else {
        return json({
          success: false,
          error: result.error || 'پر کردن Template‌ها انجام نشد.'
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

      // ⭐ ارسال مجدد Email
      if (logResult.channel === 'email') {
        const emailSettings = await getEmailSettings(context.env);
        if (!emailSettings.is_enabled) {
          return json({
            success: false,
            error: 'کانال Email فعال نیست.'
          }, 400);
        }

        const config = emailSettings.config || {};
        const senderEmail = config.sender_email || 'noreply@takdaro.com';
        const senderName = config.sender_name || 'تاکدارو';

        // ارسال مجدد از طریق Resend
        const sendResult = await sendEmail(context.env, {
          to: logResult.recipient,
          subject: logResult.subject,
          html: logResult.content,
          from: senderEmail,
          fromName: senderName
        });

        if (sendResult.success) {
          await updateLogStatus(context.env, logId, 'sent');
          return json({
            success: true,
            message: 'ایمیل با موفقیت ارسال مجدد شد.',
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
      sender_email: '',
      sender_name: '',
      admin_email: '',
      templates: {}
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

async function sendEmail(env, data) {
  const { to, subject, html, from, fromName } = data;

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY تنظیم نشده است.' };
  }

  const payload = {
    from: `${fromName || 'تاکدارو'} <${from || 'noreply@takdaro.com'}>`,
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: html
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.id) {
      throw new Error(result.message || 'ارسال ایمیل انجام نشد.');
    }

    return {
      success: true,
      messageId: result.id
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