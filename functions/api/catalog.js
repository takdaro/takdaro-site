function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

function normalizeProduct(row, imagesByProductId) {
  const productId = Number(row.id);
  const gallery = imagesByProductId.get(productId) || [];
  const primaryImage =
    row.primary_image ||
    gallery.find((image) => Number(image.is_primary) === 1)?.image_url ||
    gallery[0]?.image_url ||
    "";

  const numericPrice =
    row.price === null || row.price === undefined || row.price === ""
      ? null
      : Number(row.price);

  const stockQuantity = Math.max(0, Number(row.stock_quantity || 0));
  const inStock = Number(row.in_stock) === 1 && stockQuantity > 0;

  return {
    id: productId,
    slug: row.slug,
    name: row.name,
    category: row.category || "",
    price: numericPrice,
    priceLabel:
      numericPrice === null
        ? row.price_label || "تماس بگیرید"
        : numericPrice.toLocaleString("fa-IR"),
    showPrice: Number(row.show_price) === 1 && numericPrice !== null,
    stockQuantity,
    inStock,
    stockLabel:
      row.stock_label ||
      (inStock ? `موجود (${stockQuantity.toLocaleString("fa-IR")})` : "ناموجود"),
    shortDescription: row.short_description || "",
    description: row.description || "",
    primaryImage,
    images: gallery.map((image) => image.image_url).filter(Boolean),
    pageUrl: row.page_url || `products/${row.slug}.html`,
    status: row.status || "published",
    updatedAt: row.updated_at || null
  };
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const requestedSlug = String(url.searchParams.get("slug") || "").trim();
    const requestedCategory = String(url.searchParams.get("category") || "").trim();

    let productsQuery = `
      SELECT
        id,
        slug,
        name,
        category,
        price,
        price_label,
        show_price,
        stock_quantity,
        in_stock,
        stock_label,
        short_description,
        description,
        primary_image,
        page_url,
        status,
        created_at,
        updated_at
      FROM products
      WHERE status = 'published'
    `;

    const bindings = [];

    if (requestedSlug) {
      productsQuery += " AND slug = ?";
      bindings.push(requestedSlug);
    }

    if (requestedCategory) {
      productsQuery += " AND category = ?";
      bindings.push(requestedCategory);
    }

    productsQuery += " ORDER BY id DESC";

    const productsResult = await context.env.DB.prepare(productsQuery)
      .bind(...bindings)
      .all();

    const productRows = productsResult.results || [];

    if (requestedSlug && productRows.length === 0) {
      return json(
        {
          success: false,
          error: "محصول موردنظر پیدا نشد."
        },
        404
      );
    }

    const productIds = productRows
      .map((product) => Number(product.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const imagesByProductId = new Map();

    if (productIds.length > 0) {
      const placeholders = productIds.map(() => "?").join(", ");

      const imagesResult = await context.env.DB.prepare(`
        SELECT
          id,
          product_id,
          image_url,
          alt_text,
          sort_order,
          is_primary
        FROM product_images
        WHERE product_id IN (${placeholders})
        ORDER BY product_id ASC, is_primary DESC, sort_order ASC, id ASC
      `)
        .bind(...productIds)
        .all();

      for (const image of imagesResult.results || []) {
        const productId = Number(image.product_id);

        if (!imagesByProductId.has(productId)) {
          imagesByProductId.set(productId, []);
        }

        imagesByProductId.get(productId).push({
          id: Number(image.id),
          imageUrl: image.image_url,
          image_url: image.image_url,
          altText: image.alt_text || "",
          alt_text: image.alt_text || "",
          sortOrder: Number(image.sort_order || 0),
          sort_order: Number(image.sort_order || 0),
          isPrimary: Number(image.is_primary) === 1,
          is_primary: Number(image.is_primary) === 1 ? 1 : 0
        });
      }
    }

    const products = productRows.map((row) =>
      normalizeProduct(row, imagesByProductId)
    );

    if (requestedSlug) {
      return json({
        success: true,
        product: products[0]
      });
    }

    return json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}