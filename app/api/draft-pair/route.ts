import { NextResponse } from "next/server";

/**
 * Server-side proxy from the browser to the Clinexio API's
 * /api/v1/test/draft-pair endpoint.
 *
 * Why a proxy exists at all:
 *   1. The bearer secret (`DEMO_DRAFT_PAIR_SECRET`) MUST NOT ship to
 *      the browser. By keeping it on the server side and proxying,
 *      anyone inspecting the browser's network tab sees only same-
 *      origin calls to `/api/draft-pair`. The AWS API URL + secret
 *      stay invisible.
 *   2. CORS becomes a no-op: the browser only talks to the same
 *      origin as the Vercel-hosted page.
 *   3. We can shape the upstream response into a stable contract for
 *      the page components even if the backend wire shape evolves.
 *
 * Auth model:
 *   - `DEMO_DRAFT_PAIR_SECRET` (Vercel server-only env var) — bearer
 *     token sent to the AWS API.
 *   - `NEXT_PUBLIC_API_URL` — public env var with the AWS API base URL.
 *
 * Rate limiting / abuse protection happens server-side on the AWS API
 * (10 req/min per IP). This proxy doesn't re-implement that.
 */

export const runtime = "nodejs";
// The upstream pipeline takes 25-60s (Sonnet latency × 2 clinics). The
// default route timeout on Vercel's Hobby tier is 60s; we explicitly
// allow longer here and rely on the AWS API's own deadline.
export const maxDuration = 90;

interface IncomingBody {
  query_text?: unknown;
  patient_first_name?: unknown;
}

export async function POST(request: Request) {
  // ---- Validate config (so we fail loudly, not silently) -----------
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.DEMO_DRAFT_PAIR_SECRET;
  if (!apiBase) {
    return NextResponse.json(
      {
        error: "config_missing",
        detail:
          "Server isn't configured to reach the drafts service. Please contact your admin.",
      },
      { status: 503 }
    );
  }
  if (!secret) {
    return NextResponse.json(
      {
        error: "config_missing",
        detail:
          "Server isn't configured for authentication. Please contact your admin.",
      },
      { status: 503 }
    );
  }

  // ---- Validate body -----------------------------------------------
  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", detail: "Invalid request body." },
      { status: 400 }
    );
  }
  if (typeof body.query_text !== "string" || body.query_text.trim() === "") {
    return NextResponse.json(
      {
        error: "bad_request",
        detail: "Please enter a patient question.",
      },
      { status: 400 }
    );
  }
  const queryText = body.query_text.trim().slice(0, 4000); // cap length
  const patientFirstName =
    typeof body.patient_first_name === "string"
      ? body.patient_first_name.trim().slice(0, 80) || undefined
      : undefined;

  // ---- Call the AWS API --------------------------------------------
  const upstreamUrl = `${apiBase.replace(/\/$/, "")}/api/v1/test/draft-pair`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 80_000);

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
      }),
      signal: controller.signal,
      // Vercel edge → AWS ALB — explicitly disable Next.js cache on this
      // request (defensive; POST isn't cached by default but be explicit).
      cache: "no-store",
    });

    // Pass through structured errors when we can; surface a generic
    // message otherwise.
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
            detail ||
            (status === 401
              ? "Configuration issue — please contact your admin"
              : status === 429
                ? "Too many tests in a row — give it 60 seconds and try again"
                : status === 503
                  ? "The drafts service isn't ready yet — please try again in a few minutes"
                  : "Server error — please try again in a moment"),
        },
        { status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    // AbortError -> timeout; network errors -> backend unreachable
    const isAbort =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    return NextResponse.json(
      {
        error: isAbort ? "upstream_timeout" : "upstream_unreachable",
        detail: isAbort
          ? "The AI took too long this time. Please try again — sometimes Bedrock is slow."
          : "Can't reach the drafts service right now. Please try again in a few minutes.",
      },
      { status: isAbort ? 504 : 503 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// Optionally support a GET for health-checking the proxy itself.
export async function GET() {
  const configured =
    !!process.env.NEXT_PUBLIC_API_URL && !!process.env.DEMO_DRAFT_PAIR_SECRET;
  return NextResponse.json({
    ok: true,
    configured,
    upstream: process.env.NEXT_PUBLIC_API_URL || null,
  });
}
