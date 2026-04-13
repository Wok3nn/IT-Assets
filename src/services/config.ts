function normalizeAppUrl(input: string) {
  return input.trim().replace(/\/+$/, "");
}

const resolvedAppUrl = normalizeAppUrl(process.env.APP_URL ?? "http://localhost:4050");

export const appConfig = {
  name: "IT-Asset-Tracker",
  containerName: "IT-Assets",
  port: Number(process.env.PORT ?? 4050),
  appUrl: resolvedAppUrl,
  useSecureCookies:
    process.env.SESSION_COOKIE_SECURE === "true" ||
    ((process.env.SESSION_COOKIE_SECURE ?? "auto") === "auto" && resolvedAppUrl.startsWith("https://")),
};

export function buildAppUrl(path = "/") {
  return new URL(path, `${appConfig.appUrl}/`);
}

