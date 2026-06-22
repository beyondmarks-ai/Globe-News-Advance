"use client";

import { FormEvent, useState } from "react";

export type SearchResult = {
  placeName: string;
  center: [number, number];
};

type LocationSearchProps = {
  onResult: (result: SearchResult) => void;
  basemap: "dark" | "satellite";
  onBasemapChange: (basemap: "dark" | "satellite") => void;
};

export default function LocationSearch({ onResult, basemap, onBasemapChange }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setNotification("Enter a place or city to fly.");
      return;
    }

    setIsLoading(true);
    setNotification(null);

    try {
      const response = await fetch(`/api/geocode?query=${encodeURIComponent(trimmedQuery)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed.");
      }

      if (!payload.result) {
        throw new Error("No matching location found.");
      }

      onResult(payload.result);
    } catch (searchError) {
      setNotification(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="search-card">
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden="true" />
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search country, city, or region..."
            aria-label="Search location"
          />
        </div>
        <div className="fly-control">
          <button className="search-button" type="submit" disabled={isLoading}>
            {isLoading ? "..." : "FLY"}
          </button>
          <button
            className="fly-menu-button"
            type="button"
            aria-label="Choose map style"
            aria-expanded={isLayerMenuOpen}
            onClick={() => setIsLayerMenuOpen((isOpen) => !isOpen)}
          >
            <span className="fly-caret" aria-hidden="true" />
          </button>
          {isLayerMenuOpen ? (
            <div className="fly-menu">
              <button
                className={`fly-menu-item ${basemap === "dark" ? "active" : ""}`}
                type="button"
                onClick={() => {
                  onBasemapChange("dark");
                  setIsLayerMenuOpen(false);
                }}
              >
                Dark
              </button>
              <button
                className={`fly-menu-item ${basemap === "satellite" ? "active" : ""}`}
                type="button"
                onClick={() => {
                  onBasemapChange("satellite");
                  setIsLayerMenuOpen(false);
                }}
              >
                Satellite
              </button>
            </div>
          ) : null}
        </div>
      </form>
      {notification ? (
        <div className="search-toast" role="status">
          <span className="search-toast-label">Warning</span>
          <span>{notification}</span>
          <button
            className="search-toast-close"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotification(null)}
          >
            x
          </button>
        </div>
      ) : null}
    </div>
  );
}
