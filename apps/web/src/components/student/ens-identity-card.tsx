"use client";

import { createGeneratedEnsAlias, type CapabilityState } from "@lozzi/domain";
import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Network,
  RefreshCw,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface EnsIdentityCardProps {
  readonly capability: CapabilityState;
  readonly currentName: string | null;
  readonly currentStatus: string | null;
  readonly parentName: string | null;
  readonly walletAddress: `0x${string}` | null;
}

interface EthereumProvider {
  request(input: {
    readonly method: string;
    readonly params?: readonly unknown[];
  }): Promise<unknown>;
}

const SEPOLIA_CHAIN_ID = "0xaa36a7";
const addressPattern = /^0x[0-9a-fA-F]{40}$/u;
const signaturePattern = /^0x[0-9a-fA-F]+$/u;

const truncateAddress = (address: string) =>
  `${address.slice(0, 8)}…${address.slice(-6)}`;

const getEthereumProvider = (): EthereumProvider | null =>
  (
    window as typeof window & {
      readonly ethereum?: EthereumProvider;
    }
  ).ethereum ?? null;

const errorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 4001
  ) {
    return "The wallet request was cancelled.";
  }
  return error instanceof Error ? error.message : fallback;
};

const responseJson = async <Payload,>(
  response: Response,
  fallback: string,
): Promise<Payload> => {
  const payload = (await response.json()) as Payload & {
    readonly error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? fallback);
  return payload;
};

const generateAlias = (): string => {
  const entropy = new Uint32Array(3);
  crypto.getRandomValues(entropy);
  return createGeneratedEnsAlias(entropy[0], entropy[1], entropy[2]);
};

export function EnsIdentityCard({
  capability,
  currentName,
  currentStatus,
  parentName,
  walletAddress: initialWalletAddress,
}: EnsIdentityCardProps) {
  const [label, setLabel] = useState("");
  const [name, setName] = useState(currentName);
  const [identityStatus, setIdentityStatus] = useState(currentStatus);
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mockUsed, setMockUsed] = useState(false);
  const [walletPending, setWalletPending] = useState(false);
  const [issuePending, setIssuePending] = useState(false);
  const [revokePending, setRevokePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const available = capability.status === "available";
  const mockDevelopment = capability.status === "mock-development";
  const revocationPending = identityStatus === "revocation-pending";
  const issuancePending = [
    "pending",
    "submitting",
    "submitted",
    "confirmed",
  ].includes(identityStatus ?? "");
  const active = Boolean(name) && identityStatus === "active";
  const canChooseAlias =
    !active &&
    !issuancePending &&
    !revocationPending &&
    (Boolean(walletAddress) || mockDevelopment);

  const regenerate = () => {
    setLabel(generateAlias());
    setConsent(false);
    requestId.current = null;
  };

  const connectWallet = async () => {
    setWalletPending(true);
    setError(null);
    try {
      const ethereum = getEthereumProvider();
      if (!ethereum) {
        throw new Error(
          "Install or open an Ethereum wallet extension, then try again.",
        );
      }
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      const address =
        Array.isArray(accounts) && typeof accounts[0] === "string"
          ? accounts[0]
          : null;
      if (!address || !addressPattern.test(address)) {
        throw new Error("The wallet did not return a valid account.");
      }
      const chainId = await ethereum.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchError) {
          throw new Error(
            "Switch the wallet to Ethereum Sepolia, then try again.",
            { cause: switchError },
          );
        }
      }

      const challenge = await responseJson<{
        readonly challengeId: string;
        readonly message: string;
      }>(
        await fetch("/api/integrations/ens/wallet/challenge", {
          body: JSON.stringify({ address }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        "Wallet verification could not start.",
      );
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [challenge.message, address],
      });
      if (typeof signature !== "string" || !signaturePattern.test(signature)) {
        throw new Error("The wallet did not return a valid signature.");
      }
      const verified = await responseJson<{
        readonly address: `0x${string}`;
        readonly status: "verified";
      }>(
        await fetch("/api/integrations/ens/wallet/verify", {
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            message: challenge.message,
            signature,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        "The wallet signature could not be verified.",
      );
      setWalletAddress(verified.address);
    } catch (walletError) {
      setError(errorMessage(walletError, "The wallet could not be connected."));
    } finally {
      setWalletPending(false);
    }
  };

  const copyAddress = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const revokeWallet = async () => {
    setRevokePending(true);
    setError(null);
    try {
      const revoked = await responseJson<{
        readonly ensClearRequired: boolean;
        readonly status: "revoked";
      }>(
        await fetch("/api/integrations/ens/wallet/revoke", {
          method: "POST",
        }),
        "The wallet link could not be revoked.",
      );
      setWalletAddress(null);
      if (revoked.ensClearRequired) {
        setIdentityStatus("revocation-pending");
      }
    } catch (revokeError) {
      setError(
        errorMessage(revokeError, "The wallet link could not be revoked."),
      );
    } finally {
      setRevokePending(false);
    }
  };

  const issue = async () => {
    setIssuePending(true);
    setError(null);
    if (mockDevelopment) {
      setName(`${label}.mock.lozzi.test`);
      setIdentityStatus("active");
      setMockUsed(true);
      setIssuePending(false);
      return;
    }
    try {
      requestId.current ??= crypto.randomUUID();
      const result = await responseJson<{
        readonly name: string;
        readonly status: string;
        readonly transactionHash: string | null;
      }>(
        await fetch("/api/integrations/ens/issue", {
          body: JSON.stringify({
            consent,
            label,
            requestId: requestId.current,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        "ENS subname issuance failed.",
      );
      setName(result.name);
      setIdentityStatus(result.status);
      setTransactionHash(result.transactionHash);
    } catch (issueError) {
      setError(errorMessage(issueError, "ENS subname issuance failed."));
    } finally {
      setIssuePending(false);
    }
  };

  const badgeLabel = revocationPending
    ? "Revocation pending"
    : issuancePending
      ? "Confirmation pending"
      : active
        ? mockUsed
          ? "Development mock"
          : "Active"
        : available
          ? walletAddress
            ? "Ready"
            : "Wallet required"
          : mockDevelopment
            ? "Development mock"
            : "Not configured";

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
              Publish a pseudonym beneath the institution’s Ethereum Sepolia
              parent. Academic records and student details are never written to
              ENS text records.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            active
              ? "border-lozzi-teal/30 text-lozzi-teal"
              : "text-muted-foreground"
          }
        >
          {badgeLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {!mockDevelopment ? (
          <div className="border-border space-y-3 border-t pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Verified Sepolia wallet</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  A one-time ERC-4361 signature proves wallet control. It is not
                  a transaction and does not consent to an ENS name.
                </p>
              </div>
              {walletAddress ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lozzi-navy inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {truncateAddress(walletAddress)}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyAddress}
                    aria-label="Copy verified wallet address"
                  >
                    {copied ? (
                      <Check aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Copy aria-hidden="true" className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={revokeWallet}
                    disabled={revokePending}
                  >
                    {revokePending ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
                      />
                    ) : (
                      <Unlink aria-hidden="true" className="size-3.5" />
                    )}
                    {revokePending ? "Revoking…" : "Revoke link"}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={connectWallet}
                  disabled={!available || walletPending}
                >
                  {walletPending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <ShieldCheck aria-hidden="true" className="size-4" />
                  )}
                  {walletPending ? "Verifying…" : "Connect and verify wallet"}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {name && (active || issuancePending || revocationPending) ? (
          <div className="border-border flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {mockUsed
                  ? "No ENS name, transaction, or wallet resolution was created."
                  : revocationPending
                    ? "The wallet link is revoked. The institutional Safe must still clear the public resolver address."
                    : issuancePending
                      ? "The request is durable and will be reconciled without sending a duplicate transaction."
                      : "Resolves to your verified Sepolia wallet."}
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
        ) : canChooseAlias ? (
          <div className="border-border space-y-4 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <label htmlFor="ens-label" className="text-sm font-medium">
                  Generated public alias
                </label>
                <div className="flex items-center">
                  <Input
                    id="ens-label"
                    value={label}
                    readOnly
                    placeholder="Generate an alias"
                    aria-describedby="ens-alias-explanation"
                    className="rounded-r-none"
                  />
                  <span className="border-input bg-muted text-muted-foreground flex h-9 items-center border border-l-0 px-3 text-xs">
                    .
                    {mockDevelopment
                      ? "mock.lozzi.test"
                      : (parentName ?? "parent.eth")}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={regenerate}
                disabled={issuePending}
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                {label ? "Generate another" : "Generate alias"}
              </Button>
            </div>
            <p
              id="ens-alias-explanation"
              className="text-muted-foreground text-xs"
            >
              Lozzi generates neutral aliases so names, email addresses, and
              student IDs do not become public blockchain identifiers.
            </p>
            {!mockDevelopment ? (
              <label className="border-border flex items-start gap-3 rounded-sm border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  disabled={issuePending}
                  className="mt-0.5 size-4"
                />
                <span>
                  I understand this alias and my verified wallet address will be
                  public and durable on Sepolia. Lozzi can revoke its current
                  resolution, but cannot erase blockchain history.
                </span>
              </label>
            ) : null}
            <Button
              type="button"
              onClick={issue}
              disabled={
                !label ||
                issuePending ||
                (!mockDevelopment && (!walletAddress || !consent))
              }
              className="sm:min-w-44"
            >
              {issuePending ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                  Submitting…
                </>
              ) : mockDevelopment ? (
                "Create mock name"
              ) : (
                "Publish public alias"
              )}
            </Button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
