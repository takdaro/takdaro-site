(function () {
  const overrides = window.PRODUCT_PRICE_OVERRIDES || {};
  const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];

  if (!products.length) return;

  products.forEach((product) => {
    if (!product || !product.slug) return;

    const override = overrides[product.slug];
    if (!override) return;

    if (Object.prototype.hasOwnProperty.call(override, "price")) {
      product.price = override.price;
      product.priceLabel =
        typeof override.price === "number"
          ? `${new Intl.NumberFormat("fa-IR").format(override.price)} ØªÙˆÙ…Ø§Ù†`
          : "ØªÙ…Ø§Ø³ Ø¨Ú¯ÛŒØ±ÛŒØ¯";
    }

    if (Object.prototype.hasOwnProperty.call(override, "stockText")) {
      product.stockLabel = override.stockText;
    }

    if (Object.prototype.hasOwnProperty.call(override, "stockQty")) {
      product.stockQty = override.stockQty;
      product.inStock = Number(override.stockQty) > 0;
    }

    if (Object.prototype.hasOwnProperty.call(override, "expiryDate")) {
      product.expiryDate = override.expiryDate;
    }
  });
})();
