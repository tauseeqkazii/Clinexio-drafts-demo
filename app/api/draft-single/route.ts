import { NextResponse } from "next/server";

/**
 * Server-side proxy: browser → /api/draft-single → AWS API's
 * /api/v1/test/draft-single. One call per clinic.
 *
 * Why this design:
 *   The UI has two independent "Generate this draft" buttons (one per
 *   clinic panel). Each click fires a separate POST here, which forwards
 *   to the backend's single-clinic endpoint. Result:
 *     - Each click is its own Vercel function invocation with its own
 *       60s budget — comfortably fits Hobby/Pro plans even when
 *       Bedrock takes 30-45s per draft.
 *     - The two clinics never share a single backend HTTP request,
 *       so the AWS ALB idle-timeout (60s default; bumped to 180s
 *       for this dev env) is never close to being hit.
 *     - Each panel renders the result as soon as ITS click finishes;
 *       there's no "waiting for the slowest clinic" lag.
 *
 * Why a proxy exists at all (security):
 *   The bearer secret (`DEMO_DRAFT_PAIR_SECRET`) MUST NOT ship to the
 *   browser. Keeping it server-side means anyone inspecting the network
 *   tab sees only same-origin calls to `/api/draft-single`. The AWS
 *   API URL + secret stay invisible.
 *
 * Env vars (both required):
 *   - NEXT_PUBLIC_API_URL      — AWS API base URL (no trailing slash)
 *   - DEMO_DRAFT_PAIR_SECRET   — bearer secret (server-only)
 */

export const runtime = "nodejs";
// Each backend call is ~30-45s (Sonnet). Allow 60s on Vercel Hobby,
// which is plenty since we run only ONE pipeline per request.
export const maxDuration = 60;

const UPSTREAM_TIMEOUT_MS = 55_000; // safety cap below maxDuration

type ClinicKey = "sa" | "demo";

interface IncomingBody {
  query_text?: unknown;
  patient_first_name?: unknown;
  clinic?: unknown;
}

interface ClinicDraft {
  clinic_label: string;
  classification: unknown;
  draft: unknown;
  retrieval_chunks: unknown[];
  error?: string | null;
}

interface SingleResponse {
  clinic: ClinicDraft;
  elapsed_ms: number;
}

function isClinicKey(v: unknown): v is ClinicKey {
  return v === "sa" || v === "demo";
}

export async function POST(request: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.DEMO_DRAFT_PAIR_SECRET;
  if (!apiBase) {
    return NextResponse.json(
      {
        error: "config_missing",
        detail:
          "Server isn't configured to reach the drafts service. Please contact your admin.",
      },
      { status: 503 },
    );
  }
  if (!secret) {
    return NextResponse.json(
      {
        error: "config_missing",
        detail:
          "Server isn't configured for authentication. Please contact your admin.",
      },
      { status: 503 },
    );
  }

  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", detail: "Invalid request body." },
      { status: 400 },
    );
  }
  if (typeof body.query_text !== "string" || body.query_text.trim() === "") {
    return NextResponse.json(
      { error: "bad_request", detail: "Please enter a patient question." },
      { status: 400 },
    );
  }
  if (!isClinicKey(body.clinic)) {
    return NextResponse.json(
      {
        error: "bad_request",
        detail: "Missing or invalid clinic — must be 'sa' or 'demo'.",
      },
      { status: 400 },
    );
  }

  const queryText = body.query_text.trim().slice(0, 4000);
  const patientFirstName =
    typeof body.patient_first_name === "string"
      ? body.patient_first_name.trim().slice(0, 80) || undefined
      : undefined;

  const upstreamUrl = `${apiBase.replace(/\/$/, "")}/api/v1/test/draft-single`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query_text: queryText,
        patient_first_name: patientFirstName,
        clinic: body.clinic,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!upstream.ok) {
      const status = upstream.status;
      let detail: string | null = null;
      try {
        const upstreamBody = await upstream.json();
        detail = upstreamBody?.detail || upstreamBody?.error || null;
      } catch {
        // not JSON
      }
      return NextResponse.json(
        {
          error: `upstream_${status}`,
          detail:
            (typeof detail === "string" && detail) ||
            (status === 401
              ? "Configuration issue — please contact your admin"
              : status === 429
                ? "Too many tests in a row — give it 60 seconds and try again"
                : status === 503
                  ? "The drafts service isn't ready yet — please try again in a few minutes"
                  : "Server error — please try again in a moment"),
        },
        { status },
      );
    }

    const data = (await upstream.json()) as SingleResponse;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError");
    return NextResponse.json(
      {
        error: isAbort ? "upstream_timeout" : "upstream_unreachable",
        detail: isAbort
          ? "The AI took too long this time. Please try again — sometimes Bedrock is slow."
          : "Can't reach the drafts service right now. Please try again in a few minutes.",
      },
      { status: isAbort ? 504 : 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// Health probe so you can confirm env vars are wired without making a
// full Bedrock call.
export async function GET() {
  const configured =
    !!process.env.NEXT_PUBLIC_API_URL && !!process.env.DEMO_DRAFT_PAIR_SECRET;
  return NextResponse.json({
    ok: true,
    configured,
    upstream: process.env.NEXT_PUBLIC_API_URL || null,
    proxy_strategy:
      "one call per clinic; browser fires two clicks independently",
  });
}
