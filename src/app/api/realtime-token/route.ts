import { NextResponse } from "next/server";

const DEFAULT_REALTIME_TOKEN_URL =
  "https://gdelt-live-updater-bqgza4a6b2gqakdc.southeastasia-01.azurewebsites.net/api/realtime_token";

export async function GET() {
  const realtimeTokenUrl = process.env.REALTIME_TOKEN_URL ?? DEFAULT_REALTIME_TOKEN_URL;

  try {
    const url = new URL(realtimeTokenUrl);
    const realtimeTokenCode = process.env.REALTIME_TOKEN_CODE;

    if (realtimeTokenCode && !url.searchParams.has("code")) {
      url.searchParams.set("code", realtimeTokenCode);
    }

    const response = await fetch(url, {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error ?? "Realtime token request failed." },
        { status: response.status },
      );
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Realtime token request failed." }, { status: 502 });
  }
}
