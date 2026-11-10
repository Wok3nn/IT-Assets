// Preserve stored legacy URLs for rollback; translate only when serving managed UI.
export function managedBrandingUrl(value: string) {
  const match = /^\/branding\/uploads\/((?:logo|icon)-[a-f0-9-]{36}\.(?:png|ico))$/.exec(value);
  return match ? "/api/workspace-branding/" + match[1] : value;
}
