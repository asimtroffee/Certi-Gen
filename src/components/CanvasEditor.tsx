"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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

const SAMPLE_TEXT = "Sample Name";
const HIT_THRESHOLD = 24;

const FONT_FAMILIES = [
  "Great Vibes",
  "Inter",
  "Helvetica",
  "Times-Roman",
];

function fontFamilyToCSS(family: string): string {
  switch (family) {
    case "Great Vibes": return '"Great Vibes", cursive';
    case "Inter": return '"Inter", system-ui, sans-serif';
    case "Helvetica": return "Helvetica, Arial, sans-serif";
    case "Times-Roman": return '"Times New Roman", Times, serif';
    default: return "sans-serif";
  }
}

function genId() {
  return Math.random().toString(36).substring(2, 11);
}

function normalizeField(f: Record<string, unknown>): FieldConfig {
  if (f.type === "image") {
    return { ...f, type: "image" as const } as unknown as ImageFieldConfig;
  }
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
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [cssSize, setCssSize] = useState({ w: 800, h: 600 });

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragId = useRef<string | null>(null);

  const selected = fields.find((f) => f.id === selectedId);

  // Compute CSS display size to fit container while preserving aspect ratio
  const updateCssSize = useCallback(() => {
    if (!containerRef.current || imgSize.w === 0) return;
    const cw = containerRef.current.clientWidth - 64;
    const ch = containerRef.current.clientHeight - 64;
    const scale = Math.min(1, cw / imgSize.w, ch / imgSize.h);
    setCssSize({ w: imgSize.w * scale, h: imgSize.h * scale });
  }, [imgSize]);

  useEffect(() => {
    updateCssSize();
    window.addEventListener("resize", updateCssSize);
    return () => window.removeEventListener("resize", updateCssSize);
  }, [updateCssSize]);

  // ---- Image field cache for canvas rendering ------------------------------
  const fieldImageCache = useRef<Record<string, HTMLImageElement>>({});

  const getFieldImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      if (fieldImageCache.current[url]) {
        resolve(fieldImageCache.current[url]);
        return;
      }
      const img = new window.Image();
      img.onload = () => { fieldImageCache.current[url] = img; resolve(img); };
      img.onerror = () => resolve(img);
      img.src = url;
    });
  };

  // ---- Canvas draw --------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current?.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = imgSize.w;
    canvas.height = imgSize.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, imgSize.w, imgSize.h);

    for (const f of fields) {
      const sel = f.id === selectedId;

      if (f.type === "image") {
        const px = (f.x / 100) * imgSize.w;
        const py = (f.y / 100) * imgSize.h;
        const pw = (f.width / 100) * imgSize.w;
        const ph = (f.height / 100) * imgSize.h;
        const cached = fieldImageCache.current[f.imageUrl];
        if (cached && cached.complete && cached.naturalWidth > 0) {
          ctx.save();
          ctx.globalAlpha = f.opacity / 100;
          ctx.drawImage(cached, px, py, pw, ph);
          ctx.restore();
        } else {
          getFieldImage(f.imageUrl);
          ctx.fillStyle = "rgba(200,200,200,0.3)";
          ctx.fillRect(px, py, pw, ph);
          ctx.fillStyle = "#999";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Loading...", px + pw / 2, py + ph / 2);
        }
        if (sel) {
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(px, py, pw, ph);
          ctx.setLineDash([]);
          // Corner dots
          const ds = 5;
          ctx.fillStyle = "#2563eb";
          [
            [px, py], [px + pw, py], [px, py + ph], [px + pw, py + ph],
          ].forEach(([cx, cy]) => {
            ctx.beginPath();
            ctx.arc(cx, cy, ds, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      } else {
        const px = (f.x / 100) * imgSize.w;
        const py = (f.y / 100) * imgSize.h;

        ctx.save();
        ctx.font = `${f.fontWeight === "bold" ? "bold " : ""}${f.fontSize}px ${fontFamilyToCSS(f.fontFamily)}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = f.textAlign;
        ctx.fillStyle = f.fontColor;
        ctx.fillText(SAMPLE_TEXT, px, py);

        ctx.strokeStyle = sel ? "#2563eb" : "rgba(0,0,0,0.35)";
        ctx.lineWidth = sel ? 2 : 1;
        const cs = 7;
        ctx.beginPath();
        ctx.moveTo(px - cs, py);
        ctx.lineTo(px + cs, py);
        ctx.moveTo(px, py - cs);
        ctx.lineTo(px, py + cs);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = sel ? "#2563eb" : "rgba(0,0,0,0.35)";
        ctx.fill();

        if (sel) {
          const m = ctx.measureText(SAMPLE_TEXT);
          const tw = m.width;
          const th = f.fontSize * 1.2;
          let bx = px;
          if (f.textAlign === "center") bx = px - tw / 2;
          else if (f.textAlign === "right") bx = px - tw;
          const by = py - th / 2;
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(bx, by, tw, th);
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }
  }, [fields, selectedId, imgSize]);

  useEffect(() => { draw(); }, [draw]);

  // ---- Image load ---------------------------------------------------------
  const handleImgLoad = () => {
    if (imgRef.current) {
      const w = imgRef.current.naturalWidth;
      const h = imgRef.current.naturalHeight;
      setImgSize({ w, h });
    }
  };

  // ---- Upload -------------------------------------------------------------
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
      if (res.ok && data.templateUrl) {
        setTemplateUrl(data.templateUrl);
        router.refresh();
      } else {
        console.error("Upload response:", res.status, data);
        alert(`Upload failed (${res.status}): ${JSON.stringify(data)}`);
      }
    } catch {
      alert("Upload error");
    } finally {
      setIsUploading(false);
    }
  };

  // ---- Save ---------------------------------------------------------------
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

  // ---- Field CRUD ---------------------------------------------------------
  const addTextField = () => {
    const f: TextFieldConfig = {
      id: genId(), type: "text", label: "New Field", x: 50, y: 50,
      fontFamily: "Inter", fontSize: 48, fontColor: "#000000",
      textAlign: "center", fontWeight: "bold",
    };
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
  };

  const addImageField = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg, image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("image", file);
      try {
        const res = await fetch("/api/upload/field-image", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) { alert(data.error || "Upload failed"); return; }
        const f: ImageFieldConfig = {
          id: genId(), type: "image", label: file.name.split(".")[0] || "Image",
          x: 50, y: 50, width: 30, height: 30, imageUrl: data.url, opacity: 100,
        };
        setFields((prev) => [...prev, f]);
        setSelectedId(f.id);
      } catch { alert("Image upload failed"); }
    };
    input.click();
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };

  const updField = (id: string, u: Partial<FieldConfig>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...u } : f)) as FieldConfig[]);

  // ---- Canvas mouse (percentage from CSS dimensions) ----------------------
  const posFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return {
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      };
    },
    []
  );

  const nearest = useCallback(
    (px: number, py: number) => {
      let best: FieldConfig | null = null;
      let bestDist = HIT_THRESHOLD;
      for (const f of fields) {
        if (f.type === "image") {
          const ax = (f.x / 100) * imgSize.w;
          const ay = (f.y / 100) * imgSize.h;
          const aw = (f.width / 100) * imgSize.w;
          const ah = (f.height / 100) * imgSize.h;
          if (px >= ax && px <= ax + aw && py >= ay && py <= ay + ah) {
            const cx = ax + aw / 2;
            const cy = ay + ah / 2;
            const d = Math.hypot(px - cx, py - cy);
            if (d < bestDist) { bestDist = d; best = f; }
          }
        } else {
          const ax = (f.x / 100) * imgSize.w;
          const ay = (f.y / 100) * imgSize.h;
          const d = Math.hypot(px - ax, py - ay);
          if (d < bestDist) { bestDist = d; best = f; }
        }
      }
      return best;
    },
    [fields, imgSize]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = posFromEvent(e);
    const pctP = { x: (p.x / 100) * imgSize.w, y: (p.y / 100) * imgSize.h };
    const n = nearest(pctP.x, pctP.y);
    if (n) {
      setSelectedId(n.id);
      dragging.current = true;
      dragId.current = n.id;
    } else {
      setSelectedId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging.current || !dragId.current) return;
    const p = posFromEvent(e);
    updField(dragId.current, {
      x: Math.max(0, Math.min(100, Math.round(p.x * 100) / 100)),
      y: Math.max(0, Math.min(100, Math.round(p.y * 100) / 100)),
    });
  };

  const handleMouseUp = () => { dragging.current = false; dragId.current = null; };
  const handleMouseLeave = () => { dragging.current = false; dragId.current = null; };

  // ---- Render -------------------------------------------------------------
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin">
            <Button color="tertiary" size="sm" className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            {title} <span className="text-gray-400 font-normal">| Template Editor</span>
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          <Button color="secondary" onClick={addTextField} isDisabled={!templateUrl}>
            <Type className="w-4 h-4 mr-2" /> Add Text
          </Button>
          <Button color="secondary" onClick={addImageField} isDisabled={!templateUrl}>
            <ImageUp className="w-4 h-4 mr-2" /> Add Image
          </Button>
          <Button color="primary" onClick={handleSave} isDisabled={!templateUrl || isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Configuration
          </Button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 bg-gray-100 overflow-auto relative p-8" ref={containerRef}>
          {!templateUrl ? (
            <div className="flex flex-col items-center justify-center h-full w-full max-w-lg m-auto">
              <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center w-full">
                <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Template Image</h2>
                <p className="text-gray-500 mb-8">
                  Upload a blank certificate template (PNG or JPG). The image will be the background for your generated PDFs.
                </p>
                <Label htmlFor="template-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center w-full px-6 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors">
                    {isUploading ? (
                      <span className="flex items-center text-primary-600 font-medium">
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...
                      </span>
                    ) : (
                      <span className="flex items-center text-gray-700 font-medium">
                        <Upload className="w-5 h-5 mr-2" /> Select Image
                      </span>
                    )}
                  </div>
                </Label>
                <input
                  id="template-upload" type="file" accept="image/png, image/jpeg"
                  className="hidden" onChange={handleFileUpload} disabled={isUploading}
                />
              </div>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={templateUrl} alt="" className="hidden" onLoad={handleImgLoad} />
              {imgSize.w > 0 && (
                <canvas
                  ref={canvasRef}
                  width={imgSize.w}
                  height={imgSize.h}
                  className="shadow-xl bg-white"
                  style={{ width: cssSize.w, height: cssSize.h, display: "block" }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                />
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center">
              <Type className="w-4 h-4 mr-2" /> Properties
            </h2>
          </div>
          <div className="p-6">
            {!selected ? (
              <div className="text-center text-sm text-gray-500 mt-12">
                <GripHorizontal className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                Select or drag a field on the canvas.
              </div>
            ) : selected.type === "image" ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={selected.label}
                    onChange={(v) => updField(selected.id, { label: v })}
                    placeholder="e.g. Logo"
                  />
                </div>

                {/* Image thumbnail */}
                <div className="space-y-2">
                  <Label>Preview</Label>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.imageUrl} alt={selected.label}
                    className="w-full h-32 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Width %</Label>
                      <input type="number" min={1} max={100} step={0.5}
                        value={String(selected.width)}
                        onChange={(e) => updField(selected.id, { width: Math.max(1, Math.min(100, parseFloat(e.target.value) || 1)) })}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Height %</Label>
                      <input type="number" min={1} max={100} step={0.5}
                        value={String(selected.height)}
                        onChange={(e) => updField(selected.id, { height: Math.max(1, Math.min(100, parseFloat(e.target.value) || 1)) })}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                      />
                    </div>
                  </div>

                <div className="space-y-2">
                  <Label>Opacity</Label>
                  <input type="range" min={0} max={100}
                    value={selected.opacity}
                    onChange={(e) => updField(selected.id, { opacity: parseInt(e.target.value) })}
                    className="w-full" />
                  <span className="text-xs text-gray-500">{selected.opacity}%</span>
                </div>

                <div className="space-y-2">
                  <Label>Position (% of template)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500">X%</span>
                      <input type="number" min={0} max={100} step={0.1}
                        value={String(selected.x)}
                        onChange={(e) => updField(selected.id, { x: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500">Y%</span>
                      <input type="number" min={0} max={100} step={0.1}
                        value={String(selected.y)}
                        onChange={(e) => updField(selected.id, { y: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button color="tertiary" size="sm"
                    onClick={() => removeField(selected.id)}
                    className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Image
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={selected.label}
                    onChange={(v) => updField(selected.id, { label: v })}
                    placeholder="e.g. Student Name"
                  />
                  <p className="text-xs text-gray-500">Maps to CSV column with this name.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Input type="number" value={String(selected.fontSize)}
                      onChange={(v) => updField(selected.id, { fontSize: parseInt(v) || 16 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input type="color" className="h-10 p-1 w-full"
                      value={selected.fontColor}
                      onChange={(v) => updField(selected.id, { fontColor: v })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                    value={selected.fontFamily}
                    onChange={(e) => updField(selected.id, { fontFamily: e.target.value })}>
                    {FONT_FAMILIES.map((ff) => <option key={ff} value={ff}>{ff}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Font Weight</Label>
                  <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                    value={selected.fontWeight}
                    onChange={(e) => updField(selected.id, { fontWeight: e.target.value as "normal" | "bold" })}>
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Text Alignment</Label>
                  <div className="flex rounded-md shadow-sm">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} type="button"
                        className={`flex-1 px-3 py-2 text-xs font-medium border ${selected.textAlign === a
                          ? "bg-primary-50 text-primary-700 border-primary-500 z-10"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        } ${a === "left" ? "rounded-l-md" : ""} ${a === "right" ? "rounded-r-md" : ""}`}
                        onClick={() => updField(selected.id, { textAlign: a })}>
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Position (% of template)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500">X%</span>
                      <input type="number" min={0} max={100} step={0.1}
                        value={String(selected.x)}
                        onChange={(e) => updField(selected.id, { x: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500">Y%</span>
                      <input type="number" min={0} max={100} step={0.1}
                        value={String(selected.y)}
                        onChange={(e) => updField(selected.id, { y: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button color="tertiary" size="sm"
                    onClick={() => removeField(selected.id)}
                    className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Field
                  </Button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
