import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isMasterAdmin } from "@/lib/admin";
import { dashboard } from "@/lib/entryNavigation";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const email = typeof token?.email === "string" ? token.email : "";

  if (isMasterAdmin(email)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = dashboard();
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
