// ============================================
// notifications.js - مدیریت اعلان‌ها
// Telegram + Notification Logs
// ============================================

(function() {
  'use strict';

  // ============================================
  // متغیرهای محلی
  // ============================================
  var notificationLogsPage = 0;
  var notificationLogsLimit = 20;

  // ============================================
  // نمایش پیام
  // ============================================
  function setNotificationMessage(
    message,
    type
  ) {
    var msg =
      document.getElementById(
        'notification-message'
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
  // ارسال پیام آزمایشی
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
      'sms'
    ) {
      if (
        typeof window.loadSmsSettings ===
        'function'
      ) {
        window.loadSmsSettings();
      }
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

  // ============================================
  // راه‌اندازی
  // ============================================
  setupNotificationEvents();

  console.log(
    "✅ Notifications module loaded successfully"
  );

})();