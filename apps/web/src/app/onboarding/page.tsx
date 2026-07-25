import { LozziCrest } from "@lozzi/ui";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="bg-card max-w-lg rounded-sm border p-8 text-center shadow-sm">
        <LozziCrest className="text-lozzi-navy mx-auto h-16 w-14" />
        <h1 className="font-heading mt-5 text-3xl font-semibold">
          Your profile is being prepared
        </h1>
        <p className="text-muted-foreground mt-3 leading-7">
          Your account is valid, but it is not yet connected to an active
          student record. Contact your registrar if this state persists.
        </p>
        <Button
          className="mt-6"
          nativeButton={false}
          render={<Link href="/auth" />}
        >
          Return to sign in
        </Button>
      </div>
    </main>
  );
}
