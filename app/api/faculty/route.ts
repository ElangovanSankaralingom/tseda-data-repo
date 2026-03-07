import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { assertActionPayload } from "@/lib/security/limits";
import { newId, readJson, writeJson } from "@/lib/storage";

type FacultyProfile = {
  id: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  employeeId?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
};

const FILE = "faculty.json";

async function requireSession() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return null;
  return email;
}

function requireAdmin(email: string) {
  return canAccessAdminConsole(email);
}

export async function GET() {
  const email = await requireSession();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await readJson<FacultyProfile[]>(FILE, []);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const email = await requireSession();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Partial<FacultyProfile>;
  assertActionPayload(body, "faculty.create");

  if (!body.fullName || !body.email || !body.department || !body.designation) {
    return NextResponse.json(
      { error: "fullName, email, department, designation are required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const newItem: FacultyProfile = {
    id: newId(),
    fullName: body.fullName,
    email: body.email.toLowerCase(),
    department: body.department,
    designation: body.designation,
    employeeId: body.employeeId,
    phone: body.phone,
    createdAt: now,
    updatedAt: now,
  };

  const items = await readJson<FacultyProfile[]>(FILE, []);
  items.unshift(newItem);
  await writeJson(FILE, items);

  return NextResponse.json(newItem, { status: 201 });
}

export async function PUT(req: Request) {
  const email = await requireSession();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Partial<FacultyProfile>;
  assertActionPayload(body, "faculty.update");

  if (!body.id) {
    return NextResponse.json(
      { error: "id is required for update" },
      { status: 400 }
    );
  }

  const items = await readJson<FacultyProfile[]>(FILE, []);
  const index = items.findIndex((i) => i.id === body.id);

  if (index === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  items[index] = {
    ...items[index],
    ...body,
    updatedAt: now,
  };

  await writeJson(FILE, items);
  return NextResponse.json(items[index]);
}

export async function DELETE(req: Request) {
  const email = await requireSession();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  const items = await readJson<FacultyProfile[]>(FILE, []);
  const nextItems = items.filter((i) => i.id !== id);

  if (nextItems.length === items.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await writeJson(FILE, nextItems);
  return NextResponse.json({ ok: true });
}
