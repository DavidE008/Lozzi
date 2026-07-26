import { describe, expect, it } from "vitest";

import { classifyPartnerError } from "./errors";

describe("partner error classification", () => {
  it("maps the wallet challenge database limit without exposing internals", () => {
    expect(
      classifyPartnerError({
        code: "P0001",
        message: "Wallet-link challenge rate limit exceeded",
      }),
    ).toMatchObject({
      category: "rate-limited",
      publicMessage:
        "Too many wallet verification attempts were started. Try again later.",
    });
  });

  it("maps uniqueness races to a replay conflict", () => {
    expect(classifyPartnerError({ code: "23505" })).toMatchObject({
      category: "replay",
      publicMessage: "A conflicting partner operation already exists.",
    });
  });
});
