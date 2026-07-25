import { Settings } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export default function InstructorSettingsPage() {
  return (
    <>
      <p className="text-lozzi-teal text-xs font-semibold tracking-[0.16em] uppercase">
        Workspace preferences
      </p>
      <h1 className="font-heading mt-2 text-4xl font-semibold">Settings</h1>
      <Card className="mt-8 rounded-sm py-0 shadow-none">
        <CardContent className="flex gap-4 p-6">
          <Settings
            className="text-lozzi-teal mt-0.5 size-5"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold">Institution-managed profile</p>
            <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-5">
              Identity, section assignments, and grade permissions are managed
              by Northstar University. No partner credential is required for the
              core grade workflow.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
