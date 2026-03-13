import {
  CHEMISTRY_EXPERT_PROMPT,
  EVAPORATION_PROMPT,
  KINETICS_PROMPT,
} from "./prompts";
import type {
  AIConfig,
  AICompletionRequest,
  AICompletionResponse,
  AIDataGenerationRequest,
  AIProvider,
} from "./types";

const CONFIG_KEY = "bosal-ai-config";
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.1";

function getEnvConfig(): Partial<AIConfig> {
  if (typeof process === "undefined" || !process.env) return {};
  return {
    provider: (process.env.AI_PROVIDER as AIProvider) ?? undefined,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    ollamaUrl: process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL,
    ollamaModel: process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL,
  };
}

function getStoredConfig(): Partial<AIConfig> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AIConfig>;
  } catch {
    return null;
  }
}

export function getConfig(): AIConfig {
  const envConfig = getEnvConfig();
  const stored = getStoredConfig();

  const provider: AIProvider = (stored?.provider ?? envConfig.provider ?? "off") as AIProvider;
  const openaiModel = stored?.openaiModel ?? envConfig.openaiModel ?? DEFAULT_OPENAI_MODEL;
  const ollamaUrl = stored?.ollamaUrl ?? envConfig.ollamaUrl ?? DEFAULT_OLLAMA_URL;
  const ollamaModel = stored?.ollamaModel ?? envConfig.ollamaModel ?? DEFAULT_OLLAMA_MODEL;

  const openaiApiKey = stored?.openaiApiKey ?? envConfig.openaiApiKey;

  return {
    provider,
    openaiApiKey,
    openaiModel,
    ollamaUrl,
    ollamaModel,
  };
}

export function setConfig(config: Partial<AIConfig>): void {
  if (typeof window === "undefined") return;
  const current = getConfig();
  const merged: AIConfig = {
    ...current,
    ...config,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
}

async function completeWithOpenAI(
  config: AIConfig,
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  // In browser: route through server-side proxy to protect API key
  if (typeof window !== "undefined") {
    return completeViaServerProxy(config, request);
  }

  // Server-side: call OpenAI directly
  const apiKey = config.openaiApiKey ?? process.env?.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("BelgaLabs AI API key is required. Configure it in settings.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel ?? DEFAULT_OPENAI_MODEL,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ?? `OpenAI API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed = data.usage?.total_tokens;

  return {
    content,
    provider: "openai",
    model: config.openaiModel ?? DEFAULT_OPENAI_MODEL,
    tokensUsed,
  };
}

async function completeViaServerProxy(
  config: AIConfig,
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      model: config.openaiModel ?? DEFAULT_OPENAI_MODEL,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error ?? `AI proxy error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: string;
    provider: string;
    model: string;
    tokensUsed?: number;
  };

  return {
    content: data.content,
    provider: "openai",
    model: data.model ?? DEFAULT_OPENAI_MODEL,
    tokensUsed: data.tokensUsed,
  };
}

async function completeWithOllama(
  config: AIConfig,
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const baseUrl = (config.ollamaUrl ?? DEFAULT_OLLAMA_URL).replace(/\/$/, "");
  const model = config.ollamaModel ?? DEFAULT_OLLAMA_MODEL;

  const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 4096,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama API error: ${response.status} ${response.statusText}. Ensure Ollama is running at ${baseUrl}.`
    );
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";

  return {
    content,
    provider: "ollama",
    model,
  };
}

export async function complete(request: AICompletionRequest): Promise<AICompletionResponse> {
  const config = getConfig();

  if (config.provider === "off") {
    return {
      content:
        "AI is currently disabled. Enable BelgaLabs AI (Cloud or Local) in settings to use AI features.",
      provider: "off",
      model: "off",
    };
  }

  if (config.provider === "openai") {
    return completeWithOpenAI(config, request);
  }

  if (config.provider === "ollama") {
    return completeWithOllama(config, request);
  }

  return {
    content: `Unknown AI provider: ${config.provider}. Please configure BelgaLabs AI in settings.`,
    provider: "off",
    model: "off",
  };
}

export async function generateData(request: AIDataGenerationRequest): Promise<string> {
  const { prompt } = request;
  const systemContent = buildDataGenerationSystemPrompt(request);
  const messages = [
    { role: "system" as const, content: systemContent },
    { role: "user" as const, content: prompt },
  ];
  const response = await complete({
    messages,
    temperature: 0.3,
    maxTokens: 4096,
    context: request.context ? JSON.stringify(request.context) : undefined,
  });
  return response.content;
}

function buildDataGenerationSystemPrompt(request: AIDataGenerationRequest): string {
  const { dataType, context } = request;
  const ctxStr = context ? `\n\nAdditional context:\n${JSON.stringify(context, null, 2)}` : "";

  switch (dataType) {
    case "evaporation_profile":
      return EVAPORATION_PROMPT + ctxStr;
    case "kinetic_params":
      return KINETICS_PROMPT + ctxStr;
    case "material_properties":
      return (
        CHEMISTRY_EXPERT_PROMPT +
        "\n\nGenerate material property data (density, thermal conductivity, porosity, etc.). Output valid JSON." +
        ctxStr
      );
    case "emission_factors":
      return (
        CHEMISTRY_EXPERT_PROMPT +
        "\n\nGenerate emission factors or emission-related data. Output valid JSON." +
        ctxStr
      );
    case "custom":
    default:
      return CHEMISTRY_EXPERT_PROMPT + ctxStr;
  }
}

export const aiEngine = {
  getConfig,
  setConfig,
  complete,
  generateData,
};
