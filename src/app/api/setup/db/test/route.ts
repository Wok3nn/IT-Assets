import { NextResponse } from "next/server";

// The retired experimental wizard performed privileged operations before login.
export function POST() {
  return NextResponse.json({ error: "Use the authenticated Database Management page in managed mode." }, { status: 410 });
}
