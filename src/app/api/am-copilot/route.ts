import { NextRequest, NextResponse } from "next/server";

import {
  ECS_COMPONENTS,
  buildAmCopilotContext,
  copilotFocusInstruction,
  type CopilotAnswerFocus,
} from "@/lib/catsizer/oem-database";
import { AM_HOMOLOGATION_COPILOT_SYSTEM } from "@/lib/catsizer/oem-database/prompt";
import {
  buildStepAwareSystemPrompt,
  wizardStepNumberToKey,
  type WizardStep,
} from "@/lib/catsizer/step-intelligence";

const DEFAULT_MODEL = "gpt-4o";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured on server" },
      { status: 500 },
    );
  }

  let body: {
    message: string;
    /** Indices into ECS_COMPONENTS */
    selectedIndices?: number[];
    includeFullWashcoat?: boolean;
    /** Shapes the assistant’s answer (prepended to the user message). */
    answerFocus?: CopilotAnswerFocus;
    wizardStep?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const indices = Array.isArray(body.selectedIndices)
    ? body.selectedIndices.filter(
        (i): i is number =>
          typeof i === "number" && i >= 0 && i < ECS_COMPONENTS.length,
      )
    : [];

  const selectedRecords = indices.map((i) => ECS_COMPONENTS[i]);

  const context = buildAmCopilotContext({
    selectedRecords,
    includeFullReferenceTables: Boolean(body.includeFullWashcoat),
  });

  const focus =
    body.answerFocus === "evidence" ||
    body.answerFocus === "dossier" ||
    body.answerFocus === "pgm"
      ? body.answerFocus
      : "balanced";
  const focusBlock = copilotFocusInstruction(focus);

  // Build step-aware system prompt if wizard step is provided
  let systemPrompt = AM_HOMOLOGATION_COPILOT_SYSTEM;
  let resolvedWizardStep: WizardStep | null = null;

  if (typeof body.wizardStep === "string" && body.wizardStep) {
    // Accept both "vehicle-scope" format and step numbers like "1"
    const stepNum = parseInt(body.wizardStep, 10);
    resolvedWizardStep = !isNaN(stepNum)
      ? wizardStepNumberToKey(stepNum)
      : (body.wizardStep as WizardStep);

    if (resolvedWizardStep) {
      systemPrompt = buildStepAwareSystemPrompt(
        AM_HOMOLOGATION_COPILOT_SYSTEM,
        resolvedWizardStep,
      );
    }
  }

  const wizardHint = resolvedWizardStep
    ? "" // Step intelligence is now in the system prompt — no need for user-side hint
    : typeof body.wizardStep === "string" && body.wizardStep
      ? `\n## Wizard step context: ${body.wizardStep}\nTailor your response for this specific phase of the AM product development wizard.\n`
      : "";

  const userContent = `${focusBlock ? `${focusBlock}\n\n` : ""}${wizardHint}## Retrieved OEM database context\n\n${context}\n\n---\n\n## Engineer question\n\n${message}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.25,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.error?.message ?? `OpenAI error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const tokensUsed = data.usage?.total_tokens;

    return NextResponse.json({
      content,
      model: DEFAULT_MODEL,
      tokensUsed,
      contextSummary: {
        selectedRowCount: selectedRecords.length,
        includeFullWashcoat: Boolean(body.includeFullWashcoat),
        answerFocus: focus,
        wizardStep: body.wizardStep ?? null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
