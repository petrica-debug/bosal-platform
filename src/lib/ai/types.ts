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

// ============================================================
// AI CATALYST ADVISOR TYPES
// ============================================================

export interface AIAdvisorDiagnosis {
  primaryLimitation: "kinetic" | "mass_transfer" | "thermal_inertia" | "aging" | "multiple";
  failingSpecies: string[];
  summary: string;
  coldStartContribution_pct: number;
  detailedAnalysis: {
    kinetic: string;
    massTransfer: string;
    thermal: string;
    aging: string;
  };
}

export interface AIAdvisorRecommendation {
  priority: number;
  parameter: string;
  currentValue: string;
  suggestedValue: string;
  expectedImprovement: string;
  rationale: string;
  tradeoffs: string;
  confidence: "high" | "medium" | "low";
}

export interface AIAdvisorAlternativeFormulation {
  description: string;
  pgm_ratio: { Pt: number; Pd: number; Rh: number };
  pgmLoading_g_ft3: number;
  washcoatType: string;
  rationale: string;
}

export interface AIAdvisorOverallAssessment {
  canPassWithModifications: boolean;
  estimatedIterations: number;
  costImpact: "lower" | "similar" | "higher" | "much_higher";
  summary: string;
}

export interface AIAdvisorResponse {
  diagnosis: AIAdvisorDiagnosis;
  recommendations: AIAdvisorRecommendation[];
  alternativeFormulation: AIAdvisorAlternativeFormulation;
  overallAssessment: AIAdvisorOverallAssessment;
  raw?: string;
  tokensUsed?: number;
}

export interface OEMAdvisorResponse {
  systemReview: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    costDrivers: string[];
  };
  recommendations: Array<{
    priority: number;
    component: string;
    parameter: string;
    currentValue: string;
    suggestedValue: string;
    expectedBenefit: string;
    costImpact: string;
    rationale: string;
    confidence: "high" | "medium" | "low";
  }>;
  alternativeArchitecture: {
    description: string;
    components: string[];
    rationale: string;
    estimatedCostSaving_pct: number;
  };
  overallAssessment: {
    currentSystemAdequate: boolean;
    optimizationPotential: "low" | "medium" | "high";
    summary: string;
  };
  raw?: string;
  tokensUsed?: number;
}
