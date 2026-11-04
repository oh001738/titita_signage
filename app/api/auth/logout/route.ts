import { cookies } from "next/headers";
import { cookieOptions, requireAdmin } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    (await cookies()).set("signage_admin", "", {
      ...cookieOptions(),
      maxAge: 0,
    });
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
