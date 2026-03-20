"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: { label: string; description?: string }[];
  currentStep: number;
  className?: string;
}

function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const status =
            idx < currentStep
              ? "complete"
              : idx === currentStep
                ? "current"
                : "upcoming";
          return (
            <li key={step.label} className="flex flex-1 items-center gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    status === "complete" &&
                      "border-primary bg-primary text-primary-foreground",
                    status === "current" &&
                      "border-primary bg-primary/10 text-primary",
                    status === "upcoming" &&
                      "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {status === "complete" ? (
                    <Check className="size-4" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <div className="hidden min-w-0 sm:block">
                  <p
                    className={cn(
                      "truncate text-xs font-medium",
                      status === "current"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "hidden h-0.5 flex-1 sm:block",
                    idx < currentStep ? "bg-primary" : "bg-muted",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Stepper, type StepperProps };
