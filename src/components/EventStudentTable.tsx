"use client";

import React, { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

type Student = {
  name: string;
  otherFields: Record<string, string>;
  submittedBy: string;
  submittedAt: Date;
};

type Props = {
  students: Student[];
};

export default function EventStudentTable({ students }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.submittedBy.toLowerCase().includes(q)
    );
  }, [students, search]);

  const otherKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of students) {
      for (const k of Object.keys(s.otherFields)) {
        keys.add(k);
      }
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [students]);

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Students</h2>
          <span className="text-sm text-gray-400">({students.length})</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or teacher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
            <tr>
              <th className="px-6 py-3 font-medium">#</th>
              <th className="px-6 py-3 font-medium">Student Name</th>
              {otherKeys.map((k) => (
                <th key={k} className="px-6 py-3 font-medium">{k}</th>
              ))}
              <th className="px-6 py-3 font-medium">Submitted By</th>
              <th className="px-6 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + otherKeys.length}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  {search ? "No students match your search" : "No students found"}
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr key={`${s.name}-${s.submittedBy}-${i}`} className="hover:bg-gray-50">
                  <td className="px-6 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-6 py-2.5 text-gray-900 font-medium">{s.name || "(unnamed)"}</td>
                  {otherKeys.map((k) => (
                    <td key={k} className="px-6 py-2.5 text-gray-600">{s.otherFields[k] || "—"}</td>
                  ))}
                  <td className="px-6 py-2.5 text-gray-500">{s.submittedBy}</td>
                  <td className="px-6 py-2.5 text-gray-400 text-xs">
                    {new Date(s.submittedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
