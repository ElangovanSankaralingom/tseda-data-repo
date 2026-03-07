import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { listUsers } from "@/lib/admin/integrity";
import { addNotificationForAllUsers } from "@/lib/confirmations/notificationStore";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessSettings(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { title?: string; message?: string };
  if (!body.title || !body.message) {
    return NextResponse.json({ error: "title and message are required" }, { status: 400 });
  }

  const usersResult = await listUsers();
  if (!usersResult.ok) {
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }

  const count = await addNotificationForAllUsers(
    {
      type: "system_announcement",
      title: body.title,
      message: body.message,
    },
    usersResult.data,
  );

  return NextResponse.json({ sent: count });
}
