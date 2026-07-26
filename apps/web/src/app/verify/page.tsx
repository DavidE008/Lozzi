import { brandConfig } from "@lozzi/domain";
import { LozziCrest } from "@lozzi/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { VerifierForm } from "@/components/public-verifier/verifier-form";

export const metadata: Metadata = {
  description:
    "Check a private, time-limited academic disclosure without exposing its bearer token in the URL.",
  referrer: "no-referrer",
  title: "Verify a private share",
};

export default function VerifyPage() {
  return (
    <main className="bg-muted/20 min-h-screen">
      <header className="bg-lozzi-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/verify" className="flex items-center gap-3">
            <LozziCrest className="text-lozzi-navy h-10 w-9" />
            <span className="font-heading text-2xl font-semibold">
              {brandConfig.name}
            </span>
          </Link>
          <span className="text-sm text-white/65">Public verifier</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-lozzi-teal text-xs font-semibold tracking-[0.18em] uppercase">
          Privacy-first verification
        </p>
        <h1 className="font-heading mt-2 text-4xl font-semibold tracking-tight">
          Verify only what was shared
        </h1>
        <p className="text-muted-foreground mt-4 mb-8 max-w-2xl leading-7">
          Lozzi reveals only the sections the student explicitly authorized.
          Revoked, expired, or invalid tokens disclose no academic information.
        </p>
        <VerifierForm />
      </div>
    </main>
  );
}
