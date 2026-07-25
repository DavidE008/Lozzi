const adjectives = [
  "bright",
  "calm",
  "clear",
  "gentle",
  "kind",
  "lively",
  "quiet",
  "steady",
] as const;

const nouns = [
  "cedar",
  "field",
  "harbor",
  "meadow",
  "river",
  "sparrow",
  "summit",
  "willow",
] as const;

const aliasPattern = new RegExp(
  `^(?:${adjectives.join("|")})-(?:${nouns.join("|")})-[0-9]{2}$`,
  "u",
);

export const createGeneratedEnsAlias = (
  adjectiveEntropy: number,
  nounEntropy: number,
  suffixEntropy: number,
): string => {
  const normalizeEntropy = (value: number) =>
    Number.isSafeInteger(value) ? Math.abs(value) : 0;
  const adjective =
    adjectives[normalizeEntropy(adjectiveEntropy) % adjectives.length] ??
    adjectives[0];
  const noun = nouns[normalizeEntropy(nounEntropy) % nouns.length] ?? nouns[0];
  const suffix = String(normalizeEntropy(suffixEntropy) % 100).padStart(2, "0");
  return `${adjective}-${noun}-${suffix}`;
};

export const isGeneratedEnsAlias = (value: string): boolean =>
  aliasPattern.test(value);
