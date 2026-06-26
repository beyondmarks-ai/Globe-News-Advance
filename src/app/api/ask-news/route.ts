import { NextRequest, NextResponse } from "next/server";

const ASK_NEWS_URL =
  process.env.ASK_NEWS_URL ??
  "https://gdelt-live-updater-bqgza4a6b2gqakdc.southeastasia-01.azurewebsites.net/api/ask_news";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN = /^\d{14}$/;

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      session_id?: unknown;
      question?: unknown;
      date?: unknown;
      timestamp?: unknown;
      top_k?: unknown;
    };
    const sessionId = readString(body.session_id);
    const question = readString(body.question);
    const date = readString(body.date);
    const timestamp = readString(body.timestamp);
    const topK = Number(body.top_k ?? 8);

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required." }, { status: 400 });
    }

    if (!date || !DATE_PATTERN.test(date)) {
      return NextResponse.json({ error: "Valid date is required." }, { status: 400 });
    }

    if (!timestamp || !TIMESTAMP_PATTERN.test(timestamp)) {
      return NextResponse.json({ error: "Valid timestamp is required." }, { status: 400 });
    }

    if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
      return NextResponse.json({ error: "top_k must be an integer between 1 and 20." }, { status: 400 });
    }

    const url = new URL(ASK_NEWS_URL);
    const askNewsCode = process.env.ASK_NEWS_CODE;

    if (askNewsCode && !url.searchParams.has("code")) {
      url.searchParams.set("code", askNewsCode);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        session_id: sessionId,
        question,
        date,
        timestamp,
        top_k: topK,
      }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : { answer: await response.text() };

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Ask news request failed.";

      return NextResponse.json({ error: message }, { status: response.status });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Ask news request failed." }, { status: 502 });
  }
}
