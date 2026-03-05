export { aiEngine, complete, generateData, getConfig, setConfig } from "./engine";
export { useAI, useAICompletion, useAIDataGeneration } from "./hooks";
export {
  CHEMISTRY_EXPERT_PROMPT,
  EVAPORATION_PROMPT,
  KINETICS_PROMPT,
  PRICING_PROMPT,
  RFQ_EXTRACTION_PROMPT,
  CATALYST_ADVISOR_PROMPT,
  OEM_ADVISOR_PROMPT,
  SGB_EXTRACTION_PROMPT,
} from "./prompts";
export { getAIOptimizationAdvice, getOEMAdvisorAdvice } from "./catalyst-advisor";
export type {
  AIConfig,
  AICompletionRequest,
  AICompletionResponse,
  AIDataGenerationRequest,
  AIMessage,
  AIProvider,
  AIAdvisorResponse,
  AIAdvisorRecommendation,
  AIAdvisorDiagnosis,
  AIAdvisorOverallAssessment,
  AIAdvisorAlternativeFormulation,
  OEMAdvisorResponse,
} from "./types";
