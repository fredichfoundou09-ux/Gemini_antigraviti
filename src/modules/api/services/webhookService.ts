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

export const webhookService = {
  /**
   * Liste les clés d'API existantes
   */
  async getApiKeys(): Promise<ApiKeyItem[]> {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, scopes, revoked, last_used_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement clés API:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Crée une nouvelle clé d'API et retourne le jeton complet une seule fois
   */
  async createApiKey(name: string, scopes: string[] = ["read"]): Promise<{
    fullKey: string;
    apiKeyItem: ApiKeyItem;
  }> {
    const randomHex = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const fullKey = `sn_live_${randomHex}`;
    const key_prefix = `sn_live_${randomHex.substring(0, 4)}...`;

    // Calcul du hash stocké
    let hash = 0;
    for (let i = 0; i < fullKey.length; i++) {
      hash = (hash << 5) - hash + fullKey.charCodeAt(i);
      hash |= 0;
    }
    const key_hash = `hash_${Math.abs(hash).toString(16)}`;

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        name,
        key_hash,
        key_prefix,
        scopes,
        revoked: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      fullKey,
      apiKeyItem: data,
    };
  },

  /**
   * Révoque une clé d'API
   */
  async revokeApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("api_keys")
      .update({ revoked: true })
      .eq("id", keyId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /**
   * Liste les webhooks configurés
   */
  async getWebhooks(): Promise<WebhookEndpoint[]> {
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement webhooks:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Enregistre un nouvel endpoint webhook
   */
  async createWebhook(url: string, events: string[]): Promise<{ success: boolean; data?: any; error?: string }> {
    const secret = `whsec_${Math.random().toString(36).substring(2, 14)}`;
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .insert({
        url,
        secret,
        events,
        active: true,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  /**
   * Simule et enregistre l'envoi d'un événement webhook avec signature HMAC
   */
  async dispatchEvent(event: string, payload: Record<string, any>): Promise<number> {
    const endpoints = await this.getWebhooks();
    const activeForEvent = endpoints.filter((ep) => ep.active && ep.events.includes(event));

    for (const ep of activeForEvent) {
      const signature = await computeHmacSignature(JSON.stringify(payload), ep.secret);
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
    }

    return activeForEvent.length;
  },
};
