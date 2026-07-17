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
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            value === opt.value
              ? "bg-orange-600 text-white"
              : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
