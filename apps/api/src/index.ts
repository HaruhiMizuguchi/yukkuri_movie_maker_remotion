import "dotenv/config";
import Fastify from "fastify";
import PgBoss from "pg-boss";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});
const env = envSchema.parse(process.env);

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

const createJobBody = z.object({
  theme: z.string().optional(),
  mode: z.string().optional().default("full"),
});

app.post("/api/jobs", async (req, reply) => {
  const body = createJobBody.parse(req.body ?? {});

  const project = await prisma.project.create({
    data: { theme: body.theme ?? null },
  });

  const job = await prisma.job.create({
    data: {
      projectId: project.id,
      mode: body.mode,
    },
  });

  // enqueue background execution
  await boss.send("yukkuri.render", { jobId: job.id });

  return reply.code(201).send({ projectId: project.id, jobId: job.id });
});

app.get("/api/jobs/:jobId", async (req) => {
  const params = z.object({ jobId: z.string().uuid() }).parse(req.params);
  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: { steps: true, files: true, project: true },
  });
  return job ?? { error: "not_found" };
});

async function main() {
  await boss.start();
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen({ port, host: "127.0.0.1" });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

