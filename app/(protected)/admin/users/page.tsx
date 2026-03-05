import BackTo from "@/components/nav/BackTo";

export default function AdminUsersPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <BackTo href="/admin" compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">User-management tools will be added here.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Placeholder panel for admin user controls.
      </div>
    </div>
  );
}
