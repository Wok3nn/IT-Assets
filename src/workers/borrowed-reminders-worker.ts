import { loadEnvConfig } from "@next/env";

const DEFAULT_POLL_INTERVAL_MS = 30 * 60 * 1000;
const MIN_POLL_INTERVAL_MS = 60 * 1000;

loadEnvConfig(process.cwd());

function parsePollInterval() {
  const parsed = Number(process.env.BORROWED_REMINDER_POLL_INTERVAL_MS);

  if (!Number.isInteger(parsed) || parsed < MIN_POLL_INTERVAL_MS) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  return parsed;
}

function isDryRun() {
  return process.env.BORROWED_REMINDER_DRY_RUN === "true" || process.argv.includes("--dry-run");
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function runOnce() {
  const { processBorrowedItemReminders } = await import("@/modules/borrowed-items/borrowed-item-reminders.service");
  const summary = await processBorrowedItemReminders({ dryRun: isDryRun() });
  console.log(
    `Borrowed reminder cycle complete: dryRun=${summary.dryRun} eligible=${summary.eligible} claimed=${summary.claimed} attempted=${summary.attempted} sent=${summary.sent} failed=${summary.failed} skipped=${summary.skipped}`,
  );
}

async function main() {
  const once = process.argv.includes("--once");
  const pollInterval = parsePollInterval();
  let shuttingDown = false;
  let running = false;

  const shutdown = (signal: string) => {
    console.log(`Borrowed reminder worker received ${signal}; shutting down after current cycle.`);
    shuttingDown = true;
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  console.log(`Borrowed reminder worker started. dryRun=${isDryRun()} pollIntervalMs=${pollInterval}`);

  do {
    if (!running) {
      running = true;
      try {
        await runOnce();
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Borrowed reminder cycle failed.");
        if (once) {
          throw error;
        }
      } finally {
        running = false;
      }
    }

    if (once || shuttingDown) {
      break;
    }

    await wait(pollInterval);
  } while (!shuttingDown);

  console.log("Borrowed reminder worker stopped.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
