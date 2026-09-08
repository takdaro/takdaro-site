// ============================================
// notifications.js - مدیریت اعلان‌ها
// Telegram + Email + Notification Logs
// ============================================

(function() {
  'use strict';

  // ============================================
  // متغیرهای محلی
  // ============================================
  var notificationLogsPage = 0;
  var notificationLogsLimit = 20;
  var smsActiveSubtab = 'settings';

  // ============================================
  // نمایش پیام
  // ============================================
  function setNotificationMessage(
    message,
    type,
    targetId
  ) {
    var msg =
      document.getElementById(
        targetId || 'notification-message'
      );

    if (!msg) return;

    msg.textContent =
      message || '';

    msg.className =
      'admin-message';

    if (message) {
      msg.classList.add(
        type === 'success'
          ? 'is-success'
          : type === 'info'
            ? 'is-info'
            : 'is-error'
      );
    }
  }

  // ============================================
  // وضعیت Toggle تلگرام
  // ============================================
  function updateTelegramToggleStatus(
    enabled
  ) {
    var statusText =
      document.getElementById(
        'telegram-toggle-status'
      );

    if (!statusText) return;

    if (enabled) {
      statusText.textContent =
        'فعال';

      statusText.className =
        'toggle-status';

    } else {
      statusText.textContent =
        'غیرفعال';

      statusText.className =
        'toggle-status is-disabled';
    }
  }

  // ============================================
  // وضعیت Toggle ایمیل
  // ============================================
  function updateEmailToggleStatus(
    enabled
  ) {
    var statusText =
      document.getElementById(
        'email-toggle-status'
      );

    if (!statusText) return;

    if (enabled) {
      statusText.textContent =
        'فعال';

      statusText.className =
        'toggle-status';

    } else {
      statusText.textContent =
        'غیرفعال';

      statusText.className =
        'toggle-status is-disabled';
    }
  }

  // ============================================
  // 📱 اعلان موبایل اپ مدیریت
  // ============================================
  var MOBILE_NOTIFICATION_EVENTS = [
    { key: 'order_created', label: 'ثبت سفارش جدید' },
    { key: 'payment_pending', label: 'در انتظار پرداخت' },
    { key: 'payment_success', label: 'پرداخت موفق' },
    { key: 'payment_failed', label: 'پرداخت ناموفق' },
    { key: 'order_confirmed', label: 'تأیید سفارش' },
    { key: 'courier_delivery', label: 'ارسال با پیک' },
    { key: 'bus_shipping', label: 'ارسال با باربری' },
    { key: 'shipped', label: 'ارسال شد' },
    { key: 'delivered', label: 'تحویل داده شد' },
    { key: 'completed', label: 'تکمیل شد' },
    { key: 'cancelled', label: 'لغو شد' },
    { key: 'returned', label: 'مرجوع شد' },
    { key: 'chat_online', label: 'چت آنلاین' }
  ];

  function updateMobileToggleStatus(enabled) {
    var statusText = document.getElementById('mobile-toggle-status');
    if (!statusText) return;

    statusText.textContent = enabled ? 'فعال' : 'غیرفعال';
    statusText.className = enabled
      ? 'toggle-status'
      : 'toggle-status is-disabled';
  }

  function renderMobileEventRows(events) {
    var container = document.getElementById('mobile-notification-events');
    if (!container) return;

    var orderCreated = MOBILE_NOTIFICATION_EVENTS.filter(function(item) {
      return item.key === 'order_created';
    });

    var statuses = MOBILE_NOTIFICATION_EVENTS.filter(function(item) {
      return item.key !== 'order_created' && item.key !== 'chat_online';
    });

    var chat = MOBILE_NOTIFICATION_EVENTS.filter(function(item) {
      return item.key === 'chat_online';
    });

    function row(item, extraClass) {
      var enabled = events && events[item.key] === true;
      return '<div class="mobile-event-row ' + (extraClass || '') + '">' +
        '<div class="mobile-event-label" style="flex:1;font-weight:700;direction:rtl;text-align:right;">' + window.esc(item.label) + '</div>' +
        '<label class="toggle-switch">' +
          '<input type="checkbox" data-mobile-event="' + window.esc(item.key) + '" ' + (enabled ? 'checked' : '') + ' />' +
          '<span class="toggle-slider"></span>' +
        '</label>' +
        '<span class="toggle-status ' + (enabled ? '' : 'is-disabled') + '" data-mobile-event-status="' + window.esc(item.key) + '" style="min-width:62px;text-align:center;">' +
          (enabled ? 'فعال' : 'غیرفعال') +
        '</span>' +
      '</div>';
    }

    var html = '<div class="mobile-event-section-title">ثبت سفارش</div>';
    html += orderCreated.map(row).join('');
    html += '<div class="mobile-event-section-title">۱۱ وضعیت سفارش</div>';
    html += statuses.map(row).join('');
    html += '<div class="mobile-event-section-title">رویداد آینده</div>';
    html += chat.map(row).join('');

    container.innerHTML = html;
  }

  async function loadMobileNotificationSettings() {
    try {
      var result = await window.api(
        '/api/admin/notifications?action=settings&channel=mobile'
      );

      if (!result.ok || !result.data?.success) {
        setNotificationMessage(
          result.data?.error || 'دریافت تنظیمات اعلان موبایل انجام نشد.',
          'error',
          'mobile-message'
        );
        return false;
      }

      var data = result.data;
      var toggle = document.getElementById('mobile-toggle');

      if (toggle) {
        toggle.checked = data.is_enabled === true;
        updateMobileToggleStatus(data.is_enabled === true);
      }

      renderMobileEventRows(data.events || {});
      return true;
    } catch (error) {
      setNotificationMessage(
        'خطا در بارگذاری تنظیمات اعلان موبایل.',
        'error',
        'mobile-message'
      );
      console.error('Error loading mobile notification settings:', error);
      return false;
    }
  }

  async function saveMobileNotificationSettings() {
    var toggle = document.getElementById('mobile-toggle');
    var saveButton = document.getElementById('mobile-save-btn');
    var isEnabled = toggle ? toggle.checked : false;
    var checkboxes = document.querySelectorAll('[data-mobile-event]');
    var events = {};

    checkboxes.forEach(function(input) {
      events[input.getAttribute('data-mobile-event')] = input.checked;
    });

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'در حال ذخیره...';
    }

    try {
      var result = await window.api(
        '/api/admin/notifications',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'save_settings',
            channel: 'mobile',
            config: {
              is_enabled: isEnabled,
              events: events
            }
          })
        }
      );

      if (!result.ok || !result.data?.success) {
        setNotificationMessage(
          result.data?.error || 'ذخیره تنظیمات اعلان موبایل انجام نشد.',
          'error',
          'mobile-message'
        );
        return false;
      }

      setNotificationMessage(
        '✅ تنظیمات اعلان موبایل با موفقیت ذخیره شد.',
        'success',
        'mobile-message'
      );

      updateMobileToggleStatus(isEnabled);
      renderMobileEventRows(result.data.events || events);
      return true;
    } catch (error) {
      setNotificationMessage(
        'خطا در ذخیره تنظیمات اعلان موبایل.',
        'error',
        'mobile-message'
      );
      console.error('Error saving mobile notification settings:', error);
      return false;
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = '💾 ذخیره تنظیمات';
      }
    }
  }

  async function toggleMobileNotificationEvent(eventKey, enabled) {
    try {
      var result = await window.api(
        '/api/admin/notifications',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'toggle_mobile_event',
            channel: 'mobile',
            event_key: eventKey,
            enabled: enabled
          })
        }
      );

      if (!result.ok || !result.data?.success) {
        throw new Error(
          result.data?.error || 'تغییر وضعیت اعلان موبایل انجام نشد.'
        );
      }

      var status = document.querySelector(
        '[data-mobile-event-status="' + CSS.escape(eventKey) + '"]'
      );

      if (status) {
        status.textContent = enabled ? 'فعال' : 'غیرفعال';
        status.classList.toggle('is-disabled', !enabled);
      }

      setNotificationMessage(
        (enabled ? '✅ ' : '🔕 ') +
          'اعلان «' +
          eventKey +
          '» ' +
          (enabled ? 'فعال شد.' : 'غیرفعال شد.'),
        'success',
        'mobile-message'
      );

      var globalToggle = document.getElementById('mobile-toggle');
      if (globalToggle && !globalToggle.checked && enabled) {
        globalToggle.checked = true;
        updateMobileToggleStatus(true);
      }

      return true;
    } catch (error) {
      console.error('Error toggling mobile notification event:', error);
      await loadMobileNotificationSettings();
      setNotificationMessage(
        String(error?.message || 'تغییر وضعیت انجام نشد.'),
        'error',
        'mobile-message'
      );
      return false;
    }
  }

  // ============================================
  // بارگذاری تنظیمات تلگرام
  // ============================================
  async function loadTelegramSettings() {
    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=settings&channel=telegram'
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        setNotificationMessage(
          result.data?.error ||
          'دریافت تنظیمات انجام نشد.',
          'error'
        );

        return false;
      }

      var data =
        result.data;

      var config =
        data.config || {};

      var toggle =
        document.getElementById(
          'telegram-toggle'
        );

      if (toggle) {
        toggle.checked =
          data.is_enabled === true;

        updateTelegramToggleStatus(
          data.is_enabled === true
        );
      }

      var tokenInput =
        document.getElementById(
          'telegram-bot-token'
        );

      var chatIdInput =
        document.getElementById(
          'telegram-chat-id'
        );

      if (tokenInput) {
        if (data.has_token) {
          tokenInput.placeholder =
            '🔒 توکن ذخیره شده است (برای تغییر، مقدار جدید وارد کنید)';

          tokenInput.value =
            '';
        } else {
          tokenInput.placeholder =
            'توکن ربات را وارد کنید';

          tokenInput.value =
            config.bot_token || '';
        }
      }

      if (chatIdInput) {
        chatIdInput.value =
          config.chat_id || '';
      }

      await loadNotificationLogs(
        0
      );

      await loadNotificationStats();

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در بارگذاری تنظیمات.',
        'error'
      );

      console.error(
        'Error loading telegram settings:',
        error
      );

      return false;
    }
  }

  // ============================================
  // ذخیره تنظیمات تلگرام
  // ============================================
  async function saveTelegramSettings() {
    var toggle =
      document.getElementById(
        'telegram-toggle'
      );

    var tokenInput =
      document.getElementById(
        'telegram-bot-token'
      );

    var chatIdInput =
      document.getElementById(
        'telegram-chat-id'
      );

    var saveButton =
      document.getElementById(
        'telegram-save-btn'
      );

    var isEnabled =
      toggle
        ? toggle.checked
        : false;

    var botToken =
      tokenInput
        ? tokenInput.value.trim()
        : '';

    var chatId =
      chatIdInput
        ? chatIdInput.value.trim()
        : '';

    if (!chatId) {
      setNotificationMessage(
        'شناسه چت (Chat ID) الزامی است.',
        'error'
      );

      return false;
    }

    if (saveButton) {
      saveButton.disabled =
        true;

      saveButton.textContent =
        'در حال ذخیره...';
    }

    var config = {
      chat_id:
        chatId
    };

    if (botToken) {
      config.bot_token =
        botToken;
    }

    try {
      var result =
        await window.api(
          '/api/admin/notifications',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                action:
                  'save_settings',

                channel:
                  'telegram',

                config:
                  config
              })
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        setNotificationMessage(
          result.data?.error ||
          'ذخیره تنظیمات انجام نشد.',
          'error'
        );

        return false;
      }

      var toggleResult =
        await window.api(
          '/api/admin/notifications',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                action:
                  'toggle',

                channel:
                  'telegram',

                enabled:
                  isEnabled
              })
          }
        );

      if (
        !toggleResult.ok ||
        !toggleResult.data?.success
      ) {
        setNotificationMessage(
          'تنظیمات ذخیره شد اما تغییر وضعیت انجام نشد.',
          'error'
        );

        return false;
      }

      setNotificationMessage(
        'تنظیمات تلگرام با موفقیت ذخیره شد.',
        'success'
      );

      updateTelegramToggleStatus(
        isEnabled
      );

      if (
        tokenInput &&
        tokenInput.value
      ) {
        tokenInput.value =
          '';

        tokenInput.placeholder =
          '🔒 توکن ذخیره شده است (برای تغییر، مقدار جدید وارد کنید)';
      }

      await loadTelegramSettings();

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در ذخیره تنظیمات.',
        'error'
      );

      console.error(
        'Error saving telegram settings:',
        error
      );

      return false;

    } finally {
      if (saveButton) {
        saveButton.disabled =
          false;

        saveButton.textContent =
          'ذخیره تنظیمات';
      }
    }
  }

  // ============================================
  // ارسال پیام آزمایشی تلگرام
  // ============================================
  async function sendTelegramTest() {
    var tokenInput =
      document.getElementById(
        'telegram-bot-token'
      );

    var chatIdInput =
      document.getElementById(
        'telegram-chat-id'
      );

    var testButton =
      document.getElementById(
        'telegram-test-btn'
      );

    var botToken =
      tokenInput
        ? tokenInput.value.trim()
        : '';

    var chatId =
      chatIdInput
        ? chatIdInput.value.trim()
        : '';

    if (!chatId) {
      setNotificationMessage(
        'شناسه چت (Chat ID) الزامی است.',
        'error'
      );

      return false;
    }

    if (testButton) {
      testButton.disabled =
        true;

      testButton.textContent =
        '⏳ در حال ارسال...';
    }

    setNotificationMessage(
      'در حال ارسال پیام آزمایشی...',
      'info'
    );

    try {
      var payload = {
        action:
          'test_telegram',

        channel:
          'telegram'
      };

      if (botToken) {
        payload.bot_token =
          botToken;
      }

      if (chatId) {
        payload.chat_id =
          chatId;
      }

      var result =
        await window.api(
          '/api/admin/notifications',
          {
            method:
              'POST',

            body:
              JSON.stringify(
                payload
              )
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        setNotificationMessage(
          result.data?.error ||
          'ارسال پیام آزمایشی انجام نشد.',
          'error'
        );

        return false;
      }

      setNotificationMessage(
        '✅ پیام آزمایشی با موفقیت ارسال شد.',
        'success'
      );

      await loadNotificationLogs(
        notificationLogsPage
      );

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در ارسال پیام آزمایشی.',
        'error'
      );

      console.error(
        'Error sending test message:',
        error
      );

      return false;

    } finally {
      if (testButton) {
        testButton.disabled =
          false;

        testButton.textContent =
          '📨 ارسال پیام آزمایشی';
      }
    }
  }

  // ============================================
  // ========== توابع ایمیل (Email) ==========
  // ============================================

  // ============================================
  // بارگذاری تنظیمات ایمیل
  // ============================================
  async function loadEmailSettings() {
    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=settings&channel=email'
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        setNotificationMessage(
          result.data?.error ||
          'دریافت تنظیمات ایمیل انجام نشد.',
          'error',
          'email-message'
        );

        return false;
      }

      var data =
        result.data;

      var config =
        data.config || {};

      var toggle =
        document.getElementById(
          'email-toggle'
        );

      if (toggle) {
        toggle.checked =
          data.is_enabled === true;

        updateEmailToggleStatus(
          data.is_enabled === true
        );
      }

      var senderInput =
        document.getElementById(
          'email-sender'
        );

      var senderNameInput =
        document.getElementById(
          'email-sender-name'
        );

      var adminEmailInput =
        document.getElementById(
          'email-admin'
        );

      if (senderInput) {
        senderInput.value =
          config.sender_email || '';
      }

      if (senderNameInput) {
        senderNameInput.value =
          config.sender_name || '';
      }

      if (adminEmailInput) {
        adminEmailInput.value =
          config.admin_email || '';
      }

      await loadEmailTemplates();

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در بارگذاری تنظیمات ایمیل.',
        'error',
        'email-message'
      );

      console.error(
        'Error loading email settings:',
        error
      );

      return false;
    }
  }

  // ============================================
  // ذخیره تنظیمات ایمیل
  // ============================================
  async function saveEmailSettings() {
    var toggle =
      document.getElementById(
        'email-toggle'
      );

    var senderInput =
      document.getElementById(
        'email-sender'
      );

    var senderNameInput =
      document.getElementById(
        'email-sender-name'
      );

    var adminEmailInput =
      document.getElementById(
        'email-admin'
      );

    var saveButton =
      document.getElementById(
        'email-save-btn'
      );

    var isEnabled =
      toggle
        ? toggle.checked
        : false;

    var senderEmail =
      senderInput
        ? senderInput.value.trim()
        : '';

    var senderName =
      senderNameInput
        ? senderNameInput.value.trim()
        : '';

    var adminEmail =
      adminEmailInput
        ? adminEmailInput.value.trim()
        : '';

    if (!senderEmail) {
      setNotificationMessage(
        'ایمیل فرستنده (Sender Email) الزامی است.',
        'error',
        'email-message'
      );

      return false;
    }

    if (saveButton) {
      saveButton.disabled =
        true;

      saveButton.textContent =
        'در حال ذخیره...';
    }

    var config = {
      sender_email:
        senderEmail,

      sender_name:
        senderName,

      admin_email:
        adminEmail,

      is_enabled:
        isEnabled
    };

    try {
      var result =
        await window.api(
          '/api/admin/notifications',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                action:
                  'save_settings',

                channel:
                  'email',

                config:
                  config
              })
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        setNotificationMessage(
          result.data?.error ||
          'ذخیره تنظیمات ایمیل انجام نشد.',
          'error',
          'email-message'
        );

        return false;
      }

      setNotificationMessage(
        'تنظیمات ایمیل با موفقیت ذخیره شد.',
        'success',
        'email-message'
      );

      updateEmailToggleStatus(
        isEnabled
      );

      await loadEmailSettings();

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در ذخیره تنظیمات ایمیل.',
        'error',
        'email-message'
      );

      console.error(
        'Error saving email settings:',
        error
      );

      return false;

    } finally {
      if (saveButton) {
        saveButton.disabled =
          false;

        saveButton.textContent =
          '💾 ذخیره تنظیمات';
      }
    }
  }

  // ============================================
  // ارسال ایمیل آزمایشی
  // ============================================
  async function sendEmailTest() {
    var testButton =
      document.getElementById(
        'email-test-btn'
      );

    var recipient =
      prompt(
        'ایمیل گیرنده برای ارسال آزمایشی را وارد کنید:'
      );

    if (!recipient) {
      setNotificationMessage(
        'ایمیل گیرنده مشخص نشد.',
        'error',
        'email-message'
      );

      return false;
    }

    if (testButton) {
      testButton.disabled =
        true;

      testButton.textContent =
        '⏳ در حال ارسال...';
    }

    setNotificationMessage(
      'در حال ارسال ایمیل آزمایشی...',
      'info',
      'email-message'
    );

    try {
      var result =
        await window.api(
          '/api/admin/notifications',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                action:
                  'test_email',

                recipient:
                  recipient
              })
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        setNotificationMessage(
          result.data?.error ||
          'ارسال ایمیل آزمایشی انجام نشد.',
          'error',
          'email-message'
        );

        return false;
      }

      setNotificationMessage(
        '✅ ایمیل آزمایشی با موفقیت ارسال شد.',
        'success',
        'email-message'
      );

      await loadNotificationLogs(
        notificationLogsPage
      );

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در ارسال ایمیل آزمایشی.',
        'error',
        'email-message'
      );

      console.error(
        'Error sending email test:',
        error
      );

      return false;

    } finally {
      if (testButton) {
        testButton.disabled =
          false;

        testButton.textContent =
          '📨 ارسال ایمیل آزمایشی';
      }
    }
  }

  // ============================================
  // بارگذاری Template‌های ایمیل
  // ============================================
  async function loadEmailTemplates() {
    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=email_templates'
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        var errorContainer =
          document.getElementById(
            'email-templates-container'
          );

        if (errorContainer) {
          errorContainer.innerHTML =
            '<div class="admin-message is-error">خطا در بارگذاری قالب‌ها</div>';
        }

        return false;
      }

      var templates =
        result.data.data || [];

      var container =
        document.getElementById(
          'email-templates-container'
        );

      if (!container) {
        return false;
      }

      if (templates.length === 0) {
        container.innerHTML =
          '<div class="admin-message is-info">هیچ قالبی یافت نشد. لطفاً ابتدا یک Template بسازید.</div>';

        return true;
      }

      var eventLabels = {
        order_created:
          'ثبت سفارش',

        payment_pending:
          'در انتظار پرداخت',

        payment_success:
          'پرداخت موفق',

        payment_failed:
          'پرداخت ناموفق',

        order_status_changed:
          'تغییر وضعیت سفارش',

        order_cancelled:
          'لغو سفارش',

        wallet_credit:
          'افزایش موجودی کیف پول',

        wallet_debit:
          'کاهش موجودی کیف پول',

        cashback_applied:
          'اعمال کش‌بک',

        refund_applied:
          'بازپرداخت'
      };

      var html = '';

      for (
        var i = 0;
        i < templates.length;
        i++
      ) {
        var t =
          templates[i];

        var label =
          eventLabels[
            t.event_type
          ] ||
          t.event_type;

        var statusClass =
          t.is_enabled
            ? 'status-badge--success'
            : 'status-badge--danger';

        var statusText =
          t.is_enabled
            ? 'فعال'
            : 'غیرفعال';

        html +=
          '<div class="detail-card" style="margin-bottom:16px;padding:16px;border:1px solid var(--border);border-radius:8px;">';

        html +=
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">';

        html +=
          '<div><strong>' +
          window.esc(label) +
          '</strong> <span class="status-badge ' +
          statusClass +
          '">' +
          statusText +
          '</span></div>';

        html +=
          '<div style="display:flex;gap:8px;">';

        html +=
          '<button class="btn btn-secondary" type="button" data-edit-email-template="' +
          window.esc(t.event_type) +
          '" style="font-size:0.85rem;padding:4px 12px;">✏️ ویرایش</button>';

        html +=
          '<button class="btn btn-secondary" type="button" data-toggle-email-template="' +
          window.esc(t.event_type) +
          '" style="font-size:0.85rem;padding:4px 12px;">' +
          (
            t.is_enabled
              ? '🔇 غیرفعال'
              : '🔊 فعال'
          ) +
          '</button>';

        html +=
          '</div>';

        html +=
          '</div>';

        if (t.exists) {
          html +=
            '<div style="margin-top:8px;font-size:0.9rem;color:var(--muted);">';

          html +=
            '<div><strong>موضوع:</strong> ' +
            window.esc(
              t.subject || ''
            ) +
            '</div>';

          html +=
            '<div style="margin-top:4px;"><strong>متن:</strong> ' +
            (
              t.body
                ? '✅ تنظیم شده'
                : '❌ تنظیم نشده'
            ) +
            '</div>';

          html +=
            '</div>';

        } else {
          html +=
            '<div style="margin-top:8px;color:var(--warning);font-size:0.9rem;">⚠️ این Template هنوز ساخته نشده است.</div>';
        }

        html +=
          '</div>';
      }

      container.innerHTML =
        html;

      return true;

    } catch (error) {
      var errorContainer =
        document.getElementById(
          'email-templates-container'
        );

      if (errorContainer) {
        errorContainer.innerHTML =
          '<div class="admin-message is-error">خطا در بارگذاری قالب‌ها: ' +
          window.esc(
            String(error)
          ) +
          '</div>';
      }

      console.error(
        'Error loading email templates:',
        error
      );

      return false;
    }
  }

  // ============================================
  // ویرایش Template ایمیل
  // ============================================
  async function editEmailTemplate(
    eventType
  ) {
    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=email_template&eventType=' +
          encodeURIComponent(
            eventType
          )
        );

      var template =
        result.data?.data || {};

      var title =
        prompt(
          'عنوان Template:',
          template.title || ''
        );

      if (title === null) {
        return false;
      }

      var subject =
        prompt(
          'موضوع (Subject):',
          template.subject || ''
        );

      if (subject === null) {
        return false;
      }

      var body =
        prompt(
          'متن (Body) - می‌توانید از HTML استفاده کنید:',
          template.body || ''
        );

      if (body === null) {
        return false;
      }

      var isEnabled =
        confirm(
          'آیا این Template فعال باشد؟'
        );

      var saveResult =
        await window.api(
          '/api/admin/notifications',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                action:
                  'save_email_template',

                eventType:
                  eventType,

                title:
                  title,

                subject:
                  subject,

                body:
                  body,

                isEnabled:
                  isEnabled
              })
          }
        );

      if (
        !saveResult.ok ||
        !saveResult.data?.success
      ) {
        setNotificationMessage(
          saveResult.data?.error ||
          'ذخیره Template انجام نشد.',
          'error',
          'email-message'
        );

        return false;
      }

      setNotificationMessage(
        'Template ایمیل با موفقیت ذخیره شد.',
        'success',
        'email-message'
      );

      await loadEmailTemplates();

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در ویرایش Template.',
        'error',
        'email-message'
      );

      console.error(
        'Error editing email template:',
        error
      );

      return false;
    }
  }

  // ============================================
  // تغییر وضعیت Template ایمیل
  // ============================================
  async function toggleEmailTemplate(
    eventType
  ) {
    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=email_template&eventType=' +
          encodeURIComponent(
            eventType
          )
        );

      var template =
        result.data?.data || {};

      var newStatus =
        !template.is_enabled;

      var saveResult =
        await window.api(
          '/api/admin/notifications',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                action:
                  'toggle_email_template',

                eventType:
                  eventType,

                isEnabled:
                  newStatus
              })
          }
        );

      if (
        !saveResult.ok ||
        !saveResult.data?.success
      ) {
        setNotificationMessage(
          saveResult.data?.error ||
          'تغییر وضعیت انجام نشد.',
          'error',
          'email-message'
        );

        return false;
      }

      setNotificationMessage(
        'وضعیت Template با موفقیت تغییر کرد.',
        'success',
        'email-message'
      );

      await loadEmailTemplates();

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در تغییر وضعیت.',
        'error',
        'email-message'
      );

      console.error(
        'Error toggling email template:',
        error
      );

      return false;
    }
  }

  // ============================================
  // بارگذاری تاریخچه اعلان‌ها
  // ============================================
  async function loadNotificationLogs(
    page
  ) {
    page =
      Number.isFinite(
        Number(page)
      )
        ? Number(page)
        : 0;

    try {
      var status =
        document.getElementById(
          'notification-logs-status'
        )?.value || '';

      var eventType =
        document.getElementById(
          'notification-logs-event'
        )?.value || '';

      var params =
        new URLSearchParams({
          action:
            'logs',

          channel:
            'telegram',

          limit:
            String(
              notificationLogsLimit
            ),

          offset:
            String(
              page *
              notificationLogsLimit
            )
        });

      if (status) {
        params.set(
          'status',
          status
        );
      }

      if (eventType) {
        params.set(
          'event_type',
          eventType
        );
      }

      var result =
        await window.api(
          '/api/admin/notifications?' +
          params.toString()
        );

      var tbody =
        document.getElementById(
          'notification-logs-body'
        );

      if (!tbody) {
        return false;
      }

      if (
        !result.ok ||
        !result.data?.success
      ) {
        tbody.innerHTML =
          '<tr><td colspan="7">' +
          window.esc(
            result.data?.error ||
            'دریافت تاریخچه انجام نشد.'
          ) +
          '</td></tr>';

        return false;
      }

      var logs =
        result.data.logs ||
        [];

      var total =
        result.data.total ||
        0;

      if (
        logs.length === 0
      ) {
        tbody.innerHTML =
          '<tr><td colspan="7">هیچ اعلانی ارسال نشده است.</td></tr>';

      } else {
        tbody.innerHTML =
          logs
            .map(
              function(log) {
                var statusBadge =
                  log.status === 'sent'
                    ? '<span class="status-badge status-badge--success">ارسال شده</span>'
                    : log.status === 'failed'
                      ? '<span class="status-badge status-badge--danger">ناموفق</span>'
                      : '<span class="status-badge status-badge--warning">در انتظار</span>';

                var eventMap = {
                  order_created:
                    'ثبت سفارش',

                  test:
                    'آزمایشی'
                };

                var eventText =
                  eventMap[
                    log.event_type
                  ] ||
                  log.event_type;

                var errorText =
                  log.error_message
                    ? '<span style="color:var(--danger);font-size:0.85rem;">' +
                      window.esc(
                        String(
                          log.error_message
                        ).substring(
                          0,
                          100
                        )
                      ) +
                      '</span>'
                    : '-';

                var dateText =
                  log.sent_at ||
                  log.created_at;

                var formattedDate =
                  dateText
                    ? window.formatDate(
                        dateText
                      )
                    : '-';

                var resendButton =
                  log.status === 'failed'
                    ? '<button ' +
                      'class="btn btn-secondary" ' +
                      'type="button" ' +
                      'data-resend-log="' +
                      window.esc(
                        log.id
                      ) +
                      '" ' +
                      'style="font-size:0.8rem;padding:4px 10px;">' +
                      '🔄 ارسال مجدد' +
                      '</button>'
                    : '';

                return (
                  '<tr>' +

                    '<td class="table-number">' +
                      window.esc(
                        log.id
                      ) +
                    '</td>' +

                    '<td>' +
                      window.esc(
                        eventText
                      ) +
                    '</td>' +

                    '<td>' +
                      window.esc(
                        log.recipient ||
                        '-'
                      ) +
                    '</td>' +

                    '<td>' +
                      statusBadge +
                    '</td>' +

                    '<td>' +
                      errorText +
                    '</td>' +

                    '<td class="table-number">' +
                      formattedDate +
                    '</td>' +

                    '<td>' +
                      resendButton +
                    '</td>' +

                  '</tr>'
                );
              }
            )
            .join('');
      }

      var totalPages =
        Math.ceil(
          total /
          notificationLogsLimit
        );

      var paginationText =
        document.getElementById(
          'notification-logs-pagination'
        );

      if (paginationText) {
        paginationText.textContent =
          'صفحه ' +
          (page + 1) +
          ' از ' +
          (totalPages || 1) +
          ' (' +
          total +
          ' مورد)';
      }

      var prevBtn =
        document.getElementById(
          'notification-logs-prev-btn'
        );

      var nextBtn =
        document.getElementById(
          'notification-logs-next-btn'
        );

      if (prevBtn) {
        prevBtn.disabled =
          page === 0;
      }

      if (nextBtn) {
        nextBtn.disabled =
          totalPages === 0 ||
          page >=
            totalPages - 1;
      }

      notificationLogsPage =
        page;

      return true;

    } catch (error) {
      var tbody =
        document.getElementById(
          'notification-logs-body'
        );

      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="7">خطا در دریافت تاریخچه.</td></tr>';
      }

      console.error(
        'Error loading notification logs:',
        error
      );

      return false;
    }
  }

  // ============================================
  // آمار اعلان‌ها
  // ============================================
  async function loadNotificationStats() {
    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=stats'
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        console.warn(
          'دریافت آمار انجام نشد.'
        );

        return false;
      }

      var stats =
        result.data.stats ||
        {};

      var statusCounts =
        stats.status_counts ||
        {};

      var totalEl =
        document.getElementById(
          'stat-notifications-total'
        );

      var sentEl =
        document.getElementById(
          'stat-notifications-sent'
        );

      var failedEl =
        document.getElementById(
          'stat-notifications-failed'
        );

      var pendingEl =
        document.getElementById(
          'stat-notifications-pending'
        );

      if (totalEl) {
        totalEl.textContent =
          stats.total || 0;
      }

      if (sentEl) {
        sentEl.textContent =
          statusCounts.sent || 0;
      }

      if (failedEl) {
        failedEl.textContent =
          statusCounts.failed || 0;
      }

      if (pendingEl) {
        pendingEl.textContent =
          statusCounts.pending || 0;
      }

      return true;

    } catch (error) {
      console.error(
        'Error loading notification stats:',
        error
      );

      return false;
    }
  }

  // ============================================
  // تب‌های اصلی اعلان‌ها
  // ============================================
  function activateNotificationTab(
    target
  ) {
    var tabs =
      document.querySelectorAll(
        '[data-notification-tab]'
      );

    if (!tabs.length) {
      return;
    }

    tabs.forEach(
      function(tab) {
        tab.classList.toggle(
          'is-active',
          tab.dataset.notificationTab ===
          target
        );
      }
    );

    var contents = {
      telegram:
        document.getElementById(
          'notification-tab-telegram'
        ),

      email:
        document.getElementById(
          'notification-tab-email'
        ),

      sms:
        document.getElementById(
          'notification-tab-sms'
        ),

      mobile:
        document.getElementById(
          'notification-tab-mobile'
        )
    };

    Object.keys(contents).forEach(
      function(key) {
        if (contents[key]) {
          contents[key].classList.toggle(
            'is-active',
            key === target
          );
        }
      }
    );

    if (
      target ===
      'telegram'
    ) {
      loadTelegramSettings();

    } else if (
      target ===
      'email'
    ) {
      loadEmailSettings();

    } else if (
      target ===
      'sms'
    ) {
      if (
        typeof window.loadSmsSettings ===
        'function'
      ) {
        window.loadSmsSettings();
      }
    } else if (
      target ===
      'mobile'
    ) {
      loadMobileNotificationSettings();
    }
  }

  // ============================================
  // Event Delegation
  // ============================================
  function setupNotificationEvents() {
    if (
      document.documentElement
        .dataset
        .notificationEventsBound ===
      '1'
    ) {
      return;
    }

    document.documentElement
      .dataset
      .notificationEventsBound =
      '1';

    document.addEventListener(
      'click',
      async function(event) {
        var target =
          event.target;

        // ======================================
        // تب‌های اصلی
        // ======================================
        var notificationTab =
          target.closest(
            '[data-notification-tab]'
          );

        if (notificationTab) {
          event.preventDefault();

          activateNotificationTab(
            notificationTab.dataset.notificationTab
          );

          return;
        }

        // ======================================
        // ذخیره Telegram
        // ======================================
        if (
          target.closest(
            '#telegram-save-btn'
          )
        ) {
          event.preventDefault();

          await saveTelegramSettings();

          return;
        }

        // ======================================
        // تست Telegram
        // ======================================
        if (
          target.closest(
            '#telegram-test-btn'
          )
        ) {
          event.preventDefault();

          await sendTelegramTest();

          return;
        }

        // ======================================
        // بارگذاری دوباره Telegram
        // ======================================
        if (
          target.closest(
            '#telegram-load-btn'
          )
        ) {
          event.preventDefault();

          await loadTelegramSettings();

          return;
        }

        // ======================================
        // دکمه‌های Email
        // ======================================

        // ذخیره Email
        if (
          target.closest(
            '#email-save-btn'
          )
        ) {
          event.preventDefault();

          await saveEmailSettings();

          return;
        }

        // تست Email
        if (
          target.closest(
            '#email-test-btn'
          )
        ) {
          event.preventDefault();

          await sendEmailTest();

          return;
        }

        // بارگذاری دوباره Email
        if (
          target.closest(
            '#email-load-btn'
          )
        ) {
          event.preventDefault();

          await loadEmailSettings();

          return;
        }

        // بارگذاری مجدد Template‌های Email
        if (
          target.closest(
            '#email-templates-refresh-btn'
          )
        ) {
          event.preventDefault();

          await loadEmailTemplates();

          return;
        }

        // ویرایش Template ایمیل
        var editBtn =
          target.closest(
            '[data-edit-email-template]'
          );

        if (editBtn) {
          event.preventDefault();

          var editEventType =
            editBtn.getAttribute(
              'data-edit-email-template'
            );

          await editEmailTemplate(
            editEventType
          );

          return;
        }

        // تغییر وضعیت Template ایمیل
        var toggleBtn =
          target.closest(
            '[data-toggle-email-template]'
          );

        if (toggleBtn) {
          event.preventDefault();

          var toggleEventType =
            toggleBtn.getAttribute(
              'data-toggle-email-template'
            );

          await toggleEmailTemplate(
            toggleEventType
          );

          return;
        }

        // ======================================
        // ذخیره تنظیمات اعلان موبایل
        // ======================================
        if (
          target.closest(
            '#mobile-save-btn'
          )
        ) {
          event.preventDefault();
          await saveMobileNotificationSettings();
          return;
        }

        // ======================================
        // بارگذاری مجدد اعلان موبایل
        // ======================================
        if (
          target.closest(
            '#mobile-load-btn'
          )
        ) {
          event.preventDefault();
          await loadMobileNotificationSettings();
          return;
        }

        // ======================================
        // تغییر Event اعلان موبایل
        // ======================================
        var mobileEventInput = target.closest('[data-mobile-event]');
        if (mobileEventInput) {
          var eventKey = mobileEventInput.getAttribute('data-mobile-event');
          await toggleMobileNotificationEvent(
            eventKey,
            mobileEventInput.checked
          );
          return;
        }

        // ======================================
        // بارگذاری تاریخچه
        // ======================================
        if (
          target.closest(
            '#notification-logs-refresh-btn'
          )
        ) {
          event.preventDefault();

          await loadNotificationLogs(
            0
          );

          await loadNotificationStats();

          return;
        }

        // ======================================
        // صفحه قبلی
        // ======================================
        if (
          target.closest(
            '#notification-logs-prev-btn'
          )
        ) {
          event.preventDefault();

          if (
            notificationLogsPage >
            0
          ) {
            await loadNotificationLogs(
              notificationLogsPage - 1
            );
          }

          return;
        }

        // ======================================
        // صفحه بعدی
        // ======================================
        if (
          target.closest(
            '#notification-logs-next-btn'
          )
        ) {
          event.preventDefault();

          await loadNotificationLogs(
            notificationLogsPage + 1
          );

          return;
        }

        // ======================================
        // ارسال مجدد
        // ======================================
        var resendButton =
          target.closest(
            '[data-resend-log]'
          );

        if (resendButton) {
          event.preventDefault();

          await resendNotification(
            resendButton
          );

          return;
        }
      }
    );

    // ========================================
    // تغییر فیلترهای تاریخچه
    // ========================================
    document.addEventListener(
      'change',
      async function(event) {
        var target =
          event.target;

        if (
          target.id ===
            'notification-logs-status' ||
          target.id ===
            'notification-logs-event'
        ) {
          await loadNotificationLogs(
            0
          );
        }
      }
    );
  }

  // ============================================
  // ارسال مجدد اعلان
  // ============================================
  async function resendNotification(
    button
  ) {
    if (!button) {
      return false;
    }

    var logId =
      button.getAttribute(
        'data-resend-log'
      );

    if (!logId) {
      return false;
    }

    if (
      !window.confirm(
        'آیا از ارسال مجدد این اعلان مطمئن هستی؟'
      )
    ) {
      return false;
    }

    button.disabled =
      true;

    button.textContent =
      '⏳ ...';

    try {
      var result =
        await window.api(
          '/api/admin/notifications',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                action:
                  'resend',

                log_id:
                  Number(logId)
              })
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        setNotificationMessage(
          result.data?.error ||
          'ارسال مجدد انجام نشد.',
          'error'
        );

        return false;
      }

      setNotificationMessage(
        '✅ اعلان با موفقیت ارسال مجدد شد.',
        'success'
      );

      await loadNotificationLogs(
        notificationLogsPage
      );

      await loadNotificationStats();

      return true;

    } catch (error) {
      setNotificationMessage(
        'خطا در ارسال مجدد.',
        'error'
      );

      console.error(
        'Error resending notification:',
        error
      );

      return false;

    } finally {
      button.disabled =
        false;

      button.textContent =
        '🔄 ارسال مجدد';
    }
  }

  // ============================================
  // مقداردهی اولیه
  // ============================================
  function setupNotificationTabs() {
    setupNotificationEvents();

    var tabs =
      document.querySelectorAll(
        '[data-notification-tab]'
      );

    if (!tabs.length) {
      return;
    }

    var activeTab =
      document.querySelector(
        '[data-notification-tab].is-active'
      );

    activateNotificationTab(
      activeTab
        ? activeTab.dataset.notificationTab
        : 'telegram'
    );
  }

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.loadTelegramSettings =
    loadTelegramSettings;

  window.saveTelegramSettings =
    saveTelegramSettings;

  window.sendTelegramTest =
    sendTelegramTest;

  window.updateTelegramToggleStatus =
    updateTelegramToggleStatus;

  window.loadEmailSettings =
    loadEmailSettings;

  window.saveEmailSettings =
    saveEmailSettings;

  window.sendEmailTest =
    sendEmailTest;

  window.loadEmailTemplates =
    loadEmailTemplates;

  window.editEmailTemplate =
    editEmailTemplate;

  window.toggleEmailTemplate =
    toggleEmailTemplate;

  window.updateEmailToggleStatus =
    updateEmailToggleStatus;

  window.loadNotificationLogs =
    loadNotificationLogs;

  window.loadNotificationStats =
    loadNotificationStats;

  window.setupNotificationTabs =
    setupNotificationTabs;

  window.setNotificationMessage =
    setNotificationMessage;

  window.resendNotification =
    resendNotification;

  window.loadMobileNotificationSettings =
    loadMobileNotificationSettings;

  window.saveMobileNotificationSettings =
    saveMobileNotificationSettings;

  window.toggleMobileNotificationEvent =
    toggleMobileNotificationEvent;

  // ============================================
  // راه‌اندازی
  // ============================================
  setupNotificationEvents();

  console.log(
    '✅ Notifications module loaded successfully'
  );

})();