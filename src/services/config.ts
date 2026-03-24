export const appConfig = {
  name: "IT-Asset-Tracker",
  containerName: "IT-Assets",
  port: Number(process.env.PORT ?? 4050),
  appUrl: process.env.APP_URL ?? "http://localhost:4050",
  useSecureCookies:
    process.env.SESSION_COOKIE_SECURE === "true" ||
    ((process.env.SESSION_COOKIE_SECURE ?? "auto") === "auto" &&
      (process.env.APP_URL ?? "http://localhost:4050").startsWith("https://")),
};

