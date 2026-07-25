import { brandConfig } from "@lozzi/domain";
import { LozziCrest } from "@lozzi/ui";
import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
      <section className="bg-lozzi-navy relative hidden overflow-hidden px-16 py-14 text-white lg:flex lg:flex-col">
        <div className="absolute -top-32 -right-32 size-96 rounded-full border border-white/10" />
        <div className="border-lozzi-teal/25 absolute -bottom-44 -left-28 size-[32rem] rounded-full border" />
        <div className="relative flex items-center gap-4">
          <LozziCrest className="text-lozzi-navy h-14 w-12 drop-shadow-[0_0_0.5px_white]" />
          <div>
            <p className="font-heading text-3xl font-semibold">
              {brandConfig.name}
            </p>
            <p className="text-sm text-white/65">{brandConfig.positioning}</p>
          </div>
        </div>
        <div className="relative mt-auto max-w-xl pb-16">
          <p className="font-heading text-4xl leading-tight">
            Your academic journey, clearly in view.
          </p>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/70">
            View current courses, progress, verified records, and controlled
            sharing in one trusted student workspace.
          </p>
        </div>
        <p className="relative text-sm text-white/45">
          {brandConfig.supportingStatement}
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <LozziCrest className="text-lozzi-navy h-11 w-10" />
            <span className="font-heading text-2xl font-semibold">
              {brandConfig.name}
            </span>
          </div>
          <p className="text-lozzi-teal mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
            Student information system
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground mt-3 mb-8 leading-6">
            Sign in with your Northstar University account.
          </p>
          <SignInForm />
          <p className="text-muted-foreground mt-8 border-t pt-5 text-xs leading-5">
            This milestone uses restricted synthetic demo data. Never enter real
            student information.
          </p>
        </div>
      </section>
    </main>
  );
}
