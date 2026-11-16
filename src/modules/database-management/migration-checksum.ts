import { createHash } from "node:crypto";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
// Verified historical Windows bytes: one CRLF plus 451 LF, identical SQL after
// newline normalization. Scope the exception to both identity AND current content.
export function migrationChecksumMatches(provider: string, name: string, sql: string, checksum: string) {
  const lf = sql.replace(/\r\n/g, "\n");
  if ([sql, lf, lf.replace(/\n/g, "\r\n")].some(value => sha256(value) === checksum)) return true;
  return provider === "sqlserver" && name === "20261105000000_inventory" &&
    sha256(lf) === "59d4f44d2e81890d05b0fdf5289c646eb5a2319a34da5403afb4b369509eb09e" &&
    checksum === "c6b8c50026d1be6eded4166c8c668ca5ff115789d4677f5e982c0f8ddca199a5";
}
