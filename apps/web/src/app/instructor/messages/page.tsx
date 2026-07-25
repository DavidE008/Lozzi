import { Mail } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export default function InstructorMessagesPage() {
  return (
    <>
      <p className="text-lozzi-teal text-xs font-semibold tracking-[0.16em] uppercase">
        Communications
      </p>
      <h1 className="font-heading mt-2 text-4xl font-semibold">Messages</h1>
      <Card className="mt-8 rounded-sm py-0 shadow-none">
        <CardContent className="p-12 text-center">
          <Mail
            className="text-muted-foreground/40 mx-auto size-10"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-semibold">No synthetic messages</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Production messaging is not configured in this milestone.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
