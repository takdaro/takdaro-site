import { getDeliveryAvailability } from "../../lib/delivery-availability";

export async function onRequestGet(context) {
  try {
    const params = new URL(context.request.url).searchParams;
    const availability = await getDeliveryAvailability(context.env.DB, {
      province: String(params.get("province") || "").trim(),
      city: String(params.get("city") || "").trim(),
      shippingMethodId: Number(params.get("shipping_method_id") || 0)
    });
    return Response.json({ success: true, ...availability }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ success: false, error: String(error?.message || error) }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
