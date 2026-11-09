import type { ControlStore } from "../src/modules/database-management/control-store";
export function requiresInventory(pathname: string, managementPath: string): boolean;
export function managementBoundary(
  request: { method?: string; headers: Record<string, string | undefined> },
  response: {
    setHeader(name: string, value: string): void;
    writeHead(status: number, headers?: Record<string, string>): void;
    end(): void;
  },
  url: URL,
  store: Pick<ControlStore, "logout" | "authorized">,
  config: {
    managementPath: string;
    managementWorkspacePath: string;
    controlCookie: string;
    visitFingerprint(token: string): string;
    origin: string;
  },
): boolean;
