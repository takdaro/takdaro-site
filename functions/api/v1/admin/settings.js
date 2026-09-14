import {
  onRequestGet as legacyGet,
  onRequestPost as legacyPost
} from "../../admin/settings";
import {
  getCashbackSettings,
  saveCashbackSettings
} from "../../../lib/cashback-settings.js";

function jsonResponse(response, data) {
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequestGet(context) {
  const response = await legacyGet(context);
  if (!response.ok) return response;

  try {
    const data = await response.clone().json();
    if (!data?.success) return response;
    data.settings = {
      ...(data.settings || {}),
      ...(await getCashbackSettings(context.env.DB))
    };
    return jsonResponse(response, data);
  } catch (_) {
    return response;
  }
}

export async function onRequestPost(context) {
  const body = await context.request.clone().json().catch(() => null);
  const response = await legacyPost(context);
  if (!response.ok || !body || typeof body !== "object") return response;

  try {
    const data = await response.clone().json();
    if (!data?.success) return response;
    const cashbackSettings = await saveCashbackSettings(context.env.DB, body);
    data.settings = {
      ...(data.settings || {}),
      ...cashbackSettings
    };
    return jsonResponse(response, data);
  } catch (_) {
    return response;
  }
}
