export const brandConfig = {
  name: "Lozzi",
  positioning: "Trusted academic infrastructure.",
  supportingStatement: "One platform. Every learner. Limitless possibilities.",
  description:
    "A privacy-first, verifiable Student Information System for colleges and universities.",
  metadata: {
    applicationName: "Lozzi Student Information System",
    themeColor: "#0D1B2A",
    publisher: "Lozzi",
  },
} as const;

export type BrandConfig = typeof brandConfig;
