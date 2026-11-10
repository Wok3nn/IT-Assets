// SHOW GRANTS retains escaped underscores used by the official MariaDB image.
// Recognize only the exact target scope (or global scope), never table-level grants.
export function coversMariaDatabase(scope: string, database: string) {
  const normalized = scope.replaceAll("`", "").replaceAll("\\_", "_");
  return normalized === database + ".*" || normalized === "*.*";
}
