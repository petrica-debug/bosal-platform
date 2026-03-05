"use client";

import { useCallback, useState } from "react";
import {
  getConfig,
  setConfig as setEngineConfig,
  complete,
  generateData,
} from "./engine";
import type {
  AIConfig,
  AICompletionRequest,
  AICompletionResponse,
  AIDataGenerationRequest,
} from "./types";

const CONFIG_KEY = "bosal-ai-config";

export function useAI(): {
  provider: AIConfig["provider"];
  config: AIConfig;
  setConfig: (config: Partial<AIConfig>) => void;
  isConfigured: boolean;
} {
  const [config, setConfigState] = useState<AIConfig>(() => getConfig());

  const setConfig = useCallback((updates: Partial<AIConfig>) => {
    const current = getConfig();
    const next: AIConfig = { ...current, ...updates };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    setEngineConfig(updates);
    setConfigState(next);
  }, []);

  const isConfigured =
    config.provider !== "off" &&
    (config.provider !== "openai" || !!config.openaiApiKey);

  return {
    provider: config.provider,
    config,
    setConfig,
    isConfigured,
  };
}

export function useAICompletion(): {
  complete: (request: AICompletionRequest) => Promise<AICompletionResponse | null>;
  isLoading: boolean;
  error: Error | null;
  response: AICompletionResponse | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [response, setResponse] = useState<AICompletionResponse | null>(null);

  const completeFn = useCallback(
    async (request: AICompletionRequest): Promise<AICompletionResponse | null> => {
      setIsLoading(true);
      setError(null);
      setResponse(null);
      try {
        const result = await complete(request);
        setResponse(result);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { complete: completeFn, isLoading, error, response };
}

export function useAIDataGeneration(): {
  generate: (request: AIDataGenerationRequest) => Promise<string | null>;
  isLoading: boolean;
  error: Error | null;
  data: string | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<string | null>(null);

  const generateFn = useCallback(
    async (request: AIDataGenerationRequest): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      setData(null);
      try {
        const result = await generateData(request);
        setData(result);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { generate: generateFn, isLoading, error, data };
}
