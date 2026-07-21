(function () {
  const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const params = new URLSearchParams(window.location.search);

  const productSlug = params.get("product");
  const qtyParam = parseInt(params.get("qty"), 10);

  const quantityFromUrl = Number.isFinite(qtyParam) && qtyParam > 0 ? qtyParam : 1;
  const product = products.find((item) => item.slug === productSlug);

  const emptyState = document.getElementById("checkout-empty");
  const content = document.getElementById("checkout-content");

  const productImage = document.getElementById("checkout-product-image");
  const productCategory = document.getElementById("checkout-product-category");
  const productName = document.getElementById("checkout-product-name");
  const productDescription = document.getElementById("checkout-product-description");
  const productPrice = document.getElementById("checkout-product-price");
  const productStock = document.getElementById("checkout-product-stock");

  const invoiceProductName = document.getElementById("invoice-product-name");
  const invoiceQuantity = document.getElementById("invoice-quantity");
  const invoiceStock = document.getElementById("invoice-stock");
  const invoicePrice = document.getElementById("invoice-price");

  const form = document.getElementById("checkout-form");
  const quantityInput = document.getElementById("customer-quantity");

  function getProductPriceLabel(product) {
    if (!product) return "";
    return (
      product.priceLabel ||
      product.displayPrice ||
      product.salePrice ||
      product.price ||
      ""
    );
  }

  function normalizeQuantity(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
  }

  function extractNumericPrice(priceLabel) {
    if (!priceLabel) return 0;
    const normalized = String(priceLabel).replace(/[^\d]/g, "");
    return normalized ? Number(normalized) : 0;
  }

  function formatPrice(value) {
    if (!value || Number.isNaN(value)) return "تماس بگیرید";
    return `${value.toLocaleString("fa-IR")} تومان`;
  }

  function updateInvoiceQty(value) {
    const normalized = normalizeQuantity(value);
    const unitPriceLabel = getProductPriceLabel(product);
    const unitPriceValue = extractNumericPrice(unitPriceLabel);
    const totalPrice = unitPriceValue * normalized;

    invoiceQuantity.textContent = `${normalized} عدد`;
    quantityInput.value = normalized;

    if (invoicePrice) {
      invoicePrice.textContent = unitPriceLabel || "تماس بگیرید";
    }

    const invoiceTotal = document.getElementById("invoice-total");
    if (invoiceTotal) {
      invoiceTotal.textContent = unitPriceValue ? formatPrice(totalPrice) : "تماس بگیرید";
    }
  }

  if (!product) {
    emptyState.hidden = false;
    content.hidden = true;
  } else {
    emptyState.hidden = true;
    content.hidden = false;

    const imageSrc = Array.isArray(product.images) && product.images.length
      ? `./${product.images[0]}`
      : "/assets/images/placeholder.png";

    const priceLabel = getProductPriceLabel(product);

    productImage.src = imageSrc;
    productImage.alt = product.name || "";

    productCategory.textContent = product.category || "";
    productName.textContent = product.name || "-";
    productDescription.textContent = product.description || product.shortDescription || "-";
    productPrice.textContent = priceLabel || "تماس بگیرید";
    productStock.textContent = product.stockLabel || (product.inStock ? "موجود" : "ناموجود");

    invoiceProductName.textContent = product.name || "-";
    invoiceStock.textContent = product.stockLabel || (product.inStock ? "موجود" : "ناموجود");
    invoicePrice.textContent = priceLabel || "تماس بگیرید";

    updateInvoiceQty(quantityFromUrl);
  }

  if (quantityInput) {
    quantityInput.addEventListener("input", function () {
      updateInvoiceQty(this.value);
    });

    quantityInput.addEventListener("blur", function () {
      updateInvoiceQty(this.value);
    });
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!product) {
        alert("لطفاً ابتدا یک محصول انتخاب کنید.");
        return;
      }

      if (product.inStock === false) {
        alert("این محصول ناموجود است و امکان ثبت سفارش ندارد.");
        return;
      }

      const customerName = document.getElementById("customer-name").value.trim();
      const customerPhone = document.getElementById("customer-phone").value.trim();
      const customerCity = document.getElementById("customer-city").value.trim();
      const customerAddress = document.getElementById("customer-address").value.trim();
      const quantity = normalizeQuantity(quantityInput.value);
      const priceLabel = getProductPriceLabel(product);
      const totalValue = extractNumericPrice(priceLabel) * quantity;

      if (!customerName || !customerPhone) {
        alert("لطفاً نام و شماره تماس را وارد کنید.");
        return;
      }

      const messageLines = [
        "سلام، وقت بخیر",
        "برای ثبت سفارش از سایت تک تجارت پیام می‌دهم.",
        "",
        `محصول: ${product.name}`,
        `تعداد: ${quantity}`,
        `وضعیت: ${product.stockLabel || (product.inStock ? "موجود" : "ناموجود")}`,
        `قیمت واحد: ${priceLabel || "تماس بگیرید"}`,
        `قیمت کل: ${totalValue ? formatPrice(totalValue) : "تماس بگیرید"}`,
        "",
        `نام مشتری: ${customerName}`,
        `شماره تماس: ${customerPhone}`,
        `شهر: ${customerCity || "-"}`,
        `آدرس / توضیحات: ${customerAddress || "-"}`
      ];

      const message = encodeURIComponent(messageLines.join("\n"));
      const whatsappUrl = `https://wa.me/989214147070?text=${message}`;

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    });
  }
})();