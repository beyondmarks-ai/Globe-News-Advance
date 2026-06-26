"use client";

import Link from "next/link";
import maplibregl, { LngLatLike, Map, Marker, Popup } from "maplibre-gl";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import LocationSearch, { SearchResult } from "@/components/LocationSearch";

const CARTO_DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const ESRI_SATELLITE_STYLE = {
  version: 8,
  projection: {
    type: "globe",
  },
  sources: {
    esriWorldImagery: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster",
      source: "esriWorldImagery",
    },
  ],
} satisfies maplibregl.StyleSpecification;

const GLOBE_PROJECTION: maplibregl.ProjectionSpecification = { type: "globe" };
const GLOBE_ROTATION_SPEED = 0.018;
const COUNTRY_BORDER_LAYER_PATTERN = /admin|boundary|border|country/i;
const STATE_BORDER_LAYER_PATTERN = /admin_sub|admin-1|admin1|state|province|region|subnational/i;
const COUNTRY_BORDER_COLOR = "#6B7280";
const STATE_BORDER_COLOR = "#4B5563";
const TIMELINE_SOURCE_ID = "timeline-news";
const TIMELINE_PULSE_LAYER_ID = "timeline-news-embedding-pulses";
const TIMELINE_LAYER_ID = "timeline-news-dots";
const TIMELINE_READY_DOT_LAYER_ID = "timeline-news-ai-ready-dots";
const INITIAL_TIMELINE_DATE = "2026-06-20";
const INITIAL_TIMELINE_HOUR = 2;
const INITIAL_TIMELINE_MINUTE = 15;
const TIMELINE_STEP_MINUTES = 15;
const TIMELINE_STEP_MILLISECONDS = TIMELINE_STEP_MINUTES * 60 * 1000;
const TIMELINE_LIMIT = 1000;
const ASK_NEWS_TOP_K = 8;
const ASK_NEWS_USER_STORAGE_KEY = "globe_news_user_id";
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const ASK_AI_PROTOTYPE_NOTICE = {
  title: "Prototype preview",
  body:
    "Ask AI is in testing phase and not fully launched yet. For a reliable test run, select 23/06/2026 and any timeline slot.",
  tag: "Testing phase",
  date: "23/06/2026",
} as const;

type Coordinates = {
  lat: number;
  lng: number;
};

type SelectedLocation = {
  coordinates: Coordinates;
  placeName: string;
  country?: string;
  source?: string;
  url?: string;
  tone?: number;
  newsId?: string;
  hasEmbedding?: boolean;
  aiReady?: boolean;
};

type ArticleDetails = {
  title: string;
  emoji: string;
  whatHappened: string;
  when: string;
  why: string;
  how: string;
  where: string;
  imageUrl: string | null;
};

type ArticleLoadState = "idle" | "loading" | "ready" | "error";
type AskNewsLoadState = "idle" | "loading" | "error";
type VoiceNewsLoadState = "idle" | "connecting" | "connected" | "error";

type Basemap = "dark" | "satellite";

type TimelineNewsItem = {
  id: string;
  place: string;
  country: string;
  lat: number;
  lon: number;
  tone: number;
  color: "red" | "yellow" | "green" | string;
  url: string;
  source: string;
  has_embedding?: boolean | string | number;
  hasEmbedding?: boolean | string | number;
  ai_ready?: boolean | string | number;
  aiReady?: boolean | string | number;
  pulse_strength?: number | string;
  pulseStrength?: number | string;
};

type TimelineNewsFeatureProperties = {
  id: string;
  place: string;
  country: string;
  tone: number;
  color: string;
  url: string;
  source: string;
  hasEmbedding: boolean;
  aiReady: boolean;
  pulseReady: number;
  pulseStrength: number;
};

type AskNewsMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type RealtimeFunctionCallItem = {
  type?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
};

type RealtimeDataMessage = {
  type?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  transcript?: string;
  item?: RealtimeFunctionCallItem;
  response?: {
    output?: RealtimeFunctionCallItem[];
  };
};

type TimelineNewsFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  TimelineNewsFeatureProperties
>;

const ARTICLE_LANGUAGES = [
  ["en-US", "English"],
  ["hi-IN", "हिन्दी"],
  ["ur-PK", "اردو"],
  ["ar-SA", "العربية"],
  ["bn-IN", "বাংলা"],
  ["ta-IN", "தமிழ்"],
  ["te-IN", "తెలుగు"],
  ["mr-IN", "मराठी"],
  ["gu-IN", "ગુજરાતી"],
  ["pa-IN", "ਪੰਜਾਬੀ"],
  ["kn-IN", "ಕನ್ನಡ"],
  ["ml-IN", "മലയാളം"],
  ["or-IN", "ଓଡ଼ିଆ"],
  ["as-IN", "অসমীয়া"],
  ["ne-NP", "नेपाली"],
  ["si-LK", "සිංහල"],
  ["my-MM", "မြန်မာ"],
  ["th-TH", "ไทย"],
  ["vi-VN", "Tiếng Việt"],
  ["id-ID", "Bahasa Indonesia"],
  ["ms-MY", "Bahasa Melayu"],
  ["fil-PH", "Filipino"],
  ["zh-CN", "中文"],
  ["zh-TW", "繁體中文"],
  ["ja-JP", "日本語"],
  ["ko-KR", "한국어"],
  ["es-ES", "Español"],
  ["es-MX", "Español (México)"],
  ["fr-FR", "Français"],
  ["de-DE", "Deutsch"],
  ["it-IT", "Italiano"],
  ["pt-BR", "Português"],
  ["pt-PT", "Português (Portugal)"],
  ["ru-RU", "Русский"],
  ["uk-UA", "Українська"],
  ["pl-PL", "Polski"],
  ["nl-NL", "Nederlands"],
  ["sv-SE", "Svenska"],
  ["da-DK", "Dansk"],
  ["fi-FI", "Suomi"],
  ["no-NO", "Norsk"],
  ["tr-TR", "Türkçe"],
  ["fa-IR", "فارسی"],
  ["he-IL", "עברית"],
  ["el-GR", "Ελληνικά"],
  ["ro-RO", "Română"],
  ["cs-CZ", "Čeština"],
  ["hu-HU", "Magyar"],
  ["bg-BG", "Български"],
  ["hr-HR", "Hrvatski"],
  ["sr-RS", "Српски"],
  ["sk-SK", "Slovenčina"],
  ["sl-SI", "Slovenščina"],
  ["lt-LT", "Lietuvių"],
  ["lv-LV", "Latviešu"],
  ["et-EE", "Eesti"],
  ["sw-KE", "Kiswahili"],
  ["am-ET", "አማርኛ"],
  ["ha-NG", "Hausa"],
  ["yo-NG", "Yorùbá"],
  ["zu-ZA", "isiZulu"],
] as const;

const RIGHT_TO_LEFT_ARTICLE_LANGUAGES = new Set(["ar-SA", "fa-IR", "he-IL", "ur-PK"]);

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function formatTimelineTime(totalMinutes: number) {
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimelineDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatTimelineDisplayTime(totalMinutes: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(2000, 0, 1, 0, totalMinutes));
}

function formatHourWindow(hour: number) {
  return `${formatTimelineDisplayTime(hour * 60)} - ${formatTimelineDisplayTime(hour * 60 + 59)}`;
}

function getCurrentIstTimelineSelection(now = new Date()) {
  const lastCompletedSlot = now.getTime() - TIMELINE_STEP_MILLISECONDS;
  const istDate = new Date(lastCompletedSlot + IST_OFFSET_MINUTES * 60 * 1000);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  const hour = istDate.getUTCHours();
  const minute = Math.floor(istDate.getUTCMinutes() / TIMELINE_STEP_MINUTES) * TIMELINE_STEP_MINUTES;

  return {
    date: `${year}-${month}-${day}`,
    hour,
    minute,
    time: formatTimelineTime(hour * 60 + minute),
  };
}

function convertIstSelectionToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcDate = new Date(
    Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MINUTES * 60 * 1000,
  );

  return {
    date: `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, "0")}-${String(
      utcDate.getUTCDate(),
    ).padStart(2, "0")}`,
    time: formatTimelineTime(utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes()),
  };
}

function isValidCoordinate(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function readApiBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function readPulseStrength(item: TimelineNewsItem) {
  const strength = Number(item.pulse_strength ?? item.pulseStrength ?? 1);
  return Number.isFinite(strength) ? Math.max(0.2, strength) : 1;
}

function toTimelineGeoJson(items: TimelineNewsItem[]): TimelineNewsFeatureCollection {
  return {
    type: "FeatureCollection",
    features: items
      .filter((item) => isValidCoordinate(item.lat, item.lon))
      .slice(0, TIMELINE_LIMIT)
      .map((item) => {
        const hasEmbedding = readApiBoolean(item.has_embedding ?? item.hasEmbedding);
        const aiReady = readApiBoolean(item.ai_ready ?? item.aiReady);

        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [item.lon, item.lat],
          },
          properties: {
            id: item.id,
            place: item.place,
            country: item.country,
            tone: item.tone,
            color: item.color,
            url: item.url,
            source: item.source,
            hasEmbedding,
            aiReady,
            pulseReady: hasEmbedding && aiReady ? 1 : 0,
            pulseStrength: readPulseStrength(item),
          },
        };
      }),
  };
}

function readTimelineFeature(feature: maplibregl.MapGeoJSONFeature | undefined) {
  if (!feature || feature.geometry.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) {
    return null;
  }

  const [lng, lat] = feature.geometry.coordinates;
  const properties = feature.properties ?? {};

  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    typeof properties.place !== "string" ||
    typeof properties.source !== "string" ||
    typeof properties.url !== "string"
  ) {
    return null;
  }

  return {
    coordinates: { lng, lat },
    placeName: properties.place,
    country: typeof properties.country === "string" ? properties.country : undefined,
    source: properties.source,
    url: properties.url,
    tone: typeof properties.tone === "number" ? properties.tone : Number(properties.tone),
    newsId: typeof properties.id === "string" ? properties.id : String(properties.id ?? ""),
    hasEmbedding: readApiBoolean(properties.hasEmbedding),
    aiReady: readApiBoolean(properties.aiReady),
  };
}

function formatAskNewsTimestamp(date: string, time: string) {
  return `${date.replaceAll("-", "")}${time.replace(":", "")}00`;
}

function hashString(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getAskNewsUserId() {
  if (typeof window === "undefined") {
    return "user";
  }

  const storedUserId = window.localStorage.getItem(ASK_NEWS_USER_STORAGE_KEY);

  if (storedUserId) {
    return storedUserId;
  }

  const generatedUserId = `user_${hashString(`${window.navigator.userAgent}_${Date.now()}`)}`;
  window.localStorage.setItem(ASK_NEWS_USER_STORAGE_KEY, generatedUserId);

  return generatedUserId;
}

function createAskNewsSessionId(userId: string, timestamp: string, url: string) {
  return `${userId}_${timestamp}_${hashString(url)}`;
}

function createVoiceNewsSessionId(timestamp: string, url: string) {
  return `voice_${timestamp}_${hashString(url)}`;
}

function readRealtimeClientSecret(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.client_secret === "string") {
    return record.client_secret;
  }

  if (record.client_secret && typeof record.client_secret === "object") {
    const nested = record.client_secret as Record<string, unknown>;
    return typeof nested.value === "string" ? nested.value : null;
  }

  return null;
}

function readAskNewsAnswer(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const directAnswer = record.answer ?? record.response ?? record.message ?? record.result;

  if (typeof directAnswer === "string") {
    return directAnswer;
  }

  if (directAnswer && typeof directAnswer === "object") {
    const nested = directAnswer as Record<string, unknown>;
    const nestedAnswer = nested.answer ?? nested.response ?? nested.message ?? nested.text;
    return typeof nestedAnswer === "string" ? nestedAnswer : null;
  }

  return null;
}

function applyBorderColors(map: Map) {
  const style = map.getStyle();

  style.layers?.forEach((layer) => {
    const sourceLayer = "source-layer" in layer ? String(layer["source-layer"]) : "";
    const searchableLayerText = `${layer.id} ${sourceLayer}`;

    if (
      layer.type !== "line" ||
      !COUNTRY_BORDER_LAYER_PATTERN.test(searchableLayerText) ||
      !map.getLayer(layer.id)
    ) {
      return;
    }

    const isStateBorder = STATE_BORDER_LAYER_PATTERN.test(searchableLayerText);

    map.setPaintProperty(layer.id, "line-color", isStateBorder ? STATE_BORDER_COLOR : COUNTRY_BORDER_COLOR);
    map.setPaintProperty(layer.id, "line-opacity", isStateBorder ? 0.72 : 0.88);
    map.setPaintProperty(layer.id, "line-width", isStateBorder ? 0.75 : 1.1);
  });
}

function upsertTimelineLayer(map: Map, data: TimelineNewsFeatureCollection) {
  if (!map.isStyleLoaded()) {
    return;
  }

  const existingSource = map.getSource(TIMELINE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(TIMELINE_SOURCE_ID, {
      type: "geojson",
      data,
    });
  }

  if (!map.getLayer(TIMELINE_PULSE_LAYER_ID)) {
    map.addLayer({
      id: TIMELINE_PULSE_LAYER_ID,
      type: "circle",
      source: TIMELINE_SOURCE_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "color"],
          "red",
          "#ff4d5e",
          "green",
          "#00e88a",
          "yellow",
          "#f6d44a",
          "#67a8ff",
        ],
        "circle-opacity": 0,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          ["case", ["==", ["get", "pulseReady"], 1], ["*", ["coalesce", ["to-number", ["get", "pulseStrength"]], 1], 12], 0],
          4,
          ["case", ["==", ["get", "pulseReady"], 1], ["*", ["coalesce", ["to-number", ["get", "pulseStrength"]], 1], 24], 0],
          8,
          ["case", ["==", ["get", "pulseReady"], 1], ["*", ["coalesce", ["to-number", ["get", "pulseStrength"]], 1], 44], 0],
        ],
        "circle-blur": 0,
        "circle-stroke-color": [
          "match",
          ["get", "color"],
          "red",
          "#ff8b95",
          "green",
          "#6fffc3",
          "yellow",
          "#ffe986",
          "#a9ccff",
        ],
        "circle-stroke-opacity": ["case", ["==", ["get", "pulseReady"], 1], 0.78, 0],
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          ["case", ["==", ["get", "pulseReady"], 1], 1.25, 0],
          5,
          ["case", ["==", ["get", "pulseReady"], 1], 2.4, 0],
        ],
      },
    });
  }

  if (!map.getLayer(TIMELINE_LAYER_ID)) {
    map.addLayer({
      id: TIMELINE_LAYER_ID,
      type: "circle",
      source: TIMELINE_SOURCE_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "color"],
          "red",
          "#ff4d5e",
          "green",
          "#00e88a",
          "yellow",
          "#f6d44a",
          "#67a8ff",
        ],
        "circle-opacity": 0.82,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4, 4, 7, 8, 14],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.78,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 5, 1.2],
      },
    });
  }

  if (!map.getLayer(TIMELINE_READY_DOT_LAYER_ID)) {
    map.addLayer({
      id: TIMELINE_READY_DOT_LAYER_ID,
      type: "circle",
      source: TIMELINE_SOURCE_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "color"],
          "red",
          "#ff4d5e",
          "green",
          "#00e88a",
          "yellow",
          "#f6d44a",
          "#67a8ff",
        ],
        "circle-opacity": ["case", ["==", ["get", "pulseReady"], 1], 0.88, 0],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          ["case", ["==", ["get", "pulseReady"], 1], 5.5, 0],
          4,
          ["case", ["==", ["get", "pulseReady"], 1], 9, 0],
          8,
          ["case", ["==", ["get", "pulseReady"], 1], 16, 0],
        ],
        "circle-stroke-color": [
          "match",
          ["get", "color"],
          "red",
          "#ffd2d7",
          "green",
          "#ccffe8",
          "yellow",
          "#fff3b8",
          "#d9e8ff",
        ],
        "circle-stroke-opacity": ["case", ["==", ["get", "pulseReady"], 1], 0.92, 0],
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          ["case", ["==", ["get", "pulseReady"], 1], 1.5, 0],
          5,
          ["case", ["==", ["get", "pulseReady"], 1], 2.5, 0],
        ],
      },
    });
  }
}

function animateTimelinePulse(map: Map) {
  if (!map.getLayer(TIMELINE_PULSE_LAYER_ID)) {
    return;
  }

  const phase = (Date.now() % 1600) / 1600;
  const ringStrokeOpacity = Math.max(0, (1 - phase) * 0.78);
  const coreBlink = 0.5 + Math.sin(Date.now() / 135) * 0.5;

  map.setPaintProperty(TIMELINE_PULSE_LAYER_ID, "circle-opacity", 0);
  map.setPaintProperty(TIMELINE_PULSE_LAYER_ID, "circle-stroke-opacity", [
    "case",
    ["==", ["get", "pulseReady"], 1],
    ringStrokeOpacity,
    0,
  ]);
  map.setPaintProperty(TIMELINE_PULSE_LAYER_ID, "circle-radius", [
    "interpolate",
    ["linear"],
    ["zoom"],
    1,
    [
      "case",
      ["==", ["get", "pulseReady"], 1],
      ["*", ["coalesce", ["to-number", ["get", "pulseStrength"]], 1], 10 + phase * 24],
      0,
    ],
    4,
    [
      "case",
      ["==", ["get", "pulseReady"], 1],
      ["*", ["coalesce", ["to-number", ["get", "pulseStrength"]], 1], 18 + phase * 38],
      0,
    ],
    8,
    [
      "case",
      ["==", ["get", "pulseReady"], 1],
      ["*", ["coalesce", ["to-number", ["get", "pulseStrength"]], 1], 34 + phase * 60],
      0,
    ],
  ]);

  if (!map.getLayer(TIMELINE_READY_DOT_LAYER_ID)) {
    return;
  }

  map.setPaintProperty(TIMELINE_READY_DOT_LAYER_ID, "circle-opacity", [
    "case",
    ["==", ["get", "pulseReady"], 1],
    0.72 + coreBlink * 0.28,
    0,
  ]);
  map.setPaintProperty(TIMELINE_READY_DOT_LAYER_ID, "circle-radius", [
    "interpolate",
    ["linear"],
    ["zoom"],
    1,
    ["case", ["==", ["get", "pulseReady"], 1], 5.5 + coreBlink * 1.8, 0],
    4,
    ["case", ["==", ["get", "pulseReady"], 1], 9 + coreBlink * 2.4, 0],
    8,
    ["case", ["==", ["get", "pulseReady"], 1], 16 + coreBlink * 3.2, 0],
  ]);
}

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const historicalControlsRef = useRef<HTMLDivElement | null>(null);
  const isUserInteractingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const articleRequestRef = useRef(0);
  const selectedLanguageRef = useRef("en-US");
  const voicePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const voiceDataChannelRef = useRef<RTCDataChannel | null>(null);
  const voiceAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const voiceMicStreamRef = useRef<MediaStream | null>(null);
  const processedRealtimeToolCallsRef = useRef<Set<string>>(new Set());

  const [basemap, setBasemap] = useState<Basemap>("dark");
  const [detailLocation, setDetailLocation] = useState<SelectedLocation | null>(null);
  const [articleDetails, setArticleDetails] = useState<ArticleDetails | null>(null);
  const [articleLoadState, setArticleLoadState] = useState<ArticleLoadState>("idle");
  const [articleError, setArticleError] = useState("");
  const [isAskNewsOpen, setIsAskNewsOpen] = useState(false);
  const [askNewsQuestion, setAskNewsQuestion] = useState("");
  const [askNewsMessages, setAskNewsMessages] = useState<AskNewsMessage[]>([]);
  const [askNewsLoadState, setAskNewsLoadState] = useState<AskNewsLoadState>("idle");
  const [askNewsError, setAskNewsError] = useState("");
  const [voiceNewsLoadState, setVoiceNewsLoadState] = useState<VoiceNewsLoadState>("idle");
  const [voiceNewsStatus, setVoiceNewsStatus] = useState("");
  const [isPrototypeNoticeOpen, setIsPrototypeNoticeOpen] = useState(true);
  const [speechLanguage, setSpeechLanguage] = useState("en-US");
  const [timelineStatus, setTimelineStatus] = useState("Loading up to 1,000 timeline points...");
  const [timelineNewsCount, setTimelineNewsCount] = useState<number | null>(null);
  const [timelineDate, setTimelineDate] = useState(INITIAL_TIMELINE_DATE);
  const [timelineHour, setTimelineHour] = useState(INITIAL_TIMELINE_HOUR);
  const [timelineMinute, setTimelineMinute] = useState(INITIAL_TIMELINE_MINUTE);
  const [activeTimelineDate, setActiveTimelineDate] = useState(INITIAL_TIMELINE_DATE);
  const [activeTimelineTime, setActiveTimelineTime] = useState(
    formatTimelineTime(INITIAL_TIMELINE_HOUR * 60 + INITIAL_TIMELINE_MINUTE),
  );
  const [timelineActivationId, setTimelineActivationId] = useState(0);
  const [isHistoricalMachineOpen, setIsHistoricalMachineOpen] = useState(false);
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [isTimelineInitialized, setIsTimelineInitialized] = useState(false);
  const timelineDataRef = useRef<TimelineNewsFeatureCollection | null>(null);
  const timelineSlots = Array.from({ length: 4 }, (_, index) =>
    formatTimelineTime(timelineHour * 60 + index * TIMELINE_STEP_MINUTES),
  );
  const isRightToLeftArticle = RIGHT_TO_LEFT_ARTICLE_LANGUAGES.has(speechLanguage);
  const canAskNews = Boolean(detailLocation?.source && detailLocation.hasEmbedding && detailLocation.aiReady);
  const canStartVoiceNews = canAskNews && articleLoadState === "ready" && Boolean(articleDetails);

  const stopVoiceNewsChat = useCallback(() => {
    voiceDataChannelRef.current?.close();
    voicePeerConnectionRef.current?.close();
    voiceMicStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceAudioElementRef.current?.remove();
    voiceDataChannelRef.current = null;
    voicePeerConnectionRef.current = null;
    voiceMicStreamRef.current = null;
    voiceAudioElementRef.current = null;
    processedRealtimeToolCallsRef.current.clear();
    setVoiceNewsLoadState("idle");
    setVoiceNewsStatus("");
  }, []);

  const resetAskNewsChat = useCallback(() => {
    stopVoiceNewsChat();
    setIsAskNewsOpen(false);
    setAskNewsQuestion("");
    setAskNewsMessages([]);
    setAskNewsLoadState("idle");
    setAskNewsError("");
  }, [stopVoiceNewsChat]);

  useEffect(() => {
    return () => {
      stopVoiceNewsChat();
    };
  }, [stopVoiceNewsChat]);

  useEffect(() => {
    function closeHistoricalMachine(event: PointerEvent) {
      if (
        historicalControlsRef.current &&
        !historicalControlsRef.current.contains(event.target as Node)
      ) {
        setIsHistoricalMachineOpen(false);
      }
    }

    function closeHistoricalMachineWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsHistoricalMachineOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeHistoricalMachine);
    document.addEventListener("keydown", closeHistoricalMachineWithEscape);

    return () => {
      document.removeEventListener("pointerdown", closeHistoricalMachine);
      document.removeEventListener("keydown", closeHistoricalMachineWithEscape);
    };
  }, []);

  useEffect(() => {
    if (isHistoricalMode) {
      return;
    }

    let refreshTimer: number | undefined;

    function syncToCurrentIstSlot() {
      const current = getCurrentIstTimelineSelection();
      setTimelineDate(current.date);
      setTimelineHour(current.hour);
      setTimelineMinute(current.minute);
      setActiveTimelineDate(current.date);
      setActiveTimelineTime(current.time);
      setTimelineActivationId((activationId) => activationId + 1);
      setIsTimelineInitialized(true);
    }

    function scheduleNextSlot() {
      const delay = TIMELINE_STEP_MILLISECONDS - (Date.now() % TIMELINE_STEP_MILLISECONDS) + 500;
      refreshTimer = window.setTimeout(() => {
        syncToCurrentIstSlot();
        scheduleNextSlot();
      }, delay);
    }

    syncToCurrentIstSlot();
    scheduleNextSlot();

    return () => {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [isHistoricalMode]);

  const showPopup = useCallback((location: SelectedLocation) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ offset: 28, closeButton: false })
      .setLngLat([location.coordinates.lng, location.coordinates.lat])
      .setHTML(
        `<div class="popup-title">${location.placeName}</div>${
          location.source ? `<div class="popup-source">${location.source}</div>` : ""
        }<div class="popup-coords">${formatCoordinate(
          location.coordinates.lat,
        )}, ${formatCoordinate(location.coordinates.lng)}</div>`,
      )
      .addTo(map);
  }, []);

  const selectCoordinates = useCallback(
    async (lng: number, lat: number, knownPlaceName?: string, openDetails = false) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      isUserInteractingRef.current = true;

      const coordinates: Coordinates = { lng, lat };
      const markerPosition: LngLatLike = [lng, lat];

      markerRef.current?.remove();
      markerRef.current = new maplibregl.Marker({ color: "#42e8c4" })
        .setLngLat(markerPosition)
        .addTo(map);

      try {
        let placeName = knownPlaceName;

        if (!placeName) {
          const response = await fetch(`/api/reverse-geocode?lng=${lng}&lat=${lat}`);
          const payload = await response.json();

          if (!response.ok) {
            throw new Error(payload.error ?? "Reverse geocoding failed.");
          }

          placeName = payload.result?.placeName ?? "Unknown location";
        }

        const nextLocation = { coordinates, placeName: placeName ?? "Unknown location" };
        showPopup(nextLocation);

        if (openDetails) {
          setDetailLocation(nextLocation);
        }
      } catch {
        const fallbackLocation = { coordinates, placeName: "Address unavailable" };
        showPopup(fallbackLocation);

        if (openDetails) {
          setDetailLocation(fallbackLocation);
        }
      }
    },
    [showPopup],
  );

  const loadArticleDetails = useCallback(async (url: string, language = "en-US") => {
    const requestId = articleRequestRef.current + 1;
    articleRequestRef.current = requestId;
    setArticleDetails(null);
    setArticleError("");
    setArticleLoadState("loading");

    try {
      const response = await fetch("/api/article-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, language }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load this article.");
      }

      if (articleRequestRef.current === requestId) {
        setArticleDetails(payload as ArticleDetails);
        setArticleLoadState("ready");
      }
    } catch (error) {
      if (articleRequestRef.current === requestId) {
        setArticleError(error instanceof Error ? error.message : "Unable to load this article.");
        setArticleLoadState("error");
      }
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CARTO_DARK_STYLE,
      center: [0, 20],
      zoom: 1.97,
      pitch: 12,
      attributionControl: false,
    });

    map.on("style.load", () => {
      map.setProjection(GLOBE_PROJECTION);
      applyBorderColors(map);

      if (timelineDataRef.current) {
        upsertTimelineLayer(map, timelineDataRef.current);
      }
    });

    map.on("dragstart", () => {
      isUserInteractingRef.current = true;
    });

    map.on("pitchstart", () => {
      isUserInteractingRef.current = true;
    });

    map.on("rotatestart", () => {
      isUserInteractingRef.current = true;
    });

    map.on("zoomstart", () => {
      isUserInteractingRef.current = true;
    });

    map.on("click", (event) => {
      if (map.getLayer(TIMELINE_LAYER_ID)) {
        const timelineFeatures = map.queryRenderedFeatures(event.point, {
          layers: [TIMELINE_LAYER_ID],
        });
        const selectedNewsLocation = readTimelineFeature(timelineFeatures[0]);

        if (selectedNewsLocation) {
          popupRef.current?.remove();
          popupRef.current = null;
          resetAskNewsChat();
          setDetailLocation(selectedNewsLocation);
          void loadArticleDetails(selectedNewsLocation.url, selectedLanguageRef.current);
          return;
        }
      }
    });

    map.on("mousemove", (event) => {
      const hasTimelineFeature =
        map.getLayer(TIMELINE_LAYER_ID) &&
        map.queryRenderedFeatures(event.point, { layers: [TIMELINE_LAYER_ID] }).length > 0;

      map.getCanvas().style.cursor = hasTimelineFeature ? "pointer" : "";
    });

    mapRef.current = map;

    const revolveGlobe = () => {
      const activeMap = mapRef.current;

      if (activeMap) {
        animateTimelinePulse(activeMap);

        if (!isUserInteractingRef.current && activeMap.getZoom() < 4) {
          const center = activeMap.getCenter();
          center.lng -= GLOBE_ROTATION_SPEED;
          activeMap.setCenter(center);
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(revolveGlobe);
    };

    animationFrameRef.current = window.requestAnimationFrame(revolveGlobe);

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      markerRef.current?.remove();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [loadArticleDetails, resetAskNewsChat]);

  useEffect(() => {
    if (!isTimelineInitialized) {
      return;
    }

    let ignore = false;
    const abortController = new AbortController();

    async function loadTimelineNews() {
      try {
        setTimelineStatus("Loading selected timeline points...");
        const utcSelection = convertIstSelectionToUtc(activeTimelineDate, activeTimelineTime);
        const query = new URLSearchParams(utcSelection);
        const response = await fetch(`/api/timeline-news?${query}`, {
          signal: abortController.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Timeline news request failed.");
        }

        const timelineData = toTimelineGeoJson(payload.data ?? []);

        if (ignore) {
          return;
        }

        timelineDataRef.current = timelineData;
        setTimelineNewsCount(timelineData.features.length);
        const pulseReadyCount = timelineData.features.filter((feature) => feature.properties.pulseReady === 1).length;
        setTimelineStatus(
          timelineData.features.length === 0 && payload.message
            ? payload.message
            : `${timelineData.features.length} timeline points loaded / ${pulseReadyCount} AI-ready pulses`,
        );

        if (mapRef.current) {
          upsertTimelineLayer(mapRef.current, timelineData);
        }
      } catch (error) {
        if (!ignore && !(error instanceof DOMException && error.name === "AbortError")) {
          setTimelineNewsCount(null);
          setTimelineStatus("Timeline points unavailable");
        }
      }
    }

    void loadTimelineNews();

    return () => {
      ignore = true;
      abortController.abort();
    };
  }, [activeTimelineDate, activeTimelineTime, timelineActivationId, isTimelineInitialized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.setStyle(basemap === "dark" ? CARTO_DARK_STYLE : ESRI_SATELLITE_STYLE);
    map.once("style.load", () => {
      map.setProjection(GLOBE_PROJECTION);
      applyBorderColors(map);

      if (timelineDataRef.current) {
        upsertTimelineLayer(map, timelineDataRef.current);
      }
    });
  }, [basemap]);

  function handleSearchResult(result: SearchResult) {
    const map = mapRef.current;
    const [lng, lat] = result.center;

    isUserInteractingRef.current = true;
    articleRequestRef.current += 1;
    setArticleDetails(null);
    setArticleError("");
    setArticleLoadState("idle");
    resetAskNewsChat();

    map?.flyTo({
      center: [lng, lat],
      zoom: 12,
      essential: true,
    });

    void selectCoordinates(lng, lat, result.placeName, true);
  }

  function getSelectedNewsContext() {
    if (!detailLocation) {
      return null;
    }

    return {
      title: articleDetails?.title ?? detailLocation.placeName,
      articleSummary: articleDetails
        ? {
            whatHappened: articleDetails.whatHappened,
            when: articleDetails.when,
            where: articleDetails.where,
            why: articleDetails.why,
            how: articleDetails.how,
          }
        : null,
      source: detailLocation.source,
      url: detailLocation.url,
      date: activeTimelineDate,
      timestamp: formatAskNewsTimestamp(activeTimelineDate, activeTimelineTime),
      place: detailLocation.placeName,
      country: detailLocation.country,
      lat: detailLocation.coordinates.lat,
      lon: detailLocation.coordinates.lng,
    };
  }

  async function askNewsBackend(question: string, mode: "text" | "voice") {
    if (!detailLocation) {
      throw new Error("No selected news ripple.");
    }

    const selectedNews = getSelectedNewsContext();

    if (!selectedNews) {
      throw new Error("No selected news ripple.");
    }

    const timestamp = selectedNews.timestamp;
    const sessionSource = detailLocation.url ?? detailLocation.newsId ?? detailLocation.placeName;
    const sessionId =
      mode === "voice"
        ? createVoiceNewsSessionId(timestamp, sessionSource)
        : createAskNewsSessionId(getAskNewsUserId(), timestamp, sessionSource);
    const requestBody = {
      session_id: sessionId,
      question,
      ...selectedNews,
      top_k: ASK_NEWS_TOP_K,
    };

    if (mode === "voice") {
      console.log("Selected news sent to ask_news:", selectedNews);
      console.log("Question:", question);
    }

    const response = await fetch("/api/ask-news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to ask AI about this news.");
    }

    const answer = readAskNewsAnswer(payload);

    if (!answer) {
      throw new Error("The AI response did not include an answer.");
    }

    return answer;
  }

  async function submitAskNewsQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!detailLocation || !canAskNews || askNewsLoadState === "loading") {
      return;
    }

    const question = askNewsQuestion.trim();

    if (!question) {
      return;
    }

    setAskNewsMessages((messages) => [
      ...messages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
      },
    ]);
    setAskNewsQuestion("");
    setAskNewsError("");
    setAskNewsLoadState("loading");

    try {
      const answer = await askNewsBackend(question, "text");

      setAskNewsMessages((messages) => [
        ...messages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: answer,
        },
      ]);
      setAskNewsLoadState("idle");
    } catch (error) {
      setAskNewsError(error instanceof Error ? error.message : "Unable to ask AI about this news.");
      setAskNewsLoadState("error");
    }
  }

  async function handleRealtimeAskNewsTool(callId: string | undefined, rawArguments: string | undefined) {
    const dataChannel = voiceDataChannelRef.current;

    if (!dataChannel || dataChannel.readyState !== "open" || !callId) {
      setVoiceNewsStatus("Realtime asked for news, but the tool call was incomplete.");
      return;
    }

    if (processedRealtimeToolCallsRef.current.has(callId)) {
      return;
    }

    processedRealtimeToolCallsRef.current.add(callId);

    let question = "Tell me about this selected news.";

    try {
      const parsedArguments = rawArguments ? (JSON.parse(rawArguments) as { question?: unknown }) : {};

      if (typeof parsedArguments.question === "string" && parsedArguments.question.trim()) {
        question = parsedArguments.question.trim();
      }
    } catch {
      question = rawArguments?.trim() || question;
    }

    setAskNewsMessages((messages) => [
      ...messages,
      {
        id: `voice-user-${Date.now()}`,
        role: "user",
        content: question,
      },
    ]);
    setAskNewsError("");
    setAskNewsLoadState("loading");
    setVoiceNewsStatus("Calling ask_news brain...");

    try {
      const answer = await askNewsBackend(question, "voice");

      setAskNewsMessages((messages) => [
        ...messages,
        {
          id: `voice-assistant-${Date.now()}`,
          role: "assistant",
          content: answer,
        },
      ]);
      setAskNewsLoadState("idle");
      setVoiceNewsStatus("Speaking ask_news answer.");
      dataChannel.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({
              answer,
            }),
          },
        }),
      );
      dataChannel.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions:
              "Use the ask_news tool output as the source of truth. Answer naturally in Hinglish, around 60% English and 40% Hindi. Do not mention tool calls.",
          },
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to answer the voice question.";
      setAskNewsError(message);
      setAskNewsLoadState("error");
      setVoiceNewsStatus("ask_news failed.");
      dataChannel.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({
              error: message,
            }),
          },
        }),
      );
      dataChannel.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions:
              "Briefly tell the user in Hinglish that the news backend could not answer right now and they can try again.",
          },
        }),
      );
    }
  }

  async function startVoiceNewsChat() {
    if (!detailLocation || !canAskNews || voiceNewsLoadState === "connecting") {
      return;
    }

    if (!canStartVoiceNews) {
      setVoiceNewsLoadState("error");
      setVoiceNewsStatus("AI news context is still loading. Try voice again after the title and summary appear.");
      return;
    }

    stopVoiceNewsChat();
    setVoiceNewsLoadState("connecting");
    setVoiceNewsStatus("Connecting voice chat...");

    try {
      const tokenResponse = await fetch("/api/realtime-token", { cache: "no-store" });
      const tokenPayload = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenPayload.error ?? "Realtime token failed.");
      }

      const ephemeralKey = readRealtimeClientSecret(tokenPayload);
      const webrtcUrl = typeof tokenPayload.webrtc_url === "string" ? tokenPayload.webrtc_url : null;

      if (!ephemeralKey || !webrtcUrl) {
        throw new Error("Realtime token response is missing connection details.");
      }

      const peerConnection = new RTCPeerConnection();
      const audioElement = document.createElement("audio");
      audioElement.autoplay = true;
      audioElement.className = "ask-news-voice-audio";
      document.body.appendChild(audioElement);

      peerConnection.ontrack = (event) => {
        audioElement.srcObject = event.streams[0];
      };

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micTrack = micStream.getAudioTracks()[0];

      if (!micTrack) {
        throw new Error("No microphone track was found.");
      }

      peerConnection.addTrack(micTrack, micStream);

      const dataChannel = peerConnection.createDataChannel("realtime-channel");
      dataChannel.onopen = () => {
        const selectedNews = getSelectedNewsContext();
        const selectedNewsContextText = JSON.stringify(selectedNews);
        setVoiceNewsLoadState("connected");
        setVoiceNewsStatus(`Ask about this news: ${selectedNews?.title ?? "selected news"}`);
        console.log("Realtime selected news context:", selectedNews);
        dataChannel.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions:
                `You are a live news voice assistant. Speak naturally in Hinglish, around 60% English and 40% Hindi. The user has already clicked one blinking globe ripple, and that clicked ripple is the ONLY active news. Active clicked news context: ${selectedNewsContextText}. Never ask "which news", "what news", or "what article" because the active news is already selected. If the user says "this news", "that", "this", "after that", "why", "how", "what happened", or asks any news question without naming an article, assume they mean the active clicked news. Do not answer news facts from your own knowledge. For every news question or follow-up about the active clicked news, call the ask_news tool before answering. After the tool returns, speak the answer naturally in Hinglish. For a brief greeting or voice-control clarification only, you may respond normally.`,
              tools: [
                {
                  type: "function",
                  name: "ask_news",
                  description:
                    `Ask the Globe News backend about the active clicked ripple. The active clicked news is already selected, so do not ask the user which news they mean. Use this for every news question and follow-up. Active clicked news context: ${selectedNewsContextText}`,
                  parameters: {
                    type: "object",
                    properties: {
                      question: {
                        type: "string",
                        description:
                          "The user's spoken question about the selected news ripple or a follow-up question.",
                      },
                    },
                    required: ["question"],
                  },
                },
              ],
              tool_choice: "auto",
              turn_detection: {
                type: "server_vad",
                create_response: true,
              },
            },
          }),
        );
        dataChannel.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `ACTIVE_CLICKED_NEWS_CONTEXT. Do not respond to this message. The user already clicked this blinking ripple and all future news questions refer to it. Never ask which news. Context: ${selectedNewsContextText}`,
                },
              ],
            },
          }),
        );
      };
      dataChannel.onclose = () => {
        setVoiceNewsLoadState("idle");
        setVoiceNewsStatus("");
      };
      dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as RealtimeDataMessage;
          console.log("Realtime event:", message.type);

          if (message.type === "response.done") {
            message.response?.output?.forEach((outputItem) => {
              if (outputItem.type === "function_call") {
                void handleRealtimeAskNewsTool(outputItem.call_id, outputItem.arguments);
              }
            });
            setVoiceNewsStatus("Listening. Ask your news question.");
          }

          if (
            message.type === "response.function_call_arguments.done" &&
            (message.name === "ask_news" || !message.name)
          ) {
            void handleRealtimeAskNewsTool(message.call_id, message.arguments);
          }

          if (message.type === "response.output_item.done" && message.item?.type === "function_call") {
            void handleRealtimeAskNewsTool(message.item.call_id, message.item.arguments);
          }
        } catch {
          setVoiceNewsStatus("Received an unreadable realtime event.");
        }
      };

      voicePeerConnectionRef.current = peerConnection;
      voiceDataChannelRef.current = dataChannel;
      voiceAudioElementRef.current = audioElement;
      voiceMicStreamRef.current = micStream;

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch(webrtcUrl, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(await sdpResponse.text());
      }

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });
    } catch (error) {
      stopVoiceNewsChat();
      setVoiceNewsLoadState("error");
      setVoiceNewsStatus(error instanceof Error ? error.message : "Realtime connection failed.");
    }
  }

  return (
    <main className="map-shell">
      {isPrototypeNoticeOpen ? (
        <div className="prototype-notice-backdrop" role="presentation">
          <section className="prototype-notice-panel" role="dialog" aria-modal="true" aria-label="Ask AI prototype notice">
            <div className="prototype-notice-header">
              <div className="prototype-notice-heading">
                <span className="prototype-notice-eyebrow">Prototype preview</span>
                <h2>Ask AI is in testing phase</h2>
              </div>
              <button
                className="prototype-notice-close"
                type="button"
                aria-label="Close prototype notice"
                onClick={() => setIsPrototypeNoticeOpen(false)}
              >
                <span className="location-card-close-icon" aria-hidden="true" />
              </button>
            </div>

            <p className="prototype-notice-body">
              Ask AI is a prototype and our developers are working on it. It is still in testing phase and
              not fully launched yet. For testing, select date <strong>23/06/2026</strong> and any timeline
              slot. The assistant will then use the selected news context.
            </p>

            <div className="prototype-notice-footer">
              <div className="prototype-notice-pill">Testing phase</div>
              <button
                className="prototype-notice-action"
                type="button"
                onClick={() => setIsPrototypeNoticeOpen(false)}
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div ref={mapContainerRef} className="map-canvas" aria-label="Interactive OSIRIS map" />

      <section className="news-count-card" aria-label="News available on globe" aria-live="polite">
        <span className="news-count-indicator" aria-hidden="true" />
        <div className="news-count-content">
          <span className="news-count-label">News on globe</span>
          <strong className="news-count-value">
            {timelineNewsCount === null ? "--" : timelineNewsCount.toLocaleString()}
          </strong>
          <span className="news-count-caption">
            {timelineNewsCount === null ? "Loading live coverage" : "Total stories available"}
          </span>
        </div>
        <div className="news-tone-legend" aria-label="News dot tone legend">
          <span className="news-tone-legend-title">Dot tone</span>
          <span className="news-tone-item">
            <span className="news-tone-dot is-negative" aria-hidden="true" /> Negative
          </span>
          <span className="news-tone-item">
            <span className="news-tone-dot is-neutral" aria-hidden="true" /> Neutral
          </span>
          <span className="news-tone-item">
            <span className="news-tone-dot is-positive" aria-hidden="true" /> Positive
          </span>
        </div>
      </section>

      <Link
        className="grid-news-button"
        href={`/grid-news?date=${activeTimelineDate}&time=${activeTimelineTime}`}
        aria-label="Open grid news"
      >
        <span className="grid-news-icon" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span>Grid News</span>
      </Link>

      <div className="top-left-tools">
        <LocationSearch onResult={handleSearchResult} basemap={basemap} onBasemapChange={setBasemap} />
        <div className="timeline-status" aria-live="polite">
          {timelineStatus}
        </div>
      </div>

      <div className="historical-footer" ref={historicalControlsRef}>
        <button
          className={`historical-trigger ${isHistoricalMachineOpen ? "is-open" : ""}`}
          type="button"
          aria-label="Choose historical date and time"
          aria-expanded={isHistoricalMachineOpen}
          onClick={() => setIsHistoricalMachineOpen((isOpen) => !isOpen)}
        >
          <span className="historical-clock-icon" aria-hidden="true" />
        </button>

        <section
          className={`historical-machine ${isHistoricalMachineOpen ? "is-open" : ""}`}
          aria-label="Historical news controls"
          aria-hidden={!isHistoricalMachineOpen}
        >
          <div className="historical-machine-title">
            <span className="historical-calendar-icon" aria-hidden="true" />
            <span>Historical machine</span>
          </div>
          <label className="historical-field">
            <span>Select date</span>
            <input
              type="date"
              tabIndex={isHistoricalMachineOpen ? 0 : -1}
              value={timelineDate}
              onChange={(event) => {
                if (event.target.value) {
                  setTimelineDate(event.target.value);
                }
              }}
            />
          </label>
          <label className="historical-field">
            <span>IST window</span>
            <select
              value={timelineHour}
              tabIndex={isHistoricalMachineOpen ? 0 : -1}
              onChange={(event) => setTimelineHour(Number(event.target.value))}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {formatHourWindow(hour)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="historical-activate"
            type="button"
            tabIndex={isHistoricalMachineOpen ? 0 : -1}
            onClick={() => {
              setActiveTimelineDate(timelineDate);
              setActiveTimelineTime(formatTimelineTime(timelineHour * 60 + timelineMinute));
              setIsHistoricalMode(true);
              setTimelineActivationId((activationId) => activationId + 1);
              setIsHistoricalMachineOpen(false);
            }}
          >
            Activate
          </button>
        </section>

        <section className="timeline-control" aria-label="News timeline controls">
          <div className="timeline-control-header">
            <span className="timeline-control-eyebrow">Timeline</span>
            <time dateTime={`${activeTimelineDate}T${activeTimelineTime}`}>
              {isHistoricalMode ? "Historical" : "Live"} /{" "}
              {formatTimelineDate(activeTimelineDate)} / {formatTimelineDisplayTime(
                Number(activeTimelineTime.slice(0, 2)) * 60 + Number(activeTimelineTime.slice(3)),
              )} IST
            </time>
          </div>
          <div className="timeline-slots" role="group" aria-label="Select a 15-minute time slot">
            {timelineSlots.map((slot, index) => (
              <button
                className={timelineMinute === index * TIMELINE_STEP_MINUTES ? "is-active" : ""}
                key={slot}
                type="button"
                aria-pressed={timelineMinute === index * TIMELINE_STEP_MINUTES}
                onClick={() => setTimelineMinute(index * TIMELINE_STEP_MINUTES)}
              >
                {slot}
              </button>
            ))}
          </div>
        </section>
      </div>

      {detailLocation ? (
        <section
          className={`location-card${detailLocation.source ? " location-card--news" : ""}`}
          aria-label="Location intelligence card"
        >
          {detailLocation.source && articleLoadState === "loading" ? (
            <div className="location-card-skeleton" role="status" aria-label="Loading article">
              <div className="location-card-skeleton-header">
                <span className="skeleton-block skeleton-title" />
                <button
                  className="location-card-close skeleton-close"
                  type="button"
                  aria-label="Close loading article"
                  onClick={() => {
                    articleRequestRef.current += 1;
                    setDetailLocation(null);
                    setArticleDetails(null);
                    setArticleLoadState("idle");
                    resetAskNewsChat();
                  }}
                >
                  <span className="location-card-close-icon" aria-hidden="true" />
                </button>
              </div>
              <div className="skeleton-block skeleton-image" />
              <div className="location-card-skeleton-body">
                <span className="skeleton-block skeleton-label" />
                <span className="skeleton-block skeleton-line" />
                <span className="skeleton-block skeleton-line skeleton-line-short" />
                <span className="skeleton-block skeleton-label" />
                <span className="skeleton-block skeleton-line" />
                <span className="skeleton-block skeleton-line skeleton-line-medium" />
                <span className="skeleton-block skeleton-action" />
              </div>
            </div>
          ) : null}
          <div className="location-card-header">
            <h1 dir={isRightToLeftArticle ? "rtl" : "ltr"}>
              {articleDetails?.title ?? detailLocation.placeName}
              {articleDetails ? <span className="location-card-emoji">{articleDetails.emoji}</span> : null}
            </h1>
            <div className="location-card-tools">
              <select
                className="location-language-select"
                aria-label="News language"
                value={speechLanguage}
                onChange={(event) => {
                  const language = event.target.value;
                  selectedLanguageRef.current = language;
                  setSpeechLanguage(language);

                  if (detailLocation.url) {
                    void loadArticleDetails(detailLocation.url, language);
                  }
                }}
              >
                {ARTICLE_LANGUAGES.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                className="location-card-close"
                type="button"
                aria-label="Close location card"
                onClick={() => {
                  articleRequestRef.current += 1;
                  setDetailLocation(null);
                  setArticleDetails(null);
                  setArticleLoadState("idle");
                  resetAskNewsChat();
                }}
              >
                <span className="location-card-close-icon" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="location-card-image">
            {articleDetails?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={articleDetails.imageUrl} alt="" />
            ) : null}
          </div>

          <div className="location-card-body">
            <div className="location-card-section">
              <div className="location-card-label">What happened</div>
              {articleLoadState === "ready" && articleDetails ? (
                <p dir={isRightToLeftArticle ? "rtl" : "ltr"}>{articleDetails.whatHappened}</p>
              ) : articleLoadState === "loading" ? (
                <p>Loading article.</p>
              ) : articleLoadState === "error" ? (
                <p className="location-card-error">{articleError}</p>
              ) : (
                <p>
                  {detailLocation.source
                    ? `Timeline news point from ${detailLocation.source}.`
                    : "Location selected on the OSIRIS globe and resolved through Mapbox geocoding."}
                </p>
              )}
            </div>

            {articleDetails ? (
              <>
                <div className="location-card-section">
                  <div className="location-card-label">When</div>
                  <p dir={isRightToLeftArticle ? "rtl" : "ltr"}>{articleDetails.when}</p>
                </div>

                <div className="location-card-section">
                  <div className="location-card-label">Why</div>
                  <p dir={isRightToLeftArticle ? "rtl" : "ltr"}>{articleDetails.why}</p>
                </div>

                <div className="location-card-section">
                  <div className="location-card-label">How</div>
                  <p dir={isRightToLeftArticle ? "rtl" : "ltr"}>{articleDetails.how}</p>
                </div>
              </>
            ) : null}

            <div className="location-card-section">
              <div className="location-card-label">Where</div>
              <p dir={isRightToLeftArticle ? "rtl" : "ltr"}>
                {articleDetails?.where ?? detailLocation.placeName}
              </p>
            </div>
          </div>

          {canAskNews ? (
            <div className="ask-news-entry">
              <button
                className={`ask-news-button ${isAskNewsOpen ? "is-active" : ""}`}
                type="button"
                aria-expanded={isAskNewsOpen}
                onClick={() => setIsAskNewsOpen((isOpen) => !isOpen)}
              >
                <span className="ask-news-button-icon" aria-hidden="true" />
                <span>Ask AI</span>
              </button>
            </div>
          ) : null}

          <a
            className="location-card-action"
            href={
              detailLocation.url ??
              `https://www.openstreetmap.org/?mlat=${detailLocation.coordinates.lat}&mlon=${detailLocation.coordinates.lng}#map=12/${detailLocation.coordinates.lat}/${detailLocation.coordinates.lng}`
            }
            target="_blank"
            rel="noreferrer"
          >
            {detailLocation.url ? "Open source" : "Open location"}
          </a>
        </section>
      ) : null}

      {detailLocation && canAskNews && isAskNewsOpen ? (
        <div className="ask-news-modal-backdrop" role="presentation">
          <section className="ask-news-panel" role="dialog" aria-modal="true" aria-label="Ask AI about this news">
            <div className="ask-news-header">
              <div className="ask-news-header-title">
                <span>News assistant</span>
                <strong>{articleDetails?.title ?? detailLocation.placeName}</strong>
              </div>
              <div className="ask-news-header-actions">
                <button
                  className={`ask-news-voice-button is-${voiceNewsLoadState}`}
                  type="button"
                  disabled={!canStartVoiceNews && voiceNewsLoadState !== "connected"}
                  aria-label={voiceNewsLoadState === "connected" ? "Stop voice news chat" : "Start voice news chat"}
                  onClick={() => {
                    if (voiceNewsLoadState === "connected" || voiceNewsLoadState === "connecting") {
                      stopVoiceNewsChat();
                      return;
                    }

                    void startVoiceNewsChat();
                  }}
                >
                  <span className="ask-news-voice-icon" aria-hidden="true" />
                  <span>
                    {voiceNewsLoadState === "connected"
                      ? "Stop voice"
                      : canStartVoiceNews
                        ? "Voice"
                        : "Loading"}
                  </span>
                </button>
                <button
                  className="ask-news-panel-close"
                  type="button"
                  aria-label="Close news assistant"
                  onClick={() => {
                    stopVoiceNewsChat();
                    setIsAskNewsOpen(false);
                  }}
                >
                  <span className="location-card-close-icon" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="ask-news-notice" role="note" aria-label="Ask AI prototype notice">
              <div className="ask-news-notice-copy">
                <span className="ask-news-notice-tag">{ASK_AI_PROTOTYPE_NOTICE.tag}</span>
                <strong>{ASK_AI_PROTOTYPE_NOTICE.title}</strong>
                <p>{ASK_AI_PROTOTYPE_NOTICE.body}</p>
              </div>
              <div className="ask-news-notice-date">
                <span>Test date</span>
                <strong>{ASK_AI_PROTOTYPE_NOTICE.date}</strong>
              </div>
            </div>

            {voiceNewsStatus ? <div className="ask-news-voice-status">{voiceNewsStatus}</div> : null}

            <div className="ask-news-messages" aria-live="polite">
              {askNewsMessages.length === 0 ? (
                <div className="ask-news-empty">
                  Ask a question about this article, related stories, background, timeline, or impact.
                </div>
              ) : (
                askNewsMessages.map((message) => (
                  <div className={`ask-news-message is-${message.role}`} key={message.id}>
                    {message.content}
                  </div>
                ))
              )}
              {askNewsLoadState === "loading" ? (
                <div className="ask-news-message is-assistant is-loading">Searching related news and preparing an answer.</div>
              ) : null}
            </div>

            {askNewsError ? <div className="ask-news-error">{askNewsError}</div> : null}

            <form className="ask-news-form" onSubmit={submitAskNewsQuestion}>
              <input
                type="text"
                value={askNewsQuestion}
                placeholder="Ask about this news..."
                aria-label="Question for news AI"
                onChange={(event) => setAskNewsQuestion(event.target.value)}
              />
              <button type="submit" disabled={!askNewsQuestion.trim() || askNewsLoadState === "loading"}>
                Send
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
