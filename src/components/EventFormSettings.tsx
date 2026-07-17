"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Link2, Loader2, RefreshCw, CheckCircle, AlertCircle, Info, Send, XCircle } from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";

type Props = {
  eventId: string;
  eventTitle: string;
  serviceAccountEmail?: string;
};

type PendingLink = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "sent" | "failed";
};

export default function EventFormSettings({ eventId, eventTitle, serviceAccountEmail }: Props) {
  const router = useRouter();
  const [sheetId, setSheetId] = useState("");
  const [linkedSheetId, setLinkedSheetId] = useState<string | null>(null);
  const [lastPolledRow, setLastPolledRow] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([]);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sendAllLoading, setSendAllLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/form-link`);
        if (res.ok) {
          const data = await res.json();
          if (data.googleFormSheetId) {
            setLinkedSheetId(data.googleFormSheetId);
            setSheetId(data.googleFormSheetId);
            setLastPolledRow(data.lastPolledRow || 0);
          }
        }
      } catch (err) {
        console.error("Failed to load form link:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [eventId]);

  const handleLink = async () => {
    if (!sheetId.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/form-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId: sheetId.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinkedSheetId(data.googleFormSheetId);
        setLastPolledRow(data.lastPolledRow || 0);
        router.refresh();
      } else {
        setError(data.error || "Failed to link sheet");
      }
    } catch {
      setError("Failed to link sheet");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlink = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/form-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId: "" }),
      });
      if (res.ok) {
        setLinkedSheetId(null);
        setSheetId("");
        setLastPolledRow(0);
        setPollResult(null);
        setPendingLinks([]);
        router.refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePoll = async () => {
    setIsPolling(true);
    setPollResult(null);
    setError(null);
    setPendingLinks([]);
    try {
      const res = await fetch(`/api/events/${eventId}/poll-form`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setPollResult(
          data.message || `Polled successfully. ${data.linksCreated} link(s) created.`
        );
        setLastPolledRow(data.lastPolledRow);
        if (data.pendingLinks?.length) {
          setPendingLinks(
            data.pendingLinks.map((p: { id: string; name: string; email: string }) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              status: "pending" as const,
            }))
          );
        }
        router.refresh();
      } else {
        setError(data.error || "Poll failed");
      }
    } catch {
      setError("Poll failed");
    } finally {
      setIsPolling(false);
    }
  };

  const handleSendSingle = async (linkId: string) => {
    setSendingIds((prev) => new Set(prev).add(linkId));
    try {
      const res = await fetch(`/api/events/${eventId}/send-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkIds: [linkId] }),
      });
      const data = await res.json();
      if (res.ok && data.sent > 0) {
        setPendingLinks((prev) =>
          prev.map((p) => (p.id === linkId ? { ...p, status: "sent" as const } : p))
        );
      } else {
        setPendingLinks((prev) =>
          prev.map((p) => (p.id === linkId ? { ...p, status: "failed" as const } : p))
        );
      }
    } catch {
      setPendingLinks((prev) =>
        prev.map((p) => (p.id === linkId ? { ...p, status: "failed" as const } : p))
      );
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }
  };

  const handleSendAll = async () => {
    setSendAllLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/send-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendAll: true }),
      });
      const data = await res.json();
      if (res.ok && data.results) {
        setPendingLinks((prev) =>
          prev.map((p) => {
            const result = data.results.find((r: { id: string }) => r.id === p.id);
            if (!result) return p;
            return { ...p, status: result.success ? ("sent" as const) : ("failed" as const) };
          })
        );
        setPollResult(data.message || `Sent ${data.sent} email(s).`);
      }
    } catch {
      setError("Failed to send emails");
    } finally {
      setSendAllLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center space-x-4">
        <Link href={`/admin/events/${eventId}`}>
          <Button color="tertiary" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Google Form Settings</h1>
          <p className="mt-1 text-sm text-gray-500">{eventTitle}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Link Google Sheet</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter the Google Sheet ID linked to your Google Form. The sheet should contain
                  columns for teacher name and teacher email.
                </p>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="sheet-id">Sheet ID</Label>
                  <Input
                    id="sheet-id"
                    value={sheetId}
                    onChange={(val) => setSheetId(val)}
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                    isDisabled={isSaving}
                  />
                </div>
                <Button
                  color="primary"
                  onClick={handleLink}
                  isDisabled={!sheetId.trim() || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Link Sheet
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {serviceAccountEmail && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-200">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Before connecting, share your sheet with this email:</p>
                  <code className="block mt-1 text-xs bg-blue-100/50 px-2 py-1 rounded break-all">
                    {serviceAccountEmail}
                  </code>
                  <p className="mt-1 text-blue-600">
                    Open your Google Sheet → Share → add the email above as <strong>Editor</strong>.
                    Also ensure the <strong>Google Sheets API</strong> is enabled in your Cloud project.
                  </p>
                </div>
              </div>
            )}

            {linkedSheetId && (
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Linked Sheet</h2>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{linkedSheetId}</p>
                      <p className="text-xs text-gray-500">
                        Last polled row: {lastPolledRow}
                      </p>
                    </div>
                  </div>
                  <Button color="tertiary" size="sm" onClick={handleUnlink}>
                    Unlink
                  </Button>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      Check for new form responses. New teachers will appear below — review and send emails.
                    </p>
                  </div>
                  <Button
                    color="secondary"
                    onClick={handlePoll}
                    isDisabled={isPolling}
                  >
                    {isPolling ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Polling...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Poll Now
                      </>
                    )}
                  </Button>
                </div>

                {pollResult && !pendingLinks.length && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {pollResult}
                  </div>
                )}

                {pendingLinks.length > 0 && (
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">
                        New Teachers ({pendingLinks.length})
                      </h3>
                      <Button
                        color="primary"
                        size="sm"
                        onClick={handleSendAll}
                        isDisabled={sendAllLoading || pendingLinks.every((p) => p.status !== "pending")}
                      >
                        {sendAllLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send All
                      </Button>
                    </div>

                    <div className="overflow-hidden border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-left">
                          <tr>
                            <th className="px-4 py-2 font-medium">Name</th>
                            <th className="px-4 py-2 font-medium">Email</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {pendingLinks.map((link) => (
                            <tr key={link.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-gray-900">{link.name}</td>
                              <td className="px-4 py-2 text-gray-600">{link.email}</td>
                              <td className="px-4 py-2">
                                {link.status === "sent" ? (
                                  <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Sent
                                  </span>
                                ) : link.status === "failed" ? (
                                  <span className="inline-flex items-center gap-1 text-red-700 text-xs font-medium">
                                    <XCircle className="w-3.5 h-3.5" />
                                    Failed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-yellow-700 text-xs font-medium">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <Button
                                  color="secondary"
                                  size="sm"
                                  onClick={() => handleSendSingle(link.id)}
                                  isDisabled={sendingIds.has(link.id) || link.status === "sent"}
                                >
                                  {sendingIds.has(link.id) ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : link.status === "sent" ? (
                                    "Sent"
                                  ) : (
                                    "Send"
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
