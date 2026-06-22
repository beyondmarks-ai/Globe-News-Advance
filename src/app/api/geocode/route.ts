import { NextRequest, NextResponse } from "next/server";

const MAPBOX_FORWARD_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function GET(request: NextRequest) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  const query = request.nextUrl.searchParams.get("query")?.trim();

  if (!token) {
    return NextResponse.json({ error: "MAPBOX_ACCESS_TOKEN is not configured." }, { status: 500 });
  }

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter." }, { status: 400 });
  }

  const url = new URL(`${MAPBOX_FORWARD_GEOCODING_URL}/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url, { next: { revalidate: 300 } });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message ?? "Mapbox forward geocoding failed." },
        { status: response.status },
      );
    }

    const feature = data.features?.[0];

    return NextResponse.json({
      result: feature
        ? {
            placeName: feature.place_name,
            center: feature.center,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach Mapbox geocoding." }, { status: 502 });
  }
}
