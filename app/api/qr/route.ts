import QRCode from "qrcode";
export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("url") ?? "";
  if (!/^https?:\/\//.test(value) || value.length > 1000)
    return new Response(null, { status: 400 });
  const bytes = await QRCode.toBuffer(value, {
    width: 220,
    margin: 2,
    color: { dark: "#153f3b", light: "#ffffff" },
  });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
