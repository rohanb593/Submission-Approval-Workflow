interface FilterChipsProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterChips<T extends string>({ options, value, onChange }: FilterChipsProps<T>) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-all duration-150 active:scale-95 ${
            value === opt.value
              ? "bg-orange-600 text-white shadow-sm"
              : "border border-zinc-300 text-zinc-700 hover:border-orange-300 hover:bg-orange-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-800 dark:hover:bg-orange-950/30"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
