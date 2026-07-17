import { SelectHTMLAttributes } from "react";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

// A visually-styled wrapper around the native <select> - appearance-none plus
// a custom chevron - rather than a from-scratch listbox, so keyboard nav,
// mobile pickers, and screen readers keep working for free.
export function Select({ className = "", wrapperClassName = "", ...props }: SelectProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...props}
        className={`w-full appearance-none rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-9 text-sm text-zinc-900 shadow-sm transition-all duration-150 hover:border-orange-300 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-orange-800 ${className}`}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}
