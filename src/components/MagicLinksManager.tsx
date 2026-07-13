"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Loader2, Send, Ban, CheckCircle, Clock, XCircle, Copy, ExternalLink, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";

type MagicLinkItem = {
  id: string;
  teacherEmail: string;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
  status: "pending" | "submitted" | "expired" | "revoked";
  submission: {
    id: string;
    teacherName: string;
    certificateCount: number;
    hasDownloaded: boolean;
    createdAt: string;
  } | null;
};

type Props = {
  eventId: string;
};

type Notification = {
  type: "success" | "error";
  message: string;
  magicUrl?: string;
};

const PAGE_SIZE = 20;

export default function MagicLinksManager({ eventId }: Props) {
  const [links, setLinks] = useState<MagicLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [notif, setNotif] = useState<Notification | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const showNotif = (n: Notification) => {
    setNotif(n);
    setTimeout(() => setNotif(null), 8000);
  };

  const fetchLinks = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/magic-links?page=${p}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data.magicLinks);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      }
    } catch {
      console.error("Failed to fetch magic links");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchLinks(1); }, [fetchLinks]);

  const handleSend = async (targetEmail?: string) => {
    const addr = (targetEmail || email).trim();
    if (!addr) return;
    setSending(true);
    setNotif(null);
    try {
      const res = await fetch(`/api/events/${eventId}/magic-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherEmail: addr }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotif({
          type: data.warning ? "error" : "success",
          message: data.message || "Magic link sent!",
          magicUrl: data.warning ? data.magicUrl : undefined,
        });
        setEmail("");
        fetchLinks(1);
      } else {
        showNotif({ type: "error", message: data.error || "Failed to send magic link" });
      }
    } catch {
      showNotif({ type: "error", message: "Error sending magic link" });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    setNotif(null);
    try {
      const res = await fetch(`/api/events/${eventId}/magic-links/${linkId}`, {
        method: "PATCH",
      });
      if (res.ok) {
        showNotif({ type: "success", message: "Magic link revoked." });
        fetchLinks(page);
      } else {
        const data = await res.json();
        showNotif({ type: "error", message: data.error || "Failed to revoke" });
      }
    } catch {
      showNotif({ type: "error", message: "Error revoking magic link" });
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      showNotif({ type: "success", message: "Link copied to clipboard!" });
    }).catch(() => {
      showNotif({ type: "error", message: "Failed to copy link" });
    });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
      pending: {
        class: "bg-yellow-100 text-yellow-700 border-yellow-200",
        icon: <Clock className="w-3.5 h-3.5" />,
        label: "Pending",
      },
      submitted: {
        class: "bg-green-100 text-green-700 border-green-200",
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        label: "Submitted",
      },
      expired: {
        class: "bg-gray-100 text-gray-500 border-gray-200",
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: "Expired",
      },
      revoked: {
        class: "bg-red-100 text-red-600 border-red-200",
        icon: <Ban className="w-3.5 h-3.5" />,
        label: "Revoked",
      },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.class}`}>
        {s.icon}
        {s.label}
      </span>
    );
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-MY", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Notification banner */}
      {notif && (
        <div className={`p-4 rounded-lg border text-sm flex items-center justify-between gap-3 ${
          notif.type === "success"
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{notif.message}</span>
            {notif.magicUrl && (
              <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                <code className="text-xs bg-white/60 px-2 py-1 rounded border truncate max-w-[300px]">
                  {notif.magicUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyUrl(notif.magicUrl!)}
                  className="p-1 hover:bg-white/60 rounded transition-colors"
                  title="Copy link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotif(null)}
            className="p-1 hover:bg-white/60 rounded transition-colors flex-shrink-0"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Send new magic link */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Magic Link</h2>
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label>Teacher Email</Label>
            <Input
              type="email"
              placeholder="teacher@school.edu"
              value={email}
              onChange={(v) => setEmail(v)}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleSend(); }}
            />
          </div>
          <Button color="primary" onClick={() => handleSend()} isDisabled={!email.trim() || sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send
          </Button>
        </div>
      </div>

      {/* Magic links list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Sent Magic Links
            {!loading && <span className="text-gray-400 font-normal ml-2">({links.length})</span>}
          </h2>
        </div>

        {loading ? (
          <ul className="divide-y divide-gray-200">
            {[1, 2, 3].map((i) => (
              <li key={i} className="px-6 py-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-48" />
                    <div className="h-3 bg-gray-100 rounded w-64" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-5 bg-gray-200 rounded-full w-16" />
                    <div className="h-8 bg-gray-200 rounded-md w-20" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : links.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ExternalLink className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No magic links sent yet.</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-200">
              {links.map((link) => (
                <li key={link.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {link.teacherEmail}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>Sent {formatDate(link.createdAt)}</span>
                          <span>Expires {formatDate(link.expiresAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {statusBadge(link.status)}
                      {link.status === "submitted" && link.submission && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {link.submission.certificateCount} certs
                        </span>
                      )}
                      {link.submission?.hasDownloaded && (
                        <span title="Downloaded"><CheckCircle className="w-4 h-4 text-green-500" /></span>
                      )}
                      {link.status === "pending" && (
                        <Button
                          color="tertiary-destructive"
                          size="xs"
                          onClick={() => handleRevoke(link.id)}
                        >
                          <Ban className="w-3.5 h-3.5 mr-1" />
                          Revoke
                        </Button>
                      )}
                      {(link.status === "revoked" || link.status === "expired") && (
                        <Button
                          color="secondary"
                          size="xs"
                          isDisabled={sending}
                          onClick={() => handleSend(link.teacherEmail)}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Resend
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => fetchLinks(page - 1)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => fetchLinks(p)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        p === page
                          ? "bg-primary-600 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => fetchLinks(page + 1)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
