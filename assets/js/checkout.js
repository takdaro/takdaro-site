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

  function normalizeQuantity(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
  }

  function updateInvoiceQty(value) {
    const normalized = normalizeQuantity(value);
    invoiceQuantity.textContent = `${normalized} Ø¹Ø¯Ø¯`;
    quantityInput.value = normalized;
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

    productImage.src = imageSrc;
    productImage.alt = product.name;

    productCategory.textContent = product.category || "";
    productName.textContent = product.name || "-";
    productDescription.textContent = product.description || product.shortDescription || "-";
    productPrice.textContent = product.priceLabel || "ØªÙ…Ø§Ø³ Ø¨Ú¯ÛŒØ±ÛŒØ¯";
    productStock.textContent = product.stockLabel || (product.inStock ? "Ù…ÙˆØ¬ÙˆØ¯" : "Ù†Ø§Ù…ÙˆØ¬ÙˆØ¯");

    invoiceProductName.textContent = product.name || "-";
    invoiceStock.textContent = product.stockLabel || (product.inStock ? "Ù…ÙˆØ¬ÙˆØ¯" : "Ù†Ø§Ù…ÙˆØ¬ÙˆØ¯");
    invoicePrice.textContent = product.priceLabel || "ØªÙ…Ø§Ø³ Ø¨Ú¯ÛŒØ±ÛŒØ¯";

    updateInvoiceQty(quantityFromUrl);
  }

  quantityInput.addEventListener("input", function () {
    updateInvoiceQty(this.value);
  });

  quantityInput.addEventListener("blur", function () {
    updateInvoiceQty(this.value);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!product) {
      alert("Ù„Ø·ÙØ§Ù‹ Ø§Ø¨ØªØ¯Ø§ ÛŒÚ© Ù…Ø­ØµÙˆÙ„ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯.");
      return;
    }

    const customerName = document.getElementById("customer-name").value.trim();
    const customerPhone = document.getElementById("customer-phone").value.trim();
    const customerCity = document.getElementById("customer-city").value.trim();
    const customerAddress = document.getElementById("customer-address").value.trim();
    const quantity = normalizeQuantity(quantityInput.value);

    if (!customerName || !customerPhone) {
      alert("Ù„Ø·ÙØ§Ù‹ Ù†Ø§Ù… Ùˆ Ø´Ù…Ø§Ø±Ù‡ ØªÙ…Ø§Ø³ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯.");
      return;
    }

    const messageLines = [
      "Ø³Ù„Ø§Ù…ØŒ ÙˆÙ‚Øª Ø¨Ø®ÛŒØ±",
      "Ø¨Ø±Ø§ÛŒ Ø«Ø¨Øª Ø³ÙØ§Ø±Ø´ Ø§Ø² Ø³Ø§ÛŒØª ØªÚ© ØªØ¬Ø§Ø±Øª Ù¾ÛŒØ§Ù… Ù…ÛŒâ€ŒØ¯Ù‡Ù….",
      "",
      `Ù…Ø­ØµÙˆÙ„: ${product.name}`,
      `ØªØ¹Ø¯Ø§Ø¯: ${quantity}`,
      `ÙˆØ¶Ø¹ÛŒØª: ${product.stockLabel || (product.inStock ? "Ù…ÙˆØ¬ÙˆØ¯" : "Ù†Ø§Ù…ÙˆØ¬ÙˆØ¯")}`,
      `Ù‚ÛŒÙ…Øª: ${product.priceLabel || "ØªÙ…Ø§Ø³ Ø¨Ú¯ÛŒØ±ÛŒØ¯"}`,
      "",
      `Ù†Ø§Ù… Ù…Ø´ØªØ±ÛŒ: ${customerName}`,
      `Ø´Ù…Ø§Ø±Ù‡ ØªÙ…Ø§Ø³: ${customerPhone}`,
      `Ø´Ù‡Ø±: ${customerCity || "-"}`,
      `Ø¢Ø¯Ø±Ø³ / ØªÙˆØ¶ÛŒØ­Ø§Øª: ${customerAddress || "-"}`
    ];

    const message = encodeURIComponent(messageLines.join("\n"));
    const whatsappUrl = `https://wa.me/989214147070?text=${message}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  });
})();
