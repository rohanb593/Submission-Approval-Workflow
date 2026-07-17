"use client";

import { useState, FormEvent } from "react";
import { ApiError, ApplicationInput } from "@/lib/api";

const CATEGORIES = ["travel", "equipment", "training", "other"] as const;

export interface ApplicationFormValues {
  title: string;
  category: string;
  description: string;
  amount: string;
}

const EMPTY_VALUES: ApplicationFormValues = {
  title: "",
  category: "",
  description: "",
  amount: "",
};

interface ApplicationFormProps {
  initialValues?: ApplicationFormValues;
  submitLabel: string;
  onSubmit: (input: ApplicationInput) => Promise<void>;
}

export function ApplicationForm({
  initialValues = EMPTY_VALUES,
  submitLabel,
  onSubmit,
}: ApplicationFormProps) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof ApplicationFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    const trimmedAmount = values.amount.trim();
    const amount = trimmedAmount === "" ? null : Number(trimmedAmount);

    try {
      await onSubmit({
        title: values.title,
        category: values.category,
        description: values.description,
        amount,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields ?? {});
        if (!err.fields) setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title
        </label>
        <input
          type="text"
          value={values.title}
          onChange={(e) => setField("title", e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldErrors.title && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.title}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Category
        </label>
        <select
          value={values.category}
          onChange={(e) => setField("category", e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="">Select a category&hellip;</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        {fieldErrors.category && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.category}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={4}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldErrors.description && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fieldErrors.description}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Amount (optional)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={values.amount}
          onChange={(e) => setField("amount", e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldErrors.amount && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.amount}</p>
        )}
      </div>

      {formError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
      >
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
