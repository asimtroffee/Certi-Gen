"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setIsLoading(true);
      setError("");
      
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, templateConfig: [] }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create event");
      }

      // Redirect to the canvas editor
      router.push(`/admin/events/${data.event.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center space-x-4">
        <Link href="/admin">
          <Button color="tertiary" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Create New Event</h1>
          <p className="mt-1 text-sm text-gray-500">
            Give your event a name. You&apos;ll upload the certificate template on the next screen.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" className="p-4 rounded-md bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(val) => setTitle(val)}
              placeholder="e.g., 2026 Science Fair"
              isDisabled={isLoading}
              isRequired
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Link href="/admin">
              <Button color="secondary" isDisabled={isLoading}>
                Cancel
              </Button>
            </Link>
            <Button color="primary" type="submit" isDisabled={isLoading || !title.trim()}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Continue to Template Setup
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
