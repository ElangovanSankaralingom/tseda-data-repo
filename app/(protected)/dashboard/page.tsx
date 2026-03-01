export default function DashboardPage() {
  return (
    <div className="rounded-2xl border border-border bg-white/70 dark:bg-black/20 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You’re signed in. Use the menu to open <b>My Account</b> and manage your profile.
      </p>
    </div>
  );
}