// ============================================
// invoice.js - تنظیمات فاکتور و پرداخت
// ============================================

(function() {
  'use strict';

  // ============================================
  // بارگذاری تنظیمات فاکتور
  // ============================================
  async function loadInvoiceSettings() {
    try {
      var response = await fetch(
        '/api/admin/settings',
        {
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        }
      );

      var data =
        await response.json().catch(
          function() {
            return null;
          }
        );

      if (
        !response.ok ||
        !data?.success
      ) {
        return null;
      }

      return data.settings || {};

    } catch (_) {
      return null;
    }
  }

  // ============================================
  // نمایش پیام
  // ============================================
  function setInvoiceMessage(
    message,
    type
  ) {
    var msg =
      document.getElementById(
        'invoice-settings-message'
      );

    if (!msg) {
      return;
    }

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
  // پر کردن فرم با تنظیمات
  // ============================================
  async function loadInvoiceSettingsToForm() {
    var settings =
      await loadInvoiceSettings();

    if (!settings) {
      setInvoiceMessage(
        'دریافت تنظیمات فاکتور انجام نشد.',
        'error'
      );

      return false;
    }

    var fields = {
      'invoice-logo':
        settings.invoice_logo || '',

      'invoice-company-name':
        settings.invoice_company_name ||
        'تک تجارت',

      'invoice-thankyou-text':
        settings.invoice_thankyou_text ||
        '',

      'invoice-account':
        settings.invoice_bank_account ||
        '',

      'invoice-card':
        settings.invoice_card_number ||
        '',

      'invoice-sheba':
        settings.invoice_sheba_number ||
        '',

      'invoice-deadline':
        settings.invoice_payment_deadline ||
        '۲۴ ساعت',

      'invoice-whatsapp':
        settings.invoice_whatsapp_number ||
        '',

      'invoice-description':
        settings.invoice_payment_description ||
        ''
    };

    Object.keys(fields).forEach(
      function(id) {
        var element =
          document.getElementById(id);

        if (element) {
          element.value =
            fields[id];
        }
      }
    );

    return true;
  }

  // ============================================
  // جمع‌آوری اطلاعات فرم
  // ============================================
  function collectInvoiceSettings() {
    return {
      invoice_logo:
        document.getElementById(
          'invoice-logo'
        )?.value?.trim() || '',

      invoice_company_name:
        document.getElementById(
          'invoice-company-name'
        )?.value?.trim() || '',

      invoice_thankyou_text:
        document.getElementById(
          'invoice-thankyou-text'
        )?.value?.trim() || '',

      invoice_bank_account:
        document.getElementById(
          'invoice-account'
        )?.value?.trim() || '',

      invoice_card_number:
        document.getElementById(
          'invoice-card'
        )?.value?.trim() || '',

      invoice_sheba_number:
        document.getElementById(
          'invoice-sheba'
        )?.value?.trim() || '',

      invoice_payment_deadline:
        document.getElementById(
          'invoice-deadline'
        )?.value?.trim() || '',

      invoice_whatsapp_number:
        document.getElementById(
          'invoice-whatsapp'
        )?.value?.trim() || '',

      invoice_payment_description:
        document.getElementById(
          'invoice-description'
        )?.value?.trim() || ''
    };
  }

  // ============================================
  // ذخیره تنظیمات فاکتور
  // ============================================
  async function saveInvoiceSettings() {
    var payload =
      collectInvoiceSettings();

    var saveButton =
      document.getElementById(
        'save-invoice-settings-btn'
      );

    if (saveButton) {
      saveButton.disabled =
        true;

      saveButton.textContent =
        'در حال ذخیره...';
    }

    try {
      var response =
        await fetch(
          '/api/admin/settings',
          {
            method: 'POST',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',

              Accept:
                'application/json'
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );

      var data =
        await response
          .json()
          .catch(
            function() {
              return null;
            }
          );

      if (
        !response.ok ||
        !data?.success
      ) {
        setInvoiceMessage(
          data?.error ||
          'ذخیره تنظیمات انجام نشد.',
          'error'
        );

        return false;
      }

      setInvoiceMessage(
        'تنظیمات فاکتور با موفقیت ذخیره شد.',
        'success'
      );

      await loadInvoiceSettingsToForm();

      setTimeout(
        function() {
          setInvoiceMessage('');
        },
        3000
      );

      return true;

    } catch (_) {
      setInvoiceMessage(
        'خطا در ارتباط با سرور.',
        'error'
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
  // Event Delegation
  // ============================================
  function setupInvoiceEvents() {
    if (
      document.documentElement
        .dataset
        .invoiceEventsBound ===
      '1'
    ) {
      return;
    }

    document.documentElement
      .dataset
      .invoiceEventsBound =
      '1';

    document.addEventListener(
      'click',
      function(event) {
        var target =
          event.target;

        // ========================================
        // ذخیره تنظیمات
        // ========================================
        var saveButton =
          target.closest(
            '#save-invoice-settings-btn'
          );

        if (saveButton) {
          event.preventDefault();

          saveInvoiceSettings();

          return;
        }

        // ========================================
        // بارگذاری مجدد
        // ========================================
        var loadButton =
          target.closest(
            '#load-invoice-settings-btn'
          );

        if (loadButton) {
          event.preventDefault();

          loadInvoiceSettingsToForm();

          return;
        }
      }
    );
  }

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.loadInvoiceSettings =
    loadInvoiceSettings;

  window.loadInvoiceSettingsToForm =
    loadInvoiceSettingsToForm;

  window.saveInvoiceSettings =
    saveInvoiceSettings;

  window.setInvoiceMessage =
    setInvoiceMessage;

  window.setupInvoiceEvents =
    setupInvoiceEvents;

  // ============================================
  // راه‌اندازی
  // ============================================
  setupInvoiceEvents();

  console.log(
    "✅ Invoice module loaded successfully"
  );

})();