import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Display } from "@/components/Display";
import { Preview } from "@/components/Preview";
export const dynamic = "force-dynamic";
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; player?: string }>;
}) {
  if (!(await isAdmin())) redirect("/login");
  const query = await searchParams;
  const source = query.source === "published" ? "published" : "draft";
  if (query.player === "1")
    return <Display mode="preview" previewSource={source} />;
  return <Preview initialSource={source} />;
}
