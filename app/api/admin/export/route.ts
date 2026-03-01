import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readJson } from "@/lib/storage";
import { getAllProfiles } from "@/lib/profileStore";

type AdminsFile = { admins: string[] };

function csvEscape(s: string) {
  const v = String(s ?? "");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET() {
  const session = await getServerSession();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admins = await readJson<AdminsFile>("admins.json", { admins: [] });
  if (!admins.admins.map((x) => x.toLowerCase()).includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await getAllProfiles();
  const rows = Object.values(all);

  const header = [
    "email",
    "userPreferredName",
    "dob",
    "bloodGroup",
    "dateOfJoiningTce",
    "designation",
    "phdStatus",
    "theme",
    "outsideCount",
    "industryCount",
    "lopCount"
  ];

  const csv = [
    header.join(","),
    ...rows.map((p) => [
      p.email,
      p.userPreferredName,
      p.personal?.dob ?? "",
      p.personal?.bloodGroup ?? "",
      p.academic?.dateOfJoiningTce ?? "",
      p.academic?.designation ?? "",
      p.academic?.phdStatus ?? "",
      p.settings?.theme ?? "light",
      String(p.experience?.academicOutside?.length ?? 0),
      String(p.experience?.industry?.length ?? 0),
      String(p.experience?.lop?.length ?? 0),
    ].map(csvEscape).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="tseda_profiles.csv"`,
    },
  });
}