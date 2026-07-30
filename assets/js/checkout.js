(() => {
  const SHIPPING_FEES = {
    tehran: 700000,
    "tehran-counties": 1200000,
    "iran-provinces": 800000
  };

  const SHIPPING_LABELS = {
    tehran: "تهران",
    "tehran-counties": "اطراف تهران",
    "iran-provinces": "سایر استان‌ها"
  };

  const els = {
    checkoutEmpty: document.getElementById("checkout-empty"),
    checkoutContent: document.getElementById("checkout-content"),
    checkoutForm: document.getElementById("checkout-form"),
    checkoutMessage: document.getElementById("checkout-message"),
    submitOrderBtn: document.getElementById("submit-order-btn"),

    invoiceItemsBody: document.getElementById("invoice-items-body"),
    invoiceDate: document.getElementById("invoice-date"),
    invoiceItemsCount: document.getElementById("invoice-items-count"),

    summaryQty: document.getElementById("summary-qty"),
    summarySubtotal: document.getElementById("summary-subtotal"),
    summaryShipping: document.getElementById("summary-shipping"),
    summaryTotal: document.getElementById("summary-total"),

    walletBox: document.getElementById("wallet-box"),
    walletBalance: document.getElementById("wallet-balance"),
    walletUseToggle: document.getElementById("wallet-use-toggle"),
    walletUseFields: document.getElementById("wallet-use-fields"),
    walletUseAmount: document.getElementById("wallet-use-amount"),
    walletHelpText: document.getElementById("wallet-help-text"),
    walletDiscountRow: document.getElementById("wallet-discount-row"),
    summaryWalletUsed: document.getElementById("summary-wallet-used"),
    cashbackRow: document.getElementById("cashback-row"),
    summaryCashback: document.getElementById("summary-cashback"),

    province: document.getElementById("province"),
    firstName: document.getElementById("first-name"),
    lastName: document.getElementById("last-name"),
    city: document.getElementById("city"),
    postalCode: document.getElementById("postal-code"),
    phone: document.getElementById("phone"),
    address: document.getElementById("address")
  };

  const state = {
    currentUser: null,
    wallet: {
      loaded: false,
      available: false,
      balance: 0,
      cashbackPercent: 0
    }
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toEnglishDigits(value) {
    const map = {
      "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
      "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
    };
    return String(value ?? "").replace(/[۰-۹]/g, (d) => map[d]);
  }

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function parsePrice(raw) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.max(0, Math.round(raw));
    }

    if (raw === null || raw === undefined || raw === "") {
      return null;
    }

    const normalized = toEnglishDigits(String(raw)).replace(/[^\d]/g, "");
    if (!normalized) return null;

    const amount = Number(normalized);
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : null;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fa-IR").format(Number(value || 0));
  }

  function formatMoney(value) {
    const amount = parsePrice(value);
    if (amount === null || amount <= 0) return "تماس بگیرید";
    return `${formatNumber(amount)} تومان`;
  }

  function getProducts() {
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function findProductByIdentifiers(productId, slug) {
    const safeId = String(productId ?? "").trim();
    const safeSlug = String(slug ?? "").trim();

    return (
      getProducts().find((product) => {
        return (
          (safeSlug && String(product?.slug || "").trim() === safeSlug) ||
          (safeId && String(product?.id ?? "").trim() === safeId)
        );
      }) || null
    );
  }

  function setCheckoutMessage(message, type = "info") {
    if (!els.checkoutMessage) return;

    els.checkoutMessage.textContent = message || "";
    els.checkoutMessage.className = "checkout-message";

    if (!message) return;

    if (type === "success") {
      els.checkoutMessage.classList.add("is-success");
    } else if (type === "error") {
      els.checkoutMessage.classList.add("is-error");
    } else {
      els.checkoutMessage.classList.add("is-info");
    }
  }

  function getProductImage(product) {
    const firstImage =
      Array.isArray(product?.images) && product.images.length
        ? String(product.images[0] || "").trim()
        : "";

    const primaryImage = String(product?.primaryImage || "").trim();
    const resolved = primaryImage || firstImage;

    if (!resolved) return "./assets/images/placeholder.png";
    if (resolved.startsWith("http://") || resolved.startsWith("https://")) return resolved;
    if (resolved.startsWith("/")) return `.${resolved}`;
    return `./${resolved.replace(/^\.?\//, "")}`;
  }

  function getSelectedShippingFee() {
    const value = els.province?.value || "";
    return SHIPPING_FEES[value] || 0;
  }

  function getSelectedShippingLabel() {
    const value = els.province?.value || "";
    return SHIPPING_LABELS[value] || "";
  }

  function getCartItems() {
    try {
      if (window.CartStore?.getCartDetailed) {
        const items = window.CartStore.getCartDetailed();
        if (Array.isArray(items)) return items;
      }
    } catch (_) {}

    try {
      if (window.CartStore?.getItems) {
        const items = window.CartStore.getItems();
        if (Array.isArray(items)) return items;
      }
    } catch (_) {}

    try {
      if (window.Cart?.getItems) {
        const items = window.Cart.getItems();
        if (Array.isArray(items)) return items;
      }
    } catch (_) {}

    return [];
  }

  function clearCart() {
    try {
      if (window.CartStore?.clearCart) {
        window.CartStore.clearCart();
        return;
      }
    } catch (_) {}

    try {
      if (window.Cart?.clear) {
        window.Cart.clear();
        return;
      }
    } catch (_) {}
  }

  function normalizeCartItems(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const detailedProduct = item?.product || null;
        const productId = item?.productId ?? item?.product_id ?? detailedProduct?.id ?? null;
        const slug = String(item?.slug || detailedProduct?.slug || "").trim();
        const liveProduct = findProductByIdentifiers(productId, slug);
        const quantity = Math.max(1, Number(item?.quantity ?? item?.qty ?? 1) || 1);

        const product = liveProduct || detailedProduct || {};
        const unitPrice = parsePrice(
          liveProduct?.price ??
          detailedProduct?.price ??
          item?.unitPrice ??
          item?.unit_price ??
          item?.price
        );

        const totalPrice = unitPrice !== null ? unitPrice * quantity : null;

        return {
          productId: product?.id ?? productId,
          slug: product?.slug || slug,
          quantity,
          product: {
            id: product?.id ?? productId,
            slug: product?.slug || slug,
            name: product?.name || item?.name || "محصول",
            category: product?.category || "",
            pageUrl: product?.pageUrl || "",
            images: Array.isArray(product?.images) ? product.images : [],
            primaryImage: product?.primaryImage || ""
          },
          unitPrice,
          totalPrice
        };
      })
      .filter((item) => item.quantity > 0);
  }

  function getCartPricing(items = normalizeCartItems(getCartItems())) {
    const shippingFee = getSelectedShippingFee();

    let totalQty = 0;
    let subtotal = 0;
    let hasNumericPrice = true;

    for (const item of items) {
      totalQty += item.quantity;

      if (item.unitPrice === null) {
        hasNumericPrice = false;
        continue;
      }

      subtotal += item.unitPrice * item.quantity;
    }

    const total = hasNumericPrice ? subtotal + shippingFee : null;

    return {
      items,
      totalQty,
      subtotal,
      shippingFee,
      total,
      hasNumericPrice
    };
  }

  function getMaxWalletUsable(totalAmount) {
    if (!state.wallet.available || totalAmount === null) return 0;
    return Math.max(0, Math.min(Number(state.wallet.balance || 0), Number(totalAmount || 0)));
  }

  function getRequestedWalletAmount(totalAmount) {
    if (!state.wallet.available) return 0;
    if (!els.walletUseToggle?.checked || !els.walletUseAmount) return 0;

    const maxUsable = getMaxWalletUsable(totalAmount);
    const raw = String(els.walletUseAmount.value || "").trim();

    if (!raw) return maxUsable;

    const amount = parsePrice(raw);
    if (amount === null) return 0;

    return Math.max(0, Math.min(amount, maxUsable));
  }

  function getWalletAppliedAmount(totalAmount) {
    if (totalAmount === null) return 0;
    return getRequestedWalletAmount(totalAmount);
  }

  function getCashbackAmount(baseAmount) {
    const percent = Number(state.wallet.cashbackPercent || 0);
    if (!baseAmount || baseAmount <= 0 || percent <= 0) return 0;
    return Math.max(0, Math.round((baseAmount * percent) / 100));
  }

  function resetWalletState() {
    state.wallet.loaded = false;
    state.wallet.available = false;
    state.wallet.balance = 0;
    state.wallet.cashbackPercent = 0;
  }

  function applyWalletState(payload) {
    const balanceCandidates = [
      payload?.wallet_balance,
      payload?.user?.wallet_balance,
      payload?.wallet?.balance,
      payload?.balance
    ];

    const cashbackCandidates = [
      payload?.cashback_percent,
      payload?.settings?.cashback_percent,
      payload?.wallet?.cashback_percent
    ];

    let resolvedBalance = null;
    for (const candidate of balanceCandidates) {
      const parsed = parsePrice(candidate);
      if (parsed !== null) {
        resolvedBalance = parsed;
        break;
      }
    }

    let resolvedCashback = 0;
    for (const candidate of cashbackCandidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed >= 0) {
        resolvedCashback = parsed;
        break;
      }
    }

    if (resolvedBalance === null) {
      resetWalletState();
      return false;
    }

    state.wallet.loaded = true;
    state.wallet.available = true;
    state.wallet.balance = resolvedBalance;
    state.wallet.cashbackPercent = Math.max(0, resolvedCashback);
    return true;
  }

  async function loadWalletData() {
    resetWalletState();

    try {
      const response = await fetch("/api/account/wallet", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }

      if (!response.ok || !data?.success) {
        updateWalletUi();
        return;
      }

      applyWalletState(data);
      updateWalletUi();
    } catch (_) {
      resetWalletState();
      updateWalletUi();
    }
  }

  function updateWalletUi() {
    const pricing = getCartPricing();
    const walletVisible = state.wallet.available && pricing.total !== null;

    if (els.walletBox) {
      els.walletBox.hidden = !walletVisible;
    }

    if (!walletVisible) {
      if (els.walletUseFields) els.walletUseFields.hidden = true;
      if (els.walletDiscountRow) els.walletDiscountRow.hidden = true;
      if (els.cashbackRow) els.cashbackRow.hidden = true;
      if (els.walletBalance) els.walletBalance.textContent = "0 تومان";
      if (els.summaryWalletUsed) els.summaryWalletUsed.textContent = "0 تومان";
      if (els.summaryCashback) els.summaryCashback.textContent = "0 تومان";
      if (els.walletHelpText) els.walletHelpText.textContent = "کیف پول برای این سفارش در دسترس نیست.";
      if (els.summaryTotal) {
        els.summaryTotal.textContent =
          pricing.total !== null ? `${formatNumber(pricing.total)} تومان` : "تماس بگیرید";
      }
      return;
    }

    const maxUsable = getMaxWalletUsable(pricing.total);
    const walletUsed = getWalletAppliedAmount(pricing.total);
    const payableAmount = Math.max(0, pricing.total - walletUsed);
    const cashbackBase = pricing.total;
    const cashbackAmount = getCashbackAmount(cashbackBase);

    if (els.walletBalance) {
      els.walletBalance.textContent = `${formatNumber(state.wallet.balance)} تومان`;
    }

    if (els.walletUseFields) {
      els.walletUseFields.hidden = !els.walletUseToggle?.checked;
    }

    if (els.walletUseAmount) {
      els.walletUseAmount.max = String(maxUsable);
    }

    if (els.walletDiscountRow) {
      els.walletDiscountRow.hidden = walletUsed <= 0;
    }

    if (els.summaryWalletUsed) {
      els.summaryWalletUsed.textContent = `${formatNumber(walletUsed)} تومان`;
    }

    if (els.cashbackRow) {
      els.cashbackRow.hidden = cashbackAmount <= 0;
    }

    if (els.summaryCashback) {
      els.summaryCashback.textContent = `${formatNumber(cashbackAmount)} تومان`;
    }

    if (els.summaryTotal) {
      els.summaryTotal.textContent = `${formatNumber(payableAmount)} تومان`;
    }

    if (els.walletHelpText) {
      els.walletHelpText.textContent =
        `حداکثر قابل استفاده از کیف پول: ${formatNumber(maxUsable)} تومان — کش‌بک این سفارش: ${formatNumber(cashbackAmount)} تومان`;
    }
  }

  function renderCheckout() {
    const today = new Date();
    const pricing = getCartPricing();
    const items = pricing.items;

    if (els.invoiceDate) {
      els.invoiceDate.textContent = `تاریخ: ${today.toLocaleDateString("fa-IR")}`;
    }

    if (els.invoiceItemsCount) {
      els.invoiceItemsCount.textContent = `اقلام: ${formatNumber(items.length)}`;
    }

    if (els.summaryQty) {
      els.summaryQty.textContent = formatNumber(pricing.totalQty);
    }

    if (els.summarySubtotal) {
      els.summarySubtotal.textContent = pricing.hasNumericPrice
        ? `${formatNumber(pricing.subtotal)} تومان`
        : "تماس بگیرید";
    }

    if (els.summaryShipping) {
      els.summaryShipping.textContent = pricing.hasNumericPrice
        ? `${formatNumber(pricing.shippingFee)} تومان`
        : "-";
    }

    if (!items.length) {
      if (els.checkoutEmpty) els.checkoutEmpty.hidden = false;
      if (els.checkoutContent) els.checkoutContent.hidden = true;
      if (els.checkoutForm) els.checkoutForm.style.display = "none";
      if (els.walletBox) els.walletBox.hidden = true;
      if (els.walletDiscountRow) els.walletDiscountRow.hidden = true;
      if (els.cashbackRow) els.cashbackRow.hidden = true;
      return;
    }

    if (els.checkoutEmpty) els.checkoutEmpty.hidden = true;
    if (els.checkoutContent) els.checkoutContent.hidden = false;
    if (els.checkoutForm) els.checkoutForm.style.display = "grid";

    if (els.invoiceItemsBody) {
      els.invoiceItemsBody.innerHTML = items.map((item) => {
        const product = item.product || {};
        const imageSrc = getProductImage(product);
        const productName = product.name || "محصول";
        const productCategory = product.category || "-";

        return `
          <tr>
            <td>
              <div class="invoice-product">
                <img
                  class="invoice-product__image"
                  src="${esc(imageSrc)}"
                  alt="${esc(productName)}"
                  loading="lazy"
                />
                <div class="invoice-product__info">
                  <strong>${esc(productName)}</strong>
                  <span>${esc(productCategory)}</span>
                </div>
              </div>
            </td>
            <td class="invoice-number">${formatNumber(item.quantity)}</td>
            <td class="invoice-number">${formatMoney(item.unitPrice)}</td>
            <td class="invoice-number">${formatMoney(item.totalPrice)}</td>
          </tr>
        `;
      }).join("");
    }

    if (!state.wallet.available) {
      if (els.summaryTotal) {
        els.summaryTotal.textContent = pricing.total !== null
          ? `${formatNumber(pricing.total)} تومان`
          : "تماس بگیرید";
      }
    }

    updateWalletUi();
  }

  function splitFullName(fullName) {
    const safe = String(fullName || "").trim();
    const parts = safe.split(/\s+/).filter(Boolean);

    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ")
    };
  }

  function provinceValueFromAddress(address) {
    const stateName = String(address?.state || "").trim();
    if (!stateName) return "";
    if (stateName.includes("تهران")) return "tehran";
    return "iran-provinces";
  }

  async function tryFillUserData() {
    if (!window.Auth) return;

    try {
      const profileResult = await window.Auth.getProfile();
      const profileUser = profileResult?.data?.user || null;
      if (!profileUser) return;

      state.currentUser = profileUser;

      const nameParts = splitFullName(profileUser.full_name || profileUser.fullname);

      if (els.firstName && !els.firstName.value) els.firstName.value = nameParts.firstName;
      if (els.lastName && !els.lastName.value) els.lastName.value = nameParts.lastName;
      if (els.phone && !els.phone.value) els.phone.value = profileUser.phone || "";

      const addressesResponse = await fetch("/api/account/addresses", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });

      let addressesData = null;
      try {
        addressesData = await addressesResponse.json();
      } catch (_) {
        addressesData = null;
      }

      if (!addressesResponse.ok || !addressesData?.success) return;

      const addresses = Array.isArray(addressesData.addresses) ? addressesData.addresses : [];
      const shippingAddress =
        addresses.find((item) => item.type === "shipping" && Number(item.is_default) === 1) ||
        addresses.find((item) => item.type === "shipping") ||
        addresses.find((item) => Number(item.is_default) === 1) ||
        addresses[0];

      if (!shippingAddress) return;

      if (els.province && !els.province.value) {
        els.province.value = provinceValueFromAddress(shippingAddress);
      }

      if (els.city && !els.city.value) {
        els.city.value = shippingAddress.city || "";
      }

      if (els.postalCode && !els.postalCode.value) {
        els.postalCode.value = shippingAddress.postal_code || shippingAddress.postalCode || "";
      }

      if (els.phone && !els.phone.value) {
        els.phone.value = shippingAddress.phone || "";
      }

      if (els.address && !els.address.value) {
        els.address.value = shippingAddress.address_line || shippingAddress.addressLine || "";
      }
    } catch (_) {}
  }

  function validateForm(data) {
    if (
      !data.firstName ||
      !data.lastName ||
      !data.province ||
      !data.provinceLabel ||
      !data.city ||
      !data.postalCode ||
      !data.phone ||
      !data.address
    ) {
      setCheckoutMessage("لطفاً همه فیلدهای ضروری را کامل کنید.", "error");
      return false;
    }

    const phone = toEnglishDigits(data.phone).replace(/[^\d]/g, "");
    const postalCode = toEnglishDigits(data.postalCode).replace(/[^\d]/g, "");

    if (phone.length < 10) {
      setCheckoutMessage("شماره تماس معتبر وارد کنید.", "error");
      return false;
    }

    if (postalCode.length !== 10) {
      setCheckoutMessage("کد پستی باید ۱۰ رقم باشد.", "error");
      return false;
    }

    return true;
  }

  function buildOrderPayload(items, formData) {
    const pricing = getCartPricing(items);
    const subtotal = pricing.subtotal;
    const shippingAmount = pricing.shippingFee;
    const totalAmount = pricing.total || 0;
    const walletUsedAmount = getWalletAppliedAmount(pricing.total);
    const payableAmount = Math.max(0, totalAmount - walletUsedAmount);
    const cashbackBase = totalAmount;
    const cashbackAmount = getCashbackAmount(cashbackBase);

    return {
      address: {
        type: "shipping",
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        address_line: formData.address,
        postal_code: toEnglishDigits(formData.postalCode).replace(/[^\d]/g, ""),
        phone: toEnglishDigits(formData.phone).replace(/[^\d]/g, ""),
        city: formData.city,
        state: formData.provinceLabel
      },
      order: {
        items: items.map((item) => ({
          product_id: item.productId,
          name: item.product?.name || item.slug || "محصول",
          qty: item.quantity,
          unit_price: item.unitPrice || 0,
          row_total: item.totalPrice || 0
        })),
        subtotal_amount: subtotal,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        payable_amount: payableAmount,
        use_wallet: walletUsedAmount > 0,
        wallet_used_amount: walletUsedAmount,
        cashback_base: cashbackBase,
        cashback_amount: cashbackAmount
      }
    };
  }

  // =============================================
  // ✅ ثبت سفارش - بدون ارسال به واتساپ
  // =============================================
  async function submitCheckout(event) {
    event.preventDefault();
    setCheckoutMessage("");

    const items = getCartPricing().items;
    if (!items.length) {
      setCheckoutMessage("سبد خرید شما خالی است.", "error");
      return;
    }

    const formData = {
      firstName: normalizeText(els.firstName?.value),
      lastName: normalizeText(els.lastName?.value),
      province: normalizeText(els.province?.value),
      provinceLabel: getSelectedShippingLabel(),
      city: normalizeText(els.city?.value),
      postalCode: normalizeText(els.postalCode?.value),
      phone: normalizeText(els.phone?.value),
      address: normalizeText(els.address?.value)
    };

    if (!validateForm(formData)) {
      return;
    }

    if (els.submitOrderBtn) {
      els.submitOrderBtn.disabled = true;
      els.submitOrderBtn.textContent = "در حال ثبت سفارش...";
    }

    setCheckoutMessage("در حال ثبت سفارش...", "info");

    try {
      const payload = buildOrderPayload(items, formData);

      const response = await fetch("/api/account/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setCheckoutMessage(data?.error || "ثبت سفارش انجام نشد.", "error");
        if (els.submitOrderBtn) {
          els.submitOrderBtn.disabled = false;
          els.submitOrderBtn.textContent = "ثبت سفارش";
        }
        return;
      }

      // پاک کردن سبد خرید
      clearCart();

      // ریست کردن کیف پول
      if (els.walletUseToggle) els.walletUseToggle.checked = false;
      if (els.walletUseAmount) els.walletUseAmount.value = "";
      resetWalletState();
      renderCheckout();

      // دریافت شماره سفارش
      const createdOrder = data.order || {};
      const orderNumber = createdOrder.order_number || "-";

      // نمایش پیام موفقیت
      setCheckoutMessage(`سفارش ${orderNumber} با موفقیت ثبت شد. در حال انتقال...`, "success");

      // ✅ هدایت به صفحه تشکر با تاخیر ۱ ثانیه
      setTimeout(() => {
        window.location.href = `/invoice.html?order=${encodeURIComponent(orderNumber)}`;
      }, 1000);

    } catch (error) {
      console.error("خطا در ثبت سفارش:", error);
      setCheckoutMessage("خطا در ارتباط با سرور. دوباره تلاش کنید.", "error");
      if (els.submitOrderBtn) {
        els.submitOrderBtn.disabled = false;
        els.submitOrderBtn.textContent = "ثبت سفارش";
      }
    }
  }

  function bindEvents() {
    if (els.province) {
      els.province.addEventListener("change", () => {
        renderCheckout();
      });
    }

    if (els.walletUseToggle) {
      els.walletUseToggle.addEventListener("change", () => {
        const pricing = getCartPricing();
        const maxUsable = getMaxWalletUsable(pricing.total);

        if (
          els.walletUseToggle.checked &&
          els.walletUseAmount &&
          !String(els.walletUseAmount.value || "").trim() &&
          maxUsable > 0
        ) {
          els.walletUseAmount.value = String(maxUsable);
        }

        updateWalletUi();
      });
    }

    if (els.walletUseAmount) {
      els.walletUseAmount.addEventListener("input", () => {
        updateWalletUi();
      });

      els.walletUseAmount.addEventListener("blur", () => {
        const pricing = getCartPricing();
        const maxUsable = getMaxWalletUsable(pricing.total);
        const current = parsePrice(els.walletUseAmount.value) || 0;
        els.walletUseAmount.value = String(Math.max(0, Math.min(current, maxUsable)));
        updateWalletUi();
      });
    }

    if (els.checkoutForm) {
      els.checkoutForm.addEventListener("submit", submitCheckout);
    }

    document.addEventListener("cart:updated", renderCheckout);
    document.addEventListener("products:ready", renderCheckout);
  }

  async function waitForProductsReady() {
    if (window.PRODUCTS_READY === true) return;
    if (window.PRODUCTS_LOADING && typeof window.PRODUCTS_LOADING.then === "function") {
      try {
        await window.PRODUCTS_LOADING;
      } catch (_) {}
    }
  }

  async function init() {
    await waitForProductsReady();
    renderCheckout();
    await tryFillUserData();
    await loadWalletData();
    renderCheckout();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();