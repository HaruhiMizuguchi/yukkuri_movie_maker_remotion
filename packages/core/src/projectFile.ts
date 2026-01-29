import type { PrismaClient } from "@prisma/client";
import type { ArtifactMetadata } from "@ymm/shared";

export type RegisterProjectFilesInput = {
  prisma: PrismaClient;
  jobId: string;
  stepName?: string | null;
  fileCategory?: "input" | "output" | "intermediate" | "final";
  artifacts: ArtifactMetadata[];
};

export async function registerProjectFiles({
  prisma,
  jobId,
  stepName,
  fileCategory = "output",
  artifacts,
}: RegisterProjectFilesInput): Promise<number> {
  if (artifacts.length === 0) {
    return 0;
  }

  const data = artifacts.map((artifact) => ({
    jobId,
    stepName: stepName ?? null,
    fileType: artifact.type,
    fileCategory: artifact.fileCategory ?? fileCategory,
    relativePath: artifact.relativePath,
    fileSizeBytes:
      artifact.fileSizeBytes !== undefined
        ? BigInt(artifact.fileSizeBytes)
        : undefined,
  }));

  const result = await prisma.projectFile.createMany({ data });
  return result.count;
}
