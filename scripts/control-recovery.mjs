import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import storeModule from "../src/modules/database-management/control-store.ts";
const directory = path.resolve(
  process.env.IT_ASSETS_CONTROL_DIR || ".managed-data",
);
const [operation, confirmation] = process.argv.slice(2);
if (
  !["unlock", "password"].includes(operation) ||
  confirmation !== "--offline-confirmed"
)
  throw new Error(
    "Stop all managed web/CLI processes, then specify unlock|password --offline-confirmed.",
  );
if (!existsSync(path.join(directory, "control.sqlite")))
  throw new Error("Control database not found.");
const lock = new DatabaseSync(path.join(directory, "owner.sqlite"));
try {
  lock.exec("BEGIN EXCLUSIVE");
  const store = new storeModule.ControlStore(directory);
  try {
    store.recover(operation, process.env.IT_ASSETS_NEW_OPERATOR_PASSWORD);
    console.log("Offline control recovery completed.");
  } finally {
    store.close();
  }
} finally {
  lock.close();
}
