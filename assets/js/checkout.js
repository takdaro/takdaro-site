(() => {
  const els = {
    form: document.getElementById("checkout-form"),
    message: document.getElementById("checkout-message"),
    submitBtn: document.getElementById("checkout-submit-btn"),

    fullName: document.getElementById("checkout-full-name"),
    phone: document.getElementById("checkout-phone"),
    postalCode: document.getElementById("checkout-postal-code"),
    addressLine: document.getElementById("checkout-address-line"),
    city: document.getElementById("checkout-city"),
    state: document.getElementById("checkout-state"),
    notes: document.getElementById("checkout-notes"),

    walletToggle: document.getElementById("checkout-use-wallet"),
    walletHint: document.getElementById("checkout-wallet-hint"),

    itemsBox: document.getElementById("checkout-items"),
    subtotalBox: document.getElementById("checkout-subtotal"),
    shippingBox: document.getElementById("checkout-shipping"),
    totalBox: document.getElementById("checkout-total"),
    walletUsedBox: document.getElementById("checkout-wallet-used"),
    payableBox: document.getElementById("checkout-payable"),
    cashbackBox: document.getElementById("checkout-cashback"),

    orderResult: document.getElementById("checkout-order-result")
  };

  const state = {
    user: null,
    cartItems: [],
    walletBalance: 0,
    shippingAmount: 0,
    useWallet: false,
    summary: {
      subtotal: 0,
      total: 0,
      walletUsed: 0,
      payable: 0,
      cashbackPreview: 0
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

  function normalizeDigits(value) {
    const map = {
      "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
      "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
    };
    return String(value ?? "").replace(/[۰-۹]/g, (digit) => map[digit]);
  }

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function normalizeNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }
    const normalized = normalizeDigits(value).replace(/[^\d]/g, "");
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
  }

  function money(value) {
    return Number(value || 0).toLocaleString("fa-IR");
  }

  function setMessage(message, type = "error") {
    if (!els.message) return;
    els.message.textContent = message || "";
    els.message.className = "checkout-message";
    if (message) {
      els.message.classList.add(type === "success" ? "is-success" : "is-error");
    }
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = { success: false, error: "invalid_json_response" };
    }

    return { ok: response.ok, data };
  }

  function getStoredCart() {
    try {
      if (window.Cart?.getItems) {
        const items = window.Cart.getItems();
        return Array.isArray(items) ? items : [];
      }
    } catch (_) {}

    try {
      const raw =
        localStorage.getItem("cart") ||
        sessionStorage.getItem("cart") ||
        "[]";
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function getUnitPrice(item) {
    const direct = normalizeNumber(item?.unit_price);
    if (direct > 0) return direct;

    const price = normalizeNumber(item?.price);
    if (price > 0) return price;

    const productPrice = normalizeNumber(item?.product?.price);
    if (productPrice > 0) return productPrice;

    const total = normalizeNumber(item?.total_price ?? item?.total);
    const quantity = getQuantity(item);
    return quantity > 0 ? Math.round(total / quantity) : 0;
  }

  function getQuantity(item) {
    const quantity = normalizeNumber(
      item?.qty ??
      item?.quantity ??
      item?.count ??
      item?.amount
    );
    return quantity > 0 ? quantity : 1;
  }

  function getRowTotal(item) {
    const direct = normalizeNumber(
      item?.row_total ??
      item?.total_price ??
      item?.line_total ??
      item?.total
    );
    if (direct > 0) return direct;

    return getUnitPrice(item) * getQuantity(item);
  }

  function normalizeCartItems(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const quantity = getQuantity(item);
        const unitPrice = getUnitPrice(item);
        const totalPrice = getRowTotal(item);
        return {
          product_id: item?.product_id ?? item?.id ?? item?.product?.id ?? null,
          product_name:
            normalizeText(
              item?.product_name ||
              item?.name ||
              item?.title ||
              item?.product?.name
            ) || "محصول",
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice
        };
      })
      .filter((item) => item.quantity > 0 && item.unit_price >= 0);
  }

  function calculateSummary() {
    const subtotal = state.cartItems.reduce((sum, item) => sum + normalizeNumber(item.total_price), 0);
    const shipping = normalizeNumber(state.shippingAmount);
    const total = subtotal + shipping;

    const walletUsed = state.useWallet
      ? Math.min(normalizeNumber(state.walletBalance), total)
      : 0;

    const payable = Math.max(0, total - walletUsed);

    state.summary = {
      subtotal,
      shipping,
      total,
      walletUsed,
      payable,
      cashbackPreview: 0
    };
  }

  function renderItems() {
    if (!els.itemsBox) return;

    if (!state.cartItems.length) {
      els.itemsBox.innerHTML = `<div class="checkout-empty">سبد خرید شما خالی است.</div>`;
      return;
    }

    els.itemsBox.innerHTML = state.cartItems.map((item) => `
      <div class="checkout-item">
        <div class="checkout-item__meta">
          <strong>${esc(item.product_name)}</strong>
          <span>${money(item.unit_price)} × ${money(item.quantity)}</span>
        </div>
        <div class="checkout-item__price">${money(item.total_price)} تومان</div>
      </div>
    `).join("");
  }

  function renderSummary() {
    calculateSummary();

    if (els.subtotalBox) els.subtotalBox.textContent = `${money(state.summary.subtotal)} تومان`;
    if (els.shippingBox) els.shippingBox.textContent = `${money(state.summary.shipping)} تومان`;
    if (els.totalBox) els.totalBox.textContent = `${money(state.summary.total)} تومان`;
    if (els.walletUsedBox) els.walletUsedBox.textContent = `${money(state.summary.walletUsed)} تومان`;
    if (els.payableBox) els.payableBox.textContent = `${money(state.summary.payable)} تومان`;
    if (els.cashbackBox) els.cashbackBox.textContent = `${money(state.summary.cashbackPreview)} تومان`;

    if (els.walletHint) {
      els.walletHint.textContent = state.walletBalance > 0
        ? `موجودی کیف پول شما: ${money(state.walletBalance)} تومان`
        : "موجودی کیف پول شما صفر است.";
    }
  }

  function fillUser(user) {
    if (!user) return;

    if (els.fullName && !els.fullName.value) {
      els.fullName.value = user.full_name || "";
    }
    if (els.phone && !els.phone.value) {
      els.phone.value = user.phone || "";
    }
  }

  function getAddressPayload() {
    return {
      full_name: normalizeText(els.fullName?.value),
      phone: normalizeDigits(els.phone?.value).replace(/[^\d]/g, ""),
      postal_code: normalizeDigits(els.postalCode?.value).replace(/[^\d]/g, ""),
      address_line: normalizeText(els.addressLine?.value),
      city: normalizeText(els.city?.value),
      state: normalizeText(els.state?.value)
    };
  }

  function validateAddress(address) {
    if (!address.full_name) return "نام و نام خانوادگی را وارد کنید.";
    if (!address.phone) return "شماره موبایل را وارد کنید.";
    if (!address.address_line) return "آدرس را وارد کنید.";
    if (!address.city) return "شهر را وارد کنید.";
    if (!address.state) return "استان را وارد کنید.";
    return null;
  }

  async function loadViewer() {
    if (window.Auth?.getCurrentUser) {
      try {
        const user = await window.Auth.getCurrentUser();
        if (user) {
          state.user = user;
          state.walletBalance = normalizeNumber(user.wallet_balance);
          fillUser(user);
        }
      } catch (_) {}
    }

    if (!state.user) {
      const result = await api("/api/me");
      if (result.ok && result.data?.user) {
        state.user = result.data.user;
        state.walletBalance = normalizeNumber(result.data.user.wallet_balance);
        fillUser(result.data.user);
      }
    }
  }

  async function loadWalletFresh() {
    if (!state.user?.id) return;

    const result = await api(`/api/admin/wallet?userId=${encodeURIComponent(state.user.id)}&limit=1`);
    if (result.ok && result.data?.user) {
      state.walletBalance = normalizeNumber(result.data.user.wallet_balance);
    }
  }

  function setSubmitting(isSubmitting) {
    if (!els.submitBtn) return;
    els.submitBtn.disabled = !!isSubmitting;
    els.submitBtn.textContent = isSubmitting ? "در حال ثبت سفارش..." : "ثبت سفارش";
  }

  function renderOrderResult(order) {
    if (!els.orderResult) return;

    els.orderResult.innerHTML = `
      <div class="checkout-result-card">
        <h3>سفارش شما ثبت شد</h3>
        <p>شماره سفارش: <strong>${esc(order.order_number)}</strong></p>
        <p>مبلغ کل: <strong>${money(order.total_amount)} تومان</strong></p>
        <p>استفاده از کیف پول: <strong>${money(order.wallet_used_amount)} تومان</strong></p>
        <p>مبلغ قابل پرداخت: <strong>${money(order.payable_amount)} تومان</strong></p>
        <p>کش‌بک این سفارش: <strong>${money(order.cashback_amount)} تومان</strong></p>
      </div>
    `;
  }

  async function submitOrder(event) {
    event.preventDefault();
    setMessage("");

    if (!state.cartItems.length) {
      setMessage("سبد خرید شما خالی است.");
      return;
    }

    const address = getAddressPayload();
    const addressError = validateAddress(address);
    if (addressError) {
      setMessage(addressError);
      return;
    }

    calculateSummary();

    const payload = {
      address,
      order: {
        items: state.cartItems,
        subtotal_amount: state.summary.subtotal,
        shipping_amount: state.summary.shipping,
        total_amount: state.summary.total,
        wallet_used_amount: state.summary.walletUsed,
        notes: normalizeText(els.notes?.value)
      }
    };

    setSubmitting(true);

    try {
      const result = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!result.ok || !result.data?.success || !result.data?.order) {
        setMessage(result.data?.error || "ثبت سفارش انجام نشد.");
        return;
      }

      const createdOrder = result.data.order;

      if (els.cashbackBox) {
        els.cashbackBox.textContent = `${money(createdOrder.cashback_amount)} تومان`;
      }
      if (els.walletUsedBox) {
        els.walletUsedBox.textContent = `${money(createdOrder.wallet_used_amount)} تومان`;
      }
      if (els.payableBox) {
        els.payableBox.textContent = `${money(createdOrder.payable_amount)} تومان`;
      }

      renderOrderResult(createdOrder);
      setMessage("سفارش با موفقیت ثبت شد.", "success");

      try {
        if (window.Cart?.clear) {
          window.Cart.clear();
        } else {
          localStorage.removeItem("cart");
          sessionStorage.removeItem("cart");
        }
      } catch (_) {}

      state.cartItems = [];
      state.walletBalance = Math.max(0, state.walletBalance - normalizeNumber(createdOrder.wallet_used_amount));

      renderItems();
      renderSummary();

      if (els.form) {
        els.form.reset();
      }

      if (state.user) {
        fillUser(state.user);
      }
    } catch (error) {
      setMessage(String(error?.message || error || "خطا در ثبت سفارش"));
    } finally {
      setSubmitting(false);
    }
  }

  async function init() {
    await loadViewer();

    state.cartItems = normalizeCartItems(getStoredCart());
    state.shippingAmount = 0;
    state.useWallet = !!els.walletToggle?.checked;

    renderItems();
    renderSummary();

    if (els.walletToggle) {
      els.walletToggle.addEventListener("change", () => {
        state.useWallet = !!els.walletToggle.checked;
        renderSummary();
      });
    }

    if (els.form) {
      els.form.addEventListener("submit", submitOrder);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();