import { ActivityEntry } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

export function ActivityDetailModal({
  entry,
  onClose,
}: {
  entry: ActivityEntry;
  onClose: () => void;
}) {
  const metadata = JSON.stringify(
    { referer: entry.referer || null, contentLength: entry.content_length },
    null,
    2,
  );

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
              Activity Audit
            </p>
            <h2 className="mt-1 font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {entry.method} {entry.path}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {formatDate(entry.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <Field label="Actor" value={`${entry.actor_email} (${entry.actor_role})`} />
          <Field label="Actor ID" value={entry.actor_id} />
          <div className="col-span-2">
            <Field label="Request" value={`${entry.method} ${entry.path}`} />
          </div>
          <Field
            label="Status"
            value={`${entry.status_code} (${entry.status_code < 400 ? "success" : "failure"})`}
          />
          <Field label="Duration" value={`${entry.duration_ms}ms`} />
          <Field label="Browser" value={entry.browser} />
          <Field label="IP Address" value={entry.ip_address || "unknown"} />
          <div className="col-span-2">
            <Field label="User Agent" value={entry.user_agent || "unknown"} />
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Metadata
          </p>
          <pre className="overflow-x-auto rounded-md bg-blue-950 p-3 text-xs text-blue-100">
            {metadata}
          </pre>
        </div>
      </div>
    </div>
  );
}
