"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/base/buttons/button";

type Props = {
  eventId: string;
  eventTitle: string;
};

export default function DeleteEventButton({ eventId, eventTitle }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Delete "${eventTitle}"? This will archive the event and all its magic links.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete event");
        return;
      }
      router.refresh();
    } catch {
      alert("Error deleting event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button color="tertiary-destructive" size="sm" onClick={handleDelete} isDisabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
      Delete
    </Button>
  );
}
