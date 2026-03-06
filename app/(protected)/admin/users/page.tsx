import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import BackTo from "@/components/nav/BackTo";
import { authOptions } from "@/lib/auth";
import { MASTER_ADMIN_EMAIL } from "@/lib/admin";
import {
  canManageAdminUsers,
  getAdminUsersConfig,
  removeAdminUser,
  type AdminRole,
  upsertAdminUser,
} from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, adminUsers, dashboard } from "@/lib/navigation";
import { getButtonClass } from "@/lib/ui/buttonRoles";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminUsersPageProps = {
  searchParams?: Promise<SearchParams>;
};

const ROLE_OPTIONS: Array<{ role: AdminRole; label: string }> = [
  { role: "MASTER_ADMIN", label: "Master Admin" },
  { role: "REVIEWER", label: "Reviewer" },
  { role: "EXPORT_ADMIN", label: "Export Admin" },
  { role: "DEPARTMENT_ADMIN", label: "Department Admin" },
];

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function isAdminRole(value: string): value is AdminRole {
  return ROLE_OPTIONS.some((item) => item.role === value);
}

function parseRoles(formData: FormData) {
  const roles = new Set<AdminRole>();
  for (const raw of formData.getAll("roles")) {
    const normalized = String(raw ?? "").trim().toUpperCase();
    if (!normalized) continue;
    if (isAdminRole(normalized)) roles.add(normalized);
  }
  return Array.from(roles);
}

function noticeUrl(level: "ok" | "error", message: string) {
  const params = new URLSearchParams({ level, notice: message });
  return `${adminUsers()}?${params.toString()}`;
}

async function requireUsersAdmin() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canManageAdminUsers(email)) {
    redirect(dashboard());
  }
  return email;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requireUsersAdmin();

  const params = searchParams ? await searchParams : {};
  const notice = getParam(params, "notice");
  const level = getParam(params, "level");

  async function upsertAdminUserAction(formData: FormData) {
    "use server";
    await requireUsersAdmin();

    const email = normalizeEmail(String(formData.get("email") ?? ""));
    if (!email) {
      redirect(noticeUrl("error", "Email is required."));
    }

    const roles = parseRoles(formData);
    if (roles.length === 0 && email !== MASTER_ADMIN_EMAIL) {
      redirect(noticeUrl("error", "Select at least one role."));
    }

    const departmentRaw = String(formData.get("department") ?? "").trim();
    const department = departmentRaw ? departmentRaw : null;

    upsertAdminUser({
      email,
      roles,
      department,
    });

    redirect(noticeUrl("ok", `Updated roles for ${email}.`));
  }

  async function removeAdminUserAction(formData: FormData) {
    "use server";
    await requireUsersAdmin();

    const email = normalizeEmail(String(formData.get("email") ?? ""));
    if (!email) {
      redirect(noticeUrl("error", "Email is required."));
    }
    if (email === MASTER_ADMIN_EMAIL) {
      redirect(noticeUrl("error", "Master admin cannot be removed."));
    }

    removeAdminUser(email);
    redirect(noticeUrl("ok", `Removed admin access for ${email}.`));
  }

  const config = getAdminUsersConfig();
  const users = config.users;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <BackTo href={adminHome()} compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign admin roles. Master admin access is always retained for {MASTER_ADMIN_EMAIL}.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          className={
            level === "ok"
              ? "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {notice}
        </div>
      ) : null}

      <div className="mb-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Add / Update Admin User</h2>
        <form action={upsertAdminUserAction} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Email</span>
              <input
                type="email"
                name="email"
                placeholder="faculty@tce.edu"
                required
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Department (optional)</span>
              <input
                type="text"
                name="department"
                placeholder="Architecture"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            {ROLE_OPTIONS.map((role) => (
              <label key={role.role} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="roles" value={role.role} className="h-4 w-4" />
                <span>{role.label}</span>
              </label>
            ))}
          </div>
          <button type="submit" className={getButtonClass("context")}>
            Save Admin Roles
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-medium">Configured Admin Users</div>
        {users.length === 0 ? (
          <div className="text-sm text-muted-foreground">No admin users configured.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Department</th>
                  <th className="px-2 py-2 font-medium">Roles</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email} className="border-b border-border/60 align-top">
                    <td className="px-2 py-2 font-medium">{user.email}</td>
                    <td className="px-2 py-2">{user.department || "-"}</td>
                    <td className="px-2 py-2">
                      <form action={upsertAdminUserAction} className="space-y-2">
                        <input type="hidden" name="email" value={user.email} />
                        <input type="hidden" name="department" value={user.department ?? ""} />
                        <div className="flex flex-wrap gap-3">
                          {ROLE_OPTIONS.map((role) => (
                            <label key={`${user.email}:${role.role}`} className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="roles"
                                value={role.role}
                                defaultChecked={user.roles.includes(role.role)}
                                disabled={user.email === MASTER_ADMIN_EMAIL && role.role === "MASTER_ADMIN"}
                                className="h-4 w-4"
                              />
                              <span>{role.label}</span>
                            </label>
                          ))}
                        </div>
                        <button type="submit" className={getButtonClass("ghost")}>
                          Update Roles
                        </button>
                      </form>
                    </td>
                    <td className="px-2 py-2">
                      {user.email === MASTER_ADMIN_EMAIL ? (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          Locked Master Admin
                        </span>
                      ) : (
                        <form action={removeAdminUserAction}>
                          <input type="hidden" name="email" value={user.email} />
                          <button type="submit" className={getButtonClass("destructive")}>
                            Remove
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
