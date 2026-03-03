import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  return NextResponse.json({
    hasSession: !!session,
    email: typeof session?.user?.email === "string" ? session.user.email : null,
    name: typeof session?.user?.name === "string" ? session.user.name : null,
    image: typeof session?.user?.image === "string" ? session.user.image : null,
  });
}
