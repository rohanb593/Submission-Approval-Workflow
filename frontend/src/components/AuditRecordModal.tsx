import { ReactNode } from "react";

function Field({ label, value, span = false }: { label: string; value: ReactNode; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : undefined}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

export interface AuditRecordField {
  label: string;
  value: ReactNode;
  span?: boolean;
}

interface AuditRecordModalProps {
  eyebrow: string;
  title: ReactNode;
  timestamp: string;
  fields: AuditRecordField[];
  onClose: () => void;
}

// Shared detail-view chrome for the audit list pages (Session Audit, System
// Audit) - same layout as ActivityDetailModal, generalized so each page just
// supplies its own field set instead of duplicating the modal shell.
export function AuditRecordModal({ eyebrow, title, timestamp, fields, onClose }: AuditRecordModalProps) {
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="animate-scale-in mt-12 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{timestamp}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          {fields.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} span={f.span} />
          ))}
        </div>
      </div>
    </div>
  );
}
