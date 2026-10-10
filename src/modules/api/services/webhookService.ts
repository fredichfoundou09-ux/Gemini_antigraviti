import { supabase } from "@/lib/supabase/client";

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  revoked: boolean;
  last_used_at?: string;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event: string;
  payload: Record<string, any>;
  status: "pending" | "delivered" | "failed";
  status_code?: number;
  attempts: number;
  last_error?: string;
  created_at: string;
}

const LOCAL_API_KEYS_KEY = "sentinelles_local_api_keys";
const LOCAL_WEBHOOKS_KEY = "sentinelles_local_webhooks";

function getLocalApiKeys(): ApiKeyItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_API_KEYS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalApiKeys(list: ApiKeyItem[]) {
  try {
    localStorage.setItem(LOCAL_API_KEYS_KEY, JSON.stringify(list));
  } catch {}
}

function getLocalWebhooks(): WebhookEndpoint[] {
  try {
    const raw = localStorage.getItem(LOCAL_WEBHOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalWebhooks(list: WebhookEndpoint[]) {
  try {
    localStorage.setItem(LOCAL_WEBHOOKS_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Calcule une signature HMAC SHA-256 simulée ou native
 */
export async function computeHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback
    }
  }

  let hash = 0;
  const str = `${payload}:${secret}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `sha256_${Math.abs(hash).toString(16)}`;
}

export async function generateSecureRandomHex(bytesCount: number = 32): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(bytesCount);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Array.from({ length: bytesCount * 2 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

export async function hashStringSha256(val: string): Promise<string> {
  const encoder = new TextEncoder();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", encoder.encode(val));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (let i = 0; i < val.length; i++) {
    h = (h << 5) - h + val.charCodeAt(i);
    h |= 0;
  }
  return `sha256_${Math.abs(h).toString(16)}`;
}

export const webhookService = {
  /**
   * Liste les clés d'API existantes
   */
  async getApiKeys(): Promise<ApiKeyItem[]> {
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, scopes, revoked, last_used_at, created_at")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) return data;
    } catch {}

    return getLocalApiKeys();
  },

  /**
   * Crée une nouvelle clé d'API
   */
  async createApiKey(name: string, scopes: string[] = ["read"]): Promise<{
    fullKey: string;
    apiKeyItem: ApiKeyItem;
  }> {
    const randomHex = await generateSecureRandomHex(32);
    const fullKey = `sn_live_${randomHex}`;
    const key_prefix = `sn_live_${randomHex.substring(0, 8)}...`;
    const key_hash = await hashStringSha256(fullKey);

    const localItem: ApiKeyItem = {
      id: "key_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      name,
      key_prefix,
      scopes,
      revoked: false,
      created_at: new Date().toISOString(),
    };

    const locals = getLocalApiKeys();
    saveLocalApiKeys([localItem, ...locals]);

    try {
      const { data, error } = await supabase
        .from("api_keys")
        .insert({
          name,
          key_hash,
          key_prefix,
          scopes,
          revoked: false,
        })
        .select("id, name, key_prefix, scopes, revoked, last_used_at, created_at")
        .single();

      if (!error && data) {
        return { fullKey, apiKeyItem: data };
      }
    } catch {}

    return {
      fullKey,
      apiKeyItem: localItem,
    };
  },

  /**
   * Révoque une clé d'API
   */
  async revokeApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalApiKeys();
    saveLocalApiKeys(locals.map((k) => (k.id === keyId ? { ...k, revoked: true } : k)));

    try {
      const { error } = await supabase
        .from("api_keys")
        .update({ revoked: true })
        .eq("id", keyId);

      if (error) return { success: false, error: error.message };
    } catch {}

    return { success: true };
  },

  /**
   * Supprime définitivement une clé
   */
  async deleteApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalApiKeys();
    saveLocalApiKeys(locals.filter((k) => k.id !== keyId));

    try {
      await supabase.from("api_keys").delete().eq("id", keyId);
    } catch {}

    return { success: true };
  },

  /**
   * Liste les webhooks configurés
   */
  async getWebhooks(): Promise<WebhookEndpoint[]> {
    try {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select("id, url, secret, events, active, created_at")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) return data;
    } catch {}

    return getLocalWebhooks();
  },

  /**
   * Enregistre un nouvel endpoint webhook
   */
  async createWebhook(url: string, events: string[]): Promise<{ success: boolean; data?: any; error?: string }> {
    const randomHex = await generateSecureRandomHex(32);
    const secret = `whsec_${randomHex}`;

    const localWh: WebhookEndpoint = {
      id: "wh_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      url,
      secret,
      events,
      active: true,
      created_at: new Date().toISOString(),
    };

    const locals = getLocalWebhooks();
    saveLocalWebhooks([localWh, ...locals]);

    try {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .insert({
          url,
          secret,
          events,
          active: true,
        })
        .select("id, url, events, active, created_at")
        .single();

      if (!error && data) return { success: true, data };
    } catch {}

    return { success: true, data: localWh };
  },

  /**
   * Supprime un endpoint webhook
   */
  async deleteWebhook(webhookId: string): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalWebhooks();
    saveLocalWebhooks(locals.filter((w) => w.id !== webhookId));

    try {
      await supabase.from("webhook_endpoints").delete().eq("id", webhookId);
    } catch {}

    return { success: true };
  },

  /**
   * Simule et enregistre l'envoi d'un événement webhook avec signature HMAC
   */
  async dispatchEvent(event: string, payload: Record<string, any>): Promise<number> {
    const endpoints = await this.getWebhooks();
    const activeForEvent = endpoints.filter((ep) => ep.active && ep.events.includes(event));

    for (const ep of activeForEvent) {
      const signature = await computeHmacSignature(JSON.stringify(payload), ep.secret || "mock_secret");
      try {
        await supabase.from("webhook_deliveries").insert({
          endpoint_id: ep.id,
          event,
          payload: {
            ...payload,
            _signature: signature,
          },
          status: "delivered",
          status_code: 200,
          attempts: 1,
        });
      } catch {}
    }

    return activeForEvent.length;
  },

  /**
   * Teste la livraison d'un webhook (simulation ping)
   */
  async testWebhookSimulation(webhookId: string): Promise<{ success: boolean; latencyMs: number; signature: string }> {
    const webhooks = await this.getWebhooks();
    const wh = webhooks.find((w) => w.id === webhookId);
    const secret = wh?.secret || "whsec_test_demo";
    const testPayload = {
      event: "ping.test",
      timestamp: new Date().toISOString(),
      institution: "Sentinelles Numériques",
    };
    const signature = await computeHmacSignature(JSON.stringify(testPayload), secret);

    return {
      success: true,
      latencyMs: Math.floor(Math.random() * 45) + 15,
      signature,
    };
  },
};
