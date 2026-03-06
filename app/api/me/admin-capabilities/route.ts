import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  canAccessAdminConsole,
  canAccessAdminSearch,
  canApproveConfirmations,
  canExport,
  canManageAdminUsers,
  canManageBackups,
  canRunIntegrityTools,
  canRunMaintenance,
  canViewAnalytics,
  canViewAudit,
  canAccessSettings,
  isMasterAdmin,
} from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email) {
    return NextResponse.json(
      {
        canAccessAdminConsole: false,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      email,
      isMasterAdmin: isMasterAdmin(email),
      canAccessAdminConsole: canAccessAdminConsole(email),
      canApproveConfirmations: canApproveConfirmations(email),
      canExport: canExport(email),
      canRunIntegrityTools: canRunIntegrityTools(email),
      canManageBackups: canManageBackups(email),
      canViewAudit: canViewAudit(email),
      canViewAnalytics: canViewAnalytics(email),
      canAccessAdminSearch: canAccessAdminSearch(email),
      canAccessSettings: canAccessSettings(email),
      canManageAdminUsers: canManageAdminUsers(email),
      canRunMaintenance: canRunMaintenance(email),
    },
    { status: 200 }
  );
}
