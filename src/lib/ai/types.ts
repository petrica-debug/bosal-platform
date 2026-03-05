export type AIProvider = "openai" | "ollama" | "off";

export interface AIConfig {
  provider: AIProvider;
  openaiApiKey?: string;
  openaiModel?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  context?: string;
}

export interface AICompletionResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed?: number;
}

export interface AIDataGenerationRequest {
  prompt: string;
  dataType: "evaporation_profile" | "kinetic_params" | "material_properties" | "emission_factors" | "custom";
  context?: Record<string, unknown>;
}
