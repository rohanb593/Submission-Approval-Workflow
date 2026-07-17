"use client";

import { useEffect, useState } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// SEARCH_DEBOUNCE_MS delays onChange until the user pauses typing, so a
// search triggers one request per pause instead of one per keystroke.
const SEARCH_DEBOUNCE_MS = 300;

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className="relative mb-6 w-full max-w-sm">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 10-10.6 0 7.5 7.5 0 0010.6 0z" />
      </svg>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder ?? "Search..."}
        className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      />
    </div>
  );
}
