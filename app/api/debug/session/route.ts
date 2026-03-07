import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const email = typeof session?.user?.email === "string" ? session.user.email : "";

  if (!email || !isMasterAdmin(email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    hasSession: !!session,
    email,
    name: typeof session?.user?.name === "string" ? session.user.name : null,
    image: typeof session?.user?.image === "string" ? session.user.image : null,
  });
}
