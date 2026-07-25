"use client";

import { Archive, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deactivateCatalogResource } from "@/app/registrar/catalog/actions";
import { Button } from "@/components/ui/button";

export function CatalogResourceButton({
  institutionId,
  id,
  resource,
}: {
  readonly institutionId: string;
  readonly id: string;
  readonly resource:
    | "department"
    | "course"
    | "program"
    | "program_version"
    | "requirement"
    | "prerequisite";
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        aria-label={`Deactivate ${resource.replace("_", " ")}`}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const result = await deactivateCatalogResource({
              institutionId,
              id,
              resource,
            });
            setError(result.error);
            if (result.success) router.refresh();
          })
        }
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Archive aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {resource === "program_version" ? "Retire" : "Deactivate"}
        </span>
      </Button>
      {error ? (
        <span className="text-destructive text-[10px]">{error}</span>
      ) : null}
    </div>
  );
}
