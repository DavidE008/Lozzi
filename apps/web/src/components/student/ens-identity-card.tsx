"use client";

import type { CapabilityState } from "@lozzi/domain";
import { ExternalLink, LoaderCircle, Network } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface EnsIdentityCardProps {
  readonly capability: CapabilityState;
  readonly currentName: string | null;
  readonly parentName: string | null;
  readonly walletAddress: `0x${string}` | null;
}

const truncateAddress = (address: string) =>
  `${address.slice(0, 8)}…${address.slice(-6)}`;

export function EnsIdentityCard({
  capability,
  currentName,
  parentName,
  walletAddress,
}: EnsIdentityCardProps) {
  const [label, setLabel] = useState("");
  const [name, setName] = useState(currentName);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = capability.status === "available";

  const issue = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/ens/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const payload = (await response.json()) as {
        readonly error?: string;
        readonly name?: string;
        readonly transactionHash?: string;
      };
      if (!response.ok || !payload.name) {
        throw new Error(payload.error ?? "ENS subname issuance failed.");
      }
      setName(payload.name);
      setTransactionHash(payload.transactionHash ?? null);
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : "ENS subname issuance failed.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="shadow-none lg:col-span-2">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="bg-lozzi-navy/5 text-lozzi-navy flex size-10 shrink-0 items-center justify-center rounded-sm">
            <Network aria-hidden="true" className="size-5" />
          </span>
          <div>
            <CardTitle className="font-heading text-xl">
              Academic ENS identity
            </CardTitle>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Claim a public pseudonym beneath the institution’s Ethereum
              Sepolia parent. Academic records and student details are never
              written to ENS text records.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            name
              ? "border-lozzi-teal/30 text-lozzi-teal"
              : "text-muted-foreground"
          }
        >
          {name
            ? "Active"
            : available
              ? walletAddress
                ? "Ready"
                : "Wallet required"
              : "Not configured"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {name ? (
          <div className="border-border flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Resolves to your verified Sepolia wallet.
              </p>
            </div>
            {transactionHash ? (
              <a
                href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-lozzi-navy inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
              >
                View transaction
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : null}
          </div>
        ) : (
          <div className="border-border grid gap-4 border-t pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <label htmlFor="ens-label" className="text-sm font-medium">
                Choose a public label
              </label>
              <div className="flex items-center">
                <Input
                  id="ens-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  disabled={!available || !walletAddress || pending}
                  placeholder="aisha"
                  className="rounded-r-none"
                />
                <span className="border-input bg-muted text-muted-foreground flex h-9 items-center border border-l-0 px-3 text-xs">
                  .{parentName ?? "parent.eth"}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {walletAddress ? (
                  <a
                    href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    Verified wallet {truncateAddress(walletAddress)}
                    <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                ) : (
                  "Connect and verify a Sepolia wallet before claiming a name."
                )}
              </p>
            </div>
            <Button
              type="button"
              onClick={issue}
              disabled={
                !available || !walletAddress || !label.trim() || pending
              }
              className="sm:min-w-36"
            >
              {pending ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                  Confirming…
                </>
              ) : (
                "Claim subname"
              )}
            </Button>
          </div>
        )}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
