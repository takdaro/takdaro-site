(function () {
  function getProducts() {
    if (typeof window === "undefined") return [];
    if (!Array.isArray(window.PRODUCTS)) return [];
    return window.PRODUCTS;
  }

  function normalizeImageSrc(product) {
    if (Array.isArray(product.images) && product.images.length) {
      const firstImage = String(product.images[0] || "").trim();
      if (!firstImage) return "./assets/images/placeholder.png";
      if (firstImage.startsWith("http://") || firstImage.startsWith("https://")) {
        return firstImage;
      }
      if (firstImage.startsWith("/")) {
        return `.${firstImage}`;
      }
      return `./${firstImage.replace(/^\.?\//, "")}`;
    }

    return "./assets/images/placeholder.png";
  }

  function normalizePageUrl(product) {
    const rawPageUrl = String(product.pageUrl || "").trim();
    if (!rawPageUrl) return "#";
    if (rawPageUrl.startsWith("http://") || rawPageUrl.startsWith("https://")) {
      return rawPageUrl;
    }
    if (rawPageUrl.startsWith("/")) {
      return `.${rawPageUrl}`;
    }
    return `./${rawPageUrl.replace(/^\.?\//, "")}`;
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
    const imageSrc = normalizeImageSrc(product);
    const pageUrl = normalizePageUrl(product);
    const title = escapeHtml(product.name || "بدون نام");
    const category = escapeHtml(product.category || "محصول");
    const shortDescription = escapeHtml(product.shortDescription || "");
    const priceLabel = escapeHtml(product.priceLabel || product.displayPrice || "تماس بگیرید");
    const stockLabel = escapeHtml(
      product.stockLabel || (product.inStock ? "موجود" : "ناموجود")
    );
    const stockClass = product.inStock ? "in-stock" : "out-of-stock";

    return `
      <article class="product-card">
        <a href="${pageUrl}" class="product-card__image-link" aria-label="مشاهده محصول ${title}">
          <img
            src="${imageSrc}"
            alt="${title}"
            class="product-card__image"
            loading="lazy"
          />
        </a>

        <div class="product-card__body">
          <span class="product-card__category">${category}</span>

          <h3 class="product-card__title">
            <a href="${pageUrl}">${title}</a>
          </h3>

          <p class="product-card__text">${shortDescription}</p>

          <div class="product-card__meta">
            <strong class="product-card__price">${priceLabel}</strong>
            <span class="product-card__stock ${stockClass}">${stockLabel}</span>
          </div>

          <div class="product-card__actions">
            <a href="${pageUrl}" class="btn btn-primary">مشاهده محصول</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderEmptyState(message) {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    grid.innerHTML = `
      <div class="empty-products">
        <h3>محصولی برای نمایش پیدا نشد.</h3>
        <p>${escapeHtml(message || "اطلاعات محصولات در دسترس نیست.")}</p>
      </div>
    `;
  }

  function renderProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    const products = getProducts();

    if (!products.length) {
      renderEmptyState("اطلاعات محصولات هنوز بارگذاری نشده یا خالی است.");
      return;
    }

    grid.innerHTML = products.map(createProductCard).join("");
  }

  function handleProductsReady(event) {
    const products = event?.detail?.products;
    if (!Array.isArray(products) || !products.length) {
      renderEmptyState("داده‌ای از API دریافت نشد.");
      return;
    }

    renderProducts();
  }

  function parseMoney(value) {
    const digitMap = {
      "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
      "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
      "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
      "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
    };

    const normalized = String(value ?? "")
      .replace(/[۰-۹٠-٩]/g, (digit) => digitMap[digit] || digit)
      .replace(/[^\d]/g, "");

    const amount = Number(normalized || 0);
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  }

  function formatMoney(value) {
    return `${new Intl.NumberFormat("fa-IR").format(Number(value || 0))} تومان`;
  }

  function normalizeCashbackSettings(payload) {
    const settings = payload?.settings || {};
    const selectedIds = Array.isArray(settings.cashback_selected_user_ids)
      ? settings.cashback_selected_user_ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : String(settings.cashback_selected_user_ids || "")
          .split(",")
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0);

    const mode = ["all", "vip", "selected"].includes(String(settings.cashback_eligibility_mode || "all").toLowerCase())
      ? String(settings.cashback_eligibility_mode || "all").toLowerCase()
      : "all";

    return {
      enabled: settings.cashback_enabled !== false && String(settings.cashback_enabled ?? "1").toLowerCase() !== "0",
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

    if (settings.mode === "vip") {
      return String(user?.role || "").trim().toLowerCase() === "vip";
    }

    if (settings.mode === "selected") {
      const userId = Number(user?.id || 0);
      return userId > 0 && settings.selectedIds.includes(userId);
    }

    return true;
  }

  function calculateCashback(totalAmount, walletUsed, user, settings) {
    const safeTotal = Math.max(0, Number(totalAmount || 0));
    const safeWalletUsed = Math.max(0, Number(walletUsed || 0));

    if (!isCashbackEligible(user, settings)) return 0;
    if (safeTotal < settings.minOrder) return 0;

    const base = Math.max(0, safeTotal - safeWalletUsed);
    if (base <= 0) return 0;

    let amount = Math.max(0, Math.round((base * settings.percent) / 100));
    if (settings.maxPerOrder > 0) {
      amount = Math.min(amount, settings.maxPerOrder);
    }

    return amount;
  }

  async function fetchCustomerWalletData() {
    try {
      const response = await fetch("/api/account/wallet", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function ensureCheckoutRulesNote() {
    const cashbackRow = document.getElementById("cashback-row");
    if (!cashbackRow) return null;

    let note = document.getElementById("cashback-rules-note");
    if (note) return note;

    note = document.createElement("div");
    note.id = "cashback-rules-note";
    note.style.cssText = [
      "padding:12px 14px",
      "border:1px solid var(--border)",
      "border-radius:14px",
      "background:var(--surface-2)",
      "color:var(--text-soft)",
      "font-size:.9rem",
      "line-height:1.9"
    ].join(";");

    cashbackRow.insertAdjacentElement("afterend", note);
    return note;
  }

  function buildCashbackRulesText(settings, user) {
    const parts = [];

    if (settings.minOrder > 0) {
      parts.push(`حداقل مبلغ سفارش برای دریافت کش‌بک ${formatMoney(settings.minOrder)} است.`);
    }

    if (settings.maxPerOrder > 0) {
      parts.push(`حداکثر کش‌بک هر سفارش ${formatMoney(settings.maxPerOrder)} است.`);
    }

    if (settings.expiryMonths > 0) {
      parts.push(`اعتبار کش‌بک ${new Intl.NumberFormat("fa-IR").format(settings.expiryMonths)} ماه است.`);
    } else {
      parts.push("کش‌بک این طرح بدون تاریخ انقضا ثبت می‌شود.");
    }

    if (settings.mode === "vip") {
      parts.push("این طرح فقط برای کاربران VIP فعال است.");
    } else if (settings.mode === "selected") {
      parts.push("این طرح فقط برای کاربران انتخاب‌شده فعال است.");
    } else {
      parts.push("این طرح برای همه کاربران فعال است.");
    }

    if (!isCashbackEligible(user, settings)) {
      parts.push("حساب فعلی در گروه دریافت‌کنندگان این طرح قرار ندارد.");
    }

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
      const totalAmount = subtotal + shipping;
      const cashback = calculateCashback(totalAmount, walletUsed, user, settings);

      summaryCashback.textContent = formatMoney(cashback);
      cashbackRow.hidden = cashback <= 0;

      if (note) {
        if (!settings.enabled || settings.percent <= 0) {
          note.textContent = "در حال حاضر طرح کش‌بک غیرفعال است.";
        } else if (totalAmount > 0 && totalAmount < settings.minOrder) {
          note.textContent = `برای دریافت کش‌بک، حداقل مبلغ سفارش باید ${formatMoney(settings.minOrder)} باشد.`;
        } else {
          note.textContent = buildCashbackRulesText(settings, user);
        }
      }
    }

    refreshPreview();

    document.addEventListener("input", function (event) {
      if (event.target?.id === "wallet-use-amount") {
        setTimeout(refreshPreview, 0);
      }
    });

    document.addEventListener("change", function (event) {
      if (["wallet-use-toggle", "wallet-use-amount", "province", "city"].includes(event.target?.id)) {
        setTimeout(refreshPreview, 0);
      }
    });

    const watchedNodes = [summarySubtotal, summaryShipping, summaryWalletUsed].filter(Boolean);
    const observer = new MutationObserver(function () {
      setTimeout(refreshPreview, 0);
    });

    watchedNodes.forEach((node) => observer.observe(node, { childList: true, subtree: true }));
  }

  function injectCashbackPopupStyles() {
    if (document.getElementById("cashback-popup-styles")) return;

    const style = document.createElement("style");
    style.id = "cashback-popup-styles";
    style.textContent = `
      .cashback-info-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(2, 48, 71, .45);
        backdrop-filter: blur(4px);
      }
      .cashback-info-card {
        width: min(100%, 520px);
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: 0 24px 70px rgba(2, 48, 71, .24);
        overflow: hidden;
        direction: rtl;
      }
      .cashback-info-head {
        padding: 20px 22px;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: #fff;
      }
      .cashback-info-head h3 { margin: 0 0 6px; font-size: 1.15rem; }
      .cashback-info-head p { margin: 0; color: rgba(255,255,255,.9); line-height: 1.9; }
      .cashback-info-body { padding: 20px 22px; color: var(--text); line-height: 2; }
      .cashback-info-list { margin: 0; padding: 0 20px 0 0; }
      .cashback-info-result {
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: 14px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-weight: 700;
      }
      .cashback-info-actions { padding: 0 22px 22px; display: flex; justify-content: flex-end; }
      .cashback-info-actions button { min-width: 120px; }
    `;
    document.head.appendChild(style);
  }

  function showInvoiceCashbackPopup(walletData) {
    const invoiceContent = document.getElementById("invoice-content");
    const summaryCashback = document.getElementById("summary-cashback");
    const summaryTotal = document.getElementById("summary-total");

    if (!invoiceContent || !summaryCashback || !summaryTotal) return;

    const settings = normalizeCashbackSettings(walletData);
    const user = walletData?.user || {};

    if (!settings.enabled || settings.percent <= 0) return;
    if (document.getElementById("cashback-info-popup")) return;

    const cashback = parseMoney(summaryCashback.textContent);
    const totalAmount = parseMoney(summaryTotal.textContent);
    const eligible = isCashbackEligible(user, settings);

    injectCashbackPopupStyles();

    const rules = [];
    rules.push(`درصد کش‌بک فعلی: ${new Intl.NumberFormat("fa-IR").format(settings.percent)}٪`);
    if (settings.minOrder > 0) rules.push(`حداقل مبلغ سفارش برای دریافت کش‌بک: ${formatMoney(settings.minOrder)}`);
    if (settings.maxPerOrder > 0) rules.push(`حداکثر کش‌بک هر سفارش: ${formatMoney(settings.maxPerOrder)}`);
    rules.push(settings.expiryMonths > 0
      ? `مدت اعتبار کش‌بک: ${new Intl.NumberFormat("fa-IR").format(settings.expiryMonths)} ماه`
      : "مدت اعتبار کش‌بک: بدون انقضا");

    let resultText = "";
    if (!eligible) {
      resultText = "این حساب در گروه کاربران مجاز این طرح قرار ندارد.";
    } else if (settings.minOrder > 0 && totalAmount < settings.minOrder) {
      resultText = `این سفارش به حداقل مبلغ ${formatMoney(settings.minOrder)} برای دریافت کش‌بک نرسیده است.`;
    } else if (cashback > 0) {
      resultText = `کش‌بک این سفارش ${formatMoney(cashback)} است و پس از نهایی‌شدن سفارش طبق وضعیت‌های مجاز به کیف پول شما اضافه می‌شود.`;
    } else {
      resultText = "برای این سفارش کش‌بکی ثبت نشده است.";
    }

    const overlay = document.createElement("div");
    overlay.id = "cashback-info-popup";
    overlay.className = "cashback-info-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "cashback-info-title");

    overlay.innerHTML = `
      <div class="cashback-info-card">
        <div class="cashback-info-head">
          <h3 id="cashback-info-title">🎁 شرایط کش‌بک سفارش</h3>
          <p>شرایط فعلی طرح کش‌بک برای این سفارش</p>
        </div>
        <div class="cashback-info-body">
          <ul class="cashback-info-list">
            ${rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}
          </ul>
          <div class="cashback-info-result">${escapeHtml(resultText)}</div>
        </div>
        <div class="cashback-info-actions">
          <button type="button" class="btn btn-primary" id="cashback-info-close">متوجه شدم</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    function closePopup() {
      overlay.remove();
    }

    document.getElementById("cashback-info-close")?.addEventListener("click", closePopup);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closePopup();
    });
  }

  async function initCustomerCashbackUi() {
    const isCheckout = !!document.getElementById("checkout-form");
    const isInvoice = !!document.getElementById("invoice-content");
    if (!isCheckout && !isInvoice) return;

    const walletData = await fetchCustomerWalletData();
    if (!walletData) return;

    if (isCheckout) {
      initCheckoutCashbackPreview(walletData);
    }

    if (isInvoice) {
      let attempts = 0;
      const timer = setInterval(function () {
        attempts += 1;
        const loading = document.getElementById("invoice-loading");
        const ready = !loading || loading.style.display === "none";

        if (ready || attempts >= 40) {
          clearInterval(timer);
          showInvoiceCashbackPopup(walletData);
        }
      }, 150);
    }
  }

  function boot() {
    if (window.PRODUCTS_READY === true && getProducts().length) {
      renderProducts();
    } else {
      renderEmptyState("در حال بارگذاری محصولات...");
    }

    document.addEventListener("products:ready", handleProductsReady);
    void initCustomerCashbackUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();