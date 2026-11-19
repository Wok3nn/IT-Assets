// Image-build check only: no app startup, secrets, database access or writes.
import { accessSync, constants, readdirSync, statSync } from "node:fs";
import path from "node:path";

if (process.getuid?.() !== 1000) throw new Error("Run the image permission check as UID 1000");

function checkTree(target, writable = false, ancestors = new Set()) {
  const stat = statSync(target); // Also checks symlink targets, including package bin links.
  accessSync(target, constants.R_OK | (stat.isDirectory() ? constants.X_OK : 0));
  if (writable) {
    accessSync(target, constants.W_OK);
  } else {
    let canWrite = true;
    try { accessSync(target, constants.W_OK); } catch { canWrite = false; }
    if (canWrite) throw new Error(`Runtime code must not be writable: ${target}`);
  }
  if (stat.isFile() && (stat.mode & 0o111)) accessSync(target, constants.X_OK);
  if (!stat.isDirectory()) return;
  const identity = `${stat.dev}:${stat.ino}`;
  if (ancestors.has(identity)) throw new Error(`Directory symlink cycle: ${target}`);
  const next = new Set(ancestors).add(identity);
  for (const entry of readdirSync(target)) checkTree(path.join(target, entry), writable, next);
}

// Enumerate the entire final /app so future COPY additions are checked too.
accessSync("/app", constants.R_OK | constants.X_OK);
let appWritable = true;
try { accessSync("/app", constants.W_OK); } catch { appWritable = false; }
if (appWritable) throw new Error("Runtime application directory must not be writable");
for (const required of ["src", "scripts", "prisma", "public", "node_modules", ".next-managed", "package.json", "tsconfig.json", "next.config.ts", "prisma.managed.config.ts"]) {
  accessSync(`/app/${required}`, constants.R_OK);
}
for (const entry of readdirSync("/app")) checkTree(`/app/${entry}`, entry === ".next-managed");
accessSync("/data", constants.X_OK);
checkTree("/data/control", true);
console.log("Managed image assets readable; code immutable; runtime storage writable as UID 1000.");
