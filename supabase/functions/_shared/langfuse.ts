import { Langfuse } from "npm:langfuse@3";
import { getAnthropicClient } from "./anthropic.ts";
import type Anthropic from "npm:@anthropic-ai/sdk@0.78.0";
import { captureException } from "./sentry.ts";

let _langfuse: Langfuse | null = null;

function getLangfuse(): Langfuse {
  if (!_langfuse) {
    const secretKey = Deno.env.get("LANGFUSE_SECRET_KEY");
    const publicKey = Deno.env.get("LANGFUSE_PUBLIC_KEY");
    const baseUrl = Deno.env.get("LANGFUSE_BASE_URL");
    if (!secretKey || !publicKey) {
      throw new Error(
        "LANGFUSE_SECRET_KEY or LANGFUSE_PUBLIC_KEY is not set"
      );
    }
    _langfuse = new Langfuse({
      secretKey,
      publicKey,
      baseUrl: baseUrl || "https://cloud.langfuse.com",
    });
  }
  return _langfuse;
}

export interface CallAgentParams {
  model: string;
  system?: Anthropic.MessageCreateParams["system"];
  messages: Anthropic.MessageCreateParams["messages"];
  max_tokens: number;
  temperature?: number;
}

export interface CallAgentResult {
  content: Anthropic.ContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  model: string;
  stop_reason: string | null;
}

export async function callAgent(
  agentType: string,
  params: CallAgentParams,
  userId: string
): Promise<CallAgentResult> {
  const langfuse = getLangfuse();
  const anthropic = getAnthropicClient();
  const trace = langfuse.trace({ name: agentType, userId });
  const start = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      system: params.system,
      messages: params.messages,
      temperature: params.temperature,
    });

    const durationMs = Date.now() - start;

    const result: CallAgentResult = {
      content: response.content,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens:
          (response.usage as Record<string, number>).cache_read_input_tokens ??
          0,
        cache_creation_input_tokens:
          (response.usage as Record<string, number>)
            .cache_creation_input_tokens ?? 0,
      },
      model: response.model,
      stop_reason: response.stop_reason,
    };

    // Use Langfuse generation for proper LLM call tracking
    const generation = trace.generation({
      name: agentType,
      model: result.model,
      modelParameters: {
        max_tokens: params.max_tokens,
        temperature: params.temperature,
      },
      input: { system: params.system, messages: params.messages },
      output: result.content,
      usage: {
        input: result.usage.input_tokens,
        output: result.usage.output_tokens,
      },
      metadata: {
        duration_ms: durationMs,
        cache_read_tokens: result.usage.cache_read_input_tokens,
        cache_creation_tokens: result.usage.cache_creation_input_tokens,
        success: true,
      },
    });
    generation.end();

    await langfuse.flushAsync();

    return result;
  } catch (error) {
    const durationMs = Date.now() - start;

    trace.generation({
      name: agentType,
      model: params.model,
      input: { system: params.system, messages: params.messages },
      metadata: {
        duration_ms: durationMs,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      statusMessage: error instanceof Error ? error.message : String(error),
      level: "ERROR",
    });

    await langfuse.flushAsync();

    captureException(error, {
      agentType,
      userId,
      duration_ms: durationMs,
    });

    throw error;
  }
}

export { getLangfuse };
