import { redirect } from "next/navigation";
import { dashboard } from "@/lib/navigation";

export default function ProtectedIndexPage() {
  redirect(dashboard());
}
