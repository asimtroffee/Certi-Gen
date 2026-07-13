"use client";

import React from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

type TimelinePoint = {
  date: string;
  certificates: number;
  submissions: number;
};

type TopEvent = {
  name: string;
  certificates: number;
};

type Props = {
  timeline: TimelinePoint[];
  topEvents: TopEvent[];
  isSingleEvent: boolean;
};

export default function AnalyticsCharts({ timeline, topEvents, isSingleEvent }: Props) {
  const hasTimeline = timeline.length > 1 || (timeline.length === 1 && (timeline[0].certificates > 0 || timeline[0].submissions > 0));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Certificates Over Time */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Certificates Over Time</h3>
        <p className="text-xs text-gray-500 mb-4">Daily / monthly certificate generation volume</p>
        {hasTimeline ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="certificates"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                name="Certificates"
              />
              <Line
                type="monotone"
                dataKey="submissions"
                stroke="#7c3aed"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="Submissions"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
            Not enough data for a timeline
          </div>
        )}
      </div>

      {/* Top Events — hidden when filtered to a single event */}
      {!isSingleEvent && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {topEvents.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Top Events</h3>
              <p className="text-xs text-gray-500 mb-4">By total certificates generated</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topEvents} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" width={120} />
                  <Tooltip />
                  <Bar dataKey="certificates" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              No event data yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
