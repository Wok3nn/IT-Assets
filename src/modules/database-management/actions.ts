"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  control,
  controlCookie,
  ControlError,
  managementPath,
  profileSchema,
} from "./control-store";
import {
  checkProfile,
  initializeProfile,
  testConnection,
} from "./schema-service";
import { hashPassword } from "../../services/password";
export async function databaseAction(form: FormData) {
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
  try {
    if (op === "enroll") {
      store.enroll(v("bootstrap"), v("email"), v("password"));
      message = "Administrator registered. Sign in to continue.";
    } else if (op === "login") {
      const session = store.login(v("email"), v("password"));
      jar.set(controlCookie, session, {
        httpOnly: true,
        secure: origin.startsWith("https:"),
        sameSite: "strict",
        path: managementPath,
        maxAge: 3600,
      });
      message = "Signed in.";
    } else {
      if (!store.authorized(token))
        throw new ControlError("Sign in as the installation administrator.");
      if (op === "logout") {
        store.logout(token);
        jar.set(controlCookie, "", { path: managementPath, maxAge: 0 });
        message = "Signed out.";
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
            return;
          }
          if (op === "remove") {
            store.remove(id);
            message = "Inactive profile removed.";
            return;
          }
          const p = store.profile(id);
          if (op === "test") {
            await testConnection(p);
            store.audit("connection verified", id);
            message = "Connectivity verified. No data changed.";
            return;
          }
          if (op === "inspect") {
            message = "Schema: " + (await checkProfile(p));
            return;
          }
          if (v("confirm") !== p.database)
            throw new ControlError(
              "Enter the exact target database name to confirm.",
            );
          if (op === "activate") {
            if (id === current.active)
              throw new ControlError("This profile is already active.");
            if ((await checkProfile(p)) !== "compatible")
              throw new ControlError(
                "Activation requires a compatible initialized database.",
              );
            if (!store.authorized(token))
              throw new ControlError("Session expired. Sign in again.");
            store.activate(id, current.revision);
            message =
              "Selection saved. Reopen the inventory after the server restarts.";
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
            store.audit("initialization requested", id);
            await initializeProfile(p, email, hashPassword(password));
            store.audit("initialization completed", id);
            message =
              "Schema and workspace administrator created. Inspect, then activate.";
            return;
          }
          throw new ControlError("Unknown operation.");
        });
    }
  } catch (e) {
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
  }
  redirect(managementPath + "?message=" + encodeURIComponent(message));
}
