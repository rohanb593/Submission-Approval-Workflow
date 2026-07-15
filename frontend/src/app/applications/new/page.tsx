"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useRequireRole } from "@/lib/use-require-role";
import { createApplication, ApplicationInput } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
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
    <div className="flex flex-1 flex-col">
      <AppHeader title="New Application" />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
        <Link
          href="/applications"
          className="mb-6 inline-block text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          &larr; Back to my applications
        </Link>
        <ApplicationForm submitLabel="Create Draft" onSubmit={handleSubmit} />
      </main>
    </div>
  );
}
