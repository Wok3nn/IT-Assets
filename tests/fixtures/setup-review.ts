// Synthetic control-store-only fixture. Never inspect or connect to a database.
import { ControlStore } from "../../src/modules/database-management/control-store";
import path from "node:path";
import { tmpdir } from "node:os";
const directory = process.argv[2];
if (!directory || path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith("it-assets-http-")) throw new Error("Expected an isolated HTTP fixture directory");
const store = new ControlStore(directory);
try {
  const profile = store.profiles().find(item => item.id === process.argv[3]);
  if (!profile || profile.host !== "127.0.0.1" || profile.port !== 1 || profile.database !== "it_assets_offline_test") throw new Error("Expected the offline fixture profile");
  const id = store.captureConfigurationReview(profile.id, profile.version, {
    format: 1, source: { provider: profile.provider, host: profile.host, port: profile.port, database: profile.database },
    settings: { "app.title": "Imported fixture", "session.timeoutMinutes": "30" },
    branding: [], timeZone: "UTC", settingsKeyHash: null,
  });
  console.log(id);
} finally { store.close(); }
