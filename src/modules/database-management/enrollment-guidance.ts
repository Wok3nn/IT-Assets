import path from "node:path";

// This returns a path and shell commands only. It never opens the token file.
export function enrollmentGuidance(directory: string, platform = process.platform) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const tokenPath = paths.join(directory, "bootstrap-token");
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  return {
    tokenPath,
    localCommand: platform === "win32"
      ? "Get-Content -LiteralPath '" + tokenPath.replaceAll("'", "''") + "'"
      : "cat -- " + quote(tokenPath),
    shell: platform === "win32" ? "Windows PowerShell" : "Linux shell",
    dockerCommand: "docker compose -f docker/compose.managed.yml exec web sh -c "
      + quote('cat -- "$IT_ASSETS_CONTROL_DIR/bootstrap-token"'),
  };
}
