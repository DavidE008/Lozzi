import { NextResponse } from "next/server";

import { getDegreePlanAgentApp } from "@/lib/agentkit/hono-app";
import { IntegrationConfigurationError } from "@/lib/integrations/config";
import { logEvent } from "@/lib/logging";

const handle = async (request: Request): Promise<Response> => {
  try {
    return await getDegreePlanAgentApp().fetch(request);
  } catch (error) {
    logEvent("warn", "agentkit_route_unavailable", {
      category:
        error instanceof IntegrationConfigurationError
          ? "configuration"
          : "runtime",
    });
    return NextResponse.json(
      { error: "The degree-planning agent is not configured." },
      { status: 503 },
    );
  }
};

export const GET = handle;
export const POST = handle;
