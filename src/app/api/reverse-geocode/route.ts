import { NextRequest, NextResponse } from "next/server";

const MAPBOX_REVERSE_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function GET(request: NextRequest) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  const longitude = request.nextUrl.searchParams.get("lng");
  const latitude = request.nextUrl.searchParams.get("lat");

  if (!token) {
    return NextResponse.json({ error: "MAPBOX_ACCESS_TOKEN is not configured." }, { status: 500 });
  }

  if (!longitude || !latitude) {
    return NextResponse.json({ error: "Missing lng or lat parameter." }, { status: 400 });
  }

  const lng = Number(longitude);
  const lat = Number(latitude);

  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const url = new URL(`${MAPBOX_REVERSE_GEOCODING_URL}/${lng},${lat}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url, { next: { revalidate: 300 } });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message ?? "Mapbox reverse geocoding failed." },
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
    return NextResponse.json({ error: "Unable to reach Mapbox reverse geocoding." }, { status: 502 });
  }
}
