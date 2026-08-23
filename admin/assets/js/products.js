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

  function refreshProductElements() {
    productCreateBox = document.getElementById("product-create-box");
    productEditBox = document.getElementById("product-edit-box");
  }

  // ============================================
  // توابع کمکی
  // ============================================
  function closeProductCreateBox() {
    refreshProductElements();

    if (productCreateBox) {
      productCreateBox.classList.add("admin-hidden");
      productCreateBox.innerHTML = "";
    }
  }

  function closeProductEditBox() {
    refreshProductElements();

    if (productEditBox) {
      productEditBox.classList.add("admin-hidden");
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
      "";

    var alt =
      image.alt_text ||
      image.altText ||
      "";

    var primary =
      image.is_primary === true ||
      image.is_primary === 1 ||
      index === 0;

    return (
      '<div class="product-gallery-item" data-gallery-item>' +

        '<img data-gallery-preview src="' +
        window.esc(url) +
        '" alt="' +
        window.esc(alt) +
        '" onerror="this.style.display=\'none\'" />' +

        '<div class="form-field">' +
          '<label>مسیر تصویر</label>' +
          '<input data-gallery-url type="text" value="' +
          window.esc(url) +
          '" placeholder="/assets/images/..." />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>متن جایگزین</label>' +
          '<input data-gallery-alt type="text" value="' +
          window.esc(alt) +
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
      images.map(function(image, index) {
        return productGalleryHtml(
          image,
          index
        );
      }).join("");

    var priceType =
      product.price_type || "fixed";

    var isRateBased =
      priceType === "rate_based";

    return (
      '<h4>' +
      (
        product.id
          ? "ویرایش محصول #" +
            window.esc(product.id)
          : "افزودن محصول جدید"
      ) +
      '</h4>' +

      '<div class="filters-grid filters-grid-3">' +

        '<div class="form-field">' +
          '<label>نام محصول *</label>' +
          '<input data-product-field="name" type="text" value="' +
          window.esc(product.name || "") +
          '" placeholder="نام محصول" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>Slug انگلیسی *</label>' +
          '<input data-product-field="slug" type="text" value="' +
          window.esc(product.slug || "") +
          '" placeholder="مثلاً tb-500" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>دسته‌بندی</label>' +
          '<input data-product-field="category" type="text" value="' +
          window.esc(product.category || "") +
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
          window.esc(product.price_label || "تماس بگیرید") +
          '" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>' +
            '<input data-product-field="show_price" type="checkbox" ' +
            (product.show_price ? "checked" : "") +
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
            (product.base_price ?? "") +
            '" placeholder="مثلاً 10" />' +
            '<small class="admin-help">قیمت پایه محصول به دلار</small>' +
          '</div>' +

          '<div class="form-field">' +
            '<label>نوع سود</label>' +
            '<select data-product-field="profit_type">' +
              '<option value="none" ' +
              (product.profit_type === "none" ? "selected" : "") +
              '>بدون سود</option>' +

              '<option value="percentage" ' +
              (product.profit_type === "percentage" ? "selected" : "") +
              '>درصدی</option>' +

              '<option value="fixed" ' +
              (product.profit_type === "fixed" ? "selected" : "") +
              '>مبلغ ثابت (تومان)</option>' +
            '</select>' +
          '</div>' +

          '<div class="form-field">' +
            '<label>مقدار سود</label>' +
            '<input data-product-field="profit_value" type="text" inputmode="numeric" value="' +
            (product.profit_value ?? "") +
            '" placeholder="مثلاً 20 یا 50000" />' +
            '<small class="admin-help">درصد یا مبلغ ثابت به تومان</small>' +
          '</div>' +

        '</div>' +

        '<div class="filters-grid filters-grid-3">' +

          '<div class="form-field">' +
            '<label>هزینه ثابت (تومان)</label>' +
            '<input data-product-field="fixed_fee" type="text" inputmode="numeric" value="' +
            (product.fixed_fee ?? "") +
            '" placeholder="مثلاً 200000" />' +
            '<small class="admin-help">هزینه اضافی به تومان</small>' +
          '</div>' +

          '<div class="form-field">' +
            '<label>نوع گرد کردن</label>' +
            '<select data-product-field="rounding_type">' +
              '<option value="none" ' +
              (product.rounding_type === "none" ? "selected" : "") +
              '>بدون گرد کردن</option>' +

              '<option value="1000" ' +
              (product.rounding_type === "1000" ? "selected" : "") +
              '>۱,۰۰۰ تومان</option>' +

              '<option value="10000" ' +
              (product.rounding_type === "10000" ? "selected" : "") +
              '>۱۰,۰۰۰ تومان</option>' +

              '<option value="100000" ' +
              (product.rounding_type === "100000" ? "selected" : "") +
              '>۱۰۰,۰۰۰ تومان</option>' +
            '</select>' +
          '</div>' +

          '<div class="form-field">' +
            '<label>روش گرد کردن</label>' +
            '<select data-product-field="rounding_method">' +
              '<option value="nearest" ' +
              (product.rounding_method === "nearest" ? "selected" : "") +
              '>نزدیک‌ترین</option>' +

              '<option value="up" ' +
              (product.rounding_method === "up" ? "selected" : "") +
              '>بالا</option>' +

              '<option value="down" ' +
              (product.rounding_method === "down" ? "selected" : "") +
              '>پایین</option>' +
            '</select>' +
          '</div>' +

        '</div>' +

        '<small class="admin-help" style="display:block;margin-top:8px;">' +
          'قیمت نهایی = (قیمت پایه × نرخ دلار) + سود + هزینه ثابت، سپس گرد کردن' +
          (
            product.calculated_price
              ? ' | قیمت محاسبه‌شده فعلی: <strong>' +
                window.money(product.calculated_price) +
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
          window.esc(product.stock_label || "") +
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
          window.esc(product.page_url || "") +
          '" placeholder="products/example.html" />' +
        '</div>' +

        '<div class="form-field">' +
          '<label>' +
            '<input data-product-field="in_stock" type="checkbox" ' +
            (product.in_stock ? "checked" : "") +
            ' /> محصول موجود است' +
          '</label>' +
        '</div>' +

      '</div>' +

      '<div class="form-field">' +
        '<label>توضیح کوتاه</label>' +
        '<textarea data-product-field="short_description" rows="3" placeholder="توضیح کوتاه برای محصول">' +
          window.esc(product.short_description || "") +
        '</textarea>' +
      '</div>' +

      '<div class="form-field">' +
        '<label>توضیحات کامل</label>' +
        '<textarea data-product-field="description" rows="7" placeholder="توضیحات کامل محصول">' +
          window.esc(product.description || "") +
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
          (product.id ? "ذخیره تغییرات" : "ثبت محصول") +
        '</button>' +

        (
          product.id
            ? '<button class="btn btn-secondary" type="button" data-delete-current-product="' +
              window.esc(product.id) +
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

          if (gallery) {
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

          if (removeBtn) {
            var item =
              removeBtn.closest(
                "[data-gallery-item]"
              );

            if (item) {
              item.remove();
            }
          }
        }
      );

      gallery.addEventListener(
        "input",
        function(event) {
          if (
            event.target.matches(
              "[data-gallery-url]"
            )
          ) {
            var item =
              event.target.closest(
                "[data-gallery-item]"
              );

            if (!item) return;

            var preview =
              item.querySelector(
                "[data-gallery-preview]"
              );

            if (preview) {
              preview.style.display =
                "block";

              preview.src =
                event.target.value.trim();
            }
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
              event.target.files
            );

          files.forEach(
            function(file) {

              var reader =
                new FileReader();

              reader.onload =
                function() {

                  if (gallery) {
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
                  }
                };

              reader.readAsDataURL(
                file
              );
            }
          );

          window.setAdminMessage(
            "فایل‌ها فقط برای پیش‌نمایش اضافه شدند. پیش از ذخیره، مسیر واقعی /assets/images/... را وارد کن."
          );
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
            Array.from(
              galleryItems
            ).map(
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
            ).filter(
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
            window.setAdminMessage(
              "نام محصول الزامی است."
            );
            return;
          }

          if (
            payload.price_type ===
            "rate_based"
          ) {
            if (
              !payload.base_price ||
              Number(payload.base_price) <= 0
            ) {
              window.setAdminMessage(
                "برای محصولات وابسته به نرخ ارز، قیمت پایه به دلار الزامی است."
              );
              return;
            }
          }

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
                method:
                  method,

                body:
                  JSON.stringify(
                    payload
                  )
              }
            );

          if (
            !result.ok ||
            !result.data?.success
          ) {
            window.setAdminMessage(
              result.data?.error ||
              "ذخیره محصول انجام نشد."
            );
            return;
          }

          window.setAdminMessage(
            result.data.message ||
            "محصول با موفقیت ذخیره شد.",
            "success"
          );

          closeProductCreateBox();
          closeProductEditBox();

          await loadProducts();
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
      params.set(
        "search",
        search
      );
    }

    if (category) {
      params.set(
        "category",
        category
      );
    }

    if (status) {
      params.set(
        "status",
        status
      );
    }

    tbody.innerHTML =
      '<tr><td colspan="9">در حال دریافت محصولات...</td></tr>';

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
      !result.ok ||
      !result.data?.success
    ) {
      tbody.innerHTML =
        '<tr><td colspan="9">' +
        window.esc(
          result.data?.error ||
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
      select.innerHTML =
        '<option value="">همه دسته‌بندی‌ها</option>' +
        (
          result.data.categories ||
          []
        ).map(
          function(c) {
            return (
              '<option value="' +
              window.esc(c) +
              '">' +
              window.esc(c) +
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

    tbody.innerHTML =
      products.length
        ? products.map(
            function(product) {

              var img =
                product.primary_image ||
                (
                  product.images &&
                  product.images.length > 0
                    ? product.images[0].image_url
                    : ""
                ) ||
                "";

              var displayPrice =
                product.display_price_formatted ||
                product.price_label ||
                "تماس بگیرید";

              var priceType =
                product.price_type ===
                "rate_based"
                  ? "🔹 دلاری"
                  : "🔸 ثابت";

              return (
                "<tr>" +

                "<td>" +
                  (
                    img
                      ? '<img class="product-image-thumb" src="' +
                        window.esc(img) +
                        '" alt="' +
                        window.esc(product.name) +
                        '" onerror="this.outerHTML=\'<div class=product-empty-image>—</div>\'" />'
                      : '<div class="product-empty-image">—</div>'
                  ) +
                "</td>" +

                '<td class="table-number">' +
                  window.esc(product.id) +
                "</td>" +

                "<td>" +
                  "<strong>" +
                  window.esc(product.name) +
                  "</strong><br>" +
                  '<small style="color:var(--muted)">' +
                  window.esc(product.slug) +
                  "</small>" +
                "</td>" +

                "<td>" +
                  window.esc(
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
                    Number(product.in_stock) ||
                    product.in_stock === true
                  )
                    ? '<span class="status-badge status-badge--success">' +
                      window.esc(
                        product.stock_label ||
                        "موجود"
                      ) +
                      "</span><br><small>" +
                      window.money(
                        product.stock_quantity ||
                        0
                      ) +
                      " عدد</small>"

                    : '<span class="status-badge status-badge--danger">' +
                      window.esc(
                        product.stock_label ||
                        "ناموجود"
                      ) +
                      "</span>" +
                "</td>" +

                "<td>" +
                  window.productStatusBadge(
                    product.status
                  ) +
                "</td>" +

                '<td class="table-number">' +
                  window.formatDate(
                    product.updated_at ||
                    product.created_at
                  ) +
                "</td>" +

                "<td>" +
                  '<div class="panel-actions" style="margin-top:0">' +

                    '<button class="btn btn-secondary" type="button" data-edit-product="' +
                    window.esc(product.id) +
                    '">ویرایش</button>' +

                    '<button class="btn btn-secondary" type="button" data-delete-product="' +
                    window.esc(product.id) +
                    '">حذف</button>' +

                  "</div>" +
                "</td>" +

                "</tr>"
              );
            }
          ).join("")

        : '<tr><td colspan="9">محصولی پیدا نشد.</td></tr>';
  }

  // ============================================
  // باز کردن فرم افزودن محصول
  // ============================================
  function openProductCreate() {
    refreshProductElements();

    closeProductEditBox();

    refreshProductElements();

    if (!productCreateBox) {
      window.setAdminMessage(
        "فرم افزودن محصول هنوز بارگذاری نشده است."
      );
      return;
    }

    productCreateBox.classList.remove(
      "admin-hidden"
    );

    productCreateBox.innerHTML =
      productFormHtml({
        show_price:
          true,

        in_stock:
          true,

        status:
          "draft",

        stock_label:
          "موجود",

        price_label:
          "تماس بگیرید",

        price_type:
          "fixed"
      });

    bindProductForm(
      productCreateBox
    );

    productCreateBox.scrollIntoView({
      behavior:
        "smooth",
      block:
        "start"
    });
  }

  // ============================================
  // باز کردن فرم ویرایش محصول
  // ============================================
  async function openProductEdit(id) {
    refreshProductElements();

    closeProductCreateBox();

    refreshProductElements();

    if (!productEditBox) {
      window.setAdminMessage(
        "فرم ویرایش محصول هنوز بارگذاری نشده است."
      );
      return;
    }

    var result =
      await window.api(
        "/api/admin/products/" +
        encodeURIComponent(id)
      );

    if (
      !result.ok ||
      !result.data?.success
    ) {
      window.setAdminMessage(
        result.data?.error ||
        "دریافت محصول انجام نشد."
      );
      return;
    }

    refreshProductElements();

    if (!productEditBox) {
      window.setAdminMessage(
        "فرم ویرایش محصول هنوز بارگذاری نشده است."
      );
      return;
    }

    productEditBox.classList.remove(
      "admin-hidden"
    );

    productEditBox.innerHTML =
      productFormHtml(
        result.data.product
      );

    bindProductForm(
      productEditBox,
      result.data.product
    );

    productEditBox.scrollIntoView({
      behavior:
        "smooth",
      block:
        "start"
    });
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

    var result =
      await window.api(
        "/api/admin/products/" +
        encodeURIComponent(id),
        {
          method:
            "DELETE"
        }
      );

    if (
      !result.ok ||
      !result.data?.success
    ) {
      window.setAdminMessage(
        result.data?.error ||
        "حذف محصول انجام نشد."
      );
      return;
    }

    window.setAdminMessage(
      result.data.message ||
      "محصول حذف شد.",
      "success"
    );

    closeProductCreateBox();
    closeProductEditBox();

    await loadProducts();
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
  // مدیریت کلیک‌های محصولات
  // ============================================
  function handleProductClick(
    event
  ) {
    var target =
      event.target;

    // افزودن محصول
    var createBtn =
      target.closest(
        "#show-create-product-btn"
      );

    if (createBtn) {
      event.preventDefault();

      openProductCreate();

      return;
    }

    // فیلتر محصولات
    var filterBtn =
      target.closest(
        "#products-filter-btn"
      );

    if (filterBtn) {
      event.preventDefault();

      loadProducts();

      return;
    }

    // ویرایش محصول
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
        openProductEdit(
          editId
        );
      }

      return;
    }

    // حذف محصول
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

      return;
    }
  }

  // ============================================
  // Enter برای جستجوی محصولات
  // ============================================
  function handleProductKeydown(
    event
  ) {
    if (
      event.key !==
      "Enter"
    ) {
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
  // راه‌اندازی
  // ============================================
  refreshProductElements();
  setupProductEvents();

  console.log(
    "✅ Products module loaded successfully"
  );

})();