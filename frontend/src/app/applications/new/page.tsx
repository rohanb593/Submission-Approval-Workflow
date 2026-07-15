"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { createApplication, ApplicationInput } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ApplicationForm } from "@/components/ApplicationForm";

export default function NewApplicationPage() {
  const user = useRequireRole("requester");
  const { token } = useAuth();
  const router = useRouter();

  if (!user) return null;

  async function handleSubmit(input: ApplicationInput) {
    await createApplication(token!, input);
    router.push("/applications");
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-lg px-8 py-10">
        <Link
          href="/applications"
          className="mb-6 inline-block text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          &larr; Back to my submissions
        </Link>
        <PageHeader
          eyebrow="Requester Dashboard"
          title="New Application"
          subtitle="Create a draft. You can edit or submit it for review afterward."
        />
        <ApplicationForm submitLabel="Create Draft" onSubmit={handleSubmit} />
      </main>
    </AppShell>
  );
}
