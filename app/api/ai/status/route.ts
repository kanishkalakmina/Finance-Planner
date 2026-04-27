import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ online: false, reason: "No API key configured" });
  }

  const start = Date.now();
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const latency = Date.now() - start;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({
        online: false,
        latency,
        reason: err?.error?.message ?? `HTTP ${res.status}`,
      });
    }

    return NextResponse.json({ online: true, latency });
  } catch (err) {
    return NextResponse.json({
      online: false,
      latency: Date.now() - start,
      reason: err instanceof Error ? err.message : "Timeout or network error",
    });
  }
}
