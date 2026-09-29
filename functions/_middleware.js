export async function onRequest(context) {
  const url = new URL(context.request.url);
  const method = context.request.method.toUpperCase();

  if (url.hostname.toLowerCase() === "takdaro.com" && (method === "GET" || method === "HEAD")) {
    url.hostname = "www.takdaro.com";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
