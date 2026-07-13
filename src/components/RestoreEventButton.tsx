"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/base/buttons/button";

type Props = {
  eventId: string;
  eventTitle: string;
};

export default function RestoreEventButton({ eventId, eventTitle }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRestore = async () => {
    if (!confirm(`Restore "${eventTitle}"? This will make it visible on the dashboard again.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to restore event");
        return;
      }
      router.refresh();
    } catch {
      alert("Error restoring event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button color="secondary" size="sm" onClick={handleRestore} isDisabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
      Restore
    </Button>
  );
}
