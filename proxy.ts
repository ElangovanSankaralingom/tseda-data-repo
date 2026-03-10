import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isMasterAdmin } from "@/lib/admin";
import { dashboard } from "@/lib/entryNavigation";

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  const email = typeof token?.email === "string" ? token.email : "";

  // Generate request ID for tracing
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();

  if (isMasterAdmin(email)) {
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = dashboard();
  redirectUrl.search = "";
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
