export function checkRealE2ePrereqs(): Promise<any>;
export function parsePostgresEndpoint(databaseUrl: string): { host: string; port: number } | null;
export function redactDatabaseUrl(databaseUrl: string): string;
