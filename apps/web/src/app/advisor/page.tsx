import { Bot, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { reviewDegreePlanProposal } from "@/app/advisor/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getAdvisorDegreePlanProposals } from "@/lib/repositories/advisor";

const statusLabel = {
  approved: "Approved",
  pending: "Pending review",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;

export default async function AdvisorDegreePlansPage() {
  const proposals = await getAdvisorDegreePlanProposals();

  return (
    <>
      <div className="mb-8">
        <p className="text-lozzi-teal text-xs font-semibold tracking-[0.16em] uppercase">
          Advisor workspace
        </p>
        <h1 className="font-heading mt-2 text-4xl font-semibold">
          Degree-plan review
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
          Review minimized proposals submitted by human-backed agents. Approval
          records an advisory decision only; it cannot enroll a student or
          change an official academic record.
        </p>
      </div>

      {proposals.length ? (
        <div className="space-y-5">
          {proposals.map((proposal) => (
            <Card
              key={proposal.proposalId}
              className="gap-0 rounded-sm py-0 shadow-none"
            >
              <CardHeader className="border-b py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="bg-lozzi-navy/5 text-lozzi-navy flex size-10 shrink-0 items-center justify-center rounded-sm">
                    <Bot aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <CardTitle
                      role="heading"
                      aria-level={2}
                      className="font-heading text-xl"
                    >
                      {proposal.studentDisplayName}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {proposal.studentNumber} · Submitted{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(proposal.submittedAt))}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    proposal.status === "approved"
                      ? "border-lozzi-teal/30 text-lozzi-teal"
                      : proposal.status === "pending"
                        ? "border-lozzi-gold/30 text-lozzi-gold"
                        : "text-muted-foreground"
                  }
                >
                  {proposal.status === "pending" ? (
                    <Clock3 aria-hidden="true" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" />
                  )}
                  {statusLabel[proposal.status]}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_22rem]">
                <div>
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Agent rationale
                  </p>
                  <p className="mt-2 text-sm leading-6">{proposal.summary}</p>
                  <p className="text-muted-foreground mt-5 text-[10px] font-semibold tracking-wider uppercase">
                    Proposed courses
                  </p>
                  <ol className="mt-2 flex flex-wrap gap-2">
                    {proposal.items.map((item) => (
                      <li
                        key={item.courseCode}
                        className="bg-muted border px-3 py-2 text-xs font-medium"
                      >
                        {item.sortOrder}. {item.courseCode}
                      </li>
                    ))}
                  </ol>
                </div>

                {proposal.status === "pending" ? (
                  <form
                    action={reviewDegreePlanProposal}
                    className="bg-lozzi-navy/[0.03] border p-4"
                  >
                    <input
                      type="hidden"
                      name="proposalId"
                      value={proposal.proposalId}
                    />
                    <Label htmlFor={`review-${proposal.proposalId}`}>
                      Review note
                    </Label>
                    <textarea
                      id={`review-${proposal.proposalId}`}
                      name="reviewNote"
                      required
                      minLength={1}
                      maxLength={1_200}
                      className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mt-2 min-h-28 w-full rounded-sm border p-3 text-sm outline-none focus-visible:ring-3"
                      placeholder="Explain the advisory decision…"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="submit" name="decision" value="approved">
                        <ShieldCheck aria-hidden="true" />
                        Approve plan
                      </Button>
                      <Button
                        type="submit"
                        name="decision"
                        value="rejected"
                        variant="outline"
                      >
                        Request changes
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-muted/50 border p-4">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                      Advisor decision
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {proposal.reviewNote ?? "No review note recorded."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-sm shadow-none">
          <CardContent className="py-14 text-center">
            <Bot
              aria-hidden="true"
              className="text-muted-foreground/40 mx-auto size-10"
            />
            <p className="mt-4 text-sm font-semibold">
              No degree plans need review
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Assigned student proposals will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
