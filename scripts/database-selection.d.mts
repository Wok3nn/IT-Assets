export function assertScriptDatabaseSelection(options?: { workspaceDir?: string; env?: Record<string, string | undefined> }): {
  provider: string;
  schemaPath: string;
  providerMigrationsPath: string;
};
