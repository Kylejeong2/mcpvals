import { generateText, LanguageModelV1 } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { TraceStore } from "../core/trace.js";
import { ConversationMessage } from "../../types/trace.js";
import { Workflow } from "../core/config.js";
import { LlmJudgeArgs, LlmJudgeResult } from "../../types/evaluation.js";

/**
 * Build a conversation dump from the trace store
 */
function buildConversationDump(
  traceStore: TraceStore,
  maxMessages?: number,
): string {
  const messages = traceStore.getConversation();
  const messagesToInclude = maxMessages ? messages.slice(-maxMessages) : messages;

  // Build a lookup for tool calls by id to resolve toolCallIds
  const toolCallsById = new Map(
    traceStore.getToolCalls().map((tc) => [tc.id, tc]),
  );

  return messagesToInclude
    .map((msg: ConversationMessage) => {
      let content = `${msg.role.toUpperCase()}: ${msg.content}`;

      // Prefer explicit toolCalls if provided, otherwise resolve via toolCallIds
      const associatedToolCalls = Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0
        ? msg.toolCalls
        : Array.isArray(msg.toolCallIds) && msg.toolCallIds.length > 0
          ? msg.toolCallIds
              .map((id) => toolCallsById.get(id))
              .filter((x): x is NonNullable<typeof x> => Boolean(x))
          : [];

      if (associatedToolCalls.length > 0) {
        content += "\nTOOL CALLS:";
        associatedToolCalls.forEach((call) => {
          content += `\n  - ${call.name}(${JSON.stringify(call.arguments)})`;
        });
      }

      return content;
    })
    .join("\n\n");
}

/**
 * Build the LLM judge prompt
 */
function buildPrompt(workflow: Workflow, conversationDump: string): string {
  // Get expected state from the last step if available
  const lastStep = workflow.steps[workflow.steps.length - 1];
  const expectedState =
    lastStep?.expectedState || "No specific end state defined";

  return `You are an expert evaluator. Return ONLY valid JSON.

<workflow name="${workflow.name}">
${conversationDump}
</workflow>

<expected>
${expectedState}
</expected>

Evaluate how well the workflow execution matches the expected outcome. Consider:
1. Did the conversation achieve the intended goal?
2. Were the tool calls appropriate and effective?
3. Was the interaction natural and complete?

Provide your evaluation as: {"score": 0.0-1.0, "reason": "Your explanation here"}`;
}

/**
 * Run LLM judge evaluation
 */
export async function runLlmJudge(args: LlmJudgeArgs): Promise<LlmJudgeResult> {
  const { model, apiKey, workflow, traceStore, maxMessages } = args;

  try {
    // Build conversation dump
    const conversationDump = buildConversationDump(traceStore, maxMessages);

    // Build prompt
    const prompt = buildPrompt(workflow, conversationDump);

    // Create OpenAI provider with API key
    const openai = createOpenAI({
      apiKey,
      compatibility: "strict", // Use strict mode for OpenAI API
    });

    // Call LLM with the configured provider
    const { text } = await generateText({
      model: openai(model) as unknown as LanguageModelV1,
      prompt,
      maxTokens: 512,
      temperature: 0.1, // Low temperature for consistent evaluation
    });

    // Parse result
    try {
      const result = JSON.parse(text) as LlmJudgeResult;

      // Validate the result
      if (
        typeof result.score !== "number" ||
        result.score < 0 ||
        result.score > 1
      ) {
        throw new Error("Invalid score value");
      }
      if (typeof result.reason !== "string") {
        throw new Error("Invalid reason value");
      }

      return result;
    } catch (parseError) {
      console.error("Failed to parse LLM response:", text);
      return {
        score: 0,
        reason: `Invalid LLM output: ${parseError instanceof Error ? parseError.message : "JSON parse error"}`,
      };
    }
  } catch (error) {
    console.error("LLM Judge error:", error);
    return {
      score: 0,
      reason: `LLM Judge failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
