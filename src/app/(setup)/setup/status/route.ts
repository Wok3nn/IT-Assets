import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  control,
  controlCookie,
  managed,
} from "@/modules/database-management/control-store";
import { verifyReadiness } from "@/modules/database-management/setup-service";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!managed()) return new NextResponse(null, { status: 404 });
  const store = control();
  if (!store.authorized((await cookies()).get(controlCookie)?.value ?? ""))
    return new NextResponse(null, { status: 401 });
  try {
    const result = await store.exclusive(() => verifyReadiness(store));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        ready: false,
        message: "Another management operation is running. Waiting…",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
