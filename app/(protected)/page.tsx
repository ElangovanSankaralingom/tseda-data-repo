import { redirect } from "next/navigation";
import { dashboard } from "@/lib/entryNavigation";

export default function ProtectedIndexPage() {
  redirect(dashboard());
}
