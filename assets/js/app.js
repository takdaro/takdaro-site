(function () {
  function getProducts() {
    return typeof window !== "undefined" && Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function normalizeImageSrc(product) {
    const firstImage = Array.isArray(product?.images) && product.images.length ? String(product.images[0] || "").trim() : "";
    if (!firstImage) return "./assets/images/placeholder.png";
    if (/^https?:\/\//i.test(firstImage)) return firstImage;
    if (firstImage.startsWith("/")) return `.${firstImage}`;
    return `./${firstImage.replace(/^\.?\//, "")}`;
  }

  function normalizePageUrl(product) {
    const raw = String(product?.pageUrl || "").trim();
    if (!raw) return "#";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return `.${raw}`;
    return `./${raw.replace(/^\.?\//, "")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createProductCard(product) {
    const title = escapeHtml(product?.name || "بدون نام");
    const category = escapeHtml(product?.category || "محصول");
    const shortDescription = escapeHtml(product?.shortDescription || "");
    const priceLabel = escapeHtml(product?.priceLabel || product?.displayPrice || "تماس بگیرید");
    const stockLabel = escapeHtml(product?.stockLabel || (product?.inStock ? "موجود" : "ناموجود"));
    const stockClass = product?.inStock ? "in-stock" : "out-of-stock";

    return `
      <article class="product-card">
        <a href="${normalizePageUrl(product)}" class="product-card__image-link" aria-label="مشاهده محصول ${title}">
          <img src="${normalizeImageSrc(product)}" alt="${title}" class="product-card__image" loading="lazy" />
        </a>
        <div class="product-card__body">
          <span class="product-card__category">${category}</span>
          <h3 class="product-card__title"><a href="${normalizePageUrl(product)}">${title}</a></h3>
          <p class="product-card__text">${shortDescription}</p>
          <div class="product-card__meta">
            <strong class="product-card__price">${priceLabel}</strong>
            <span class="product-card__stock ${stockClass}">${stockLabel}</span>
          </div>
          <div class="product-card__actions"><a href="${normalizePageUrl(product)}" class="btn btn-primary">مشاهده محصول</a></div>
        </div>
      </article>`;
  }

  function renderEmptyState(message) {
    const grid = document.getElementById("products-grid");
    if (!grid) return;
    grid.innerHTML = `<div class="empty-products"><h3>محصولی برای نمایش پیدا نشد.</h3><p>${escapeHtml(message || "اطلاعات محصولات در دسترس نیست.")}</p></div>`;
  }

  function renderProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;
    const products = getProducts();
    if (!products.length) return renderEmptyState("اطلاعات محصولات هنوز بارگذاری نشده یا خالی است.");
    grid.innerHTML = products.map(createProductCard).join("");
  }

  function handleProductsReady(event) {
    if (!Array.isArray(event?.detail?.products) || !event.detail.products.length) return renderEmptyState("داده‌ای از API دریافت نشد.");
    renderProducts();
  }

  const digitMap = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
  };

  function parseMoney(value) {
    const normalized = String(value ?? "").replace(/[۰-۹٠-٩]/g, d => digitMap[d] || d).replace(/[^\d]/g, "");
    const amount = Number(normalized || 0);
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  }

  function formatMoney(value) {
    return `${new Intl.NumberFormat("fa-IR").format(Number(value || 0))} تومان`;
  }

  function formatPersianDate(value) {
    if (!value) return "بدون انقضا";
    const raw = String(value).trim();
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function normalizeCashbackSettings(payload) {
    const settings = payload?.settings || {};
    const selectedIds = Array.isArray(settings.cashback_selected_user_ids)
      ? settings.cashback_selected_user_ids.map(Number).filter(id => Number.isInteger(id) && id > 0)
      : String(settings.cashback_selected_user_ids || "").split(",").map(Number).filter(id => Number.isInteger(id) && id > 0);
    const rawMode = String(settings.cashback_eligibility_mode || "all").toLowerCase();
    const mode = ["all", "vip", "selected"].includes(rawMode) ? rawMode : "all";
    const enabledValue = settings.cashback_enabled;
    const enabled = enabledValue === true || ["1", "true", "on", "yes"].includes(String(enabledValue ?? "1").toLowerCase());

    return {
      enabled,
      percent: Math.max(0, Number(payload?.cashback_percent ?? settings.cashback_percent ?? 0) || 0),
      minOrder: Math.max(0, Number(settings.cashback_min_order_amount || 0) || 0),
      maxPerOrder: Math.max(0, Number(settings.cashback_max_per_order || 0) || 0),
      mode,
      selectedIds,
      expiryMonths: Math.max(0, Math.min(12, Number(settings.cashback_expiry_months || 0) || 0))
    };
  }

  function isCashbackEligible(user, settings) {
    if (!settings.enabled || settings.percent <= 0) return false;
    if (settings.mode === "vip") return String(user?.role || "").trim().toLowerCase() === "vip";
    if (settings.mode === "selected") {
      const userId = Number(user?.id || 0);
      return userId > 0 && settings.selectedIds.includes(userId);
    }
    return true;
  }

  function calculateCashback(totalAmount, walletUsed, user, settings) {
    const total = Math.max(0, Number(totalAmount || 0));
    const used = Math.max(0, Number(walletUsed || 0));
    if (!isCashbackEligible(user, settings)) return 0;
    if (total < settings.minOrder) return 0;
    const base = Math.max(0, total - used);
    if (base <= 0) return 0;
    let amount = Math.max(0, Math.round((base * settings.percent) / 100));
    if (settings.maxPerOrder > 0) amount = Math.min(amount, settings.maxPerOrder);
    return amount;
  }

  async function fetchCustomerWalletData(attempts = 1) {
    for (let i = 0; i < attempts; i += 1) {
      try {
        const response = await fetch("/api/account/wallet", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.success) return data;
      } catch (_) {}
      if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, 350));
    }
    return null;
  }

  function ensureCheckoutRulesNote() {
    const cashbackRow = document.getElementById("cashback-row");
    if (!cashbackRow) return null;
    let note = document.getElementById("cashback-rules-note");
    if (note) return note;
    note = document.createElement("div");
    note.id = "cashback-rules-note";
    note.style.cssText = "padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);color:var(--text-soft);font-size:.9rem;line-height:1.9";
    cashbackRow.insertAdjacentElement("afterend", note);
    return note;
  }

  function buildCashbackRulesText(settings, user) {
    const parts = [];
    if (settings.minOrder > 0) parts.push(`حداقل مبلغ سفارش برای دریافت کش‌بک ${formatMoney(settings.minOrder)} است.`);
    if (settings.maxPerOrder > 0) parts.push(`حداکثر کش‌بک هر سفارش ${formatMoney(settings.maxPerOrder)} است.`);
    parts.push(settings.expiryMonths > 0
      ? `اعتبار کش‌بک ${new Intl.NumberFormat("fa-IR").format(settings.expiryMonths)} ماه از زمان واریز به کیف پول است.`
      : "کش‌بک این طرح بدون تاریخ انقضا ثبت می‌شود.");
    if (settings.mode === "vip") parts.push("این طرح فقط برای کاربران VIP فعال است.");
    else if (settings.mode === "selected") parts.push("این طرح فقط برای کاربران انتخاب‌شده فعال است.");
    else parts.push("این طرح برای همه کاربران فعال است.");
    if (!isCashbackEligible(user, settings)) parts.push("حساب فعلی در گروه دریافت‌کنندگان این طرح قرار ندارد.");
    return parts.join(" ");
  }

  function initCheckoutCashbackPreview(walletData) {
    const cashbackRow = document.getElementById("cashback-row");
    const summaryCashback = document.getElementById("summary-cashback");
    const summarySubtotal = document.getElementById("summary-subtotal");
    const summaryShipping = document.getElementById("summary-shipping");
    const summaryWalletUsed = document.getElementById("summary-wallet-used");
    if (!cashbackRow || !summaryCashback || !summarySubtotal || !summaryShipping) return;

    const settings = normalizeCashbackSettings(walletData);
    const user = walletData?.user || {};
    const note = ensureCheckoutRulesNote();

    function refreshPreview() {
      const subtotal = parseMoney(summarySubtotal.textContent);
      const shipping = parseMoney(summaryShipping.textContent);
      const walletUsed = parseMoney(summaryWalletUsed?.textContent);
      const total = subtotal + shipping;
      const cashback = calculateCashback(total, walletUsed, user, settings);
      summaryCashback.textContent = formatMoney(cashback);
      cashbackRow.hidden = cashback <= 0;
      if (!note) return;
      if (!settings.enabled || settings.percent <= 0) note.textContent = "در حال حاضر طرح کش‌بک غیرفعال است. موجودی کش‌بک قبلی شما همچنان تا تاریخ انقضای خودش قابل استفاده است.";
      else if (total > 0 && total < settings.minOrder) note.textContent = `برای دریافت کش‌بک، حداقل مبلغ سفارش باید ${formatMoney(settings.minOrder)} باشد.`;
      else note.textContent = buildCashbackRulesText(settings, user);
    }

    refreshPreview();
    document.addEventListener("input", e => { if (e.target?.id === "wallet-use-amount") setTimeout(refreshPreview, 0); });
    document.addEventListener("change", e => { if (["wallet-use-toggle", "wallet-use-amount", "province", "city"].includes(e.target?.id)) setTimeout(refreshPreview, 0); });
    const observer = new MutationObserver(() => setTimeout(refreshPreview, 0));
    [summarySubtotal, summaryShipping, summaryWalletUsed].filter(Boolean).forEach(node => observer.observe(node, { childList: true, subtree: true }));
  }

  function injectPopupStyles() {
    if (document.getElementById("cashback-popup-styles")) return;
    const style = document.createElement("style");
    style.id = "cashback-popup-styles";
    style.textContent = `
      .cashback-info-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,48,71,.48);backdrop-filter:blur(4px)}
      .cashback-info-card{width:min(100%,540px);background:#fff;border:1px solid #dbe4ea;border-radius:24px;box-shadow:0 24px 70px rgba(2,48,71,.28);overflow:hidden;direction:rtl}
      .cashback-info-head{padding:20px 22px;background:linear-gradient(135deg,#023047,#219ebc);color:#fff}
      .cashback-info-head h3{margin:0 0 6px;font-size:1.15rem}.cashback-info-head p{margin:0;color:rgba(255,255,255,.92);line-height:1.9}
      .cashback-info-body{padding:20px 22px;color:#24333d;line-height:2}.cashback-info-list{margin:0;padding:0 20px 0 0}
      .cashback-info-result{margin-top:14px;padding:12px 14px;border-radius:14px;background:#f7fafc;border:1px solid #dbe4ea;font-weight:700}
      .cashback-info-actions{padding:0 22px 22px;display:flex;justify-content:flex-end}.cashback-info-actions button{min-width:120px}
      .account-cashback-breakdown{margin-top:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .account-cashback-card{padding:16px;border:1px solid var(--border,#dbe4ea);border-radius:18px;background:var(--surface-2,#f7fafc)}
      .account-cashback-card span{display:block;color:var(--muted,#64748b);font-size:.86rem;margin-bottom:8px}.account-cashback-card strong{color:var(--primary,#023047);font-size:1.05rem}
      .account-cashback-expiry{margin-top:12px;padding:12px 14px;border:1px solid rgba(33,158,188,.2);border-radius:14px;background:rgba(33,158,188,.06);color:var(--text-soft,#334155);line-height:1.9}
      @media(max-width:720px){.account-cashback-breakdown{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function showInvoiceCashbackPopup(walletData) {
    if (document.getElementById("cashback-info-popup")) return;
    const settings = normalizeCashbackSettings(walletData || {});
    const user = walletData?.user || {};
    const cashback = parseMoney(document.getElementById("summary-cashback")?.textContent);
    const total = parseMoney(document.getElementById("summary-total")?.textContent);
    injectPopupStyles();

    const rules = [];
    if (settings.percent > 0) rules.push(`درصد کش‌بک فعلی: ${new Intl.NumberFormat("fa-IR").format(settings.percent)}٪`);
    if (settings.minOrder > 0) rules.push(`حداقل مبلغ سفارش برای دریافت کش‌بک: ${formatMoney(settings.minOrder)}`);
    if (settings.maxPerOrder > 0) rules.push(`حداکثر کش‌بک هر سفارش: ${formatMoney(settings.maxPerOrder)}`);
    if (settings.expiryMonths > 0) rules.push(`مدت اعتبار کش‌بک: ${new Intl.NumberFormat("fa-IR").format(settings.expiryMonths)} ماه از زمان واریز به کیف پول`);
    else rules.push("مدت اعتبار کش‌بک: بدون انقضا");

    let resultText = "";
    if (!settings.enabled || settings.percent <= 0) resultText = "در حال حاضر صدور کش‌بک جدید غیرفعال است. موجودی کش‌بک قبلی شما حذف نمی‌شود و تا تاریخ انقضای خودش قابل استفاده است.";
    else if (!isCashbackEligible(user, settings)) resultText = "این حساب در گروه کاربران مجاز این طرح قرار ندارد.";
    else if (settings.minOrder > 0 && total < settings.minOrder) resultText = `این سفارش به حداقل مبلغ ${formatMoney(settings.minOrder)} برای دریافت کش‌بک نرسیده است.`;
    else if (cashback > 0) resultText = `کش‌بک این سفارش ${formatMoney(cashback)} است و پس از نهایی‌شدن سفارش طبق وضعیت‌های مجاز به کیف پول شما اضافه می‌شود.`;
    else resultText = "برای این سفارش کش‌بکی ثبت نشده است.";

    const overlay = document.createElement("div");
    overlay.id = "cashback-info-popup";
    overlay.className = "cashback-info-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="cashback-info-card">
        <div class="cashback-info-head"><h3>🎁 شرایط کش‌بک سفارش</h3><p>شرایط فعلی طرح کش‌بک برای این سفارش</p></div>
        <div class="cashback-info-body">
          <ul class="cashback-info-list">${rules.map(rule => `<li>${escapeHtml(rule)}</li>`).join("")}</ul>
          <div class="cashback-info-result">${escapeHtml(resultText)}</div>
        </div>
        <div class="cashback-info-actions"><button type="button" class="btn btn-primary" id="cashback-info-close">متوجه شدم</button></div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById("cashback-info-close")?.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  }

  function renderAccountCashbackSummary(walletData) {
    const walletBalance = document.getElementById("wallet-balance");
    if (!walletBalance || !walletData) return;
    injectPopupStyles();

    walletBalance.textContent = formatMoney(walletData.wallet_balance || walletData.user?.wallet_balance || 0);

    const total = Number(walletData.wallet_balance || walletData.user?.wallet_balance || 0);
    const permanent = Number(walletData.permanent_balance || 0);
    const cashback = Number(walletData.cashback_balance || 0);
    const nearestExpiry = walletData.nearest_cashback_expiry || null;

    const statsGrid = walletBalance.closest(".stats-grid");
    if (!statsGrid) return;

    let box = document.getElementById("account-cashback-breakdown");
    if (!box) {
      box = document.createElement("div");
      box.id = "account-cashback-breakdown";
      box.className = "account-cashback-breakdown";
      statsGrid.insertAdjacentElement("afterend", box);
    }

    box.innerHTML = `
      <div class="account-cashback-card">
        <span>موجودی کل کیف پول</span>
        <strong>${escapeHtml(formatMoney(total))}</strong>
      </div>
      <div class="account-cashback-card">
        <span>موجودی دائمی</span>
        <strong>${escapeHtml(formatMoney(permanent))}</strong>
      </div>
      <div class="account-cashback-card">
        <span>موجودی کش‌بک</span>
        <strong>${escapeHtml(formatMoney(cashback))}</strong>
      </div>`;

    let expiryNote = document.getElementById("account-cashback-expiry");
    if (!expiryNote) {
      expiryNote = document.createElement("div");
      expiryNote.id = "account-cashback-expiry";
      expiryNote.className = "account-cashback-expiry";
      box.insertAdjacentElement("afterend", expiryNote);
    }

    const settings = normalizeCashbackSettings(walletData);
    if (cashback > 0 && nearestExpiry) {
      expiryNote.textContent = `${formatMoney(cashback)} کش‌بک فعال دارید. نزدیک‌ترین تاریخ انقضا: ${formatPersianDate(nearestExpiry)}.`;
    } else if (cashback > 0) {
      expiryNote.textContent = `${formatMoney(cashback)} کش‌بک فعال دارید و برای این موجودی تاریخ انقضا ثبت نشده است.`;
    } else if (settings.expiryMonths > 0) {
      expiryNote.textContent = `کش‌بک‌های جدید ${new Intl.NumberFormat("fa-IR").format(settings.expiryMonths)} ماه از زمان واریز به کیف پول اعتبار دارند.`;
    } else {
      expiryNote.textContent = "در حال حاضر کش‌بک فعالی با تاریخ انقضا در کیف پول شما وجود ندارد.";
    }
  }

  async function initAccountCashbackUi() {
    if (!document.getElementById("wallet-balance")) return;
    const walletData = await fetchCustomerWalletData(5);
    if (walletData) renderAccountCashbackSummary(walletData);
  }

  async function initCustomerCashbackUi() {
    const isCheckout = !!document.getElementById("checkout-form");
    const isInvoice = !!document.getElementById("invoice-content");
    if (!isCheckout && !isInvoice) return;

    if (isCheckout) {
      const walletData = await fetchCustomerWalletData(4);
      if (walletData) initCheckoutCashbackPreview(walletData);
    }

    if (isInvoice) {
      let loops = 0;
      const waitForInvoice = setInterval(async function () {
        loops += 1;
        const summary = document.getElementById("summary-total");
        const orderNumber = document.getElementById("order-number-text");
        const ready = summary && parseMoney(summary.textContent) > 0 && orderNumber && String(orderNumber.textContent || "").trim() !== "-";
        if (!ready && loops < 50) return;

        clearInterval(waitForInvoice);
        const walletData = await fetchCustomerWalletData(6);
        showInvoiceCashbackPopup(walletData || { settings: { cashback_enabled: false } });
      }, 200);
    }
  }

  function boot() {
    if (document.getElementById("products-grid")) {
      if (window.PRODUCTS_READY === true && getProducts().length) renderProducts();
      else renderEmptyState("در حال بارگذاری محصولات...");
      document.addEventListener("products:ready", handleProductsReady);
    }
    void initCustomerCashbackUi();
    void initAccountCashbackUi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
