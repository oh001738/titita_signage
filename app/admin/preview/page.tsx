import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Display } from "@/components/Display";
export const dynamic = "force-dynamic";
export default async function PreviewPage() {
  if (!(await isAdmin())) redirect("/login");
  return <Display mode="preview" />;
}
