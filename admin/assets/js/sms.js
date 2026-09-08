// ============================================
// sms.js - مدیریت کامل SMS
// ============================================

(function() {
  'use strict';

  // ============================================
  // متغیرهای محلی
  // ============================================
  var smsLogsPage = 0;
  var smsLogsLimit = 20;
  var smsInboxPage = 0;
  var smsInboxLimit = 20;

  // ============================================
  // نمایش پیام در بخش SMS
  // ============================================
  function showSmsMessage(message, type) {
    var msg = document.getElementById('sms-message');
    if (!msg) return;

    msg.textContent = message || '';
    msg.className = 'admin-message';

    if (message) {
      msg.classList.add(type === 'success' ? 'is-success' : 'is-error');
      msg.style.display = 'block';

      setTimeout(function() {
        msg.style.display = 'none';
      }, 5000);
    }
  }

  // ============================================
  // بروزرسانی وضعیت Toggle SMS
  // ============================================
  function updateSmsToggleStatus(enabled) {
    var statusText =
      document.getElementById('sms-toggle-status');

    if (!statusText) return;

    if (enabled) {
      statusText.textContent = 'فعال';
      statusText.className = 'toggle-status';
    } else {
      statusText.textContent = 'غیرفعال';
      statusText.className = 'toggle-status is-disabled';
    }
  }

  // ============================================
  // بارگذاری تنظیمات SMS
  // ============================================
  async function loadSmsSettings() {
    try {
      var result = await window.api(
        '/api/admin/notifications?action=settings&channel=sms'
      );

      if (!result.ok || !result.data?.success) {
        showSmsMessage(
          result.data?.error ||
          'دریافت تنظیمات SMS انجام نشد.',
          'error'
        );
        return;
      }

      var data = result.data;
      var config = data.config || {};

      var toggle =
        document.getElementById('sms-toggle');

      if (toggle) {
        toggle.checked =
          data.is_enabled === true;

        updateSmsToggleStatus(
          data.is_enabled === true
        );
      }

      var fields = {
        'sms-admin-phone':
          config.admin_phone || '',

        'sms-default-sender':
          config.default_sender || '',

        'sms-polling-interval':
          config.polling_interval || 30,

        'sms-max-per-minute':
          config.max_sms_per_minute || 10,

        'sms-gateway-url':
          config.gateway_url || ''
      };

      for (var id in fields) {
        if (fields.hasOwnProperty(id)) {
          var el =
            document.getElementById(id);

          if (el) {
            el.value =
              fields[id];
          }
        }
      }

      var events = {
        'sms-event-order-created-admin':
          config.event_order_created_admin !== undefined
            ? config.event_order_created_admin
            : true,

        'sms-event-order-created-user':
          config.event_order_created_user || false,

        'sms-event-order-status-changed-user':
          config.event_order_status_changed_user || false,

        'sms-event-payment-success-admin':
          config.event_payment_success_admin !== undefined
            ? config.event_payment_success_admin
            : true,

        'sms-event-payment-success-user':
          config.event_payment_success_user || false,

        'sms-event-order-cancelled-user':
          config.event_order_cancelled_user || false
      };

      for (var evId in events) {
        if (events.hasOwnProperty(evId)) {
          var evEl =
            document.getElementById(evId);

          if (evEl) {
            evEl.checked =
              events[evId];
          }
        }
      }

      await loadSmsStats();
      await loadSmsLogs(0);
      await loadSmsInbox(0);
      await loadSmsGatewayStatus();

    } catch (error) {
      showSmsMessage(
        'خطا در بارگذاری تنظیمات SMS.',
        'error'
      );

      console.error(
        'Error loading SMS settings:',
        error
      );
    }
  }

  // ============================================
  // ذخیره تنظیمات SMS
  // ============================================
  async function saveSmsSettings() {
    var toggle =
      document.getElementById('sms-toggle');

    var isEnabled =
      toggle
        ? toggle.checked
        : false;

    var config = {
      is_enabled:
        isEnabled,

      admin_phone:
        document.getElementById(
          'sms-admin-phone'
        )?.value?.trim() || '',

      default_sender:
        document.getElementById(
          'sms-default-sender'
        )?.value?.trim() || '',

      polling_interval:
        parseInt(
          document.getElementById(
            'sms-polling-interval'
          )?.value || '30',
          10
        ),

      max_sms_per_minute:
        parseInt(
          document.getElementById(
            'sms-max-per-minute'
          )?.value || '10',
          10
        ),

      gateway_url:
        document.getElementById(
          'sms-gateway-url'
        )?.value?.trim() || '',

      event_order_created_admin:
        document.getElementById(
          'sms-event-order-created-admin'
        )?.checked || false,

      event_order_created_user:
        document.getElementById(
          'sms-event-order-created-user'
        )?.checked || false,

      event_order_status_changed_user:
        document.getElementById(
          'sms-event-order-status-changed-user'
        )?.checked || false,

      event_payment_success_admin:
        document.getElementById(
          'sms-event-payment-success-admin'
        )?.checked || false,

      event_payment_success_user:
        document.getElementById(
          'sms-event-payment-success-user'
        )?.checked || false,

      event_order_cancelled_user:
        document.getElementById(
          'sms-event-order-cancelled-user'
        )?.checked || false
    };

    var saveButton =
      document.getElementById(
        'sms-save-btn'
      );

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent =
        '⏳ در حال ذخیره...';
    }

    try {
      var result =
        await window.api(
          '/api/admin/notifications',
          {
            method: 'POST',

            body: JSON.stringify({
              action:
                'save_settings',

              channel:
                'sms',

              config:
                config
            })
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        showSmsMessage(
          result.data?.error ||
          'ذخیره تنظیمات SMS انجام نشد.',
          'error'
        );

        return;
      }

      showSmsMessage(
        'تنظیمات SMS با موفقیت ذخیره شد.',
        'success'
      );

      updateSmsToggleStatus(
        isEnabled
      );

      await loadSmsSettings();

    } catch (error) {
      showSmsMessage(
        'خطا در ذخیره تنظیمات SMS.',
        'error'
      );

      console.error(
        'Error saving SMS settings:',
        error
      );

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
  // بارگذاری آمار SMS
  // ============================================
  async function loadSmsStats() {
    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=sms_stats'
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        console.warn(
          'دریافت آمار SMS انجام نشد.'
        );
        return;
      }

      var stats =
        result.data.stats || {};

      var outbox =
        stats.outbox || {};

      var inbox =
        stats.inbox || {};

      var totalEl =
        document.getElementById(
          'sms-stat-total'
        );

      var pendingEl =
        document.getElementById(
          'sms-stat-pending'
        );

      var sentEl =
        document.getElementById(
          'sms-stat-sent'
        );

      var failedEl =
        document.getElementById(
          'sms-stat-failed'
        );

      var inboxTotalEl =
        document.getElementById(
          'sms-stat-inbox-total'
        );

      var inboxProcessedEl =
        document.getElementById(
          'sms-stat-inbox-processed'
        );

      var inboxUnprocessedEl =
        document.getElementById(
          'sms-stat-inbox-unprocessed'
        );

      if (totalEl) {
        totalEl.textContent =
          outbox.total || 0;
      }

      if (pendingEl) {
        pendingEl.textContent =
          outbox.pending || 0;
      }

      if (sentEl) {
        sentEl.textContent =
          outbox.sent || 0;
      }

      if (failedEl) {
        failedEl.textContent =
          outbox.failed || 0;
      }

      if (inboxTotalEl) {
        inboxTotalEl.textContent =
          inbox.total || 0;
      }

      if (inboxProcessedEl) {
        inboxProcessedEl.textContent =
          inbox.processed || 0;
      }

      if (inboxUnprocessedEl) {
        inboxUnprocessedEl.textContent =
          inbox.unprocessed || 0;
      }

    } catch (error) {
      console.error(
        'Error loading SMS stats:',
        error
      );
    }
  }

  // ============================================
  // بارگذاری وضعیت Gateway
  // ============================================
  async function loadSmsGatewayStatus() {
    try {
      var result =
        await window.api(
          '/api/sms/status'
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        console.warn(
          'دریافت وضعیت Gateway انجام نشد.'
        );
        return;
      }

      var data =
        result.data.data || {};

      var statusEl =
        document.getElementById(
          'sms-gateway-status'
        );

      var lastActivityEl =
        document.getElementById(
          'sms-gateway-last-activity'
        );

      if (statusEl) {
        var gatewayStatus =
          data.gateway_status ||
          'unknown';

        var statusMap = {
          online:
            '🟢 آنلاین',

          degraded:
            '🟡 مشکل دارد',

          offline:
            '🔴 آفلاین',

          unknown:
            '⚪ نامشخص'
        };

        statusEl.textContent =
          statusMap[gatewayStatus] ||
          '⚪ نامشخص';

        statusEl.className =
          'sms-status-indicator ' +
          gatewayStatus;
      }

      if (lastActivityEl) {
        lastActivityEl.textContent =
          data.last_activity
            ? window.formatDate(
                data.last_activity
              )
            : '—';
      }

    } catch (error) {
      console.error(
        'Error loading gateway status:',
        error
      );
    }
  }

  // ============================================
  // بارگذاری لاگ‌های SMS
  // ============================================
  async function loadSmsLogs(page) {
    page =
      Number.isFinite(
        Number(page)
      )
        ? Number(page)
        : 0;

    try {
      var status =
        document.getElementById(
          'sms-logs-status'
        )?.value || '';

      var direction =
        document.getElementById(
          'sms-logs-direction'
        )?.value || '';

      var params =
        new URLSearchParams({
          action:
            'gateway_logs',

          limit:
            String(
              smsLogsLimit
            ),

          offset:
            String(
              page *
              smsLogsLimit
            )
        });

      if (status) {
        params.set(
          'status',
          status
        );
      }

      if (direction) {
        params.set(
          'direction',
          direction
        );
      }

      var result =
        await window.api(
          '/api/admin/notifications?' +
          params.toString()
        );

      var tbody =
        document.getElementById(
          'sms-logs-body'
        );

      if (!tbody) {
        return;
      }

      if (
        !result.ok ||
        !result.data?.success
      ) {
        tbody.innerHTML =
          '<tr><td colspan="6">' +
          window.esc(
            result.data?.error ||
            'دریافت لاگ‌ها انجام نشد.'
          ) +
          '</td></tr>';

        return;
      }

      var logs =
        result.data.logs || [];

      var total =
        result.data.total || 0;

      if (
        logs.length === 0
      ) {
        tbody.innerHTML =
          '<tr><td colspan="6">هیچ لاگی ثبت نشده است.</td></tr>';

      } else {
        tbody.innerHTML =
          logs
            .map(
              function(log) {
                var statusBadge =
                  log.status === 'success'

                    ? '<span class="status-badge status-badge--success">موفق</span>'

                    : log.status === 'failed'

                      ? '<span class="status-badge status-badge--danger">ناموفق</span>'

                      : '<span class="status-badge status-badge--warning">در انتظار</span>';

                var directionText =
                  log.direction === 'outbound'
                    ? '📤 ارسال'
                    : '📥 دریافت';

                var errorText =
                  log.error_message
                    ? '<span style="color:var(--danger);font-size:0.85rem;">' +
                      window.esc(
                        String(
                          log.error_message
                        ).substring(
                          0,
                          50
                        )
                      ) +
                      '</span>'
                    : '-';

                var dateText =
                  window.formatDate(
                    log.created_at
                  );

                return (
                  '<tr>' +

                    '<td class="table-number">' +
                      window.esc(
                        log.id
                      ) +
                    '</td>' +

                    '<td>' +
                      directionText +
                    '</td>' +

                    '<td>' +
                      window.esc(
                        log.message_id ||
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
                      dateText +
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
          smsLogsLimit
        );

      var paginationText =
        document.getElementById(
          'sms-logs-pagination'
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
          'sms-logs-prev-btn'
        );

      var nextBtn =
        document.getElementById(
          'sms-logs-next-btn'
        );

      if (prevBtn) {
        prevBtn.disabled =
          page === 0;
      }

      if (nextBtn) {
        nextBtn.disabled =
          page >=
            totalPages - 1 ||
          totalPages === 0;
      }

      smsLogsPage =
        page;

    } catch (error) {
      var errorBody =
        document.getElementById(
          'sms-logs-body'
        );

      if (errorBody) {
        errorBody.innerHTML =
          '<tr><td colspan="6">خطا در دریافت لاگ‌ها.</td></tr>';
      }

      console.error(
        'Error loading SMS logs:',
        error
      );
    }
  }

  // ============================================
  // بارگذاری پیامک‌های دریافتی
  // ============================================
  async function loadSmsInbox(page) {
    page =
      Number.isFinite(
        Number(page)
      )
        ? Number(page)
        : 0;

    try {
      var status =
        document.getElementById(
          'sms-inbox-status'
        )?.value || '';

      var params =
        new URLSearchParams({
          action:
            'sms_inbox',

          limit:
            String(
              smsInboxLimit
            ),

          offset:
            String(
              page *
              smsInboxLimit
            )
        });

      if (status) {
        params.set(
          'status',
          status
        );
      }

      var result =
        await window.api(
          '/api/admin/notifications?' +
          params.toString()
        );

      var tbody =
        document.getElementById(
          'sms-inbox-body'
        );

      if (!tbody) {
        return;
      }

      if (
        !result.ok ||
        !result.data?.success
      ) {
        tbody.innerHTML =
          '<tr><td colspan="6">' +
          window.esc(
            result.data?.error ||
            'دریافت پیامک‌ها انجام نشد.'
          ) +
          '</td></tr>';

        return;
      }

      var sms =
        result.data.sms || [];

      var total =
        result.data.total || 0;

      if (
        sms.length === 0
      ) {
        tbody.innerHTML =
          '<tr><td colspan="6">هیچ پیامکی دریافت نشده است.</td></tr>';

      } else {
        tbody.innerHTML =
          sms
            .map(
              function(item) {
                var statusBadge =
                  item.status ===
                  'processed'

                    ? '<span class="status-badge status-badge--success">پردازش شده</span>'

                    : '<span class="status-badge status-badge--warning">دریافت شده</span>';

                var dateText =
                  window.formatDate(
                    item.received_at ||
                    item.created_at
                  );

                return (
                  '<tr>' +

                    '<td class="table-number">' +
                      window.esc(
                        item.id
                      ) +
                    '</td>' +

                    '<td>' +
                      window.esc(
                        item.sender ||
                        '-'
                      ) +
                    '</td>' +

                    '<td>' +
                      window.esc(
                        item.recipient ||
                        '-'
                      ) +
                    '</td>' +

                    '<td style="max-width:200px;white-space:normal;word-break:break-word;">' +
                      window.esc(
                        item.message ||
                        '-'
                      ) +
                    '</td>' +

                    '<td>' +
                      statusBadge +
                    '</td>' +

                    '<td class="table-number">' +
                      dateText +
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
          smsInboxLimit
        );

      var paginationText =
        document.getElementById(
          'sms-inbox-pagination'
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
          'sms-inbox-prev-btn'
        );

      var nextBtn =
        document.getElementById(
          'sms-inbox-next-btn'
        );

      if (prevBtn) {
        prevBtn.disabled =
          page === 0;
      }

      if (nextBtn) {
        nextBtn.disabled =
          page >=
            totalPages - 1 ||
          totalPages === 0;
      }

      smsInboxPage =
        page;

    } catch (error) {
      var errorBody =
        document.getElementById(
          'sms-inbox-body'
        );

      if (errorBody) {
        errorBody.innerHTML =
          '<tr><td colspan="6">خطا در دریافت پیامک‌ها.</td></tr>';
      }

      console.error(
        'Error loading SMS inbox:',
        error
      );
    }
  }

  // ============================================
  // بارگذاری قالب‌های SMS (⭐ اصلاح شده با ۱۱ وضعیت رسمی)
  // ============================================
  async function loadSmsTemplates() {
    var container =
      document.getElementById(
        'sms-templates-container'
      );

    if (!container) return;

    container.innerHTML =
      '<div class="admin-loading">در حال بارگذاری قالب‌ها...</div>';

    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=sms_templates'
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        container.innerHTML =
          '<div class="admin-message is-error">' +
          'خطا در بارگذاری قالب‌ها: ' +
          window.esc(
            result.data?.error ||
            'خطای ناشناخته'
          ) +
          '</div>';

        return;
      }

      var templates =
        result.data.data || [];

      if (
        templates.length === 0
      ) {
        container.innerHTML =
          '<div class="admin-message is-warning">هیچ قالبی یافت نشد.</div>';

        return;
      }

      // ⭐ اصلاح شده: فقط ۱۱ وضعیت رسمی + ۲ ادمین
      var eventMap = {
        'payment_pending': 'در انتظار پرداخت',
        'payment_success': 'پرداخت موفق',
        'payment_failed': 'پرداخت ناموفق',
        'order_confirmed': 'تأیید سفارش',
        'courier_delivery': 'ارسال با پیک',
        'bus_shipping': 'ارسال با باربری',
        'shipped': 'ارسال شد',
        'delivered': 'تحویل داده شد',
        'completed': 'تکمیل شد',
        'cancelled': 'لغو شد',
        'returned': 'مرجوع شد',
        'admin_order_created': 'سفارش جدید (ادمین)',
        'admin_payment_success': 'پرداخت موفق (ادمین)'
      };

      var html =
        '<div style="display:grid;gap:16px;">';

      for (
        var i = 0;
        i < templates.length;
        i++
      ) {
        var template =
          templates[i];

        var title =
          eventMap[
            template.event_type
          ] ||
          template.event_type;

        var isEnabled =
          template.is_enabled ===
          1;

        html +=
          '<div class="detail-card" style="background:var(--surface-2);border-left:4px solid ' +
          (
            isEnabled
              ? 'var(--success)'
              : 'var(--danger)'
          ) +
          ';">' +

            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">' +

              '<div>' +

                '<h4 style="margin:0;">' +
                  window.esc(
                    title
                  ) +
                '</h4>' +

                '<small style="color:var(--muted);">' +
                  'رویداد: ' +
                  window.esc(
                    template.event_type
                  ) +
                '</small>' +

                '<span class="status-badge ' +
                (
                  isEnabled
                    ? 'status-badge--success'
                    : 'status-badge--danger'
                ) +
                '" style="margin-right:8px;">' +
                  (
                    isEnabled
                      ? '✅ فعال'
                      : '❌ غیرفعال'
                  ) +
                '</span>' +

              '</div>' +

              '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +

                '<button class="btn btn-secondary" type="button" data-edit-template="' +
                window.esc(
                  template.event_type
                ) +
                '" style="font-size:0.85rem;padding:4px 12px;">' +
                  '✏️ ویرایش' +
                '</button>' +

                '<button class="btn btn-secondary" type="button" data-toggle-template="' +
                window.esc(
                  template.event_type
                ) +
                '" style="font-size:0.85rem;padding:4px 12px;">' +

                  (
                    isEnabled
                      ? '🔇 غیرفعال'
                      : '🔊 فعال'
                  ) +

                '</button>' +

                '<button class="btn btn-secondary" type="button" data-test-template="' +
                window.esc(
                  template.event_type
                ) +
                '" style="font-size:0.85rem;padding:4px 12px;">' +
                  '📨 تست' +
                '</button>' +

                '<button class="btn btn-secondary" type="button" data-preview-template="' +
                window.esc(
                  template.event_type
                ) +
                '" style="font-size:0.85rem;padding:4px 12px;">' +
                  '👁️ پیش‌نمایش' +
                '</button>' +

              '</div>' +

            '</div>' +

            '<div style="margin-top:8px;padding:12px;background:var(--color-kumo-base);border-radius:8px;font-size:0.9rem;white-space:pre-wrap;word-break:break-word;border:1px solid var(--border);">' +
              window.esc(
                template.message_template
              ) +
            '</div>' +

            '<small style="color:var(--muted);display:block;margin-top:6px;">' +
              'آخرین به‌روزرسانی: ' +
              window.formatDate(
                template.updated_at
              ) +
            '</small>' +

          '</div>';
      }

      html +=
        '</div>';

      container.innerHTML =
        html;

    } catch (error) {
      container.innerHTML =
        '<div class="admin-message is-error">' +
        'خطا در بارگذاری قالب‌ها: ' +
        window.esc(
          error.message
        ) +
        '</div>';
    }
  }

  // ============================================
  // باز کردن ویرایشگر قالب
  // ============================================
  function openTemplateEditor(
    eventType
  ) {
    window.api(
      '/api/admin/notifications?action=sms_template&eventType=' +
      encodeURIComponent(
        eventType
      )
    )
      .then(
        function(result) {
          if (
            !result.ok ||
            !result.data?.success
          ) {
            alert(
              result.data?.error ||
              'دریافت قالب انجام نشد.'
            );

            return;
          }

          var template =
            result.data.data;

          if (!template) {
            alert(
              'قالب یافت نشد.'
            );

            return;
          }

          var eventMap = {
            'payment_pending': 'در انتظار پرداخت',
            'payment_success': 'پرداخت موفق',
            'payment_failed': 'پرداخت ناموفق',
            'order_confirmed': 'تأیید سفارش',
            'courier_delivery': 'ارسال با پیک',
            'bus_shipping': 'ارسال با باربری',
            'shipped': 'ارسال شد',
            'delivered': 'تحویل داده شد',
            'completed': 'تکمیل شد',
            'cancelled': 'لغو شد',
            'returned': 'مرجوع شد',
            'admin_order_created': 'سفارش جدید (ادمین)',
            'admin_payment_success': 'پرداخت موفق (ادمین)'
          };

          var title =
            eventMap[
              template.event_type
            ] ||
            template.event_type;

          document
            .querySelector(
              '.template-editor-overlay'
            )
            ?.remove();

          var overlay =
            document.createElement(
              'div'
            );

          overlay.className =
            'template-editor-overlay';

          overlay.innerHTML =
            '<div class="template-editor-modal">' +

              '<h3 style="margin:0 0 16px;">' +
                '✏️ ویرایش قالب: ' +
                window.esc(
                  title
                ) +
              '</h3>' +

              '<div class="form-field" style="margin-bottom:16px;">' +
                '<label>عنوان</label>' +

                '<input id="template-editor-title" type="text" value="' +
                  window.esc(
                    template.title
                  ) +
                '" />' +

              '</div>' +

              '<div class="form-field" style="margin-bottom:16px;">' +

                '<label>متن قالب</label>' +

                '<textarea id="template-editor-content" rows="6" style="font-family:monospace;">' +
                  window.esc(
                    template.message_template
                  ) +
                '</textarea>' +

                '<small class="admin-help">' +
                  'از متغیرهای {customer_name}, {order_number}, {amount}, ... استفاده کنید.' +
                '</small>' +

              '</div>' +

              '<div class="form-field" style="margin-bottom:16px;">' +

                '<label>' +

                  '<input type="checkbox" id="template-editor-enabled" ' +
                  (
                    template.is_enabled === 1
                      ? 'checked'
                      : ''
                  ) +
                  ' /> فعال' +

                '</label>' +

              '</div>' +

              '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +

                '<button class="btn btn-primary" type="button" id="template-editor-save">' +
                  '💾 ذخیره' +
                '</button>' +

                '<button class="btn btn-secondary" type="button" id="template-editor-preview">' +
                  '👁️ پیش‌نمایش' +
                '</button>' +

                '<button class="btn btn-secondary" type="button" id="template-editor-close">' +
                  '❌ بستن' +
                '</button>' +

              '</div>' +

              '<div id="template-editor-preview-area" class="template-preview-area"></div>' +

            '</div>';

          document.body.appendChild(
            overlay
          );

          // ------------------------------------------
          // ذخیره
          // ------------------------------------------
          var saveButton =
            document.getElementById(
              'template-editor-save'
            );

          if (saveButton) {
            saveButton.addEventListener(
              'click',
              async function() {
                var titleInput =
                  document.getElementById(
                    'template-editor-title'
                  );

                var contentInput =
                  document.getElementById(
                    'template-editor-content'
                  );

                var enabledInput =
                  document.getElementById(
                    'template-editor-enabled'
                  );

                var title =
                  titleInput
                    ? titleInput.value.trim()
                    : '';

                var messageTemplate =
                  contentInput
                    ? contentInput.value.trim()
                    : '';

                var isEnabled =
                  enabledInput
                    ? enabledInput.checked
                    : false;

                if (
                  !title ||
                  !messageTemplate
                ) {
                  alert(
                    'عنوان و متن قالب الزامی هستند.'
                  );

                  return;
                }

                saveButton.disabled =
                  true;

                saveButton.textContent =
                  '⏳ ذخیره...';

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
                              'save_sms_template',

                            eventType:
                              template.event_type,

                            title:
                              title,

                            messageTemplate:
                              messageTemplate,

                            isEnabled:
                              isEnabled
                          })
                      }
                    );

                  if (
                    !result.ok ||
                    !result.data?.success
                  ) {
                    alert(
                      result.data?.error ||
                      'ذخیره قالب انجام نشد.'
                    );

                    saveButton.disabled =
                      false;

                    saveButton.textContent =
                      '💾 ذخیره';

                    return;
                  }

                  var editor =
                    document.querySelector(
                      '.template-editor-overlay'
                    );

                  if (editor) {
                    editor.remove();
                  }

                  await loadSmsTemplates();

                  showSmsMessage(
                    'قالب با موفقیت ذخیره شد.',
                    'success'
                  );

                } catch (error) {
                  alert(
                    'خطا در ذخیره قالب.'
                  );

                  saveButton.disabled =
                    false;

                  saveButton.textContent =
                    '💾 ذخیره';
                }
              }
            );
          }

          // ------------------------------------------
          // پیش‌نمایش
          // ------------------------------------------
          var previewButton =
            document.getElementById(
              'template-editor-preview'
            );

          if (previewButton) {
            previewButton.addEventListener(
              'click',
              function() {
                var contentInput =
                  document.getElementById(
                    'template-editor-content'
                  );

                var previewArea =
                  document.getElementById(
                    'template-editor-preview-area'
                  );

                var content =
                  contentInput
                    ? contentInput.value
                    : '';

                if (!previewArea) {
                  return;
                }

                var sampleData = {
                  customer_name:
                    'کاربر تست',

                  customer_phone:
                    '09123456789',

                  order_number:
                    'TT-20260819-123456',

                  amount:
                    '2500000',

                  payment_status:
                    'pending',

                  order_status:
                    'pending',

                  tracking_code:
                    'TRK-12345678'
                };

                var rendered =
                  content;

                for (
                  var key in sampleData
                ) {
                  if (
                    sampleData.hasOwnProperty(
                      key
                    )
                  ) {
                    rendered =
                      rendered.replace(
                        new RegExp(
                          '{' +
                          key +
                          '}',
                          'g'
                        ),
                        sampleData[
                          key
                        ]
                      );
                  }
                }

                previewArea.style.display =
                  'block';

                previewArea.textContent =
                  rendered;
              }
            );
          }

          // ------------------------------------------
          // بستن
          // ------------------------------------------
          var closeButton =
            document.getElementById(
              'template-editor-close'
            );

          if (closeButton) {
            closeButton.addEventListener(
              'click',
              function() {
                var editor =
                  document.querySelector(
                    '.template-editor-overlay'
                  );

                if (editor) {
                  editor.remove();
                }
              }
            );
          }

          // بستن با کلیک روی پس‌زمینه
          overlay.addEventListener(
            'click',
            function(event) {
              if (
                event.target ===
                event.currentTarget
              ) {
                overlay.remove();
              }
            }
          );
        }
      )
      .catch(
        function(error) {
          console.error(
            'Error opening template editor:',
            error
          );

          alert(
            'خطا در دریافت قالب.'
          );
        }
      );
  }

  // ============================================
  // پیش‌نمایش قالب
  // ============================================
  async function previewTemplate(
    eventType
  ) {
    try {
      var result =
        await window.api(
          '/api/admin/notifications?action=sms_template_preview&eventType=' +
          encodeURIComponent(
            eventType
          )
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        alert(
          result.data?.error ||
          'پیش‌نمایش انجام نشد.'
        );

        return;
      }

      var data =
        result.data.data;

      var eventMap = {
        'payment_pending': 'در انتظار پرداخت',
        'payment_success': 'پرداخت موفق',
        'payment_failed': 'پرداخت ناموفق',
        'order_confirmed': 'تأیید سفارش',
        'courier_delivery': 'ارسال با پیک',
        'bus_shipping': 'ارسال با باربری',
        'shipped': 'ارسال شد',
        'delivered': 'تحویل داده شد',
        'completed': 'تکمیل شد',
        'cancelled': 'لغو شد',
        'returned': 'مرجوع شد',
        'admin_order_created': 'سفارش جدید (ادمین)',
        'admin_payment_success': 'پرداخت موفق (ادمین)'
      };

      var title =
        eventMap[eventType] ||
        eventType;

      alert(
        '📝 پیش‌نمایش قالب: ' +
        title +
        '\n\n' +
        data.rendered +
        '\n\n📌 داده‌های نمونه:\n' +
        'نام: ' +
        data.sample_data.customer_name +
        '\n' +
        'شماره: ' +
        data.sample_data.customer_phone +
        '\n' +
        'سفارش: ' +
        data.sample_data.order_number +
        '\n' +
        'مبلغ: ' +
        data.sample_data.amount +
        ' تومان'
      );

    } catch (error) {
      alert(
        'خطا در پیش‌نمایش.'
      );
    }
  }

  // ============================================
  // ارسال تست قالب
  // ============================================
  async function testTemplate(
    eventType
  ) {
    var phoneInput =
      document.getElementById(
        'sms-admin-phone'
      );

    var phone =
      phoneInput?.value?.trim();

    if (!phone) {
      phone =
        prompt(
          'شماره تلفن برای تست را وارد کنید:'
        );
    }

    if (!phone) {
      alert(
        'شماره تلفن الزامی است.'
      );

      return;
    }

    if (
      !confirm(
        'ارسال SMS تست با قالب ' +
        eventType +
        ' به شماره ' +
        phone +
        '؟'
      )
    ) {
      return;
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
                  'test_sms_template',

                phoneNumber:
                  phone,

                eventType:
                  eventType
              })
          }
        );

      if (
        !result.ok ||
        !result.data?.success
      ) {
        alert(
          result.data?.error ||
          'ارسال تست انجام نشد.'
        );

        return;
      }

      alert(
        '✅ پیام تست با موفقیت ارسال شد.'
      );

    } catch (error) {
      alert(
        'خطا در ارسال تست.'
      );
    }
  }

  // ============================================
  // فعال‌سازی زیرتب‌های SMS
  // ============================================
  function activateSmsSubTab(
    target
  ) {
    var tabs =
      document.querySelectorAll(
        '[data-sms-subtab]'
      );

    var contents = {
      settings:
        document.getElementById(
          'sms-subtab-settings'
        ),

      templates:
        document.getElementById(
          'sms-subtab-templates'
        ),

      logs:
        document.getElementById(
          'sms-subtab-logs'
        ),

      inbox:
        document.getElementById(
          'sms-subtab-inbox'
        )
    };

    if (!tabs.length) {
      return;
    }

    tabs.forEach(
      function(tab) {
        tab.classList.toggle(
          'is-active',
          tab.dataset.smsSubtab ===
          target
        );
      }
    );

    Object.keys(
      contents
    ).forEach(
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
      'templates'
    ) {
      loadSmsTemplates();

    } else if (
      target ===
      'logs'
    ) {
      loadSmsLogs(0);

    } else if (
      target ===
      'inbox'
    ) {
      loadSmsInbox(0);

    } else if (
      target ===
      'settings'
    ) {
      loadSmsSettings();
    }
  }

  // ============================================
  // Event Delegation کامل SMS
  // ============================================
  function setupSmsEvents() {
    if (
      document.documentElement
        .dataset
        .smsEventsBound ===
      '1'
    ) {
      return;
    }

    document.documentElement
      .dataset
      .smsEventsBound =
      '1';

    // ==========================================
    // Click
    // ==========================================
    document.addEventListener(
      'click',
      function(event) {
        var target =
          event.target;

        // ----------------------------------------
        // زیرتب‌ها
        // ----------------------------------------
        var subTab =
          target.closest(
            '[data-sms-subtab]'
          );

        if (subTab) {
          event.preventDefault();

          activateSmsSubTab(
            subTab.dataset.smsSubtab
          );

          return;
        }

        // ----------------------------------------
        // ذخیره تنظیمات
        // ----------------------------------------
        if (
          target.closest(
            '#sms-save-btn'
          )
        ) {
          event.preventDefault();

          saveSmsSettings();

          return;
        }

        // ----------------------------------------
        // بارگذاری مجدد تنظیمات
        // ----------------------------------------
        if (
          target.closest(
            '#sms-load-btn'
          )
        ) {
          event.preventDefault();

          loadSmsSettings();

          return;
        }

        // ----------------------------------------
        // وضعیت Gateway
        // ----------------------------------------
        if (
          target.closest(
            '#sms-gateway-refresh-btn'
          )
        ) {
          event.preventDefault();

          loadSmsGatewayStatus();

          return;
        }

        // ----------------------------------------
        // بارگذاری Templateها
        // ----------------------------------------
        if (
          target.closest(
            '#sms-templates-refresh-btn'
          )
        ) {
          event.preventDefault();

          loadSmsTemplates();

          return;
        }

        // ----------------------------------------
        // لاگ‌ها - Refresh
        // ----------------------------------------
        if (
          target.closest(
            '#sms-logs-refresh-btn'
          )
        ) {
          event.preventDefault();

          loadSmsLogs(0);

          return;
        }

        // ----------------------------------------
        // لاگ‌ها - قبلی
        // ----------------------------------------
        if (
          target.closest(
            '#sms-logs-prev-btn'
          )
        ) {
          event.preventDefault();

          if (
            smsLogsPage >
            0
          ) {
            loadSmsLogs(
              smsLogsPage - 1
            );
          }

          return;
        }

        // ----------------------------------------
        // لاگ‌ها - بعدی
        // ----------------------------------------
        if (
          target.closest(
            '#sms-logs-next-btn'
          )
        ) {
          event.preventDefault();

          loadSmsLogs(
            smsLogsPage + 1
          );

          return;
        }

        // ----------------------------------------
        // Inbox - Refresh
        // ----------------------------------------
        if (
          target.closest(
            '#sms-inbox-refresh-btn'
          )
        ) {
          event.preventDefault();

          loadSmsInbox(0);

          return;
        }

        // ----------------------------------------
        // Inbox - قبلی
        // ----------------------------------------
        if (
          target.closest(
            '#sms-inbox-prev-btn'
          )
        ) {
          event.preventDefault();

          if (
            smsInboxPage >
            0
          ) {
            loadSmsInbox(
              smsInboxPage - 1
            );
          }

          return;
        }

        // ----------------------------------------
        // Inbox - بعدی
        // ----------------------------------------
        if (
          target.closest(
            '#sms-inbox-next-btn'
          )
        ) {
          event.preventDefault();

          loadSmsInbox(
            smsInboxPage + 1
          );

          return;
        }

        // ----------------------------------------
        // Template - Edit
        // ----------------------------------------
        var editTemplateButton =
          target.closest(
            '[data-edit-template]'
          );

        if (editTemplateButton) {
          event.preventDefault();

          openTemplateEditor(
            editTemplateButton.dataset.editTemplate
          );

          return;
        }

        // ----------------------------------------
        // Template - Toggle
        // ----------------------------------------
        var toggleTemplateButton =
          target.closest(
            '[data-toggle-template]'
          );

        if (toggleTemplateButton) {
          event.preventDefault();

          var eventType =
            toggleTemplateButton.dataset.toggleTemplate;

          var current =
            toggleTemplateButton.textContent
              .includes(
                'غیرفعال'
              );

          var newStatus =
            !current;

          if (
            !confirm(
              'آیا از ' +
              (
                newStatus
                  ? 'فعال'
                  : 'غیرفعال'
              ) +
              ' کردن این قالب مطمئن هستید؟'
            )
          ) {
            return;
          }

          toggleTemplateButton.disabled =
            true;

          toggleTemplateButton.textContent =
            '⏳ ...';

          window.api(
            '/api/admin/notifications',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  action:
                    'toggle_sms_template',

                  eventType:
                    eventType,

                  isEnabled:
                    newStatus
                })
            }
          )
            .then(
              function(result) {
                if (
                  !result.ok ||
                  !result.data?.success
                ) {
                  alert(
                    result.data?.error ||
                    'تغییر وضعیت انجام نشد.'
                  );

                  toggleTemplateButton.disabled =
                    false;

                  toggleTemplateButton.textContent =
                    current
                      ? '🔇 غیرفعال'
                      : '🔊 فعال';

                  return null;
                }

                return loadSmsTemplates()
                  .then(
                    function() {
                      showSmsMessage(
                        'قالب با موفقیت به‌روزرسانی شد.',
                        'success'
                      );
                    }
                  );
              }
            )
            .catch(
              function(error) {
                console.error(
                  'Error toggling SMS template:',
                  error
                );

                alert(
                  'خطا در تغییر وضعیت.'
                );

                toggleTemplateButton.disabled =
                  false;

                toggleTemplateButton.textContent =
                  current
                    ? '🔇 غیرفعال'
                    : '🔊 فعال';
              }
            );

          return;
        }

        // ----------------------------------------
        // Template - Preview
        // ----------------------------------------
        var previewTemplateButton =
          target.closest(
            '[data-preview-template]'
          );

        if (previewTemplateButton) {
          event.preventDefault();

          previewTemplate(
            previewTemplateButton.dataset.previewTemplate
          );

          return;
        }

        // ----------------------------------------
        // Template - Test
        // ----------------------------------------
        var testTemplateButton =
          target.closest(
            '[data-test-template]'
          );

        if (testTemplateButton) {
          event.preventDefault();

          testTemplate(
            testTemplateButton.dataset.testTemplate
          );

          return;
        }
      }
    );

    // ==========================================
    // Change
    // ==========================================
    document.addEventListener(
      'change',
      function(event) {
        var target =
          event.target;

        if (
          target.id ===
            'sms-logs-status' ||
          target.id ===
            'sms-logs-direction'
        ) {
          loadSmsLogs(0);

          return;
        }

        if (
          target.id ===
          'sms-inbox-status'
        ) {
          loadSmsInbox(0);
        }
      }
    );
  }

  // ============================================
  // راه‌اندازی زیرتب‌های SMS
  // ============================================
  function setupSmsSubTabs() {
    setupSmsEvents();

    var tabs =
      document.querySelectorAll(
        '[data-sms-subtab]'
      );

    if (!tabs.length) {
      return;
    }

    var activeTab =
      document.querySelector(
        '[data-sms-subtab].is-active'
      );

    activateSmsSubTab(
      activeTab
        ? activeTab.dataset.smsSubtab
        : 'settings'
    );
  }

  // ============================================
  // Eventهای ماژول را فوری وصل کن
  // حتی اگر HTML بعداً inject شود.
  // ============================================
  setupSmsEvents();

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.loadSmsSettings =
    loadSmsSettings;

  window.saveSmsSettings =
    saveSmsSettings;

  window.showSmsMessage =
    showSmsMessage;

  window.updateSmsToggleStatus =
    updateSmsToggleStatus;

  window.loadSmsStats =
    loadSmsStats;

  window.loadSmsGatewayStatus =
    loadSmsGatewayStatus;

  window.loadSmsLogs =
    loadSmsLogs;

  window.loadSmsInbox =
    loadSmsInbox;

  window.loadSmsTemplates =
    loadSmsTemplates;

  window.openTemplateEditor =
    openTemplateEditor;

  window.previewTemplate =
    previewTemplate;

  window.testTemplate =
    testTemplate;

  window.activateSmsSubTab =
    activateSmsSubTab;

  window.setupSmsEvents =
    setupSmsEvents;

  window.setupSmsSubTabs =
    setupSmsSubTabs;

  console.log(
    "✅ SMS module loaded successfully"
  );

})();