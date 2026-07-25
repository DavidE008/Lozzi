import { beforeEach, describe, expect, it, vi } from "vitest";

const records = vi.hoisted(() => ({
  begin: vi.fn(),
  finalize: vi.fn(),
  finalizeRevocation: vi.fn(),
  list: vi.fn(),
  listRevocations: vi.fn(),
  mark: vi.fn(),
  reserve: vi.fn(),
}));

vi.mock("./config", () => ({
  getEnsConfig: () => ({
    confirmations: 3,
    deploymentBlock: BigInt(1),
    maxFeeWei: BigInt(1),
    maxGas: BigInt(1),
    parentName: "lozzi-sepolia.eth",
    readRpcUrl: "https://read.example",
    registrarAddress: `0x${"22".repeat(20)}`,
    registrarCodeHash: `0x${"33".repeat(32)}`,
    safeAddress: `0x${"44".repeat(20)}`,
    safeOwners: [
      `0x${"41".repeat(20)}`,
      `0x${"42".repeat(20)}`,
      `0x${"43".repeat(20)}`,
    ],
    safeThreshold: 2,
    signer: {
      address: `0x${"55".repeat(20)}`,
      rpcUrl: "https://signer.example",
      type: "json-rpc",
    },
    writeRpcUrl: "https://write.example",
  }),
}));

vi.mock("./ens-records", () => ({
  beginEnsIssuanceSubmission: records.begin,
  finalizeEnsIssuance: records.finalize,
  finalizeEnsRevocation: records.finalizeRevocation,
  listReconcilableEnsOperations: records.list,
  listPendingEnsRevocations: records.listRevocations,
  markEnsIssuanceSubmitted: records.mark,
  reserveEnsIssuance: records.reserve,
}));

import { issueEnsAlias } from "./ens-issuance";

const requestId = "11111111-1111-4111-8111-111111111111";
const requestKey = `0x${"66".repeat(32)}` as const;
const transactionHash = `0x${"77".repeat(32)}` as const;
const walletAddress = `0x${"88".repeat(20)}` as const;
const operationId = "22222222-2222-4222-8222-222222222222";
const name = "calm-river-42.lozzi-sepolia.eth";

const reservation = {
  name,
  operationId,
  requestId,
  requestKey,
  status: "pending" as const,
  submissionAuthorized: false,
  transactionHash: null,
};

const input = {
  consentedAt: "2026-07-25T12:00:00.000Z",
  label: "calm-river-42",
  requestId,
  studentId: "33333333-3333-4333-8333-333333333333",
  studentWalletId: "44444444-4444-4444-8444-444444444444",
  walletAddress,
};

describe("ENS issuance coordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    records.list.mockResolvedValue([]);
    records.listRevocations.mockResolvedValue([]);
    records.mark.mockResolvedValue({
      ...reservation,
      status: "submitted",
      transactionHash,
    });
    records.finalize.mockResolvedValue({
      ...reservation,
      status: "active",
      transactionHash,
    });
  });

  it("allows only the request that claimed pending state to broadcast", async () => {
    records.reserve.mockResolvedValue(reservation);
    records.begin.mockResolvedValue({
      ...reservation,
      status: "submitting",
      submissionAuthorized: true,
    });
    const provider = {
      confirmSubname: vi.fn().mockResolvedValue({
        confirmationCount: 3,
        confirmedAt: "2026-07-25T12:01:00.000Z",
        confirmedBlockNumber: BigInt(123),
        resolvedAddress: walletAddress,
        resolverAddress: `0x${"99".repeat(20)}`,
      }),
      findSubmission: vi.fn().mockResolvedValue(null),
      submitSubname: vi.fn().mockResolvedValue({
        name,
        transactionHash,
      }),
    };

    await expect(issueEnsAlias(input, provider)).resolves.toMatchObject({
      name,
      status: "active",
      transactionHash,
    });
    expect(provider.submitSubname).toHaveBeenCalledOnce();
    expect(records.mark).toHaveBeenCalledWith(
      expect.objectContaining({ transactionHash }),
    );
    expect(records.finalize).toHaveBeenCalledOnce();
  });

  it("never broadcasts from an already-submitting ambiguous state", async () => {
    records.reserve.mockResolvedValue({
      ...reservation,
      status: "submitting",
    });
    records.begin.mockResolvedValue({
      ...reservation,
      status: "submitting",
      submissionAuthorized: false,
    });
    const provider = {
      confirmSubname: vi.fn(),
      findSubmission: vi.fn().mockResolvedValue(null),
      submitSubname: vi.fn(),
    };

    await expect(issueEnsAlias(input, provider)).resolves.toMatchObject({
      status: "submitting",
      transactionHash: null,
    });
    expect(provider.submitSubname).not.toHaveBeenCalled();
    expect(provider.confirmSubname).not.toHaveBeenCalled();
  });
});
