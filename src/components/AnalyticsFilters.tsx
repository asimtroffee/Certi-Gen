"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "All time", value: "all" },
];

type Props = {
  currentRange: string;
  currentEventId: string;
};

export default function AnalyticsFilters({ currentRange, currentEventId }: Props) {
  const router = useRouter();
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch("/api/events?limit=200")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load events");
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
        else if (data.events) setEvents(data.events);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  function navigate(range: string, eventId: string) {
    const params = new URLSearchParams();
    params.set("range", range);
    if (eventId) params.set("eventId", eventId);
    router.push(`/admin/analytics?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => navigate(r.value, currentEventId)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              currentRange === r.value
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <select
          value={currentEventId}
          onChange={(e) => navigate(currentRange, e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
        >
          <option value="">
            {loading ? "Loading events..." : error ? "Failed to load" : "All Events"}
          </option>
          {!loading && !error && events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>
        {error && (
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(false);
              fetch("/api/events?limit=200")
                .then((r) => {
                  if (!r.ok) throw new Error("Failed");
                  return r.json();
                })
                .then((data) => {
                  if (Array.isArray(data)) setEvents(data);
                  else if (data.events) setEvents(data.events);
                  setLoading(false);
                })
                .catch(() => { setError(true); setLoading(false); });
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            title="Retry"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
