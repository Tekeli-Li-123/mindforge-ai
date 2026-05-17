import { Router } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import type { AIProxyRequest, AIProxyResponse } from "../types/index.js";

const router = Router();

// POST /api/ai/chat — proxy to external AI provider
router.post("/ai/chat", async (req: AuthRequest, res) => {
  try {
    const { provider, model, messages, temperature, maxTokens }: AIProxyRequest = req.body;

    if (!provider || !model || !messages?.length) {
      res.status(400).json({ error: "provider, model, and messages are required" });
      return;
    }

    const response = await callAIProvider({ provider, model, messages, temperature, maxTokens });
    res.json(response);
  } catch (err: any) {
    console.error("AI proxy error:", err);
    res.status(502).json({ error: err.message || "AI proxy failed" });
  }
});

async function callAIProvider(req: AIProxyRequest): Promise<AIProxyResponse> {
  const { provider, model, messages, temperature = 0.7, maxTokens = 2048 } = req;

  switch (provider) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OpenAI API error ${resp.status}: ${text}`);
      }

      const data = (await resp.json()) as any;
      return { content: data.choices[0]?.message?.content ?? "" };
    }

    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

      // Convert messages to Anthropic format
      const systemMsg = messages.find((m) => m.role === "system");
      const userMsgs = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : ("user" as const),
          content: m.content,
        }));

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model || "claude-3-haiku-20240307",
          system: systemMsg?.content,
          messages: userMsgs,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Anthropic API error ${resp.status}: ${text}`);
      }

      const data = (await resp.json()) as any;
      return { content: data.content?.[0]?.text ?? "" };
    }

    case "deepseek": {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

      const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || "deepseek-chat",
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`DeepSeek API error ${resp.status}: ${text}`);
      }

      const data = (await resp.json()) as any;
      return { content: data.choices?.[0]?.message?.content ?? "" };
    }

    case "local": {
      // For local models (e.g., Ollama, LM Studio)
      const baseUrl = process.env.LOCAL_AI_URL || "http://localhost:11434";
      const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || "llama3.2",
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Local AI error ${resp.status}: ${text}`);
      }

      const data = (await resp.json()) as any;
      return { content: data.choices?.[0]?.message?.content ?? data.message?.content ?? "" };
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export default router;
