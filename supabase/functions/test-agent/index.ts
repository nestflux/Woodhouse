import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callClaude } from "../_shared/agent-call.ts";

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = body.prompt || "Say hello in one sentence.";
    const useCache = body.use_cache === true;

    const result = await callClaude({
      agentType: "test-agent",
      userId: "test-user",
      model: "claude-haiku-4-5",
      systemPrompt: "You are a helpful assistant. Respond concisely.",
      cacheableContext: useCache
        ? "This is cached user context that would normally contain the user's full profile data."
        : undefined,
      userMessage: prompt,
      maxTokens: 256,
    });

    return new Response(
      JSON.stringify({
        response: result.text,
        model: result.model,
        usage: result.usage,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.name : "UnknownError";
    return new Response(
      JSON.stringify({ error: message, type: errorType }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
