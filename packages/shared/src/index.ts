import { z } from "zod";

export const ScriptLineSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  emotion: z.string().optional(),
});

export const ScriptSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
  lines: z.array(ScriptLineSchema),
});

export type Script = z.infer<typeof ScriptSchema>;

