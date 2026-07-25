const WORLD_BRIDGE_ORIGIN = "https://bridge.worldcoin.org";

interface ContentSecurityPolicyOptions {
  readonly isDevelopment: boolean;
  readonly nonce: string;
  readonly supabaseUrl?: string;
  readonly worldFlowConfigured: boolean;
}

const configuredOrigin = (url: string | undefined) => {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

export const buildContentSecurityPolicy = ({
  isDevelopment,
  nonce,
  supabaseUrl,
  worldFlowConfigured,
}: ContentSecurityPolicyOptions) => {
  const connectSources = ["'self'"];
  const supabaseOrigin = configuredOrigin(supabaseUrl);

  if (supabaseOrigin) connectSources.push(supabaseOrigin);
  if (worldFlowConfigured) connectSources.push(WORLD_BRIDGE_ORIGIN);

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    `connect-src ${connectSources.join(" ")}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
};

export const hasConfiguredWorldBrowserFlow = (
  environment: Readonly<Record<string, string | undefined>>,
) =>
  Boolean(
    environment.WORLD_APP_ID &&
      environment.WORLD_RP_ID &&
      environment.WORLD_RP_SIGNING_KEY,
  );

