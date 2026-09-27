import { Store } from "./domain";
import { StewardDecision, StewardMemory } from "./steward";
import { AgentDecision, validateAgentDecision } from "./agent";

export type GatewayConfig = { enabled: boolean; baseUrl: string };

export const defaultGatewayConfig: GatewayConfig = { enabled: false, baseUrl: "" };

function endpoint(baseUrl: string) {
  return baseUrl.replace(/\/$/, "") + "/v1/agent/decide";
}

export async function askGateway(
  config: GatewayConfig,
  message: string,
  store: Store,
  memory: StewardMemory,
  fallback: StewardDecision,
): Promise<AgentDecision> {
  if (!config.enabled || !config.baseUrl.trim()) return { ...fallback, source: "offline" };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint(config.baseUrl.trim()), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, store, memory }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Gateway HTTP " + response.status);
    const payload = await response.json();
    return validateAgentDecision(payload, store, fallback, payload?.model);
  } catch {
    return { ...fallback, source: "offline" };
  } finally {
    window.clearTimeout(timer);
  }
}
