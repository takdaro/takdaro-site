// ============================================
// rates.js - مدیریت نرخ ارز
// ============================================

(function () {
  'use strict';

  // ============================================
  // نمایش پیام در بخش نرخ ارز
  // ============================================
  function setRatesMessage(message, type) {
    var msg =
      document.getElementById("rates-message");

    if (!msg) return;

    msg.textContent =
      message || "";

    msg.className =
      "admin-message";

    if (message) {
      msg.classList.add(
        type === "success"
          ? "is-success"
          : "is-error"
      );
    }
  }

  // ============================================
  // بارگذاری اطلاعات نرخ ارز
  // ============================================
  async function loadRates() {
    try {
      // ========================================
      // نرخ فعلی
      // ========================================
      var rateResult =
        await window.api(
          "/api/rate/current"
        );

      if (
        rateResult.ok &&
        rateResult.data?.success
      ) {
        var rate =
          rateResult.data.rate;

        var currentRateDisplay =
          document.getElementById(
            "current-rate-display"
          );

        var sourceDisplay =
          document.getElementById(
            "rate-source-display"
          );

        var updatedDisplay =
          document.getElementById(
            "rate-updated-display"
          );

        var changeDisplay =
          document.getElementById(
            "rate-change-display"
          );

        if (currentRateDisplay) {
          currentRateDisplay.textContent =
            rate.rate_formatted ||
            window.money(rate.rate) +
              " تومان";
        }

        if (sourceDisplay) {
          sourceDisplay.textContent =
            rate.source_label ||
            "دستی";
        }

        if (updatedDisplay) {
          updatedDisplay.textContent =
            rate.updated_at
              ? window.formatDate(
                  rate.updated_at
                )
              : "—";
        }

        if (changeDisplay) {
          if (
            rate.change_percent !== null &&
            rate.change_percent !== undefined
          ) {
            var changeText =
              (
                rate.change_percent > 0
                  ? "+"
                  : ""
              ) +
              rate.change_percent.toFixed(
                1
              ) +
              "%";

            changeDisplay.textContent =
              changeText;

            changeDisplay.className =
              rate.change_percent > 0
                ? "rate-change-positive"
                : rate.change_percent < 0
                  ? "rate-change-negative"
                  : "rate-change-neutral";
          } else {
            changeDisplay.textContent =
              "—";

            changeDisplay.className =
              "rate-change-neutral";
          }
        }

        // مقدار نرخ فعلی داخل فرم
        var manualValue =
          document.getElementById(
            "rate-manual-value"
          );

        if (manualValue) {
          manualValue.value =
            rate.rate || "";
        }

      } else {
        var currentRateError =
          document.getElementById(
            "current-rate-display"
          );

        if (currentRateError) {
          currentRateError.textContent =
            "خطا در دریافت";
        }
      }

      // ========================================
      // تاریخچه
      // ========================================
      var historyResult =
        await window.api(
          "/api/rate/history"
        );

      var historyBody =
        document.getElementById(
          "rate-history-body"
        );

      if (historyBody) {
        if (
          historyResult.ok &&
          historyResult.data?.success
        ) {
          var history =
            historyResult.data.history ||
            [];

          if (history.length) {
            historyBody.innerHTML =
              history
                .map(
                  function (item) {
                    return (
                      "<tr>" +

                      '<td class="table-number">' +
                      window.money(
                        item.rate
                      ) +
                      " تومان</td>" +

                      "<td>" +
                      window.esc(
                        item.source_label ||
                        "دستی"
                      ) +
                      "</td>" +

                      "<td>" +
                      window.esc(
                        item.changed_by ||
                        "سیستم"
                      ) +
                      "</td>" +

                      '<td class="table-number">' +
                      (
                        item.created_at_formatted ||
                        window.formatDate(
                          item.created_at
                        )
                      ) +
                      "</td>" +

                      "</tr>"
                    );
                  }
                )
                .join("");

          } else {
            historyBody.innerHTML =
              '<tr><td colspan="4">تاریخچه‌ای ثبت نشده است.</td></tr>';
          }

        } else {
          historyBody.innerHTML =
            '<tr><td colspan="4">خطا در دریافت تاریخچه.</td></tr>';
        }
      }

      setRatesMessage(
        "اطلاعات نرخ ارز بارگذاری شد.",
        "success"
      );

      setTimeout(
        function () {
          setRatesMessage("");
        },
        3000
      );

    } catch (error) {
      setRatesMessage(
        "خطا در بارگذاری اطلاعات نرخ ارز.",
        "error"
      );

      console.error(
        "Error loading rates:",
        error
      );
    }
  }

  // ============================================
  // ذخیره نرخ دستی
  // ============================================
  async function saveManualRate() {
    var currencyElement =
      document.getElementById(
        "rate-manual-currency"
      );

    var rateElement =
      document.getElementById(
        "rate-manual-value"
      );

    var currency =
      currencyElement
        ? currencyElement.value
        : "USD";

    var rate =
      rateElement
        ? Number(rateElement.value)
        : 0;

    if (!rate || rate <= 0) {
      setRatesMessage(
        "لطفاً نرخ معتبر وارد کنید.",
        "error"
      );
      return;
    }

    var button =
      document.getElementById(
        "rate-manual-save-btn"
      );

    if (button) {
      button.disabled = true;
      button.textContent =
        "در حال ذخیره...";
    }

    try {
      var result =
        await window.api(
          "/api/rate/update",
          {
            method: "POST",

            body: JSON.stringify({
              currency:
                currency,

              rate:
                rate,

              source_type:
                "manual"
            })
          }
        );

      if (
        result.ok &&
        result.data?.success
      ) {
        setRatesMessage(
          "نرخ با موفقیت به " +
            window.money(rate) +
            " تومان به‌روزرسانی شد.",
          "success"
        );

        await loadRates();

        // بعد از تغییر نرخ،
        // قیمت محصولات وابسته را هم بروزرسانی می‌کنیم.
        await recalculateProductPrices();

        setTimeout(
          function () {
            setRatesMessage("");
          },
          5000
        );

      } else {
        setRatesMessage(
          result.data?.error ||
            "خطا در ذخیره نرخ.",
          "error"
        );
      }

    } catch (error) {
      console.error(
        "Error saving rate:",
        error
      );

      setRatesMessage(
        "خطا در ارتباط با سرور.",
        "error"
      );

    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "ذخیره نرخ دستی";
      }
    }
  }

  // ============================================
  // بروزرسانی قیمت محصولات
  // ============================================
  async function recalculateProductPrices() {
    var button =
      document.getElementById(
        "rate-recalculate-btn"
      );

    var status =
      document.getElementById(
        "recalculate-status"
      );

    if (button) {
      button.textContent =
        "🔄 در حال بروزرسانی...";

      button.disabled =
        true;
    }

    if (status) {
      status.textContent =
        "در حال بروزرسانی...";
    }

    try {
      var result =
        await window.api(
          "/api/rate/update-prices",
          {
            method:
              "POST"
          }
        );

      if (
        result.ok &&
        result.data?.success
      ) {
        var count =
          result.data.updated_count ||
          0;

        if (status) {
          status.textContent =
            "✅ " +
            count +
            " محصول با نرخ فعلی به‌روزرسانی شد.";
        }

        setRatesMessage(
          "قیمت " +
            count +
            " محصول به‌روزرسانی شد.",
          "success"
        );

        await loadRates();

        // در صورت وجود ماژول محصولات،
        // لیست محصولات هم تازه شود.
        if (
          typeof window.loadProducts ===
          "function"
        ) {
          try {
            await window.loadProducts();
          } catch (_) {}
        }

        setTimeout(
          function () {
            setRatesMessage("");
          },
          3000
        );

      } else {
        if (status) {
          status.textContent =
            "⚠️ خطا در بروزرسانی.";
        }

        setRatesMessage(
          result.data?.error ||
            "خطا در بروزرسانی قیمت محصولات.",
          "error"
        );
      }

    } catch (error) {
      console.error(
        "Error recalculating products:",
        error
      );

      if (status) {
        status.textContent =
          "⚠️ خطا در بروزرسانی.";
      }

      setRatesMessage(
        "خطا در ارتباط با سرور.",
        "error"
      );

    } finally {
      if (button) {
        button.textContent =
          "🔄 بروزرسانی قیمت محصولات";

        button.disabled =
          false;
      }
    }
  }

  // ============================================
  // Event Delegation
  // ============================================
  function setupRatesEvents() {
    if (
      document.documentElement
        .dataset
        .ratesEventsBound ===
      "1"
    ) {
      return;
    }

    document.documentElement
      .dataset
      .ratesEventsBound =
      "1";

    document.addEventListener(
      "click",
      function (event) {
        var target =
          event.target;

        // ======================================
        // ذخیره نرخ دستی
        // ======================================
        var saveButton =
          target.closest(
            "#rate-manual-save-btn"
          );

        if (saveButton) {
          event.preventDefault();

          saveManualRate();

          return;
        }

        // ======================================
        // بروزرسانی قیمت محصولات
        // ======================================
        var recalculateButton =
          target.closest(
            "#rate-recalculate-btn"
          );

        if (recalculateButton) {
          event.preventDefault();

          recalculateProductPrices();

          return;
        }
      }
    );
  }

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.loadRates =
    loadRates;

  window.setRatesMessage =
    setRatesMessage;

  window.saveManualRate =
    saveManualRate;

  window.recalculateProductPrices =
    recalculateProductPrices;

  window.setupRatesEvents =
    setupRatesEvents;

  // ============================================
  // راه‌اندازی
  // ============================================
  setupRatesEvents();

  console.log(
    "✅ Rates module loaded successfully"
  );

})();