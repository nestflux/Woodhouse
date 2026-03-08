import { callAgent } from "./langfuse.ts";
import type { CallAgentResult } from "./langfuse.ts";

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

export interface AgentCallOptions {
  agentType: string;
  userId: string;
  model: "claude-sonnet-4-6" | "claude-haiku-4-5";
  systemPrompt: string;
  cacheableContext?: string;
  userMessage: string;
  maxTokens: number;
  temperature?: number;
}

export async function callClaude(
  options: AgentCallOptions
): Promise<{ text: string; usage: CallAgentResult["usage"]; model: string }> {
  const {
    agentType,
    userId,
    model,
    systemPrompt,
    cacheableContext,
    userMessage,
    maxTokens,
    temperature,
  } = options;

  // Build system message with prompt caching when cacheableContext is provided
  const system: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = cacheableContext
    ? [
        {
          type: "text" as const,
          text: systemPrompt,
          cache_control: { type: "ephemeral" as const },
        },
        {
          type: "text" as const,
          text: cacheableContext,
          cache_control: { type: "ephemeral" as const },
        },
      ]
    : [{ type: "text" as const, text: systemPrompt }];

  try {
    const result = await callAgent(
      agentType,
      {
        model,
        system,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: maxTokens,
        temperature,
      },
      userId
    );

    // Extract text content from response
    const textBlock = result.content.find((block) => block.type === "text");
    const text =
      textBlock && "text" in textBlock ? textBlock.text : "";

    return {
      text,
      usage: result.usage,
      model: result.model,
    };
  } catch (error) {
    // Classify Anthropic API errors
    if (error instanceof Error) {
      const message = error.message;

      // Rate limit (429) — retryable
      if (message.includes("429") || message.includes("rate_limit")) {
        throw new RetryableError(`Rate limited: ${message}`);
      }

      // Server errors (500, 529) — retryable
      if (
        message.includes("500") ||
        message.includes("529") ||
        message.includes("overloaded")
      ) {
        throw new RetryableError(`Server error: ${message}`);
      }

      // Bad request (400) — non-retryable
      if (message.includes("400") || message.includes("invalid_request")) {
        throw new NonRetryableError(`Bad request: ${message}`);
      }
    }

    // Unknown errors — rethrow as retryable (pipeline will handle backoff)
    throw error;
  }
}
