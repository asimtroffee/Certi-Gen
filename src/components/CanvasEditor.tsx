"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Type, Image as ImageIcon, Trash2, Loader2, Upload, GripHorizontal, ImageUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";

export type TextFieldConfig = {
  id: string;
  type: "text";
  label: string;
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  textAlign: "left" | "center" | "right";
  fontWeight: "normal" | "bold";
};

export type ImageFieldConfig = {
  id: string;
  type: "image";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageUrl: string;
  opacity: number;
};

export type FieldConfig = TextFieldConfig | ImageFieldConfig;

type Props = {
  eventId: string;
  title: string;
  initialTemplateUrl: string;
  initialConfig: FieldConfig[] | null;
};

const FONT_FAMILIES = ["Great Vibes", "Inter", "Helvetica", "Times-Roman"];

function genId() {
  return Math.random().toString(36).substring(2, 11);
}

function normalizeField(f: Record<string, unknown>): FieldConfig {
  if (f.type === "image") return { ...f, type: "image" as const } as unknown as ImageFieldConfig;
  return { ...f, type: "text" as const } as unknown as TextFieldConfig;
}

export default function CanvasEditor({ eventId, title, initialTemplateUrl, initialConfig }: Props) {
  const router = useRouter();
  const [templateUrl, setTemplateUrl] = useState(initialTemplateUrl);
  const [fields, setFields] = useState<FieldConfig[]>(
    Array.isArray(initialConfig) && initialConfig.length > 0 ? initialConfig.map(normalizeField) : []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1);

  const selected = fields.find((f) => f.id === selectedId);

  // Measure container and scale
  useEffect(() => {
    if (!containerRef.current || imgSize.w === 0) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const cw = width - 64;
      const ch = height - 64;
      setScale(Math.min(1, cw / imgSize.w, ch / imgSize.h));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [imgSize]);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    fd.append("templateConfig", JSON.stringify(fields));
    try {
      const res = await fetch(`/api/events/${eventId}/template`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.event?.templateUrl) {
        setTemplateUrl(data.event.templateUrl);
        router.refresh();
      } else {
        alert(data.error || "Upload failed");
      }
    } catch {
      alert("Upload error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateConfig: fields }),
      });
      if (res.ok) {
        alert("Saved");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Save failed");
      }
    } catch {
      alert("Save error");
    } finally {
      setIsSaving(false);
    }
  };

  const addTextField = () => {
    const f: TextFieldConfig = {
      id: genId(), type: "text", label: "New Field", x: 50, y: 50,
      fontFamily: "Inter", fontSize: 48, fontColor: "#000000",
      textAlign: "center", fontWeight: "bold",
    };
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
  };

  const updField = (id: string, u: Partial<FieldConfig>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...u } : f)) as FieldConfig[]);

  // Dragging logic
  const dragInfo = useRef<{ id: string; startX: number; startY: number; initX: number; initY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);
    const f = fields.find(f => f.id === id);
    if (!f) return;
    dragInfo.current = { id, startX: e.clientX, startY: e.clientY, initX: f.x, initY: f.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.current) return;
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;
    
    // Convert dx/dy to percentages
    const pctX = (dx / (imgSize.w * scale)) * 100;
    const pctY = (dy / (imgSize.h * scale)) * 100;
    
    updField(dragInfo.current.id, {
      x: Math.max(0, Math.min(100, dragInfo.current.initX + pctX)),
      y: Math.max(0, Math.min(100, dragInfo.current.initY + pctY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragInfo.current = null;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex-shrink-0 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin">
            <Button color="tertiary" size="sm" className="p-2"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{title} <span className="text-gray-400 font-normal">| Template Editor</span></h1>
        </div>
        <div className="flex items-center space-x-3">
          <Button color="secondary" onClick={addTextField} isDisabled={!templateUrl}><Type className="w-4 h-4 mr-2" /> Add Text</Button>
          <Button color="primary" onClick={handleSave} isDisabled={!templateUrl || isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Configuration
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-100 overflow-auto relative p-8 flex items-center justify-center" ref={containerRef} onClick={() => setSelectedId(null)}>
          {!templateUrl ? (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center w-full max-w-lg">
              <Upload className="w-8 h-8 mx-auto mb-4 text-primary-600" />
              <h2 className="text-xl font-semibold mb-2">Upload Template</h2>
              <Label htmlFor="template-upload" className="cursor-pointer inline-block mt-4 px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">Select Image</Label>
              <input id="template-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
          ) : (
            <div 
              className="relative shadow-xl bg-white select-none touch-none" 
              style={{ width: imgSize.w * scale, height: imgSize.h * scale }}
            >
              <img src={templateUrl} alt="Template" className="w-full h-full object-fill pointer-events-none" onLoad={handleImgLoad} />
              
              {fields.map(f => (
                <div
                  key={f.id}
                  onPointerDown={(e) => handlePointerDown(e, f.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={`absolute flex items-center justify-center cursor-move whitespace-nowrap
                    ${selectedId === f.id ? 'ring-2 ring-primary-500 bg-primary-50/20' : ''}`}
                  style={{
                    left: `${f.x}%`,
                    top: `${f.y}%`,
                    transform: f.type === 'text' && f.textAlign === 'center' ? 'translate(-50%, -50%)' 
                              : f.type === 'text' && f.textAlign === 'right' ? 'translate(-100%, -50%)'
                              : 'translate(0, -50%)',
                    fontFamily: f.type === 'text' ? f.fontFamily : 'inherit',
                    fontSize: f.type === 'text' ? f.fontSize * scale : 'inherit',
                    fontWeight: f.type === 'text' ? f.fontWeight : 'inherit',
                    color: f.type === 'text' ? f.fontColor : 'inherit',
                  }}
                >
                  {f.type === 'text' ? (f.label || "Sample Text") : "Image"}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar settings */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto p-6">
            {!selected ? (
              <div className="text-center text-sm text-gray-500 mt-12">
                <GripHorizontal className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                Select a field on the canvas.
              </div>
            ) : selected.type === "text" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={selected.label} onChange={(v) => updField(selected.id, { label: v })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Input type="number" value={String(selected.fontSize)} onChange={(v) => updField(selected.id, { fontSize: parseInt(v) || 16 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input type="color" className="h-10 p-1 w-full" value={selected.fontColor} onChange={(v) => updField(selected.id, { fontColor: v })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <select className="w-full border p-2 rounded" value={selected.fontFamily} onChange={(e) => updField(selected.id, { fontFamily: e.target.value })}>
                    {FONT_FAMILIES.map((ff) => <option key={ff} value={ff}>{ff}</option>)}
                  </select>
                </div>
                <div className="pt-4">
                  <Button color="tertiary" size="sm" onClick={() => setFields(fields.filter(f => f.id !== selected.id))} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </div>
              </div>
            )}
        </aside>
      </div>
    </div>
  );
}
