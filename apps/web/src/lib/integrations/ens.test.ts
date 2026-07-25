import { describe, expect, it, vi } from "vitest";

import {
  buildEnsSubname,
  SepoliaEnsNameProvider,
} from "./ens";

const transactionHash = `0x${"33".repeat(32)}` as const;
const walletAddress = `0x${"55".repeat(20)}` as const;

describe("Sepolia ENS provider", () => {
  it("normalizes and bounds the selected subname label", () => {
    expect(buildEnsSubname(" Aisha ", "lozzi-sepolia.eth")).toBe(
      "aisha.lozzi-sepolia.eth",
    );
    expect(() =>
      buildEnsSubname("student.aisha", "lozzi-sepolia.eth"),
    ).toThrow(/ENS label using/u);
  });

  it("submits and confirms an idempotent issuance", async () => {
    const driver = {
      confirm: vi.fn().mockResolvedValue({
        confirmationCount: 3,
        confirmedAt: "2026-07-25T12:00:00.000Z",
        confirmedBlockNumber: BigInt(1),
        resolvedAddress: walletAddress,
        resolverAddress: `0x${"66".repeat(20)}`,
      }),
      findSubmission: vi.fn().mockResolvedValue(null),
      reverseResolve: vi.fn(),
      submit: vi.fn().mockResolvedValue({
        name: "aisha.lozzi-sepolia.eth",
        transactionHash,
      }),
    };
    const provider = new SepoliaEnsNameProvider(driver);

    await expect(
      provider.issueSubname({
        idempotencyKey: "synthetic-idempotency",
        label: "aisha",
        walletAddress,
      }),
    ).resolves.toEqual({
      name: "aisha.lozzi-sepolia.eth",
      transactionHash,
    });
    expect(driver.submit).toHaveBeenCalledWith({
      label: "aisha",
      requestKey: expect.stringMatching(/^0x[0-9a-f]{64}$/u),
      walletAddress,
    });
    expect(driver.confirm).toHaveBeenCalledWith({
      name: "aisha.lozzi-sepolia.eth",
      requestKey: expect.stringMatching(/^0x[0-9a-f]{64}$/u),
      transactionHash,
      walletAddress,
    });
  });

  it("returns a scoped reverse-resolution result", async () => {
    const driver = {
      confirm: vi.fn(),
      findSubmission: vi.fn(),
      reverseResolve: vi.fn().mockResolvedValue("Aisha.LOZZI-SEPOLIA.eth"),
      submit: vi.fn(),
    };
    const provider = new SepoliaEnsNameProvider(driver);

    await expect(provider.resolveAddress(walletAddress)).resolves.toMatchObject({
      name: "aisha.lozzi-sepolia.eth",
      network: "ethereum-sepolia",
    });
  });
});
