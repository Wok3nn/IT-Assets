import { randomUUID } from "node:crypto";
import { ControlError } from "./control-store";

export async function presentationUploads(form: FormData) {
  const uploads: { key: "branding.logo.light" | "branding.logo.dark" | "branding.icon.light" | "branding.icon.dark"; name: string; base64: string }[] = [];
  for (const key of ["branding.logo.light", "branding.logo.dark", "branding.icon.light", "branding.icon.dark"] as const) {
    const file = form.get(key);
    if (!(file instanceof File) || !file.size) continue;
    if (file.size > 2 * 1024 * 1024) throw new ControlError("Branding uploads must be 2 MB or smaller.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const png = file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const ico = ["image/x-icon", "image/vnd.microsoft.icon"].includes(file.type) && bytes.subarray(0, 4).equals(Buffer.from([0,0,1,0]));
    if (!png && !(ico && key.startsWith("branding.icon."))) throw new ControlError("Use a PNG logo or PNG/ICO icon with a valid image signature.");
    uploads.push({ key, name: `${key.includes(".logo.") ? "logo" : "icon"}-${randomUUID()}.${png ? "png" : "ico"}`, base64: bytes.toString("base64") });
  }
  return uploads;
}
