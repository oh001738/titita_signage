import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "@/lib/store";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(name))
    return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(dataDir(), "uploads", name));
    return new Response(bytes, {
      headers: {
        "Content-Type": name.endsWith(".png")
          ? "image/png"
          : name.endsWith(".jpg")
            ? "image/jpeg"
            : "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
