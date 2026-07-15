"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar as CalendarIcon, Link as LinkIcon, FileText, Award,
  Plus, FileSpreadsheet, Upload, Edit, Eye, BarChart3,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import DeleteEventButton from "@/components/DeleteEventButton";
import RestoreEventButton from "@/components/RestoreEventButton";
import EventSearch from "@/src/components/EventSearch";

type Event = {
  id: string;
  title: string;
  slug: string;
  templateUrl: string | null;
  templateConfig: unknown;
  isArchived: boolean;
  createdAt: string;
  adminId: string;
  _count: { magicLinks: number };
};

type Stats = {
  totalEvents: number;
  totalMagicLinks: number;
  totalSubmissions: number;
  totalCertificates: number;
  archivedCount: number;
};

type DashboardData = {
  events: Event[];
  totalEvents: number;
  totalPages: number;
  page: number;
  stats: Stats;
};

function navigate(router: ReturnType<typeof useRouter>, searchParams: ReturnType<typeof useSearchParams>, params: Record<string, string>) {
  const sp = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
    else sp.delete(key);
  }
  router.replace(`/admin?${sp.toString()}`);
}

export default function EventDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [, setLoading] = React.useState(true);

  const tab = searchParams.get("tab") === "archived" ? "archived" : "active";
  const query = searchParams.get("q") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (tab === "archived") params.set("tab", "archived");
      if (query) params.set("q", query);
      if (page > 1) params.set("page", String(page));

      try {
        const res = await fetch(`/api/admin/events?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json: DashboardData = await res.json();
        setData(json);
      } catch {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tab, query, page]);

  if (!data) {
    return <div className="p-8 max-w-7xl mx-auto space-y-8"><DashboardSkeleton /></div>;
  }

  const { events, totalEvents, totalPages: totalPages_, stats } = data;

  const statsCards = [
    { label: "Total Events", value: stats.totalEvents, icon: CalendarIcon, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Magic Links Sent", value: stats.totalMagicLinks, icon: LinkIcon, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Submissions", value: stats.totalSubmissions, icon: FileText, color: "text-green-600", bg: "bg-green-100" },
    { label: "Certificates Generated", value: stats.totalCertificates, icon: Award, color: "text-amber-600", bg: "bg-amber-100" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your certificate generation events and magic links.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/batch">
            <Button color="secondary">
              <Eye className="w-5 h-5 mr-2" />
              Preview Certificates
            </Button>
          </Link>
          <Link href="/admin/events/new">
            <Button color="primary">
              <Plus className="w-5 h-5 mr-2" />
              Create Event
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-6 h-6 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(router, searchParams, { tab: "", q: "", page: "" })}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "active"
                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => navigate(router, searchParams, { tab: "archived", q: "", page: "" })}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "archived"
                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Archived
            {stats.archivedCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                {stats.archivedCount}
              </span>
            )}
          </button>
        </div>
        {tab === "active" && (
          <EventSearch
            query={query}
            onSearch={(q) => navigate(router, searchParams, { q, page: "" })}
          />
        )}
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center bg-white">
          <div className="mx-auto w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {tab === "archived" ? "No archived events" : "No events found"}
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {tab === "archived"
              ? "Archived events will appear here after you delete them."
              : "Get started by creating a new event. You will be able to upload a certificate template and generate magic links for teachers."
            }
          </p>
          {tab === "active" && (
            <Link href="/admin/events/new">
              <Button color="primary">
                <Plus className="w-5 h-5 mr-2" />
                Create Event
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 text-sm text-gray-500 border-b border-gray-100">
            {totalEvents} event{totalEvents !== 1 ? "s" : ""}
            {query && <> matching &quot;{query}&quot;</>}
          </div>
          <ul className="divide-y divide-gray-200">
            {events.map((event) => (
              <li key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {event.templateUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={event.templateUrl} alt="Template" className="w-full h-full object-cover" />
                      ) : (
                        <CalendarIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {event.title}
                      </h3>
                      <div className="flex items-center mt-1 space-x-4 text-sm text-gray-500">
                        <span className="flex items-center whitespace-nowrap">
                          <LinkIcon className="w-4 h-4 mr-1 text-gray-400" />
                          {event._count.magicLinks} Magic Links
                        </span>
                        <span className="whitespace-nowrap">Created {new Date(event.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto pb-0.5">
                    {tab === "archived" ? (
                      <RestoreEventButton eventId={event.id} eventTitle={event.title} />
                    ) : (
                      <>
                        <Link href={`/admin/events/${event.id}/form`}>
                          <Button color="tertiary" size="sm" className="whitespace-nowrap">
                            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                            Form
                          </Button>
                        </Link>
                        <Link href={`/admin/events/${event.id}/magic-links`}>
                          <Button color="secondary" size="sm" className="whitespace-nowrap">
                            <LinkIcon className="w-4 h-4 mr-1.5" />
                            Links
                          </Button>
                        </Link>
                        <Link href={`/admin/events/${event.id}/bulk`}>
                          <Button color="secondary" size="sm" className="whitespace-nowrap">
                            <Upload className="w-4 h-4 mr-1.5" />
                            Bulk
                          </Button>
                        </Link>
                        <Link href={`/admin/analytics?eventId=${event.id}`}>
                          <Button color="tertiary" size="sm" className="whitespace-nowrap">
                            <BarChart3 className="w-4 h-4 mr-1.5" />
                            Analytics
                          </Button>
                        </Link>
                        <Link href={`/admin/events/${event.id}`}>
                          <Button color="primary" size="sm" className="whitespace-nowrap">
                            <Edit className="w-4 h-4 mr-1.5" />
                            Edit
                          </Button>
                        </Link>
                        <DeleteEventButton eventId={event.id} eventTitle={event.title} />
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages_ > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages_}
              </p>
              <div className="flex items-center gap-1">
                {page > 1 && (
                  <button
                    onClick={() => navigate(router, searchParams, { page: String(page - 1) })}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {Array.from({ length: totalPages_ }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages_ || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-gray-300">...</span>
                      )}
                      <button
                        onClick={() => navigate(router, searchParams, { page: String(p) })}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                          p === page
                            ? "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                {page < totalPages_ && (
                  <button
                    onClick={() => navigate(router, searchParams, { page: String(page + 1) })}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="mt-2 h-4 w-64 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-40 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
