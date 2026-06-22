"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const IST_OFFSET_MINUTES = 330;
const TIMELINE_STEP_MINUTES = 15;
const ARTICLE_LANGUAGES = [
  ["en-US", "English"], ["hi-IN", "हिन्दी"], ["ur-PK", "اردو"],
  ["ar-SA", "العربية"], ["bn-IN", "বাংলা"], ["ta-IN", "தமிழ்"],
  ["te-IN", "తెలుగు"], ["mr-IN", "मराठी"], ["gu-IN", "ગુજરાતી"],
  ["pa-IN", "ਪੰਜਾਬੀ"], ["es-ES", "Español"], ["fr-FR", "Français"],
  ["de-DE", "Deutsch"], ["pt-BR", "Português"], ["zh-CN", "中文"],
  ["ja-JP", "日本語"], ["ko-KR", "한국어"],
] as const;

type GridNewsItem = {
  id: string;
  place: string;
  country: string;
  tone: number;
  color: string;
  url: string;
  source: string;
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

type GridNewsViewProps = { initialDate?: string; initialTime?: string };
type ArticleLoadState = "idle" | "loading" | "ready" | "error";

function getDefaultIstSelection() {
  const previousSlot = Date.now() - TIMELINE_STEP_MINUTES * 60 * 1000;
  const istDate = new Date(previousSlot + IST_OFFSET_MINUTES * 60 * 1000);
  const minute = Math.floor(istDate.getUTCMinutes() / TIMELINE_STEP_MINUTES) * TIMELINE_STEP_MINUTES;
  return {
    date: `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, "0")}-${String(istDate.getUTCDate()).padStart(2, "0")}`,
    time: `${String(istDate.getUTCHours()).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function convertIstSelectionToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MINUTES * 60 * 1000);
  return {
    date: `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, "0")}-${String(utcDate.getUTCDate()).padStart(2, "0")}`,
    time: `${String(utcDate.getUTCHours()).padStart(2, "0")}:${String(utcDate.getUTCMinutes()).padStart(2, "0")}`,
  };
}

function formatHeadline(item: GridNewsItem) {
  try {
    const slug = decodeURIComponent(new URL(item.url).pathname.split("/").filter(Boolean).at(-1) ?? "")
      .replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    if (slug.length >= 12 && !/^\d+$/.test(slug)) {
      return slug.replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
  } catch {
    // Use the location fallback for malformed source URLs.
  }
  return `${item.place || item.country || "World"} News Update`;
}

function toneLabel(color: string) {
  if (color === "red") return "Negative";
  if (color === "green") return "Positive";
  if (color === "yellow") return "Neutral";
  return "Unrated";
}

export default function GridNewsView({ initialDate, initialTime }: GridNewsViewProps) {
  const router = useRouter();
  const articleRequestRef = useRef(0);
  const [initialSelection] = useState(() => {
    const defaults = getDefaultIstSelection();
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(initialDate ?? "") ? initialDate! : defaults.date,
      time: /^\d{2}:\d{2}$/.test(initialTime ?? "") ? initialTime! : defaults.time,
    };
  });
  const [date, setDate] = useState(initialSelection.date);
  const [time, setTime] = useState(initialSelection.time);
  const [draftDate, setDraftDate] = useState(initialSelection.date);
  const [draftHour, setDraftHour] = useState(Number(initialSelection.time.slice(0, 2)));
  const [draftMinute, setDraftMinute] = useState(Number(initialSelection.time.slice(3)));
  const [items, setItems] = useState<GridNewsItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Loading timeline news...");
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState<GridNewsItem | null>(null);
  const [articleDetails, setArticleDetails] = useState<ArticleDetails | null>(null);
  const [articleStatus, setArticleStatus] = useState<ArticleLoadState>("idle");
  const [articleError, setArticleError] = useState("");
  const [articleLanguage, setArticleLanguage] = useState("en-US");

  const loadArticle = useCallback(async (item: GridNewsItem, language: string) => {
    const requestId = ++articleRequestRef.current;
    setSelectedItem(item);
    setArticleDetails(null);
    setArticleError("");
    setArticleStatus("loading");
    try {
      const response = await fetch("/api/article-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url, language }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to prepare this article.");
      if (articleRequestRef.current === requestId) {
        setArticleDetails(payload as ArticleDetails);
        setArticleStatus("ready");
      }
    } catch (error) {
      if (articleRequestRef.current === requestId) {
        setArticleError(error instanceof Error ? error.message : "Unable to prepare this article.");
        setArticleStatus("error");
      }
    }
  }, []);

  const closeArticle = useCallback(() => {
    articleRequestRef.current += 1;
    setSelectedItem(null);
    setArticleDetails(null);
    setArticleStatus("idle");
    setArticleError("");
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    async function loadNews() {
      try {
        setStatus("loading");
        setMessage("Loading timeline news...");
        const query = new URLSearchParams(convertIstSelectionToUtc(date, time));
        const response = await fetch(`/api/timeline-news?${query}`, { signal: abortController.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load grid news.");
        const newsItems = Array.isArray(payload.data) ? payload.data : [];
        setItems(newsItems);
        setMessage(payload.message || `${newsItems.length.toLocaleString()} stories available`);
        setStatus("ready");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMessage(error instanceof Error ? error.message : "Unable to load grid news.");
          setStatus("error");
        }
      }
    }
    void loadNews();
    return () => abortController.abort();
  }, [date, time]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && closeArticle();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeArticle]);

  useEffect(() => {
    if (!selectedItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedItem]);

  function applyTimelineSelection() {
    if (!draftDate) return;
    const nextTime = `${String(draftHour).padStart(2, "0")}:${String(draftMinute).padStart(2, "0")}`;
    setDate(draftDate);
    setTime(nextTime);
    closeArticle();
    router.replace(`/grid-news?date=${draftDate}&time=${nextTime}`, { scroll: false });
  }

  function speakArticle() {
    if (!articleDetails || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance([
      articleDetails.title, articleDetails.whatHappened, articleDetails.when,
      articleDetails.why, articleDetails.how, articleDetails.where,
    ].join(". "));
    utterance.lang = articleLanguage;
    window.speechSynthesis.speak(utterance);
  }

  const isRtl = articleLanguage === "ur-PK" || articleLanguage === "ar-SA";
  const normalizedLocationFilter = locationFilter.trim().toLocaleLowerCase();
  const filteredItems = normalizedLocationFilter
    ? items.filter((item) =>
        `${item.place} ${item.country}`.toLocaleLowerCase().includes(normalizedLocationFilter),
      )
    : items;

  return (
    <main className="grid-news-page">
      <header className="grid-news-header">
        <Link className="grid-news-back" href="/"><span aria-hidden="true">&lt;</span> Back to Globe</Link>
        <div className="grid-news-brand"><span className="grid-news-brand-mark" aria-hidden="true" />Grid News</div>
        <div className="grid-news-header-right">
          <div className={`grid-news-status is-${status}`} aria-live="polite">
            <strong>{status === "loading" ? "--" : filteredItems.length.toLocaleString()}</strong>
            <span>{normalizedLocationFilter ? "Matching stories" : message}</span>
          </div>
          <div className="grid-news-time"><span>IST timeline</span><strong>{date} / {time}</strong></div>
        </div>
      </header>

      <section className="grid-news-filters" aria-label="Change grid timeline">
        <div className="grid-news-filter-heading"><span>Timeline controls</span><strong>Choose an IST news window</strong></div>
        <label className="grid-news-filter-field is-search"><span>Country or place</span><input type="search" value={locationFilter} placeholder="Search India, Delhi..." onChange={(event) => setLocationFilter(event.target.value)} /></label>
        <label className="grid-news-filter-field is-date"><span>Date</span><input type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} /></label>
        <label className="grid-news-filter-field"><span>Hour</span><select value={draftHour} onChange={(event) => setDraftHour(Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option value={hour} key={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label>
        <label className="grid-news-filter-field"><span>Minute</span><select value={draftMinute} onChange={(event) => setDraftMinute(Number(event.target.value))}>{[0, 15, 30, 45].map((minute) => <option value={minute} key={minute}>:{String(minute).padStart(2, "0")}</option>)}</select></label>
        <button className="grid-news-filter-apply" type="button" onClick={applyTimelineSelection}>Load news</button>
      </section>

      {status === "loading" ? (
        <section className="grid-news-list" aria-label="Loading news cards">{Array.from({ length: 12 }, (_, index) => <div className="grid-news-card is-loading" key={index}><span className="grid-card-skeleton is-small" /><span className="grid-card-skeleton is-title" /><span className="grid-card-skeleton" /><span className="grid-card-skeleton is-short" /></div>)}</section>
      ) : filteredItems.length > 0 ? (
        <section className="grid-news-list" aria-label="Timeline news articles">
          {filteredItems.map((item) => (
            <button className={`grid-news-card tone-${item.color}`} type="button" onClick={() => void loadArticle(item, articleLanguage)} key={item.id}>
              <div className="grid-news-card-meta"><span className="grid-news-card-tone"><span aria-hidden="true" /> {toneLabel(item.color)} tone</span><span>{item.source}</span></div>
              <h2>{formatHeadline(item)}</h2>
              <p>Coverage from {item.place || "an identified location"}{item.country ? `, ${item.country}` : ""}. GDELT tone score: {Number.isFinite(Number(item.tone)) ? Number(item.tone).toFixed(2) : "unrated"}.</p>
              <div className="grid-news-card-footer"><span>{item.place || item.country || "Global"}</span><span>View details +</span></div>
            </button>
          ))}
        </section>
      ) : <div className="grid-news-empty"><h2>No stories found</h2><p>{normalizedLocationFilter ? `No stories match "${locationFilter.trim()}" in this timeline window.` : message}</p></div>}

      {selectedItem ? (
        <div className="grid-article-backdrop" role="presentation" onMouseDown={closeArticle}>
          <article className="grid-article-modal" role="dialog" aria-modal="true" aria-label="News article details" onMouseDown={(event) => event.stopPropagation()}>
            <header className="grid-article-modal-header">
              <div><span>{selectedItem.source}</span><h2 dir={isRtl ? "rtl" : "ltr"}>{articleDetails?.title ?? formatHeadline(selectedItem)}{articleDetails ? <b>{articleDetails.emoji}</b> : null}</h2></div>
              <div className="grid-article-tools">
                <button type="button" className="grid-article-speak" onClick={speakArticle} disabled={!articleDetails} aria-label="Read article summary aloud"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.25a3.75 3.75 0 0 0 3.75-3.75V6a3.75 3.75 0 0 0-7.5 0v5.5A3.75 3.75 0 0 0 12 15.25Z" /><path d="M5.75 10.75v.75a6.25 6.25 0 0 0 12.5 0v-.75M12 17.75V21M9.25 21h5.5" /></svg></button>
                <select className="grid-article-language" value={articleLanguage} aria-label="Article language" onChange={(event) => { const language = event.target.value; setArticleLanguage(language); void loadArticle(selectedItem, language); }}>{ARTICLE_LANGUAGES.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select>
                <button type="button" className="grid-article-close" onClick={closeArticle} aria-label="Close article"><span aria-hidden="true" /></button>
              </div>
            </header>

            {articleStatus === "loading" ? (
              <div className="grid-article-loading" role="status" aria-label="Preparing article"><span className="grid-article-skeleton is-image" /><div><span className="grid-article-skeleton is-label" /><span className="grid-article-skeleton" /><span className="grid-article-skeleton is-short" /><span className="grid-article-skeleton is-label" /><span className="grid-article-skeleton" /><span className="grid-article-skeleton is-short" /></div></div>
            ) : articleStatus === "error" ? (
              <div className="grid-article-error"><h3>Article unavailable</h3><p>{articleError}</p></div>
            ) : articleDetails ? (
              <><div className="grid-article-image">{articleDetails.imageUrl ? <img src={articleDetails.imageUrl} alt="" /> : null}</div><div className="grid-article-content" dir={isRtl ? "rtl" : "ltr"}><section className="is-primary"><span>What happened</span><p>{articleDetails.whatHappened}</p></section><section><span>When</span><p>{articleDetails.when}</p></section><section><span>Where</span><p>{articleDetails.where}</p></section><section><span>Why</span><p>{articleDetails.why}</p></section><section><span>How</span><p>{articleDetails.how}</p></section></div></>
            ) : null}

            <footer className="grid-article-footer"><div><span>{selectedItem.place || "Global"}</span><span>{selectedItem.country}</span></div><a href={selectedItem.url} target="_blank" rel="noreferrer">Open original source</a></footer>
          </article>
        </div>
      ) : null}
    </main>
  );
}
