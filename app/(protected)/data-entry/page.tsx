import { redirect } from "next/navigation";
import { dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

/**
 * The /data-entry index page is no longer used.
 * The dashboard serves as the single hub for category navigation.
 * Redirect any direct visits or bookmarks to the dashboard.
 */
export default function DataEntryHomePage() {
  redirect(dashboard());
}
