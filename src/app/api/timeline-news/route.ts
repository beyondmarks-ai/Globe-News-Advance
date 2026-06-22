import { NextRequest, NextResponse } from "next/server";

const TIMELINE_NEWS_URL =
  "https://gdelt-live-updater-bqgza4a6b2gqakdc.southeastasia-01.azurewebsites.net/api/timeline_news";
const DEFAULT_DATE = "2025-08-12";
const DEFAULT_TIME = "02:15";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/;

export async function GET(request: NextRequest) {
  const timelineNewsCode = process.env.TIMELINE_NEWS_CODE;
  const requestedDate = request.nextUrl.searchParams.get("date") ?? DEFAULT_DATE;
  const requestedTime = request.nextUrl.searchParams.get("time") ?? DEFAULT_TIME;

  if (!timelineNewsCode) {
    return NextResponse.json({ error: "TIMELINE_NEWS_CODE is not configured." }, { status: 500 });
  }

  if (!DATE_PATTERN.test(requestedDate) || !TIME_PATTERN.test(requestedTime)) {
    return NextResponse.json({ error: "Invalid timeline date or time." }, { status: 400 });
  }

  const url = new URL(TIMELINE_NEWS_URL);
  url.searchParams.set("code", timelineNewsCode);
  url.searchParams.set("date", requestedDate);
  url.searchParams.set("time", requestedTime);
  url.searchParams.set("limit", "1000");

  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error ?? "Timeline news request failed." },
        { status: response.status },
      );
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Timeline news request failed." }, { status: 502 });
  }
}
