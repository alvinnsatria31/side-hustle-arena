import type { GenerationContext, GenerationProvider } from "./core";

/**
 * Concrete AI generation provider (OpenAI-compatible chat completions).
 *
 * The weekly generator speaks only the GenerationProvider interface, so this
 * adapter is configuration, not surgery: when AI_API_BASE_URL + AI_API_KEY +
 * AI_GENERATION_MODEL are set (copy them from the Hermes VPS — see
 * docs/backend/HERMES_EVAL_CONTRACT.md for where the key lives), the Monday
 * cron generates with the model; otherwise generation runs library-only and
 * says so honestly. chooseCandidate() validates every output against
 * validatePackage() and falls back to the library on any failure, so a bad
 * model response can never publish an invalid project.
 */

export interface AiGenerationConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const GENERATION_INSTRUCTION = `You design one weekly real-world project for a talent arena. Return ONLY a JSON object with exactly these keys: divisionId, title, shortDescription, caseBackground, roleDescription, objective, mission, difficulty ("STANDARD" only), estimatedMinutes (120..960 integer), skills (1..20 items: skillId from the allowed list, weight 1..100), rubric (use the frozen base rubric names/weights/maxScores verbatim, in order; only description and reviewInstruction may be elaborated), requirements (1..10 deliverables: label, type FILE or LINK, required boolean, minItems 0..5, maxItems 1..5, allowedMimeTypes from the allowed list for FILE, allowedLinkTypes for LINK, instructions; at least one deliverable required), resources (at most 20: label plus credential-free HTTPS url), fingerprint (industry, role, coreSkill, secondarySkill, scenarioType, decisionType, primaryDeliverable, inputDataType, targetStakeholder, toolCategory — short labels that distinguish this project from recent history). Write all prose in Indonesian. Never require confidential, paid, or video materials. Never invent skill IDs.`;

export class AiGenerationProvider implements GenerationProvider {
  readonly name = "openai-compatible-generation";
  private readonly config: AiGenerationConfig;
  private readonly transport: typeof fetch;

  constructor(config: AiGenerationConfig, transport: typeof fetch = fetch) {
    const url = new URL(config.baseUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("AI provider must use HTTPS.");
    }
    if (!config.model.trim()) throw new Error("AI generation model is not configured.");
    this.config = config;
    this.transport = transport;
  }

  async generate(input: {
    context: GenerationContext;
    history: unknown[];
    attempt: number;
    signal: AbortSignal;
  }): Promise<unknown> {
    const response = await this.transport(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      signal: input.signal,
      body: JSON.stringify({
        model: this.config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: GENERATION_INSTRUCTION },
          {
            role: "user",
            content: JSON.stringify({
              divisionId: input.context.divisionId,
              divisionName: input.context.divisionName ?? null,
              weekCode: input.context.weekCode ?? null,
              allowedSkillIds: input.context.skillIds,
              baseRubric: input.context.baseRubric,
              recentHistory: input.history,
              attempt: input.attempt,
            }),
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI provider request failed (${response.status}).`);
    const body = await response.text();
    if (body.length > 1_000_000) throw new Error("AI provider response too large.");
    const payload = JSON.parse(body) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const choice = payload.choices?.[0];
    if (!choice?.message?.content || choice.finish_reason === "length") {
      throw new Error("AI provider returned incomplete output.");
    }
    return JSON.parse(choice.message.content) as unknown;
  }
}

/** Null when the Hermes-provisioned key is absent: generation runs library-only. */
export function createGenerationProvider(env: NodeJS.ProcessEnv = process.env): GenerationProvider | null {
  if (!env.AI_API_BASE_URL || !env.AI_API_KEY || !env.AI_GENERATION_MODEL) return null;
  return new AiGenerationProvider({
    baseUrl: env.AI_API_BASE_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_GENERATION_MODEL,
  });
}
