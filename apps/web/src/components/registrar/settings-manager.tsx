"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  assignStaffRole,
  deactivateStaffRole,
  setMembershipStatus,
  updateInstitutionName,
} from "@/app/registrar/settings/actions";
import { MutationFeedback } from "@/components/registrar/mutation-feedback";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegistrarActionResult } from "@/lib/registrar/mutation-context";
import type {
  RegistrarMembership,
  RegistrarStaffMember,
} from "@/lib/repositories/registrar-administration";

const selectClass =
  "border-input bg-background h-9 w-full rounded-sm border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20";
const institutionSchema = z.object({
  name: z.string().trim().min(2).max(160),
});
const roleSchema = z.object({
  membership: z.string().min(1),
  validUntil: z.string().optional(),
});

export function SettingsManager({
  institutionId,
  institutionName,
  isInstitutionAdmin,
  memberships,
  staff,
}: {
  readonly institutionId: string;
  readonly institutionName: string;
  readonly isInstitutionAdmin: boolean;
  readonly memberships: readonly RegistrarMembership[];
  readonly staff: readonly RegistrarStaffMember[];
}) {
  const router = useRouter();
  const [result, setResult] = useState<RegistrarActionResult>();
  const [pending, startTransition] = useTransition();
  const eligibleMemberships = memberships.filter(
    (membership) =>
      membership.role !== "student" && membership.status === "active",
  );
  const institution = useForm<z.infer<typeof institutionSchema>>({
    resolver: zodResolver(institutionSchema),
    defaultValues: { name: institutionName },
  });
  const role = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      membership: eligibleMemberships[0]
        ? `${eligibleMemberships[0].userId}:${eligibleMemberships[0].role}`
        : "",
      validUntil: "",
    },
  });

  const run = (operation: () => Promise<RegistrarActionResult>) =>
    startTransition(async () => {
      setResult(undefined);
      const next = await operation();
      setResult(next);
      if (next.success) router.refresh();
    });

  return (
    <div className="space-y-7">
      {!isInstitutionAdmin ? (
        <div className="border-lozzi-gold/30 bg-lozzi-gold/5 text-lozzi-slate flex gap-3 rounded-sm border px-4 py-3 text-sm">
          <ShieldCheck
            className="text-lozzi-gold mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <p>
            Institution and membership changes require an active institution
            administrator assignment. Registrar access remains read-only here.
          </p>
        </div>
      ) : null}
      <MutationFeedback result={result} />

      <div className="grid gap-7 xl:grid-cols-[0.7fr_1.3fr]">
        <section className="bg-card rounded-sm border p-5">
          <h2 className="font-heading text-xl font-semibold">
            Institution profile
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            The public academic institution name shown throughout Lozzi.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={institution.handleSubmit((values) =>
              run(() =>
                updateInstitutionName({
                  institutionId,
                  name: values.name,
                }),
              ),
            )}
          >
            <div className="space-y-1.5">
              <Label htmlFor="institution-name">Institution name</Label>
              <Input
                id="institution-name"
                disabled={!isInstitutionAdmin}
                {...institution.register("name")}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !isInstitutionAdmin}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Save institution
            </Button>
          </form>

          <div className="mt-7 border-t pt-5">
            <h3 className="text-sm font-semibold">Assign staff role</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Role assignment requires an existing matching membership.
            </p>
            <form
              className="mt-3 space-y-3"
              onSubmit={role.handleSubmit((values) => {
                const [userId, selectedRole] = values.membership.split(":");
                if (!userId || !selectedRole) return;
                run(() =>
                  assignStaffRole({
                    institutionId,
                    userId,
                    role: selectedRole as
                      | "registrar"
                      | "instructor"
                      | "advisor"
                      | "institution_admin",
                    validUntil: values.validUntil || undefined,
                  }),
                );
              })}
            >
              <select
                aria-label="Institution membership"
                className={selectClass}
                disabled={!isInstitutionAdmin}
                {...role.register("membership")}
              >
                {eligibleMemberships.map((membership) => (
                  <option
                    key={membership.id}
                    value={`${membership.userId}:${membership.role}`}
                  >
                    {membership.displayName} ·{" "}
                    {membership.role.replace("_", " ")}
                  </option>
                ))}
              </select>
              <div className="space-y-1.5">
                <Label htmlFor="role-valid-until">Valid until</Label>
                <Input
                  id="role-valid-until"
                  type="datetime-local"
                  disabled={!isInstitutionAdmin}
                  {...role.register("validUntil")}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={
                  pending || !isInstitutionAdmin || !eligibleMemberships.length
                }
              >
                Assign role
              </Button>
            </form>
          </div>
        </section>

        <section className="bg-card overflow-hidden rounded-sm border">
          <div className="border-b px-5 py-4">
            <h2 className="font-heading text-xl font-semibold">
              Institution memberships
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              {memberships.length} synthetic membership assignments
            </p>
          </div>
          <ul className="divide-y">
            {memberships.map((membership) => (
              <li
                key={membership.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-lozzi-navy text-[10px] font-semibold text-white">
                      {membership.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">
                      {membership.displayName}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs capitalize">
                      {membership.role.replace("_", " ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-12 sm:pl-0">
                  <Badge
                    variant="outline"
                    className={
                      membership.status === "active"
                        ? "border-lozzi-teal/25 bg-lozzi-teal/5 text-lozzi-teal text-[10px] capitalize"
                        : "text-muted-foreground text-[10px] capitalize"
                    }
                  >
                    {membership.status}
                  </Badge>
                  {isInstitutionAdmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          setMembershipStatus({
                            institutionId,
                            id: membership.id,
                            status:
                              membership.status === "active"
                                ? "inactive"
                                : "active",
                          }),
                        )
                      }
                    >
                      {membership.status === "active"
                        ? "Deactivate"
                        : "Reactivate"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="bg-card overflow-hidden rounded-sm border">
        <div className="border-b px-5 py-4">
          <h2 className="font-heading text-xl font-semibold">
            Active staff assignments
          </h2>
        </div>
        <ul className="divide-y">
          {staff.map((assignment) => (
            <li
              key={assignment.assignmentId}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div>
                <p className="text-sm font-semibold">
                  {assignment.displayName}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs capitalize">
                  {assignment.role.replace("_", " ")} · {assignment.status}
                </p>
              </div>
              {isInstitutionAdmin && assignment.status === "active" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      deactivateStaffRole({
                        institutionId,
                        id: assignment.assignmentId,
                      }),
                    )
                  }
                >
                  <Archive aria-hidden="true" />
                  Deactivate
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
