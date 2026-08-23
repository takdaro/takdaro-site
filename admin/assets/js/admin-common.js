// ============================================
// admin-common.js - توابع مشترک پنل مدیریت
// ============================================

(function() {
  'use strict';

  // ============================================
  // تابع escape کردن متن
  // ============================================
  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ============================================
  // تابع فرمت کردن اعداد به فارسی
  // ============================================
  function money(value) {
    return Number(value || 0).toLocaleString("fa-IR");
  }

  // ============================================
  // تابع فرمت کردن تاریخ به فارسی
  // ============================================
  function formatDate(value) {
    if (!value) return "-";
    try {
      var normalized = String(value).trim().replace(" ", "T");
      var date = new Date(normalized);
      if (Number.isNaN(date.getTime())) return esc(String(value));
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    } catch (error) {
      return esc(String(value));
    }
  }

  // ============================================
  // تبدیل نقش کاربر به فارسی
  // ============================================
  function faRole(value) {
    var map = {
      user: "مشتری",
      customer: "مشتری",
      admin: "ادمین",
      super_admin: "مدیر کل"
    };
    return map[String(value || "").toLowerCase()] || "نامشخص";
  }

  // ============================================
  // تبدیل وضعیت سفارش به فارسی (۱۶ وضعیت کامل)
  // ============================================
  function faOrderStatus(value) {
    var map = {
      order_created: "سفارش ثبت شد",
      payment_pending: "در انتظار پرداخت",
      payment_success: "پرداخت موفق",
      payment_failed: "پرداخت ناموفق",
      payment_review: "بررسی پرداخت",
      order_confirmed: "تأیید سفارش",
      processing: "در حال پردازش",
      ready_to_ship: "آماده ارسال",
      courier_delivery: "ارسال با پیک",
      bus_shipping: "ارسال با اتوبوس",
      shipped: "ارسال شد",
      delivered: "تحویل داده شد",
      completed: "تکمیل شد",
      cancelled: "لغو شد",
      returned: "مرجوع شد",
      processing_failed: "پردازش ناموفق"
    };
    return map[String(value || "").toLowerCase()] || "نامشخص";
  }

  // ============================================
  // تبدیل وضعیت پرداخت به فارسی
  // ============================================
  function faPaymentStatus(value) {
    var map = {
      payment_pending: "در انتظار پرداخت",
      payment_review: "بررسی پرداخت",
      payment_success: "پرداخت موفق",
      payment_failed: "پرداخت ناموفق"
    };
    return map[String(value || "").toLowerCase()] || "نامشخص";
  }

  // ============================================
  // تبدیل نوع تراکنش کیف پول به فارسی
  // ============================================
  function faWalletType(value) {
    var map = {
      credit: "واریز",
      debit: "برداشت",
      cashback: "کش‌بک",
      refund: "بازگشت وجه",
      adjustment: "تعدیل"
    };
    return map[String(value || "").toLowerCase()] || "نامشخص";
  }

  // ============================================
  // تبدیل وضعیت محصول به فارسی
  // ============================================
  function faProductStatus(value) {
    var map = {
      published: "منتشرشده",
      draft: "پیش‌نویس",
      private: "خصوصی"
    };
    return map[String(value || "").toLowerCase()] || "پیش‌نویس";
  }

  // ============================================
  // ایجاد بج وضعیت (برای سفارش‌ها و کاربران)
  // ============================================
  function badge(value) {
    var v = String(value || "").toLowerCase();
    var cls = "status-badge status-badge--warning";
    
    if (["payment_success", "order_confirmed", "processing", "ready_to_ship", "shipped", "delivered", "completed"].includes(v)) {
      cls = "status-badge status-badge--success";
    } else if (["order_created", "payment_pending", "payment_review", "courier_delivery", "bus_shipping"].includes(v)) {
      cls = "status-badge status-badge--warning";
    } else if (["payment_failed", "cancelled", "returned", "processing_failed"].includes(v)) {
      cls = "status-badge status-badge--danger";
    } else if (["user", "customer"].includes(v)) {
      cls = "status-badge status-badge--info";
    } else if (["admin", "super_admin"].includes(v)) {
      cls = "status-badge status-badge--success";
    }
    
    var text = faOrderStatus(v) || v || "نامشخص";
    return '<span class="' + cls + '">' + text + '</span>';
  }

  // ============================================
  // ایجاد چیپ نوع تراکنش کیف پول
  // ============================================
  function walletTypeChip(type) {
    var v = String(type || "").toLowerCase();
    var cls = "wallet-type-chip wallet-type-chip--adjustment";
    if (["credit", "cashback", "refund"].includes(v)) cls = "wallet-type-chip wallet-type-chip--" + v;
    else if (v === "debit") cls = "wallet-type-chip wallet-type-chip--debit";
    else if (v === "adjustment") cls = "wallet-type-chip wallet-type-chip--adjustment";
    return '<span class="' + cls + '">' + esc(faWalletType(type)) + '</span>';
  }

  // ============================================
  // ایجاد بج وضعیت محصول
  // ============================================
  function productStatusBadge(value) {
    var v = String(value || "draft").toLowerCase();
    var cls = v === "published" 
      ? "status-badge status-badge--success" 
      : v === "private" 
        ? "status-badge status-badge--danger" 
        : "status-badge status-badge--warning";
    return '<span class="' + cls + '">' + esc(faProductStatus(v)) + '</span>';
  }

  // ============================================
  // تابع نمایش پیام در پنل ادمین
  // ============================================
  function setAdminMessage(message, type) {
    var adminMessage = document.getElementById("admin-message");
    if (!adminMessage) {
      console.log("[Admin Message]", type || "info", message);
      return;
    }
    adminMessage.textContent = message || "";
    adminMessage.className = "admin-message";
    if (message) {
      adminMessage.classList.add(type === "success" ? "is-success" : "is-error");
    }
  }

  // ============================================
  // تابع درخواست API
  // ============================================
  async function api(url, options) {
    options = options || {};
    try {
      var response = await fetch(url, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        ...options
      });
      var data = null;
      try {
        data = await response.json();
      } catch (_) {
        data = { success: false, error: "پاسخ سرور نامعتبر است." };
      }
      return { ok: response.ok, data: data };
    } catch (e) {
      return { ok: false, data: { success: false, error: e.message } };
    }
  }

  // ============================================
  // صادر کردن توابع به صورت Global
  // ============================================
  
  window.esc = esc;
  window.money = money;
  window.formatDate = formatDate;
  window.faRole = faRole;
  window.faOrderStatus = faOrderStatus;
  window.faPaymentStatus = faPaymentStatus;
  window.faWalletType = faWalletType;
  window.faProductStatus = faProductStatus;
  window.badge = badge;
  window.walletTypeChip = walletTypeChip;
  window.productStatusBadge = productStatusBadge;
  window.setAdminMessage = setAdminMessage;
  window.api = api;

  window.AdminCommon = {
    esc: esc,
    money: money,
    formatDate: formatDate,
    faRole: faRole,
    faOrderStatus: faOrderStatus,
    faPaymentStatus: faPaymentStatus,
    faWalletType: faWalletType,
    faProductStatus: faProductStatus,
    badge: badge,
    walletTypeChip: walletTypeChip,
    productStatusBadge: productStatusBadge,
    setAdminMessage: setAdminMessage,
    api: api
  };

  console.log("✅ Admin Common loaded successfully");

})();