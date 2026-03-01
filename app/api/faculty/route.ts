import { NextResponse } from "next/server";
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

export async function GET() {
  const items = await readJson<FacultyProfile[]>(FILE, []);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<FacultyProfile>;

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
  const body = (await req.json()) as Partial<FacultyProfile>;

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