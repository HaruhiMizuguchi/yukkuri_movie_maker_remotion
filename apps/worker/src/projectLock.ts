import { Client } from "pg";

type LockClient = Pick<Client, "connect" | "query" | "end">;

export const withProjectAdvisoryLock = async <T>(
  connectionString: string,
  projectId: string,
  task: () => Promise<T>,
  clientFactory: () => LockClient = () => new Client({ connectionString }),
): Promise<T> => {
  const client = clientFactory();
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [
      projectId,
    ]);
    return await task();
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
        projectId,
      ]);
    } finally {
      await client.end();
    }
  }
};
