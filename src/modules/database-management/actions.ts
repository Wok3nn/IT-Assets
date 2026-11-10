"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  control,
  controlCookie,
  ControlError,
  managementPath,
  managementWorkspacePath,
  profileSchema,
} from "./control-store";
import { initializeProfile } from "./schema-service";
import { hashPassword } from "../../services/password";
import { setupPath, setupWorkspacePath } from "./setup-state";
import { inspectConnection } from "./setup-service";
export async function databaseAction(form: FormData) {
  return execute(form);
}
export async function submitDatabaseAction(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string; fields?: Record<string, string> }> {
  return execute(form, true);
}
async function execute(
  form: FormData,
  returnErrors = false,
): Promise<{ error: string; fields?: Record<string, string> }> {
  const origin = (await headers()).get("origin");
  if (origin !== new URL(process.env.APP_URL || "http://localhost:4050").origin)
    throw new Error("Invalid request origin.");
  const v = (key: string) => String(form.get(key) ?? "");
  const op = v("op"),
    id = v("id");
  const store = control(),
    jar = await cookies();
  const token = jar.get(controlCookie)?.value ?? "";
  let message = "Operation completed.";
  const wizard = v("context") === "setup";
  const entry = wizard ? setupPath : managementPath;
  let destination = wizard ? setupWorkspacePath : managementWorkspacePath;
  let step = v("step") || "3";
  let activationRevision: number | undefined;
  try {
    if (op === "enroll") {
      if (v("password") !== v("confirmPassword"))
        throw new ControlError("Passwords do not match.");
      store.enroll(v("bootstrap"), v("email"), v("password"), {
        siteName: v("siteName"),
        appTitle: v("appTitle"),
      });
      message = "Administrator registered. Sign in to continue.";
      destination = entry;
    } else if (op === "login") {
      store.logout(token);
      const session = store.login(v("email"), v("password"));
      jar.set(controlCookie, session, {
        httpOnly: true,
        secure: origin.startsWith("https:"),
        sameSite: "strict",
        path: "/",
        maxAge: 3600,
      });
      message = "Signed in.";
      step = store.resumeStep();
    } else {
      if (!store.authorized(token)) {
        destination = entry;
        throw new ControlError("Sign in as the installation administrator.");
      }
      if (op === "logout" || op === "exit") {
        store.logout(token);
        jar.set(controlCookie, "", { path: "/", maxAge: 0 });
        message = "Signed out.";
        destination =
          op === "logout"
            ? entry
            : store.state().active && v("destination") === "settings"
              ? "/settings"
              : store.state().active && v("destination") === "inventory"
                ? "/"
                : setupPath;
      } else if (op === "organization") {
        store.saveOrganization(
          { siteName: v("siteName"), appTitle: v("appTitle") },
          v("organizationVersion"),
        );
        message =
          "Installation settings saved. Existing workspace branding was not changed.";
        step = "1";
      } else
        await store.exclusive(async () => {
          const current = store.state();
          if (
            id &&
            store.profiles().find((profile) => profile.id === id)?.version !==
              v("version")
          )
            throw new ControlError(
              "This connection changed. Reload and verify its server and database.",
            );
          if (v("revision") !== String(current.revision))
            throw new ControlError(
              "Selection changed. Reload before continuing.",
            );
          if (op === "save") {
            const before = id ? store.profile(id) : null;
            if (
              before &&
              (before.host !== v("host") ||
                before.port !== Number(v("port")) ||
                before.database !== v("database") ||
                before.provider !== v("provider")) &&
              (!v("username") || !v("password"))
            )
              throw new ControlError(
                "Re-enter both credentials when changing the target database or server.",
              );
            const password = v("password") || before?.password || "";
            store.save(
              profileSchema.parse({
                name: v("name"),
                provider: v("provider"),
                host: v("host"),
                port: v("port"),
                database: v("database"),
                username: v("username") || before?.username || "",
                password,
                trustCertificate: v("trust") === "on",
              }),
              id || undefined,
            );
            message = "Profile saved.";
            step = "3";
            return;
          }
          if (op === "remove") {
            store.remove(id);
            message = "Inactive profile removed.";
            return;
          }
          const p = store.profile(id);
          if (["test", "inspect", "validate"].includes(op)) {
            const status = await inspectConnection(store, id);
            store.audit("connection and schema inspected", id);
            message =
              "Connected — " + status + " database. No records changed.";
            step = wizard && v("step") === "4" ? "4" : "3";
            return;
          }
          if (v("confirm") !== p.database)
            throw new ControlError(
              "Enter the exact target database name to confirm.",
            );
          if (op === "activate") {
            if (id === current.active)
              throw new ControlError("This profile is already active.");
            if ((await inspectConnection(store, id)) !== "compatible")
              throw new ControlError(
                "Activation requires a compatible initialized database.",
              );
            if (!store.authorized(token))
              throw new ControlError("Session expired. Sign in again.");
            store.activate(id, current.revision);
            activationRevision = current.revision + 1;
            step = "4";
            message =
              "Selection saved. Waiting for application restart and readiness verification.";
            return;
          }
          if (op === "initialize") {
            if (id === current.active)
              throw new ControlError("Cannot initialize an active profile.");
            const email = z
              .string()
              .email()
              .max(191)
              .parse(v("workspaceEmail"))
              .toLowerCase();
            const password = z
              .string()
              .min(14)
              .max(128)
              .parse(v("workspacePassword"));
            if (password !== v("workspaceConfirmPassword"))
              throw new ControlError("Workspace passwords do not match.");
            store.audit("initialization requested", id);
            await initializeProfile(
              p,
              email,
              hashPassword(password),
              store.organization() ?? undefined,
            );
            store.audit("initialization completed", id);
            if ((await inspectConnection(store, id, true)) !== "compatible")
              throw new ControlError(
                "Initialization finished but compatibility was not confirmed. Inspect before proceeding; do not retry initialization.",
              );
            step = "4";
            message =
              "Schema and workspace administrator created. Inspect, then activate.";
            return;
          }
          throw new ControlError("Unknown operation.");
        });
    }
  } catch (e) {
    if (!store.authorized(token)) destination = entry;
    if (e instanceof ControlError) message = e.message;
    else if (e instanceof z.ZodError)
      message =
        "Check the indicated values: " +
        e.issues.map((i) => i.path.join(".") || "input").join(", ") +
        ".";
    else {
      const failure = e as { code?: string; errorCode?: string };
      const diagnostics: Record<string, string> = {
        P1000: "SQL authentication failed. Verify the login and password.",
        P1001:
          "Server unreachable. Check hostname, TCP port, TCP/IP enablement and firewall.",
        P1002: "Server connection timed out.",
        P1003:
          "The named database does not exist. Create the empty database first.",
        P1010: "The login lacks access to this database.",
        P1011:
          "TLS negotiation failed. Verify the server name, certificate chain and trust store.",
      };
      message =
        diagnostics[failure.errorCode ?? failure.code ?? ""] ??
        "Operation failed. Check network/TLS, login, database permissions and migration state. No selection change was made.";
    }
    if (store.authorized(token))
      store.audit(
        "operation failed",
        [
          "initialize",
          "activate",
          "save",
          "test",
          "inspect",
          "remove",
        ].includes(op)
          ? op
          : null,
      );
    if (returnErrors) return {
      error: message,
      fields: e instanceof z.ZodError
        ? Object.fromEntries(e.issues.map(issue => [String(issue.path[0]), issue.message]))
        : undefined,
    };
  }
  redirect(
    destination +
      "?message=" +
      encodeURIComponent(message) +
      (wizard && destination === setupWorkspacePath
        ? "&step=" + encodeURIComponent(step)
        : "") +
      (!wizard && activationRevision !== undefined
        ? "&activationProfile=" + encodeURIComponent(id) + "&activationRevision=" + activationRevision
        : ""),
  );
}
