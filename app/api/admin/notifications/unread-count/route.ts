import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getAdminUnreadCount } from "@/lib/confirmations/adminNotificationStore";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessAdminConsole(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const count = await getAdminUnreadCount(email);
  return NextResponse.json({ count });
}
