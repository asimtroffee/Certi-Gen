"use client";

import React, { useState } from "react";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Loader2, Download, FileText, Users } from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import type { FieldConfig } from "./CanvasEditor";

type EventItem = {
  id: string;
  title: string;
  templateUrl: string;
  templateConfig: unknown;
};

type Props = {
  events: EventItem[];
};

export default function AdminPreviewBatch({ events }: Props) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || "");
  const [names, setNames] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const templateConfig = selectedEvent?.templateConfig
    ? (typeof selectedEvent.templateConfig === "string"
        ? JSON.parse(selectedEvent.templateConfig)
        : selectedEvent.templateConfig)
    : [];

  const nameList = names
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
  };

  const generatePreview = async () => {
    if (!selectedEvent || nameList.length === 0) return;

    setIsGenerating(true);
    setProgress(0);
    setDone(false);

    try {
      const templateImageBytes = await fetch(selectedEvent.templateUrl).then(
        (res) => res.arrayBuffer()
      );
      const zip = new JSZip();
      let greatVibesBytes: ArrayBuffer | null = null;

      for (let i = 0; i < nameList.length; i++) {
        const name = nameList[i];
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        const fontCache: Record<string, PDFFont> = {};

        const getFont = async (pdfDoc: PDFDocument, fontFamily: string, fontWeight: string): Promise<PDFFont> => {
          const key = `${fontFamily}:${fontWeight}`;
          if (fontCache[key]) return fontCache[key];

          let font: PDFFont;
          if (fontFamily === "Great Vibes") {
            if (!greatVibesBytes) {
              const res = await fetch("/fonts/GreatVibes-Regular.ttf");
              greatVibesBytes = await res.arrayBuffer();
            }
            font = await pdfDoc.embedFont(new Uint8Array(greatVibesBytes));
          } else if (fontFamily === "Helvetica") {
            font =
              fontWeight === "bold"
                ? await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold)
                : await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
          } else if (fontFamily === "Times-Roman") {
            font =
              fontWeight === "bold"
                ? await pdfDoc.embedStandardFont(StandardFonts.TimesRomanBold)
                : await pdfDoc.embedStandardFont(StandardFonts.TimesRoman);
          } else {
            font =
              fontWeight === "bold"
                ? await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold)
                : await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
          }
          fontCache[key] = font;
          return font;
        };

        let image;
        if (selectedEvent.templateUrl.toLowerCase().endsWith(".png")) {
          image = await pdfDoc.embedPng(templateImageBytes);
        } else {
          image = await pdfDoc.embedJpg(templateImageBytes);
        }

        // Page size = image pixel dimensions (no A4)
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

        for (const box of templateConfig as FieldConfig[]) {
          if (box.type === "image") {
            try {
              const imgRes = await fetch(box.imageUrl);
              if (!imgRes.ok) continue;
              const imgBytes = await imgRes.arrayBuffer();
              const fieldImg = selectedEvent.templateUrl.toLowerCase().endsWith(".png")
                ? await pdfDoc.embedPng(imgBytes)
                : await pdfDoc.embedJpg(imgBytes);
              const px = (box.x / 100) * image.width;
              const py = (box.y / 100) * image.height;
              const pw = (box.width / 100) * image.width;
              const ph = (box.height / 100) * image.height;
              const drawY = image.height - py - ph;
              page.drawImage(fieldImg, { x: px, y: drawY, width: pw, height: ph, opacity: box.opacity / 100 });
            } catch { continue; }
            continue;
          }

          const font = await getFont(pdfDoc, box.fontFamily, box.fontWeight);

          const px = (box.x / 100) * image.width;
          const py = (box.y / 100) * image.height;

          const textWidth = font.widthOfTextAtSize(name, box.fontSize);
          let x = px;
          if (box.textAlign === "center") {
            x = px - textWidth / 2;
          } else if (box.textAlign === "right") {
            x = px - textWidth;
          }

          const textHeight = font.heightAtSize(box.fontSize, { descender: false });
          const y = image.height - py - textHeight / 2;

          page.drawText(name, {
            x,
            y,
            size: box.fontSize,
            font,
            color: hexToRgb(box.fontColor),
          });
        }

        const pdfBytes = await pdfDoc.save();
        zip.file(`${name}.pdf`, pdfBytes);
        setProgress(Math.round(((i + 1) / nameList.length) * 100));
      }

      const zipContent = await zip.generateAsync({ type: "blob" });
      saveAs(
        zipContent,
        `${selectedEvent.title.replace(/\s+/g, "_")}_Preview.zip`
      );
      setDone(true);
    } catch (err) {
      console.error(err);
      alert("Error generating preview certificates.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Select Event
        </label>
        <select
          className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
          value={selectedEventId}
          onChange={(e) => {
            setSelectedEventId(e.target.value);
            setDone(false);
          }}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </div>

      {selectedEvent?.templateUrl && (
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedEvent.templateUrl}
            alt="Template"
            className="w-20 h-14 object-cover rounded border border-gray-300"
          />
          <div className="text-sm text-gray-600">
            <span className="font-medium">{selectedEvent.title}</span>
            <span className="text-gray-400 ml-2">
              ({Array.isArray(templateConfig) ? templateConfig.length : 0} fields)
            </span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Sample Names
        </label>
        <textarea
          className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-3 border resize-none"
          rows={8}
          placeholder={`ONG KAILYN\nLEE SHU HANG\nGOH WU PING\n...`}
          value={names}
          onChange={(e) => setNames(e.target.value)}
        />
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {nameList.length} name{nameList.length !== 1 ? "s" : ""} entered
        </p>
      </div>

      <Button
        color="primary"
        onClick={generatePreview}
        isDisabled={!selectedEventId || nameList.length === 0 || isGenerating}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating... {progress}%
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Generate Preview ZIP
          </>
        )}
      </Button>

      {isGenerating && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {done && (
        <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Download started! ZIP contains {nameList.length} certificate
          {nameList.length !== 1 ? "s" : ""}.
        </div>
      )}
    </div>
  );
}
