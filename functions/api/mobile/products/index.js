// Shared read endpoint for the mobile management application.
import { getMobileUser, mobileUnauthorized } from "../../../lib/mobile-auth";
import { listAdminProducts } from "../../../lib/admin-products";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" }
  });
}

export async function onRequestGet(context) {
  try {
    const auth = await getMobileUser(context);
    if (!auth.ok) return mobileUnauthorized(auth.reason);

    const url = new URL(context.request.url);
    const result = await listAdminProducts(context.env, {
      search: url.searchParams.get("search"),
      status: url.searchParams.get("status"),
      category: url.searchParams.get("category"),
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit") || 50
    });

    return json({ success: true, ...result });
  } catch (error) {
    console.error("Mobile products error:", error);
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}
