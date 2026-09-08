import { getPublishedProducts } from "../lib/products";

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
      ...headers
    }
  });
}

function cleanText(value) {
  return String(value ?? "").trim();
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const result = await getPublishedProducts(context.env, {
      slug: cleanText(url.searchParams.get("slug")),
      category: cleanText(url.searchParams.get("category")),
      includeOutOfStock: url.searchParams.get("include_out_of_stock") === "1"
    });

    return json({ success: true, ...result });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500,
      { "Cache-Control": "no-store" }
    );
  }
}
