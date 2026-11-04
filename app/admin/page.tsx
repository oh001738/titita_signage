import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Admin } from "@/components/Admin";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/login");
  return <Admin />;
}
