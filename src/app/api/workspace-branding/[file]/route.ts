import { readFile } from "node:fs/promises";
import path from "node:path";
import { control, managed } from "@/modules/database-management/control-store";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!managed() || !/^(logo|icon)-[a-f0-9-]{36}\.(png|ico)$/.test(file))
    return new Response(null, { status: 404 });
  const selection = control().state();
  if (
    !selection.active ||
    String(selection.revision) !== process.env.IT_ASSETS_REVISION
  )
    return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(
      path.join(process.env.APP_DATA_DIR!, "branding", file),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.endsWith(".png") ? "image/png" : "image/x-icon",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
