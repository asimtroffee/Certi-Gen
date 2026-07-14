import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";
import AnalyticsFilters from "@/src/components/AnalyticsFilters";
import AnalyticsCharts from "@/src/components/AnalyticsCharts";
import EventStudentTable from "@/src/components/EventStudentTable";

export const metadata = {
  title: "Analytics | CertiGen",
};

function getDateRange(range: string): Date | null {
  if (range === "all") return null;
  const days = parseInt(range, 10) || 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function groupTimeline(
  items: { createdAt: Date; certificateCount: number }[],
  startDate: Date | null,
  range: string
) {
  const map = new Map<string, { certificates: number; submissions: number }>();

  let cursor = startDate ? new Date(startDate) : new Date("2020-01-01");
  const now = new Date();
  const isWide = range === "90" || range === "all";
  const fmt = isWide ? "month" : "day";

  while (cursor <= now) {
    const key =
      fmt === "month"
        ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
        : cursor.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, { certificates: 0, submissions: 0 });
    if (fmt === "month") {
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  for (const item of items) {
    const key =
      fmt === "month"
        ? `${item.createdAt.getFullYear()}-${String(item.createdAt.getMonth() + 1).padStart(2, "0")}`
        : item.createdAt.toISOString().slice(0, 10);
    const entry = map.get(key);
    if (entry) {
      entry.certificates += item.certificateCount;
      entry.submissions += 1;
    }
  }

  return Array.from(map.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default async function AnalyticsPage(props: {
  searchParams?: Promise<{ range?: string; eventId?: string }>;
}) {
  const sp = await props.searchParams;
  const range = sp?.range || "30";
  const eventId = sp?.eventId || "";

  const userOrResponse = await requireAdmin();
  if ("status" in userOrResponse) {
    redirect("/api/auth/signin");
  }
  const user = userOrResponse;

  const startDate = getDateRange(range);
  const dateFilter = startDate ? { gte: startDate } : undefined;
  const isSingleEvent = !!eventId;

  // ── KPI Queries ──
  const eventWhere = {
    adminId: user.id,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(isSingleEvent ? { id: eventId } : {}),
    isArchived: false,
  };

  const submissionWhere = {
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(isSingleEvent ? { eventId } : {}),
    OR: [{ adminId: user.id }, { magicLink: { event: { adminId: user.id } } }],
  };

  const [totalEvents, totalMagicLinks, submissions] = await Promise.all([
    prisma.event.count({ where: eventWhere }),
    prisma.magicLink.count({
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(isSingleEvent ? { event: { id: eventId } } : { event: { adminId: user.id } }),
      },
    }),
    prisma.submission.findMany({
      where: submissionWhere,
      select: {
        id: true,
        certificateCount: true,
        createdAt: true,
        teacherName: true,
        teacherEmail: true,
        hasDownloaded: true,
        adminId: true,
        magicLinkId: true,
        studentData: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalCertificates = submissions.reduce<number>((s, x) => s + x.certificateCount, 0);
  const uniqueTeachers = new Set(submissions.map((s) => s.teacherEmail)).size;

  // ── Timeline ──
  const timeline = groupTimeline(submissions, startDate, range);

  // ── Top Events (only for all-events view) ──
  let topEvents: { name: string; certificates: number }[] = [];
  let eventTableRows: {
    id: string;
    title: string;
    createdAt: Date;
    magicLinks: number;
    submissions: number;
    certificates: number;
  }[] = [];

  if (!isSingleEvent) {
    const events = await prisma.event.findMany({
      where: { adminId: user.id, isArchived: false },
      include: {
        _count: { select: { magicLinks: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const allSubs = await prisma.submission.findMany({
      where: {
        OR: [
          { adminId: user.id },
          { magicLink: { event: { adminId: user.id } } },
        ],
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: { eventId: true, certificateCount: true, adminId: true },
    });

    const certMap = new Map<string, number>();
    for (const s of allSubs) {
      const eid = s.eventId || "";
      certMap.set(eid, (certMap.get(eid) || 0) + s.certificateCount);
    }

    const subCountMap = new Map<string, number>();
    for (const s of allSubs) {
      const eid = s.eventId || "";
      subCountMap.set(eid, (subCountMap.get(eid) || 0) + 1);
    }

    eventTableRows = events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      createdAt: ev.createdAt,
      magicLinks: ev._count.magicLinks,
      submissions: subCountMap.get(ev.id) || 0,
      certificates: certMap.get(ev.id) || 0,
    }));

    const sorted = [...eventTableRows].sort((a, b) => b.certificates - a.certificates);
    topEvents = sorted.slice(0, 10).map((e) => ({ name: e.title, certificates: e.certificates }));
  }

  // ── Event Title ──
  let eventTitle: string | undefined;
  if (isSingleEvent) {
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });
    eventTitle = ev?.title;
  }

  // ── Teacher Breakdown (event-specific) ──
  const teacherBreakdown = isSingleEvent
    ? submissions.map((s) => ({
        teacherName: s.teacherName,
        teacherEmail: s.teacherEmail,
        certificates: s.certificateCount,
        hasDownloaded: s.hasDownloaded,
        createdAt: s.createdAt,
        source: (s.adminId ? "admin-bulk" : "magic-link") as "admin-bulk" | "magic-link",
      }))
    : undefined;

  // ── Student List (event-specific) ──
  let studentList: {
    name: string;
    otherFields: Record<string, string>;
    submittedBy: string;
    submittedAt: Date;
  }[] = [];

  if (isSingleEvent) {
    for (const s of submissions) {
      const dataArr = Array.isArray(s.studentData) ? s.studentData : [];
      for (const row of dataArr) {
        const r = row as Record<string, unknown>;
        const name = String(r.name || r.Name || r.NAME || r.student_name || r["Student Name"] || "");
        const otherFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) {
          if (!["name", "Name", "NAME", "student_name", "Student Name"].includes(k)) {
            otherFields[k] = String(v ?? "");
          }
        }
        studentList.push({
          name,
          otherFields,
          submittedBy: s.teacherName,
          submittedAt: s.createdAt,
        });
      }
    }
  }

  // ── Extra KPIs for single event ──
  const conversionRate =
    isSingleEvent && totalMagicLinks > 0
      ? Math.round((submissions.length / totalMagicLinks) * 100)
      : undefined;

  const downloadRate =
    isSingleEvent && submissions.length > 0
      ? Math.round((submissions.filter((s) => s.hasDownloaded).length / submissions.length) * 100)
      : undefined;

  const avgCerts =
    isSingleEvent && submissions.length > 0
      ? Math.round((totalCertificates / submissions.length) * 10) / 10
      : undefined;

  const activeMagicLinks = isSingleEvent
    ? await prisma.magicLink.count({
        where: {
          event: { id: eventId, adminId: user.id },
          isRevoked: false,
          expiresAt: { gte: new Date() },
          submission: null,
        },
      })
    : undefined;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isSingleEvent && eventTitle ? `${eventTitle} Analytics` : "Analytics"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isSingleEvent
              ? `Detailed breakdown for "${eventTitle}"`
              : "Overview of all your certificate events"}
          </p>
        </div>
      </div>

      <AnalyticsFilters currentRange={range} currentEventId={eventId} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Events" value={isSingleEvent ? 1 : totalEvents} />
        <KpiCard label="Certificates" value={totalCertificates} />
        <KpiCard label="Submissions" value={submissions.length} />
        <KpiCard label="Magic Links" value={totalMagicLinks} />
        <KpiCard label="Teachers" value={uniqueTeachers} />
      </div>

      {/* Extra KPIs for single event */}
      {isSingleEvent && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Conversion Rate" value={conversionRate !== undefined ? `${conversionRate}%` : "—"} />
          <KpiCard label="Download Rate" value={downloadRate !== undefined ? `${downloadRate}%` : "—"} />
          <KpiCard label="Avg Certs / Sub" value={avgCerts !== undefined ? avgCerts : "—"} />
          <KpiCard label="Active Links" value={activeMagicLinks ?? "—"} />
        </div>
      )}

      {/* Charts */}
      <AnalyticsCharts timeline={timeline} topEvents={topEvents} isSingleEvent={isSingleEvent} />

      {/* Teacher Breakdown (event-specific) */}
      {isSingleEvent && teacherBreakdown && teacherBreakdown.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Teachers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Certificates</th>
                  <th className="px-6 py-3 font-medium">Downloaded</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teacherBreakdown.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900">{t.teacherName}</td>
                    <td className="px-6 py-3 text-gray-600">{t.teacherEmail}</td>
                    <td className="px-6 py-3 text-gray-900 font-medium">{t.certificates}</td>
                    <td className="px-6 py-3">{t.hasDownloaded ? "✓" : "—"}</td>
                    <td className="px-6 py-3 text-gray-500">{t.createdAt.toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.source === "admin-bulk"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {t.source === "admin-bulk" ? "Admin Bulk" : "Magic Link"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Student List (event-specific) */}
      {isSingleEvent && studentList.length > 0 && (
        <EventStudentTable students={studentList} />
      )}

      {/* Event Summary Table (all events) */}
      {!isSingleEvent && eventTableRows.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Events Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium">Event</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium">Links</th>
                  <th className="px-6 py-3 font-medium">Submissions</th>
                  <th className="px-6 py-3 font-medium">Certificates</th>
                  <th className="px-6 py-3 font-medium">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {eventTableRows.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900 font-medium">{ev.title}</td>
                    <td className="px-6 py-3 text-gray-500">{ev.createdAt.toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-gray-900">{ev.magicLinks}</td>
                    <td className="px-6 py-3 text-gray-900">{ev.submissions}</td>
                    <td className="px-6 py-3 text-gray-900 font-medium">{ev.certificates}</td>
                    <td className="px-6 py-3">
                      {ev.magicLinks > 0
                        ? `${Math.round((ev.submissions / ev.magicLinks) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!isSingleEvent && eventTableRows.length === 0 && submissions.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No data yet for this period.</p>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
