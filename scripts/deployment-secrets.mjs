import { readFileSync } from "node:fs";

// Only explicitly named deployment secrets; never load ambient .env files.
export function loadDeploymentSecrets(env = process.env) {
  const names = ["APP_SETTINGS_ENCRYPTION_KEY", "IT_ASSETS_MANAGED_SETTINGS_KEY",
    ...Object.keys(env).filter(key => /^IT_ASSETS_ENTRA_SECRET_[A-Z0-9_]+_FILE$/.test(key)).map(key => key.slice(0, -5))];
  for (const name of new Set(names)) {
    if (!env[name + "_FILE"]) continue;
    if (env[name]) throw new Error(`Configure only ${name} or ${name}_FILE.`);
    let value;
    try { value = readFileSync(env[name + "_FILE"], "utf8").trim(); }
    catch { throw new Error(`Cannot read deployment secret ${name}_FILE.`); }
    if (!value || value.length > 16384) throw new Error(`Invalid deployment secret ${name}_FILE.`);
    env[name] = value;
  }
  return env;
}
