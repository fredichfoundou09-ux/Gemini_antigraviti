export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface AIProvider {
  name: string;
  createCompletion(options: CompletionOptions): Promise<{
    message: ChatMessage;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  }>;
}

export class NvidiaNimProvider implements AIProvider {
  name = "NVIDIA NIM";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = Deno.env.get("NVIDIA_API_KEY") || "";
    this.baseUrl = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
    this.model = Deno.env.get("NVIDIA_MODEL") || "nvidia/nemotron-3.5-lightning-30b-a3b";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  async createCompletion(options: CompletionOptions): Promise<{
    message: ChatMessage;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  }> {
    if (!this.isConfigured()) {
      throw new Error("Configuration NVIDIA NIM manquante : la variable NVIDIA_API_KEY doit être définie côté serveur.");
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const payload: Record<string, any> = {
      model: this.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 1024,
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
      payload.tool_choice = "auto";
    }

    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const status = res.status;
          const errorBody = await res.text().catch(() => "");
          const sanitizedErr = errorBody.replace(/nvapi-[a-zA-Z0-9_-]+/g, "nvapi-[REDACTED]");

          if ((status === 429 || status === 503) && attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            await new Promise((r) => setTimeout(r, waitTime));
            continue;
          }

          throw new Error(`Erreur NVIDIA NIM [HTTP ${status}] : ${sanitizedErr.slice(0, 300)}`);
        }

        const data = await res.json();
        const choice = data.choices?.[0]?.message;

        if (!choice) {
          throw new Error("Réponse vide ou invalide reçue de NVIDIA NIM.");
        }

        return {
          message: choice,
          usage: data.usage,
        };
      } catch (err: any) {
        lastError = err;
        if (err.name === "AbortError") {
          throw new Error("Délai d'attente dépassé (timeout 35s) lors de la communication avec NVIDIA NIM.");
        }
        if (attempt === maxRetries) break;
      }
    }

    throw lastError || new Error("Échec de communication avec le fournisseur d'IA.");
  }

  /**
   * Émet une requête de streaming de tokens vers NVIDIA NIM
   */
  async createStream(options: CompletionOptions): Promise<ReadableStream<Uint8Array>> {
    if (!this.isConfigured()) {
      throw new Error("Configuration NVIDIA NIM manquante : la variable NVIDIA_API_KEY doit être définie côté serveur.");
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const payload: Record<string, any> = {
      model: this.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 1024,
      stream: true,
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Erreur stream NVIDIA NIM [HTTP ${res.status}] : ${err.slice(0, 300)}`);
    }

    if (!res.body) {
      throw new Error("Flux de réponse vide reçu de NVIDIA NIM.");
    }

    return res.body;
  }
}
