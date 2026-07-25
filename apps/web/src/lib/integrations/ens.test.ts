import { describe, expect, it, vi } from "vitest";

import {
  buildEnsSubname,
  SepoliaEnsNameProvider,
} from "./ens";

const environment = {
  NEXT_PUBLIC_ENS_PARENT: "lozzi-sepolia.eth",
  ENS_REGISTRAR_ADDRESS: `0x${"22".repeat(20)}`,
  ENS_SEPOLIA_RPC_URL: "https://rpc.example",
  ENS_SIGNER_PRIVATE_KEY: `0x${"11".repeat(32)}`,
};

describe("Sepolia ENS provider", () => {
  it("normalizes and bounds the selected subname label", () => {
    expect(buildEnsSubname(" Aisha ", "lozzi-sepolia.eth")).toBe(
      "aisha.lozzi-sepolia.eth",
    );
    expect(() =>
      buildEnsSubname("student.aisha", "lozzi-sepolia.eth"),
    ).toThrow(/one ENS label/u);
  });

  it("requires the issued name to resolve to the verified wallet", async () => {
    Object.entries(environment).forEach(([name, value]) =>
      vi.stubEnv(name, value),
    );
    const driver = {
      issue: vi.fn().mockResolvedValue({
        hash: `0x${"33".repeat(32)}`,
        resolvedAddress: `0x${"44".repeat(20)}`,
      }),
      reverseResolve: vi.fn(),
    };
    const provider = new SepoliaEnsNameProvider(driver);

    await expect(
      provider.issueSubname({
        idempotencyKey: "synthetic-idempotency",
        label: "aisha",
        walletAddress: `0x${"55".repeat(20)}`,
      }),
    ).rejects.toMatchObject({ category: "integrity" });
  });

  it("returns a scoped reverse-resolution result", async () => {
    Object.entries(environment).forEach(([name, value]) =>
      vi.stubEnv(name, value),
    );
    const driver = {
      issue: vi.fn(),
      reverseResolve: vi.fn().mockResolvedValue("Aisha.LOZZI-SEPOLIA.eth"),
    };
    const provider = new SepoliaEnsNameProvider(driver);

    await expect(
      provider.resolveAddress(`0x${"55".repeat(20)}`),
    ).resolves.toMatchObject({
      name: "aisha.lozzi-sepolia.eth",
      network: "ethereum-sepolia",
    });
  });
});
