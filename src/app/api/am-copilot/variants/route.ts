import { NextRequest, NextResponse } from "next/server";

import {
  ECS_COMPONENTS,
  buildVariantContext,
} from "@/lib/catsizer/oem-database";
import { AM_HOMOLOGATION_COPILOT_SYSTEM } from "@/lib/catsizer/oem-database/prompt";

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
    selectedIndices: number[];
    emissionStandard: string;
    componentScope: string[];
    variants: {
      tier: string;
      pgmTotalGPerL: number;
      oscTargetGPerL: number;
      oscRatio: number;
      obdRisk: string;
    }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const indices = Array.isArray(body.selectedIndices)
    ? body.selectedIndices.filter(
        (i): i is number =>
          typeof i === "number" && i >= 0 && i < ECS_COMPONENTS.length,
      )
    : [];

  const selectedRecords = indices.map((i) => ECS_COMPONENTS[i]);

  const context = buildVariantContext({
    selectedRecords,
    emissionStandard: body.emissionStandard ?? "Euro 6d",
    componentScope: body.componentScope ?? ["CC-TWC"],
    variantSummaries: body.variants,
    wizardStep: "variant-commentary",
  });

  const userContent = `## Retrieved OEM database context & pre-computed variants

${context}

---

## Task

For each of the 3 AM design variants (performance, balanced, value) listed above, provide engineering commentary covering:
1. **OBD risk assessment** — specific to this OEM platform's known OBD calibration sensitivity
2. **Chemistry recommendation** — any adjustments to the standard derating approach for this engine family
3. **Homologation confidence** — likelihood of passing ECE R103 Type 1 at ≤115% of OE reference
4. **Key risk** — the single biggest risk for this variant

Return a JSON object with this exact structure:
{
  "commentaries": {
    "performance": "...",
    "balanced": "...",
    "value": "..."
  }
}

Each commentary should be 3-5 sentences, precise, with numbers where relevant.`;

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
          { role: "system", content: AM_HOMOLOGATION_COPILOT_SYSTEM },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: "json_object" },
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
    const raw = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: { commentaries?: Record<string, string> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { commentaries: { performance: raw, balanced: raw, value: raw } };
    }

    return NextResponse.json({
      commentaries: parsed.commentaries ?? {},
      model: DEFAULT_MODEL,
      tokensUsed: data.usage?.total_tokens,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
