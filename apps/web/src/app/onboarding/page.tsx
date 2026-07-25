import { LozziCrest } from "@lozzi/ui";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-lg rounded-sm border bg-card p-8 text-center shadow-sm">
        <LozziCrest className="mx-auto h-16 w-14 text-lozzi-navy" />
        <h1 className="mt-5 font-heading text-3xl font-semibold">Your profile is being prepared</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Your account is valid, but it is not yet connected to an active student record.
          Contact your registrar if this state persists.
        </p>
        <Button className="mt-6" render={<Link href="/auth" />}>
          Return to sign in
        </Button>
      </div>
    </main>
  );
}
