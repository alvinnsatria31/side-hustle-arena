import { z } from "zod";

const boundedText = (maximum: number) => z.string().trim().max(maximum);
const workspaceStepSchema = z.enum(["BRIEF", "PLAN", "WORK", "REVIEW", "SUBMIT"]);

export const projectSelectionSchema = z.object({
  projectId: z.uuid(),
}).strict();

export const enrollmentIdSchema = z.uuid();
export const projectSlugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const divisionSlugSchema = projectSlugSchema;

export const workspacePatchSchema = z.object({
  currentStep: workspaceStepSchema.optional(),
  planText: boundedText(20_000).nullable().optional(),
  tools: z.array(boundedText(120)).max(50).nullable().optional(),
  taskBreakdown: z.array(z.object({
    title: boundedText(500),
    done: z.boolean(),
  }).strict()).max(100).nullable().optional(),
  notes: boundedText(20_000).nullable().optional(),
  reviewChecklist: z.array(z.object({
    label: boundedText(500),
    done: z.boolean(),
  }).strict()).max(100).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one workspace field is required.");

export type ProjectSelectionInput = z.infer<typeof projectSelectionSchema>;
export type WorkspacePatchInput = z.infer<typeof workspacePatchSchema>;
