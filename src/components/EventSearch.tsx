"use client";

import React from "react";
import { Search, X } from "lucide-react";

type Props = {
  query: string;
  onSearch: (query: string) => void;
};

export default function EventSearch({ query, onSearch }: Props) {
  const [value, setValue] = React.useState(query);

  React.useEffect(() => {
    const timer = setTimeout(() => setValue(query), 0);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        placeholder="Search events..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch(value);
        }}
        className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-56"
      />
      {value && (
        <button
          type="button"
          onClick={() => { setValue(""); onSearch(""); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
