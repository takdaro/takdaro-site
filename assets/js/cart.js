(function () {
  const CART_STORAGE_KEY = "takdaro_cart";
  const CART_EVENT_NAME = "cart:updated";

  function getProducts() {
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function findProduct(identifier) {
    const value = String(identifier ?? "").trim();

    return getProducts().find((product) => {
      return String(product.id) === value || product.slug === value;
    }) || null;
  }

  function normalizeQuantity(value) {
    const quantity = Number.parseInt(value, 10);

    if (!Number.isFinite(quantity) || quantity < 1) {
      return 1;
    }

    return quantity;
  }

  function readCart() {
    try {
      const rawCart = localStorage.getItem(CART_STORAGE_KEY);

      if (!rawCart) {
        return [];
      }

      const parsedCart = JSON.parse(rawCart);

      return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (error) {
      console.warn("Could not read cart from localStorage.", error);
      return [];
    }
  }

  function writeCart(cart) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.warn("Could not save cart in localStorage.", error);
    }
  }

  function getValidatedCart() {
    const products = getProducts();
    const cart = readCart();
    const validItems = [];

    cart.forEach((item) => {
      const product = products.find((currentProduct) => {
        return (
          String(currentProduct.id) === String(item.productId) ||
          currentProduct.slug === item.slug
        );
      });

      if (!product || !product.inStock || product.stockQty < 1) {
        return;
      }

      const quantity = Math.min(
        normalizeQuantity(item.quantity),
        Math.max(1, Number(product.stockQty) || 1)
      );

      validItems.push({
        productId: product.id,
        slug: product.slug,
        quantity
      });
    });

    return validItems;
  }

  function getCartDetails() {
    const products = getProducts();
    const cart = getValidatedCart();

    return cart.map((item) => {
      const product = products.find((currentProduct) => {
        return (
          String(currentProduct.id) === String(item.productId) ||
          currentProduct.slug === item.slug
        );
      });

      const unitPrice = product?.showPrice && Number(product?.price) > 0
        ? Number(product.price)
        : null;

      return {
        ...item,
        product,
        unitPrice,
        totalPrice: unitPrice === null ? null : unitPrice * item.quantity
      };
    }).filter((item) => item.product);
  }

  function getItemCount() {
    return getCartDetails().reduce((total, item) => {
      return total + item.quantity;
    }, 0);
  }

  function getTotalPrice() {
    const items = getCartDetails();

    if (items.some((item) => item.totalPrice === null)) {
      return null;
    }

    return items.reduce((total, item) => total + item.totalPrice, 0);
  }

  function dispatchCartUpdated() {
    document.dispatchEvent(
      new CustomEvent(CART_EVENT_NAME, {
        detail: {
          cart: getCartDetails(),
          itemCount: getItemCount(),
          totalPrice: getTotalPrice()
        }
      })
    );
  }

  function saveValidatedCart() {
    const validCart = getValidatedCart();
    writeCart(validCart);
    dispatchCartUpdated();
    return validCart;
  }

  function addItem(identifier, quantity = 1) {
    const product = findProduct(identifier);

    if (!product) {
      return {
        success: false,
        message: "محصول موردنظر پیدا نشد."
      };
    }

    if (!product.inStock || Number(product.stockQty) < 1) {
      return {
        success: false,
        message: "این محصول در حال حاضر ناموجود است."
      };
    }

    const cart = getValidatedCart();
    const requestedQuantity = normalizeQuantity(quantity);
    const existingItem = cart.find((item) => {
      return (
        String(item.productId) === String(product.id) ||
        item.slug === product.slug
      );
    });

    if (existingItem) {
      existingItem.quantity = Math.min(
        existingItem.quantity + requestedQuantity,
        Number(product.stockQty)
      );
    } else {
      cart.push({
        productId: product.id,
        slug: product.slug,
        quantity: Math.min(requestedQuantity, Number(product.stockQty))
      });
    }

    writeCart(cart);
    dispatchCartUpdated();

    return {
      success: true,
      message: "محصول به سبد خرید اضافه شد.",
      cart: getCartDetails()
    };
  }

  function updateItemQuantity(identifier, quantity) {
    const product = findProduct(identifier);
    const cart = getValidatedCart();

    if (!product) {
      return {
        success: false,
        message: "محصول موردنظر پیدا نشد."
      };
    }

    const itemIndex = cart.findIndex((item) => {
      return (
        String(item.productId) === String(product.id) ||
        item.slug === product.slug
      );
    });

    if (itemIndex === -1) {
      return {
        success: false,
        message: "این محصول در سبد خرید نیست."
      };
    }

    const safeQuantity = Number.parseInt(quantity, 10);

    if (!Number.isFinite(safeQuantity) || safeQuantity < 1) {
      cart.splice(itemIndex, 1);
    } else if (!product.inStock || Number(product.stockQty) < 1) {
      cart.splice(itemIndex, 1);
    } else {
      cart[itemIndex].quantity = Math.min(
        safeQuantity,
        Number(product.stockQty)
      );
    }

    writeCart(cart);
    dispatchCartUpdated();

    return {
      success: true,
      cart: getCartDetails()
    };
  }

  function removeItem(identifier) {
    const value = String(identifier ?? "").trim();
    const cart = getValidatedCart();

    const filteredCart = cart.filter((item) => {
      return (
        String(item.productId) !== value &&
        item.slug !== value
      );
    });

    writeCart(filteredCart);
    dispatchCartUpdated();

    return {
      success: true,
      cart: getCartDetails()
    };
  }

  function clearCart() {
    writeCart([]);
    dispatchCartUpdated();

    return {
      success: true,
      cart: []
    };
  }

  function hasItem(identifier) {
    const value = String(identifier ?? "").trim();

    return getValidatedCart().some((item) => {
      return (
        String(item.productId) === value ||
        item.slug === value
      );
    });
  }

  function formatPrice(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0) {
      return "تماس بگیرید";
    }

    return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
  }

  function updateCartBadges() {
    const itemCount = getItemCount();

    document.querySelectorAll("[data-cart-count]").forEach((element) => {
      element.textContent = new Intl.NumberFormat("fa-IR").format(itemCount);
      element.hidden = itemCount === 0;
      element.setAttribute(
        "aria-label",
        itemCount > 0 ? `${itemCount} محصول در سبد خرید` : "سبد خرید خالی است"
      );
    });
  }

  window.Cart = {
    add: addItem,
    update: updateItemQuantity,
    remove: removeItem,
    clear: clearCart,
    getItems: getCartDetails,
    getRawItems: getValidatedCart,
    getItemCount,
    getTotalPrice,
    hasItem,
    formatPrice,
    refresh: saveValidatedCart
  };

  document.addEventListener(CART_EVENT_NAME, updateCartBadges);

  document.addEventListener("products:ready", function () {
    saveValidatedCart();
    updateCartBadges();
  });

  if (window.PRODUCTS_READY === true) {
    saveValidatedCart();
    updateCartBadges();
  }

  window.addEventListener("storage", function (event) {
    if (event.key === CART_STORAGE_KEY) {
      dispatchCartUpdated();
    }
  });
})();