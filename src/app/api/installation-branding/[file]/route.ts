import { control, managed } from "@/modules/database-management/control-store";
import { brandingResponse } from "@/modules/database-management/installation-presentation";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!managed() || !control().presentationRuntime()) return new Response(null, { status: 404 });
  // Only currently published branding is public, as required on sign-in screens.
  return brandingResponse(control().installationConfiguration(), file);
}
