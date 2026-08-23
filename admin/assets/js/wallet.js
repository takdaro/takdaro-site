// ============================================
// wallet.js - مدیریت کیف پول
// ============================================

(function() {
  'use strict';

  // ============================================
  // متغیرهای محلی
  // ============================================
  var currentWalletPayload = null;

  // این عناصر بعداً با fetch داخل DOM تزریق می‌شوند.
  // بنابراین باید هر بار قبل از استفاده مجدداً پیدا شوند.
  var walletContent = null;
  var walletEmptyState = null;
  var walletHeroCard = null;
  var walletSummaryCards = null;
  var walletUserBox = null;
  var walletAdjustBox = null;
  var walletSettingsBox = null;
  var walletHistoryBox = null;

  function refreshWalletElements() {
    walletContent = document.getElementById("wallet-content");
    walletEmptyState = document.getElementById("wallet-empty-state");
    walletHeroCard = document.getElementById("wallet-hero-card");
    walletSummaryCards = document.getElementById("wallet-summary-cards");
    walletUserBox = document.getElementById("wallet-user-box");
    walletAdjustBox = document.getElementById("wallet-adjust-box");
    walletSettingsBox = document.getElementById("wallet-settings-box");
    walletHistoryBox = document.getElementById("wallet-history-box");
  }

  // ============================================
  // محاسبه خلاصه تراکنش‌ها
  // ============================================
  function getWalletSummary(transactions) {
    transactions = transactions || [];

    var summary = {
      total_credit: 0,
      total_debit: 0,
      credit_count: 0,
      debit_count: 0
    };

    transactions.forEach(function(tx) {
      var type = String(tx.type || "").toLowerCase();
      var amount = Number(tx.amount || 0);

      if (["debit"].includes(type)) {
        summary.total_debit += Math.abs(amount);
        summary.debit_count += 1;
      } else if (
        ["credit", "cashback", "refund", "adjustment"].includes(type)
      ) {
        summary.total_credit += Math.abs(amount);
        summary.credit_count += 1;
      } else if (amount > 0) {
        summary.total_credit += amount;
        summary.credit_count += 1;
      } else if (amount < 0) {
        summary.total_debit += Math.abs(amount);
        summary.debit_count += 1;
      }
    });

    return summary;
  }

  // ============================================
  // رندر بخش Hero کیف پول
  // ============================================
  function renderWalletHero(user, transactions) {
    refreshWalletElements();

    if (!walletHeroCard) return;

    var lastTx =
      transactions && transactions.length > 0
        ? transactions[0]
        : null;

    walletHeroCard.innerHTML =
      '<div class="wallet-hero-top">' +
        '<div>' +
          '<div class="wallet-hero-kicker">کیف پول کاربر</div>' +
          '<h3 style="margin:14px 0 0;font-size:1.2rem;">' +
            window.esc(
              user.full_name || "کاربر بدون نام"
            ) +
          '</h3>' +
          '<p style="margin:8px 0 0;color:rgba(255,255,255,0.78);line-height:1.9;">' +
            window.esc(user.email || "-") +
          '</p>' +
        '</div>' +

        '<div>' +
          window.badge(user.role || "user") +
        '</div>' +
      '</div>' +

      '<div class="wallet-balance">' +
        '<span>موجودی فعلی</span>' +
        '<strong>' +
          window.money(user.wallet_balance || 0) +
          ' تومان' +
        '</strong>' +
      '</div>' +

      '<div class="wallet-meta-line">' +
        '<div class="wallet-meta-pill">شناسه کاربر: ' +
          window.esc(user.id) +
        '</div>' +

        '<div class="wallet-meta-pill">شماره: ' +
          window.esc(user.phone || "-") +
        '</div>' +

        '<div class="wallet-meta-pill">آخرین تراکنش: ' +
          (
            lastTx
              ? window.formatDate(lastTx.created_at)
              : "-"
          ) +
        '</div>' +
      '</div>';
  }

  // ============================================
  // رندر خلاصه کیف پول
  // ============================================
  function renderWalletSummary(user, transactions) {
    refreshWalletElements();

    if (!walletSummaryCards) return;

    var summary =
      getWalletSummary(transactions);

    walletSummaryCards.innerHTML =
      '<div class="wallet-mini-card">' +
        '<span>جمع واریزی‌ها</span>' +
        '<strong>' +
          window.money(summary.total_credit) +
          ' تومان' +
        '</strong>' +
        '<small>' +
          window.money(summary.credit_count) +
          ' تراکنش مثبت' +
        '</small>' +
      '</div>' +

      '<div class="wallet-mini-card">' +
        '<span>جمع برداشت‌ها</span>' +
        '<strong>' +
          window.money(summary.total_debit) +
          ' تومان' +
        '</strong>' +
        '<small>' +
          window.money(summary.debit_count) +
          ' تراکنش منفی' +
        '</small>' +
      '</div>' +

      '<div class="wallet-mini-card">' +
        '<span>تعداد تراکنش‌ها</span>' +
        '<strong>' +
          window.money(transactions.length) +
        '</strong>' +
        '<small>براساس لیست بارگذاری‌شده</small>' +
      '</div>' +

      '<div class="wallet-mini-card">' +
        '<span>موجودی ثبت‌شده</span>' +
        '<strong>' +
          window.money(user.wallet_balance || 0) +
          ' تومان' +
        '</strong>' +
        '<small>خوانده‌شده از جدول users</small>' +
      '</div>';
  }

  // ============================================
  // رندر اطلاعات کاربر
  // ============================================
  function renderWalletUser(user) {
    refreshWalletElements();

    if (!walletUserBox) return;

    walletUserBox.innerHTML =
      '<div class="wallet-user-head">' +
        '<div>' +
          '<h4 class="wallet-user-name">' +
            window.esc(user.full_name || "-") +
          '</h4>' +

          '<p class="wallet-user-email">' +
            window.esc(user.email || "-") +
          '</p>' +
        '</div>' +

        '<div>' +
          window.badge(user.role || "user") +
        '</div>' +
      '</div>' +

      '<div class="wallet-user-list">' +
        '<div class="wallet-user-row">' +
          '<span>شناسه کاربر</span>' +
          '<strong>' +
            window.esc(user.id) +
          '</strong>' +
        '</div>' +

        '<div class="wallet-user-row">' +
          '<span>شماره تماس</span>' +
          '<strong>' +
            window.esc(user.phone || "-") +
          '</strong>' +
        '</div>' +

        '<div class="wallet-user-row">' +
          '<span>موجودی فعلی</span>' +
          '<strong>' +
            window.money(user.wallet_balance || 0) +
            ' تومان' +
          '</strong>' +
        '</div>' +

        '<div class="wallet-user-row">' +
          '<span>نقش حساب</span>' +
          '<strong>' +
            window.esc(
              window.faRole(
                user.role || "user"
              )
            ) +
          '</strong>' +
        '</div>' +
      '</div>';
  }

  // ============================================
  // رندر فرم ثبت عملیات کیف پول
  // ============================================
  function renderWalletAdjust(user) {
    refreshWalletElements();

    if (!walletAdjustBox) return;

    walletAdjustBox.innerHTML =
      '<div class="wallet-card-head">' +
        '<div>' +
          '<h4>ثبت عملیات کیف پول</h4>' +
          '<p>واریز، برداشت، کش‌بک، بازگشت وجه یا تعدیل را برای این کاربر ثبت کن.</p>' +
        '</div>' +
      '</div>' +

      '<div class="filters-grid filters-grid-3">' +

        '<div class="form-field">' +
          '<label for="wallet-type">نوع عملیات</label>' +
          '<select id="wallet-type">' +
            '<option value="credit">واریز</option>' +
            '<option value="debit">برداشت</option>' +
            '<option value="cashback">کش‌بک</option>' +
            '<option value="refund">بازگشت وجه</option>' +
            '<option value="adjustment">تعدیل</option>' +
          '</select>' +
        '</div>' +

        '<div class="form-field">' +
          '<label for="wallet-amount">مبلغ</label>' +
          '<input id="wallet-amount" type="number" min="1" placeholder="مثلاً 50000" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label for="wallet-reference-id">شناسه مرجع</label>' +
          '<input id="wallet-reference-id" type="text" placeholder="اختیاری" />' +
        '</div>' +

      '</div>' +

      '<div class="filters-grid filters-grid-2">' +

        '<div class="form-field">' +
          '<label for="wallet-reference-type">منبع ثبت</label>' +
          '<select id="wallet-reference-type">' +
            '<option value="admin">ادمین</option>' +
            '<option value="order">سفارش</option>' +
            '<option value="cashback">کش‌بک</option>' +
            '<option value="refund">بازگشت وجه</option>' +
          '</select>' +
        '</div>' +

        '<div class="form-field">' +
          '<label for="wallet-note">یادداشت</label>' +
          '<input id="wallet-note" type="text" placeholder="توضیح کوتاه برای ثبت تراکنش" />' +
        '</div>' +

      '</div>' +

      '<div class="wallet-inline-actions">' +
        '<button class="btn btn-primary" type="button" id="wallet-save-btn">ثبت عملیات</button>' +
        '<button class="btn btn-secondary" type="button" id="wallet-refresh-btn">به‌روزرسانی</button>' +
      '</div>';
  }

  // ============================================
  // رندر تنظیمات کش‌بک
  // ============================================
  function renderWalletSettings(settings) {
    refreshWalletElements();

    if (!walletSettingsBox) return;

    settings = settings || {};

    var cashbackStatuses =
      Array.isArray(settings.cashback_statuses)
        ? settings.cashback_statuses
        : ["completed", "processing"];

    walletSettingsBox.innerHTML =
      '<div class="wallet-card-head">' +
        '<div>' +
          '<h4>تنظیمات کش‌بک</h4>' +
          '<p>درصد کش‌بک و وضعیت‌های مجاز سفارش برای ثبت خودکار را تعیین کن.</p>' +
        '</div>' +
      '</div>' +

      '<div class="filters-grid filters-grid-2">' +

        '<div class="form-field">' +
          '<label for="cashback-percent">درصد کش‌بک</label>' +
          '<input id="cashback-percent" type="number" min="0" max="100" value="' +
            window.esc(
              settings.cashback_percent ?? 0
            ) +
          '" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label for="cashback-statuses">وضعیت‌های مجاز</label>' +
          '<input id="cashback-statuses" type="text" value="' +
            window.esc(
              cashbackStatuses.join(", ")
            ) +
          '" placeholder="completed, processing" />' +
        '</div>' +

      '</div>' +

      '<div class="wallet-inline-actions">' +
        '<button class="btn btn-primary" type="button" id="wallet-save-settings-btn">ذخیره تنظیمات</button>' +
      '</div>';
  }

  // ============================================
  // رندر تاریخچه تراکنش‌ها
  // ============================================
  function renderWalletHistory(transactions) {
    refreshWalletElements();

    if (!walletHistoryBox) return;

    transactions = transactions || [];

    var filterType =
      document.getElementById(
        "wallet-quick-type"
      )?.value || "";

    var historySearchInput =
      document.getElementById(
        "wallet-history-search"
      );

    var historySearch =
      historySearchInput?.value
        ?.trim()
        ?.toLowerCase() || "";

    var filtered = filterType
      ? transactions.filter(function(tx) {
          return (
            String(tx.type || "")
              .toLowerCase() === filterType
          );
        })
      : transactions;

    if (historySearch) {
      filtered = filtered.filter(function(tx) {
        var note = String(
          tx.note || ""
        ).toLowerCase();

        var type = String(
          tx.type || ""
        ).toLowerCase();

        return (
          note.includes(historySearch) ||
          type.includes(historySearch)
        );
      });
    }

    walletHistoryBox.innerHTML =
      '<div class="wallet-card-head">' +
        '<div>' +
          '<h4>تاریخچه تراکنش‌ها</h4>' +
          '<p>تمام ثبت‌های اخیر کیف پول کاربر همراه با وضعیت، مانده قبل و بعد، و توضیحات.</p>' +
        '</div>' +
      '</div>' +

      '<div class="wallet-history-tools">' +

        '<div class="form-field">' +
          '<label for="wallet-history-search">جستجو در یادداشت</label>' +
          '<input id="wallet-history-search" type="text" value="' +
            window.esc(historySearch) +
          '" placeholder="یادداشت یا نوع تراکنش" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>تراکنش‌های نمایشی</label>' +
          '<input type="text" value="' +
            window.money(filtered.length) +
            ' مورد" disabled />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>آخرین به‌روزرسانی</label>' +
          '<input type="text" value="' +
            (
              filtered[0]
                ? window.formatDate(
                    filtered[0].created_at
                  )
                : "-"
            ) +
            '" disabled />' +
        '</div>' +

      '</div>' +

      '<div class="table-wrap">' +
        '<table class="admin-table">' +

          '<thead>' +
            '<tr>' +
              '<th>شناسه</th>' +
              '<th>نوع</th>' +
              '<th>مبلغ</th>' +
              '<th>قبل</th>' +
              '<th>بعد</th>' +
              '<th>وضعیت</th>' +
              '<th>منبع</th>' +
              '<th>یادداشت</th>' +
              '<th>تاریخ</th>' +
            '</tr>' +
          '</thead>' +

          '<tbody id="wallet-history-body">' +

            (
              filtered.length
                ? filtered.map(function(tx) {
                    return (
                      '<tr>' +
                        '<td class="table-number">' +
                          window.esc(tx.id) +
                        '</td>' +

                        '<td>' +
                          window.walletTypeChip(
                            tx.type
                          ) +
                        '</td>' +

                        '<td class="table-number">' +
                          window.money(tx.amount) +
                        '</td>' +

                        '<td class="table-number">' +
                          window.money(
                            tx.balance_before
                          ) +
                        '</td>' +

                        '<td class="table-number">' +
                          window.money(
                            tx.balance_after
                          ) +
                        '</td>' +

                        '<td>' +
                          window.badge(tx.status) +
                        '</td>' +

                        '<td>' +
                          window.esc(
                            tx.reference_type ||
                            tx.source ||
                            "-"
                          ) +
                        '</td>' +

                        '<td class="wallet-note">' +
                          window.esc(
                            tx.note || "-"
                          ) +
                        '</td>' +

                        '<td class="table-number">' +
                          window.formatDate(
                            tx.created_at
                          ) +
                        '</td>' +

                      '</tr>'
                    );
                  }).join("")
                : '<tr><td colspan="9">تراکنشی ثبت نشده است.</td></tr>'
            ) +

          '</tbody>' +
        '</table>' +
      '</div>';
  }

  // ============================================
  // بارگذاری کیف پول کاربر
  // ============================================
  async function loadWalletUser() {
    refreshWalletElements();

    var userId =
      Number(
        document.getElementById(
          "wallet-user-id"
        )?.value || 0
      );

    var limit =
      Number(
        document.getElementById(
          "wallet-limit"
        )?.value || 50
      );

    if (!userId) {
      window.setAdminMessage(
        "شناسه کاربر را وارد کن."
      );
      return;
    }

    var result =
      await window.api(
        "/api/admin/wallet?user_id=" +
          encodeURIComponent(userId) +
          "&limit=" +
          encodeURIComponent(limit)
      );

    refreshWalletElements();

    if (
      !result.ok ||
      !result.data?.success
    ) {
      window.setAdminMessage(
        result.data?.error ||
        "دریافت کیف پول انجام نشد."
      );

      if (walletContent) {
        walletContent.classList.add(
          "admin-hidden"
        );
      }

      if (walletEmptyState) {
        walletEmptyState.classList.remove(
          "admin-hidden"
        );
      }

      return;
    }

    var payload =
      result.data || {};

    var user =
      payload.user || {};

    var txs =
      payload.transactions || [];

    currentWalletPayload =
      payload;

    refreshWalletElements();

    if (walletEmptyState) {
      walletEmptyState.classList.add(
        "admin-hidden"
      );
    }

    if (walletContent) {
      walletContent.classList.remove(
        "admin-hidden"
      );
    }

    renderWalletHero(
      user,
      txs
    );

    renderWalletSummary(
      user,
      txs
    );

    renderWalletUser(
      user
    );

    renderWalletAdjust(
      user
    );

    renderWalletSettings(
      payload.settings || {}
    );

    renderWalletHistory(
      txs
    );
  }

  // ============================================
  // عملیات کیف پول
  // ============================================
  async function saveWalletTransaction(
    userId
  ) {
    var type =
      document.getElementById(
        "wallet-type"
      )?.value;

    var amount =
      Number(
        document.getElementById(
          "wallet-amount"
        )?.value || 0
      );

    var note =
      document.getElementById(
        "wallet-note"
      )?.value
        ?.trim() || "";

    var reference_type =
      document.getElementById(
        "wallet-reference-type"
      )?.value
        ?.trim() || "admin";

    var reference_id =
      document.getElementById(
        "wallet-reference-id"
      )?.value
        ?.trim() || "";

    if (!amount || amount <= 0) {
      window.setAdminMessage(
        "مبلغ معتبر وارد کن."
      );
      return;
    }

    var saveResult =
      await window.api(
        "/api/admin/wallet",
        {
          method: "POST",
          body: JSON.stringify({
            user_id:
              userId,

            type:
              type,

            amount:
              amount,

            note:
              note,

            reference_type:
              reference_type,

            reference_id:
              reference_id
          })
        }
      );

    if (
      !saveResult.ok ||
      !saveResult.data?.success
    ) {
      window.setAdminMessage(
        saveResult.data?.error ||
        "ثبت عملیات کیف پول انجام نشد."
      );
      return;
    }

    window.setAdminMessage(
      "عملیات کیف پول با موفقیت ثبت شد.",
      "success"
    );

    await loadWalletUser();

    if (
      typeof window.loadDashboard ===
      "function"
    ) {
      await window.loadDashboard();
    }

    if (
      typeof window.loadUsers ===
      "function"
    ) {
      await window.loadUsers();
    }
  }

  // ============================================
  // ذخیره تنظیمات کیف پول
  // ============================================
  async function saveWalletSettings() {
    var cashbackPercentInput =
      document.getElementById(
        "cashback-percent"
      );

    var cashbackStatusesInput =
      document.getElementById(
        "cashback-statuses"
      );

    var cashback_percent =
      Number(
        cashbackPercentInput?.value || 0
      );

    var cashback_statuses =
      cashbackStatusesInput?.value
        ?.split(",")
        .map(function(s) {
          return s.trim().toLowerCase();
        })
        .filter(Boolean) || [];

    var result =
      await window.api(
        "/api/admin/wallet",
        {
          method: "POST",
          body: JSON.stringify({
            action:
              "save_settings",

            cashback_percent:
              cashback_percent,

            cashback_statuses:
              cashback_statuses
          })
        }
      );

    if (
      !result.ok ||
      !result.data?.success
    ) {
      window.setAdminMessage(
        result.data?.error ||
        "ذخیره تنظیمات کش‌بک انجام نشد."
      );
      return;
    }

    window.setAdminMessage(
      "تنظیمات کش‌بک با موفقیت ذخیره شد.",
      "success"
    );

    currentWalletPayload = {
      ...(currentWalletPayload || {}),
      settings:
        result.data.settings || {}
    };

    renderWalletSettings(
      result.data.settings || {}
    );
  }

  // ============================================
  // اتصال رویدادها با Event Delegation
  // ============================================
  function setupWalletEvents() {
    document.removeEventListener(
      "click",
      handleWalletClick
    );

    document.removeEventListener(
      "change",
      handleWalletChange
    );

    document.removeEventListener(
      "input",
      handleWalletInput
    );

    document.addEventListener(
      "click",
      handleWalletClick
    );

    document.addEventListener(
      "change",
      handleWalletChange
    );

    document.addEventListener(
      "input",
      handleWalletInput
    );
  }

  // ============================================
  // رویدادهای کلیک
  // ============================================
  function handleWalletClick(
    event
  ) {
    var target =
      event.target;

    // بارگذاری کیف پول
    if (
      target.id ===
        "wallet-load-btn" ||
      target.closest(
        "#wallet-load-btn"
      )
    ) {
      event.preventDefault();
      loadWalletUser();
      return;
    }

    // ثبت عملیات
    if (
      target.id ===
        "wallet-save-btn" ||
      target.closest(
        "#wallet-save-btn"
      )
    ) {
      event.preventDefault();

      var userId =
        Number(
          document.getElementById(
            "wallet-user-id"
          )?.value || 0
        );

      if (!userId) {
        window.setAdminMessage(
          "ابتدا شناسه کاربر را وارد کنید و بارگذاری کنید."
        );
        return;
      }

      saveWalletTransaction(
        userId
      );

      return;
    }

    // به‌روزرسانی
    if (
      target.id ===
        "wallet-refresh-btn" ||
      target.closest(
        "#wallet-refresh-btn"
      )
    ) {
      event.preventDefault();
      loadWalletUser();
      return;
    }

    // ذخیره تنظیمات کش‌بک
    if (
      target.id ===
        "wallet-save-settings-btn" ||
      target.closest(
        "#wallet-save-settings-btn"
      )
    ) {
      event.preventDefault();
      saveWalletSettings();
      return;
    }
  }

  // ============================================
  // تغییر فیلتر نوع
  // ============================================
  function handleWalletChange(
    event
  ) {
    var target =
      event.target;

    if (
      target.id ===
      "wallet-quick-type"
    ) {
      if (
        currentWalletPayload &&
        currentWalletPayload.transactions
      ) {
        renderWalletHistory(
          currentWalletPayload.transactions
        );
      }

      return;
    }
  }

  // ============================================
  // جستجوی تاریخچه
  // ============================================
  function handleWalletInput(
    event
  ) {
    var target =
      event.target;

    if (
      target.id ===
      "wallet-history-search"
    ) {
      if (
        currentWalletPayload &&
        currentWalletPayload.transactions
      ) {
        clearTimeout(
          target._searchTimeout
        );

        target._searchTimeout =
          setTimeout(
            function() {
              renderWalletHistory(
                currentWalletPayload.transactions
              );
            },
            300
          );
      }

      return;
    }
  }

  // ============================================
  // صادر کردن توابع
  // ============================================
  window.loadWalletUser =
    loadWalletUser;

  window.getWalletSummary =
    getWalletSummary;

  window.renderWalletHero =
    renderWalletHero;

  window.renderWalletSummary =
    renderWalletSummary;

  window.renderWalletUser =
    renderWalletUser;

  window.renderWalletAdjust =
    renderWalletAdjust;

  window.renderWalletSettings =
    renderWalletSettings;

  window.renderWalletHistory =
    renderWalletHistory;

  window.saveWalletTransaction =
    saveWalletTransaction;

  window.saveWalletSettings =
    saveWalletSettings;

  window.setupWalletEvents =
    setupWalletEvents;

  // ============================================
  // راه‌اندازی
  // ============================================
  refreshWalletElements();
  setupWalletEvents();

  console.log(
    "✅ Wallet module loaded successfully"
  );

})();