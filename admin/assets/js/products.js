// ============================================
// products.js - مدیریت محصولات
// ============================================

(function() {
  'use strict';

  // ============================================
  // متغیرهای محلی
  // ============================================
  var productCreateBox = null;
  var productEditBox = null;

  // ============================================
  // توابع کمکی مستقل
  // جلوگیری از خراب شدن جدول در صورت آماده نبودن
  // برخی توابع سراسری در سیستم ماژولار
  // ============================================

  function escapeHtml(value) {
    if (typeof window.esc === "function") {
      return window.esc(value ?? "");
    }

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    if (typeof window.money === "function") {
      return window.money(value ?? 0);
    }

    var number = Number(value ?? 0);

    if (!Number.isFinite(number)) {
      number = 0;
    }

    return number.toLocaleString("fa-IR");
  }

  function formatProductDate(value) {
    if (typeof window.formatDate === "function") {
      try {
        return window.formatDate(value);
      } catch (_) {
        // fallback
      }
    }

    if (!value) {
      return "—";
    }

    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return escapeHtml(value);
    }

    try {
      return new Intl.DateTimeFormat(
        "fa-IR",
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }
      ).format(date);
    } catch (_) {
      return date.toLocaleString();
    }
  }

  function productStatusHtml(status) {
    if (typeof window.productStatusBadge === "function") {
      try {
        return window.productStatusBadge(status);
      } catch (_) {
        // fallback
      }
    }

    var normalized =
      String(status || "draft")
        .toLowerCase()
        .trim();

    var label = "پیش‌نویس";
    var className = "status-badge";

    if (normalized === "published") {
      label = "منتشرشده";
      className += " status-badge--success";
    } else if (normalized === "private") {
      label = "خصوصی";
      className += " status-badge--danger";
    }

    return (
      '<span class="' +
      className +
      '">' +
      escapeHtml(label) +
      "</span>"
    );
  }

  function getBoolean(value) {
    return (
      value === true ||
      value === 1 ||
      value === "1" ||
      String(value ?? "").toLowerCase() === "true"
    );
  }

  function getProductImage(product) {
    if (!product || typeof product !== "object") {
      return "";
    }

    if (product.primary_image) {
      return String(product.primary_image);
    }

    if (product.primaryImage) {
      return String(product.primaryImage);
    }

    if (
      Array.isArray(product.images) &&
      product.images.length > 0
    ) {
      var primary = product.images.find(
        function(image) {
          return (
            image &&
            (
              image.is_primary === true ||
              image.is_primary === 1 ||
              image.isPrimary === true ||
              image.isPrimary === 1
            )
          );
        }
      );

      var image = primary || product.images[0];

      if (typeof image === "string") {
        return image;
      }

      if (image && typeof image === "object") {
        return (
          image.image_url ||
          image.imageUrl ||
          image.url ||
          ""
        );
      }
    }

    return "";
  }

  function getDisplayPrice(product) {
    if (!product || typeof product !== "object") {
      return "تماس بگیرید";
    }

    if (product.display_price_formatted) {
      return escapeHtml(product.display_price_formatted);
    }

    if (product.displayPriceFormatted) {
      return escapeHtml(product.displayPriceFormatted);
    }

    if (
      product.display_price !== null &&
      product.display_price !== undefined &&
      product.display_price !== ""
    ) {
      var displayPrice = Number(product.display_price);

      if (Number.isFinite(displayPrice)) {
        return formatMoney(displayPrice) + " تومان";
      }
    }

    if (
      product.calculated_price !== null &&
      product.calculated_price !== undefined &&
      product.calculated_price !== ""
    ) {
      var calculatedPrice = Number(product.calculated_price);

      if (Number.isFinite(calculatedPrice)) {
        return formatMoney(calculatedPrice) + " تومان";
      }
    }

    if (
      product.price !== null &&
      product.price !== undefined &&
      product.price !== ""
    ) {
      var price = Number(product.price);

      if (Number.isFinite(price)) {
        return formatMoney(price) + " تومان";
      }
    }

    if (product.price_label) {
      return escapeHtml(product.price_label);
    }

    return "تماس بگیرید";
  }

  function refreshProductElements() {
    productCreateBox =
      document.getElementById(
        "product-create-box"
      );

    productEditBox =
      document.getElementById(
        "product-edit-box"
      );
  }

  // ============================================
  // بستن فرم افزودن
  // ============================================

  function closeProductCreateBox() {
    refreshProductElements();

    if (productCreateBox) {
      productCreateBox.classList.add(
        "admin-hidden"
      );

      productCreateBox.innerHTML = "";
    }
  }

  // ============================================
  // بستن فرم ویرایش
  // ============================================

  function closeProductEditBox() {
    refreshProductElements();

    if (productEditBox) {
      productEditBox.classList.add(
        "admin-hidden"
      );

      productEditBox.innerHTML = "";
    }
  }

  // ============================================
  // تولید HTML گالری تصاویر
  // ============================================

  function productGalleryHtml(image, index) {
    image = image || {};
    index = index || 0;

    var url =
      image.image_url ||
      image.imageUrl ||
      image.url ||
      "";

    var alt =
      image.alt_text ||
      image.altText ||
      image.alt ||
      "";

    var primary =
      image.is_primary === true ||
      image.is_primary === 1 ||
      image.isPrimary === true ||
      image.isPrimary === 1 ||
      index === 0;

    return (
      '<div class="product-gallery-item" data-gallery-item>' +

        '<img data-gallery-preview src="' +
        escapeHtml(url) +
        '" alt="' +
        escapeHtml(alt) +
        '" onerror="this.style.display=\'none\'" />' +

        '<div class="form-field">' +
          '<label>مسیر تصویر</label>' +
          '<input data-gallery-url type="text" value="' +
          escapeHtml(url) +
          '" placeholder="/assets/images/..." />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>متن جایگزین</label>' +
          '<input data-gallery-alt type="text" value="' +
          escapeHtml(alt) +
          '" placeholder="نام تصویر" />' +
        '</div>' +

        '<div class="product-gallery-actions">' +
          '<label>' +
            '<input data-gallery-primary type="radio" name="product-primary-image" ' +
            (primary ? "checked" : "") +
            ' /> تصویر اصلی' +
          '</label>' +

          '<button class="btn btn-secondary" type="button" data-remove-product-image>حذف</button>' +
        '</div>' +

      '</div>'
    );
  }

  // ============================================
  // تولید HTML فرم محصول
  // ============================================

  function productFormHtml(product) {
    product = product || {};

    var images =
      Array.isArray(product.images)
        ? product.images
        : [];

    var imageRows =
      images.map(
        function(image, index) {
          return productGalleryHtml(
            image,
            index
          );
        }
      ).join("");

    var priceType =
      product.price_type ||
      product.priceType ||
      "fixed";

    var isRateBased =
      priceType === "rate_based";

    return (
      '<h4>' +
      (
        product.id
          ? "ویرایش محصول #" +
            escapeHtml(product.id)
          : "افزودن محصول جدید"
      ) +
      '</h4>' +

      '<div class="filters-grid filters-grid-3">' +

        '<div class="form-field">' +
          '<label>نام محصول *</label>' +
          '<input data-product-field="name" type="text" value="' +
          escapeHtml(product.name || "") +
          '" placeholder="نام محصول" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>Slug انگلیسی *</label>' +
          '<input data-product-field="slug" type="text" value="' +
          escapeHtml(product.slug || "") +
          '" placeholder="مثلاً tb-500" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>دسته‌بندی</label>' +
          '<input data-product-field="category" type="text" value="' +
          escapeHtml(product.category || "") +
          '" placeholder="مثلاً پپتاید" />' +
        '</div>' +

      '</div>' +

      '<div class="price-type-selector">' +

        '<label>' +
          '<input type="radio" name="price_type_radio" value="fixed" ' +
          (!isRateBased ? "checked" : "") +
          ' data-price-type-radio /> قیمت ثابت (تومان)' +
        '</label>' +

        '<label>' +
          '<input type="radio" name="price_type_radio" value="rate_based" ' +
          (isRateBased ? "checked" : "") +
          ' data-price-type-radio /> وابسته به نرخ ارز (دلار)' +
        '</label>' +

      '</div>' +

      '<div id="fixed-price-fields" class="filters-grid filters-grid-3" style="' +
      (isRateBased ? "display:none;" : "") +
      '">' +

        '<div class="form-field">' +
          '<label>قیمت (تومان)</label>' +
          '<input data-product-field="price" type="text" inputmode="numeric" value="' +
          (product.price ?? "") +
          '" placeholder="مثلاً 2500000" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>برچسب قیمت</label>' +
          '<input data-product-field="price_label" type="text" value="' +
          escapeHtml(
            product.price_label ||
            "تماس بگیرید"
          ) +
          '" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>' +
            '<input data-product-field="show_price" type="checkbox" ' +
            (getBoolean(product.show_price) ? "checked" : "") +
            ' /> نمایش قیمت به مشتری' +
          '</label>' +
        '</div>' +

      '</div>' +

      '<div id="rate-price-fields" class="price-fields-rate" style="' +
      (isRateBased ? "" : "display:none;") +
      '">' +

        '<div class="filters-grid filters-grid-3">' +

          '<div class="form-field">' +
            '<label>قیمت پایه (دلار) *</label>' +
            '<input data-product-field="base_price" type="text" inputmode="numeric" value="' +
            (product.base_price ?? product.basePrice ?? "") +
            '" placeholder="مثلاً 10" />' +
            '<small class="admin-help">قیمت پایه محصول به دلار</small>' +
          '</div>' +

          '<div class="form-field">' +
            '<label>نوع سود</label>' +
            '<select data-product-field="profit_type">' +

              '<option value="none" ' +
              (
                (
                  product.profit_type ||
                  product.profitType ||
                  "none"
                ) === "none"
                  ? "selected"
                  : ""
              ) +
              '>بدون سود</option>' +

              '<option value="percentage" ' +
              (
                (
                  product.profit_type ||
                  product.profitType
                ) === "percentage"
                  ? "selected"
                  : ""
              ) +
              '>درصدی</option>' +

              '<option value="fixed" ' +
              (
                (
                  product.profit_type ||
                  product.profitType
                ) === "fixed"
                  ? "selected"
                  : ""
              ) +
              '>مبلغ ثابت (تومان)</option>' +

            '</select>' +
          '</div>' +

          '<div class="form-field">' +
            '<label>مقدار سود</label>' +
            '<input data-product-field="profit_value" type="text" inputmode="numeric" value="' +
            (
              product.profit_value ??
              product.profitValue ??
              ""
            ) +
            '" placeholder="مثلاً 20 یا 50000" />' +
            '<small class="admin-help">درصد یا مبلغ ثابت به تومان</small>' +
          '</div>' +

        '</div>' +

        '<div class="filters-grid filters-grid-3">' +

          '<div class="form-field">' +
            '<label>هزینه ثابت (تومان)</label>' +
            '<input data-product-field="fixed_fee" type="text" inputmode="numeric" value="' +
            (
              product.fixed_fee ??
              product.fixedFee ??
              ""
            ) +
            '" placeholder="مثلاً 200000" />' +
            '<small class="admin-help">هزینه اضافی به تومان</small>' +
          '</div>' +

          '<div class="form-field">' +
            '<label>نوع گرد کردن</label>' +
            '<select data-product-field="rounding_type">' +

              '<option value="none" ' +
              (
                (
                  product.rounding_type ||
                  product.roundingType ||
                  "none"
                ) === "none"
                  ? "selected"
                  : ""
              ) +
              '>بدون گرد کردن</option>' +

              '<option value="1000" ' +
              (
                (
                  product.rounding_type ||
                  product.roundingType
                ) === "1000"
                  ? "selected"
                  : ""
              ) +
              '>۱,۰۰۰ تومان</option>' +

              '<option value="10000" ' +
              (
                (
                  product.rounding_type ||
                  product.roundingType
                ) === "10000"
                  ? "selected"
                  : ""
              ) +
              '>۱۰,۰۰۰ تومان</option>' +

              '<option value="100000" ' +
              (
                (
                  product.rounding_type ||
                  product.roundingType
                ) === "100000"
                  ? "selected"
                  : ""
              ) +
              '>۱۰۰,۰۰۰ تومان</option>' +

            '</select>' +
          '</div>' +

          '<div class="form-field">' +
            '<label>روش گرد کردن</label>' +
            '<select data-product-field="rounding_method">' +

              '<option value="nearest" ' +
              (
                (
                  product.rounding_method ||
                  product.roundingMethod ||
                  "nearest"
                ) === "nearest"
                  ? "selected"
                  : ""
              ) +
              '>نزدیک‌ترین</option>' +

              '<option value="up" ' +
              (
                (
                  product.rounding_method ||
                  product.roundingMethod
                ) === "up"
                  ? "selected"
                  : ""
              ) +
              '>بالا</option>' +

              '<option value="down" ' +
              (
                (
                  product.rounding_method ||
                  product.roundingMethod
                ) === "down"
                  ? "selected"
                  : ""
              ) +
              '>پایین</option>' +

            '</select>' +
          '</div>' +

        '</div>' +

        '<small class="admin-help" style="display:block;margin-top:8px;">' +
          'قیمت نهایی = (قیمت پایه × نرخ دلار) + سود + هزینه ثابت، سپس گرد کردن' +

          (
            product.calculated_price
              ? ' | قیمت محاسبه‌شده فعلی: <strong>' +
                formatMoney(product.calculated_price) +
                ' تومان</strong>'
              : ""
          ) +

        '</small>' +

      '</div>' +

      '<div class="filters-grid filters-grid-2">' +

        '<div class="form-field">' +
          '<label>تعداد موجودی</label>' +
          '<input data-product-field="stock_quantity" type="number" min="0" value="' +
          Number(product.stock_quantity || 0) +
          '" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>برچسب موجودی</label>' +
          '<input data-product-field="stock_label" type="text" value="' +
          escapeHtml(product.stock_label || "") +
          '" placeholder="موجود / ناموجود" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>وضعیت انتشار</label>' +
          '<select data-product-field="status">' +
            '<option value="published">منتشرشده</option>' +
            '<option value="draft">پیش‌نویس</option>' +
            '<option value="private">خصوصی</option>' +
          '</select>' +
        '</div>' +

        '<div class="form-field">' +
          '<label>آدرس صفحه محصول</label>' +
          '<input data-product-field="page_url" type="text" value="' +
          escapeHtml(product.page_url || "") +
          '" placeholder="products/example.html" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>' +
            '<input data-product-field="in_stock" type="checkbox" ' +
            (getBoolean(product.in_stock) ? "checked" : "") +
            ' /> محصول موجود است' +
          '</label>' +
        '</div>' +

      '</div>' +

      '<div class="form-field">' +
        '<label>توضیح کوتاه</label>' +
        '<textarea data-product-field="short_description" rows="3" placeholder="توضیح کوتاه برای محصول">' +
          escapeHtml(product.short_description || "") +
        '</textarea>' +
      '</div>' +

      '<div class="form-field">' +
        '<label>توضیحات کامل</label>' +
        '<textarea data-product-field="description" rows="7" placeholder="توضیحات کامل محصول">' +
          escapeHtml(product.description || "") +
        '</textarea>' +
      '</div>' +

      '<div class="detail-card" style="margin-top:16px;background:var(--surface-2);">' +

        '<div class="products-toolbar">' +

          '<div>' +
            '<h4 style="margin:0">گالری تصاویر</h4>' +
            '<p class="product-file-help">برای تصویر جدید، مسیر آن را وارد کن؛ مثل: /assets/images/tb-500/1.png. انتخاب فایل فقط پیش‌نمایش محلی است و فایل را روی سرور آپلود نمی‌کند.</p>' +
          '</div>' +

          '<button class="btn btn-secondary" type="button" data-add-product-image>افزودن مسیر تصویر</button>' +

        '</div>' +

        '<div class="form-field">' +
          '<label>انتخاب تصویر از رایانه (پیش‌نمایش)</label>' +
          '<input data-product-local-files type="file" accept="image/*" multiple />' +
        '</div>' +

        '<div class="product-gallery-list" data-product-gallery>' +
          imageRows +
        '</div>' +

      '</div>' +

      '<div class="panel-actions">' +

        '<button class="btn btn-primary" type="button" data-save-product>' +
          (
            product.id
              ? "ذخیره تغییرات"
              : "ثبت محصول"
          ) +
        '</button>' +

        (
          product.id
            ? '<button class="btn btn-secondary" type="button" data-delete-current-product="' +
              escapeHtml(product.id) +
              '">حذف محصول</button>'
            : ""
        ) +

        '<button class="btn btn-secondary" type="button" data-close-product-form>بستن</button>' +

      '</div>'
    );
  }

  // ============================================
  // اتصال رویدادهای فرم محصول
  // ============================================

  function bindProductForm(box, product) {
    product = product || {};

    var statusField =
      box.querySelector(
        '[data-product-field="status"]'
      );

    if (statusField) {
      statusField.value =
        product.status || "draft";
    }

    var radioButtons =
      box.querySelectorAll(
        "[data-price-type-radio]"
      );

    var fixedFields =
      box.querySelector(
        "#fixed-price-fields"
      );

    var rateFields =
      box.querySelector(
        "#rate-price-fields"
      );

    radioButtons.forEach(
      function(radio) {
        radio.addEventListener(
          "change",
          function() {
            var isRateBased =
              this.value === "rate_based";

            if (fixedFields) {
              fixedFields.style.display =
                isRateBased
                  ? "none"
                  : "";
            }

            if (rateFields) {
              rateFields.style.display =
                isRateBased
                  ? ""
                  : "none";
            }
          }
        );
      }
    );

    var addImageBtn =
      box.querySelector(
        "[data-add-product-image]"
      );

    if (addImageBtn) {
      addImageBtn.addEventListener(
        "click",
        function() {
          var gallery =
            box.querySelector(
              "[data-product-gallery]"
            );

          if (!gallery) {
            return;
          }

          gallery.insertAdjacentHTML(
            "beforeend",
            productGalleryHtml(
              {},
              gallery.querySelectorAll(
                "[data-gallery-item]"
              ).length
            )
          );
        }
      );
    }

    var gallery =
      box.querySelector(
        "[data-product-gallery]"
      );

    if (gallery) {

      gallery.addEventListener(
        "click",
        function(event) {
          var removeBtn =
            event.target.closest(
              "[data-remove-product-image]"
            );

          if (!removeBtn) {
            return;
          }

          var item =
            removeBtn.closest(
              "[data-gallery-item]"
            );

          if (item) {
            item.remove();
          }
        }
      );

      gallery.addEventListener(
        "input",
        function(event) {
          if (
            !event.target.matches(
              "[data-gallery-url]"
            )
          ) {
            return;
          }

          var item =
            event.target.closest(
              "[data-gallery-item]"
            );

          if (!item) {
            return;
          }

          var preview =
            item.querySelector(
              "[data-gallery-preview]"
            );

          if (preview) {
            preview.style.display = "block";
            preview.src =
              event.target.value.trim();
          }
        }
      );
    }

    var localFiles =
      box.querySelector(
        "[data-product-local-files]"
      );

    if (localFiles) {
      localFiles.addEventListener(
        "change",
        function(event) {

          var gallery =
            box.querySelector(
              "[data-product-gallery]"
            );

          var files =
            Array.from(
              event.target.files || []
            );

          files.forEach(
            function(file) {

              var reader =
                new FileReader();

              reader.onload =
                function() {

                  if (!gallery) {
                    return;
                  }

                  gallery.insertAdjacentHTML(
                    "beforeend",
                    productGalleryHtml(
                      {
                        image_url:
                          reader.result,
                        alt_text:
                          file.name
                      },
                      gallery.querySelectorAll(
                        "[data-gallery-item]"
                      ).length
                    )
                  );
                };

              reader.readAsDataURL(file);
            }
          );

          if (
            typeof window.setAdminMessage ===
            "function"
          ) {
            window.setAdminMessage(
              "فایل‌ها فقط برای پیش‌نمایش اضافه شدند. پیش از ذخیره، مسیر واقعی /assets/images/... را وارد کن."
            );
          }
        }
      );
    }

    var saveBtn =
      box.querySelector(
        "[data-save-product]"
      );

    if (saveBtn) {
      saveBtn.addEventListener(
        "click",
        async function() {

          var get =
            function(key) {
              return box.querySelector(
                '[data-product-field="' +
                key +
                '"]'
              );
            };

          var selectedRadio =
            box.querySelector(
              '[data-price-type-radio]:checked'
            );

          var priceType =
            selectedRadio
              ? selectedRadio.value
              : "fixed";

          var galleryItems =
            box.querySelectorAll(
              "[data-gallery-item]"
            );

          var images =
            Array.from(galleryItems)
              .map(
                function(item, index) {

                  var urlInput =
                    item.querySelector(
                      "[data-gallery-url]"
                    );

                  var altInput =
                    item.querySelector(
                      "[data-gallery-alt]"
                    );

                  var primaryInput =
                    item.querySelector(
                      "[data-gallery-primary]"
                    );

                  return {
                    image_url:
                      urlInput
                        ? urlInput.value.trim()
                        : "",

                    alt_text:
                      altInput
                        ? altInput.value.trim()
                        : "",

                    sort_order:
                      index + 1,

                    is_primary:
                      primaryInput
                        ? primaryInput.checked
                        : false
                  };
                }
              )
              .filter(
                function(image) {
                  return (
                    image.image_url &&
                    !image.image_url.startsWith(
                      "data:"
                    )
                  );
                }
              );

          var payload = {
            name:
              get("name")?.value?.trim() ||
              "",

            slug:
              get("slug")?.value?.trim() ||
              "",

            category:
              get("category")?.value?.trim() ||
              "",

            price:
              get("price")?.value?.trim() ||
              null,

            price_label:
              get("price_label")?.value?.trim() ||
              "تماس بگیرید",

            show_price:
              get("show_price")?.checked ||
              false,

            stock_quantity:
              get("stock_quantity")?.value ||
              0,

            in_stock:
              get("in_stock")?.checked ||
              false,

            stock_label:
              get("stock_label")?.value?.trim() ||
              "",

            short_description:
              get("short_description")?.value?.trim() ||
              "",

            description:
              get("description")?.value?.trim() ||
              "",

            page_url:
              get("page_url")?.value?.trim() ||
              "",

            status:
              get("status")?.value ||
              "draft",

            images:
              images,

            price_type:
              priceType,

            base_price:
              get("base_price")?.value?.trim() ||
              null,

            profit_type:
              get("profit_type")?.value ||
              "none",

            profit_value:
              get("profit_value")?.value?.trim() ||
              null,

            fixed_fee:
              get("fixed_fee")?.value?.trim() ||
              null,

            rounding_type:
              get("rounding_type")?.value ||
              "none",

            rounding_method:
              get("rounding_method")?.value ||
              "nearest"
          };

          if (!payload.name) {
            if (
              typeof window.setAdminMessage ===
              "function"
            ) {
              window.setAdminMessage(
                "نام محصول الزامی است."
              );
            }

            return;
          }

          if (
            payload.price_type === "rate_based" &&
            (
              !payload.base_price ||
              Number(payload.base_price) <= 0
            )
          ) {
            if (
              typeof window.setAdminMessage ===
              "function"
            ) {
              window.setAdminMessage(
                "برای محصولات وابسته به نرخ ارز، قیمت پایه به دلار الزامی است."
              );
            }

            return;
          }

          if (
            typeof window.api !== "function"
          ) {
            if (
              typeof window.setAdminMessage ===
              "function"
            ) {
              window.setAdminMessage(
                "ارتباط با API هنوز آماده نشده است."
              );
            }

            return;
          }

          saveBtn.disabled = true;

          var originalText =
            saveBtn.textContent;

          saveBtn.textContent =
            "در حال ذخیره...";

          try {

            var url =
              product.id
                ? "/api/admin/products/" +
                  encodeURIComponent(
                    product.id
                  )
                : "/api/admin/products";

            var method =
              product.id
                ? "PUT"
                : "POST";

            var result =
              await window.api(
                url,
                {
                  method: method,
                  body: JSON.stringify(payload)
                }
              );

            if (
              !result ||
              !result.ok ||
              !result.data?.success
            ) {
              if (
                typeof window.setAdminMessage ===
                "function"
              ) {
                window.setAdminMessage(
                  result?.data?.error ||
                  "ذخیره محصول انجام نشد."
                );
              }

              return;
            }

            if (
              typeof window.setAdminMessage ===
              "function"
            ) {
              window.setAdminMessage(
                result.data.message ||
                "محصول با موفقیت ذخیره شد.",
                "success"
              );
            }

            closeProductCreateBox();
            closeProductEditBox();

            await loadProducts();

          } catch (error) {

            console.error(
              "Product save error:",
              error
            );

            if (
              typeof window.setAdminMessage ===
              "function"
            ) {
              window.setAdminMessage(
                "خطا در ارتباط با سرور هنگام ذخیره محصول."
              );
            }

          } finally {

            saveBtn.disabled = false;
            saveBtn.textContent =
              originalText;
          }
        }
      );
    }

    var closeBtn =
      box.querySelector(
        "[data-close-product-form]"
      );

    if (closeBtn) {
      closeBtn.addEventListener(
        "click",
        function() {
          closeProductCreateBox();
          closeProductEditBox();
        }
      );
    }

    var deleteBtn =
      box.querySelector(
        "[data-delete-current-product]"
      );

    if (deleteBtn) {
      deleteBtn.addEventListener(
        "click",
        function() {
          var id =
            Number(
              this.getAttribute(
                "data-delete-current-product"
              )
            );

          if (id) {
            deleteProduct(id);
          }
        }
      );
    }
  }

  // ============================================
  // بارگذاری لیست محصولات
  // ============================================

  async function loadProducts() {

    var tbody =
      document.getElementById(
        "products-body"
      );

    if (!tbody) {
      console.warn(
        "Products table body not found."
      );

      return;
    }

    if (
      typeof window.api !== "function"
    ) {
      tbody.innerHTML =
        '<tr><td colspan="9">سیستم ارتباط با API هنوز آماده نشده است.</td></tr>';

      return;
    }

    var params =
      new URLSearchParams();

    var search =
      document.getElementById(
        "products-search"
      )?.value?.trim() || "";

    var category =
      document.getElementById(
        "products-category"
      )?.value || "";

    var status =
      document.getElementById(
        "products-status"
      )?.value || "";

    if (search) {
      params.set("search", search);
    }

    if (category) {
      params.set("category", category);
    }

    if (status) {
      params.set("status", status);
    }

    tbody.innerHTML =
      '<tr><td colspan="9">در حال دریافت محصولات...</td></tr>';

    try {

      var result =
        await window.api(
          "/api/admin/products" +
          (
            params.toString()
              ? "?" + params.toString()
              : ""
          )
        );

      if (
        !result ||
        !result.ok ||
        !result.data?.success
      ) {
        tbody.innerHTML =
          '<tr><td colspan="9">' +
          escapeHtml(
            result?.data?.error ||
            "دریافت محصولات انجام نشد."
          ) +
          "</td></tr>";

        return;
      }

      var select =
        document.getElementById(
          "products-category"
        );

      var oldCategory =
        select
          ? select.value
          : "";

      if (select) {

        var categories =
          Array.isArray(
            result.data.categories
          )
            ? result.data.categories
            : [];

        select.innerHTML =
          '<option value="">همه دسته‌بندی‌ها</option>' +
          categories.map(
            function(c) {
              return (
                '<option value="' +
                escapeHtml(c) +
                '">' +
                escapeHtml(c) +
                "</option>"
              );
            }
          ).join("");

        select.value =
          oldCategory;
      }

      var products =
        Array.isArray(
          result.data.products
        )
          ? result.data.products
          : [];

      if (!products.length) {
        tbody.innerHTML =
          '<tr><td colspan="9">محصولی پیدا نشد.</td></tr>';

        return;
      }

      try {

        tbody.innerHTML =
          products.map(
            function(product) {

              product =
                product &&
                typeof product === "object"
                  ? product
                  : {};

              var img =
                getProductImage(product);

              var displayPrice =
                getDisplayPrice(product);

              var priceType =
                (
                  product.price_type ||
                  product.priceType
                ) === "rate_based"
                  ? "🔹 دلاری"
                  : "🔸 ثابت";

              var hasStock =
                getBoolean(product.in_stock) ||
                Number(
                  product.stock_quantity || 0
                ) > 0;

              var stockLabel =
                product.stock_label ||
                (
                  hasStock
                    ? "موجود"
                    : "ناموجود"
                );

              return (
                "<tr>" +

                  "<td>" +

                    (
                      img
                        ? '<img class="product-image-thumb" src="' +
                          escapeHtml(img) +
                          '" alt="' +
                          escapeHtml(product.name || "") +
                          '" onerror="this.onerror=null;this.style.display=\'none\';this.parentNode.innerHTML=\'<div class=product-empty-image>—</div>\';" />'

                        : '<div class="product-empty-image">—</div>'
                    ) +

                  "</td>" +

                  '<td class="table-number">' +
                    escapeHtml(
                      product.id ?? "—"
                    ) +
                  "</td>" +

                  "<td>" +
                    "<strong>" +
                    escapeHtml(
                      product.name || "بدون نام"
                    ) +
                    "</strong><br>" +

                    '<small style="color:var(--muted)">' +
                    escapeHtml(
                      product.slug || "—"
                    ) +
                    "</small>" +
                  "</td>" +

                  "<td>" +
                    escapeHtml(
                      product.category || "—"
                    ) +
                  "</td>" +

                  '<td class="table-number">' +
                    displayPrice +
                    "<br>" +

                    '<small style="color:var(--muted)">' +
                    priceType +
                    "</small>" +
                  "</td>" +

                  "<td>" +

                    (
                      hasStock
                        ? '<span class="status-badge status-badge--success">' +
                          escapeHtml(stockLabel) +
                          "</span><br>" +

                          "<small>" +
                          formatMoney(
                            product.stock_quantity || 0
                          ) +
                          " عدد</small>"

                        : '<span class="status-badge status-badge--danger">' +
                          escapeHtml(stockLabel) +
                          "</span>"
                    ) +

                  "</td>" +

                  "<td>" +
                    productStatusHtml(
                      product.status
                    ) +
                  "</td>" +

                  '<td class="table-number">' +
                    formatProductDate(
                      product.updated_at ||
                      product.updatedAt ||
                      product.created_at ||
                      product.createdAt
                    ) +
                  "</td>" +

                  "<td>" +
                    '<div class="panel-actions" style="margin-top:0">' +

                      '<button class="btn btn-secondary" type="button" data-edit-product="' +
                      escapeHtml(product.id || "") +
                      '">ویرایش</button>' +

                      '<button class="btn btn-secondary" type="button" data-delete-product="' +
                      escapeHtml(product.id || "") +
                      '">حذف</button>' +

                    "</div>" +
                  "</td>" +

                "</tr>"
              );
            }
          ).join("");

      } catch (renderError) {

        console.error(
          "Products table render error:",
          renderError
        );

        tbody.innerHTML =
          '<tr><td colspan="9">خطا در نمایش اطلاعات جدول محصولات.</td></tr>';
      }

    } catch (error) {

      console.error(
        "Products load error:",
        error
      );

      tbody.innerHTML =
        '<tr><td colspan="9">خطا در ارتباط با سرور هنگام دریافت محصولات.</td></tr>';
    }
  }

  // ============================================
  // باز کردن فرم افزودن محصول
  // ============================================

  function openProductCreate() {

    refreshProductElements();

    closeProductEditBox();

    refreshProductElements();

    if (!productCreateBox) {

      if (
        typeof window.setAdminMessage ===
        "function"
      ) {
        window.setAdminMessage(
          "فرم افزودن محصول هنوز بارگذاری نشده است."
        );
      }

      return;
    }

    productCreateBox.classList.remove(
      "admin-hidden"
    );

    productCreateBox.innerHTML =
      productFormHtml(
        {
          show_price: true,
          in_stock: true,
          status: "draft",
          stock_label: "موجود",
          price_label: "تماس بگیرید",
          price_type: "fixed"
        }
      );

    bindProductForm(
      productCreateBox
    );

    productCreateBox.scrollIntoView(
      {
        behavior: "smooth",
        block: "start"
      }
    );
  }

  // ============================================
  // باز کردن فرم ویرایش محصول
  // ============================================

  async function openProductEdit(id) {

    refreshProductElements();

    closeProductCreateBox();

    refreshProductElements();

    if (!productEditBox) {

      if (
        typeof window.setAdminMessage ===
        "function"
      ) {
        window.setAdminMessage(
          "فرم ویرایش محصول هنوز بارگذاری نشده است."
        );
      }

      return;
    }

    if (
      typeof window.api !== "function"
    ) {
      if (
        typeof window.setAdminMessage ===
        "function"
      ) {
        window.setAdminMessage(
          "ارتباط با API هنوز آماده نشده است."
        );
      }

      return;
    }

    try {

      var result =
        await window.api(
          "/api/admin/products/" +
          encodeURIComponent(id)
        );

      if (
        !result ||
        !result.ok ||
        !result.data?.success
      ) {
        if (
          typeof window.setAdminMessage ===
          "function"
        ) {
          window.setAdminMessage(
            result?.data?.error ||
            "دریافت محصول انجام نشد."
          );
        }

        return;
      }

      refreshProductElements();

      if (!productEditBox) {
        return;
      }

      productEditBox.classList.remove(
        "admin-hidden"
      );

      productEditBox.innerHTML =
        productFormHtml(
          result.data.product || {}
        );

      bindProductForm(
        productEditBox,
        result.data.product || {}
      );

      productEditBox.scrollIntoView(
        {
          behavior: "smooth",
          block: "start"
        }
      );

    } catch (error) {

      console.error(
        "Product edit load error:",
        error
      );

      if (
        typeof window.setAdminMessage ===
        "function"
      ) {
        window.setAdminMessage(
          "خطا در دریافت اطلاعات محصول."
        );
      }
    }
  }

  // ============================================
  // حذف محصول
  // ============================================

  async function deleteProduct(id) {

    if (!id) {
      return;
    }

    if (
      !window.confirm(
        "آیا از حذف این محصول مطمئن هستی؟"
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        "حذف محصول و گالری تصاویر غیرقابل بازگشت است. ادامه می‌دهی؟"
      )
    ) {
      return;
    }

    if (
      typeof window.api !== "function"
    ) {
      if (
        typeof window.setAdminMessage ===
        "function"
      ) {
        window.setAdminMessage(
          "ارتباط با API هنوز آماده نشده است."
        );
      }

      return;
    }

    try {

      var result =
        await window.api(
          "/api/admin/products/" +
          encodeURIComponent(id),
          {
            method: "DELETE"
          }
        );

      if (
        !result ||
        !result.ok ||
        !result.data?.success
      ) {
        if (
          typeof window.setAdminMessage ===
          "function"
        ) {
          window.setAdminMessage(
            result?.data?.error ||
            "حذف محصول انجام نشد."
          );
        }

        return;
      }

      if (
        typeof window.setAdminMessage ===
        "function"
      ) {
        window.setAdminMessage(
          result.data.message ||
          "محصول حذف شد.",
          "success"
        );
      }

      closeProductCreateBox();
      closeProductEditBox();

      await loadProducts();

    } catch (error) {

      console.error(
        "Product delete error:",
        error
      );

      if (
        typeof window.setAdminMessage ===
        "function"
      ) {
        window.setAdminMessage(
          "خطا در حذف محصول."
        );
      }
    }
  }

  // ============================================
  // Event Delegation برای تب محصولات
  // ============================================

  function setupProductEvents() {

    document.removeEventListener(
      "click",
      handleProductClick
    );

    document.removeEventListener(
      "keydown",
      handleProductKeydown
    );

    document.addEventListener(
      "click",
      handleProductClick
    );

    document.addEventListener(
      "keydown",
      handleProductKeydown
    );
  }

  // ============================================
  // مدیریت کلیک‌ها
  // ============================================

  function handleProductClick(event) {

    var target =
      event.target;

    var createBtn =
      target.closest(
        "#show-create-product-btn"
      );

    if (createBtn) {

      event.preventDefault();

      openProductCreate();

      return;
    }

    var filterBtn =
      target.closest(
        "#products-filter-btn"
      );

    if (filterBtn) {

      event.preventDefault();

      loadProducts();

      return;
    }

    var editBtn =
      target.closest(
        "[data-edit-product]"
      );

    if (editBtn) {

      event.preventDefault();

      var editId =
        editBtn.getAttribute(
          "data-edit-product"
        );

      if (editId) {
        openProductEdit(editId);
      }

      return;
    }

    var deleteBtn =
      target.closest(
        "[data-delete-product]"
      );

    if (deleteBtn) {

      event.preventDefault();

      var deleteId =
        deleteBtn.getAttribute(
          "data-delete-product"
        );

      if (deleteId) {
        deleteProduct(
          Number(deleteId)
        );
      }
    }
  }

  // ============================================
  // Enter برای جستجوی محصولات
  // ============================================

  function handleProductKeydown(event) {

    if (event.key !== "Enter") {
      return;
    }

    var target =
      event.target;

    if (
      target.id ===
      "products-search"
    ) {

      event.preventDefault();

      loadProducts();
    }
  }

  // ============================================
  // صادر کردن توابع
  // ============================================

  window.loadProducts =
    loadProducts;

  window.openProductCreate =
    openProductCreate;

  window.openProductEdit =
    openProductEdit;

  window.deleteProduct =
    deleteProduct;

  window.closeProductCreateBox =
    closeProductCreateBox;

  window.closeProductEditBox =
    closeProductEditBox;

  window.productFormHtml =
    productFormHtml;

  window.productGalleryHtml =
    productGalleryHtml;

  window.bindProductForm =
    bindProductForm;

  window.setupProductEvents =
    setupProductEvents;

  // ============================================
  // راه‌اندازی ماژول
  // ============================================

  refreshProductElements();
  setupProductEvents();

  console.log(
    "✅ Products module loaded successfully"
  );

})();