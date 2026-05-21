"use client";
import { useEffect, useState } from "react";

const STEPS = [
  "Reading the patient question...",
  "Looking up relevant clinic knowledge...",
  "Writing both drafts...",
  "Almost there — the AI can be slow sometimes...",
];

/**
 * Rotating loading text so the doctor knows the page isn't frozen
 * during the 30-60s Bedrock call. Steps cycle every ~10 seconds.
 */
export function LoadingState() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-ink-600">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-ink-200" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
      <p className="mt-6 text-sm font-medium text-ink-700">{STEPS[step]}</p>
      <p className="mt-1 text-xs text-ink-500">
        Drafting both clinics in parallel — usually ~30 seconds.
      </p>
    </div>
  );
}
