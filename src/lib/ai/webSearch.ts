// ============================================================
// WebSearch & Wikipedia Client Provider — SENTINEL'S AI
// Support universel navigateur & tests (API MediaWiki CORS-friendly)
// ============================================================

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceType: "wikipedia" | "official_doc" | "academic" | "web";
  confidence: number;
}

export class ClientWikipediaProvider {
  name = "Wikipédia";
  private lang: string;

  constructor(lang = "fr") {
    this.lang = lang;
  }

  async search(query: string, limit = 3): Promise<WebSearchResult[]> {
    const cleanQuery = encodeURIComponent(query.trim());
    const searchUrl = `https://${this.lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${cleanQuery}&format=json&origin=*&srlimit=${limit}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) return [];

      const data = await res.json();
      const items = data.query?.search || [];

      return items.map((item: any) => {
        const cleanSnippet = (item.snippet || "")
          .replace(/<span class="searchmatch">/g, "")
          .replace(/<\/span>/g, "")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, "&");

        return {
          title: `Wikipédia — ${item.title}`,
          url: `https://${this.lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, "_"))}`,
          snippet: cleanSnippet,
          sourceType: "wikipedia" as const,
          confidence: 0.95,
        };
      });
    } catch {
      return [];
    }
  }
}

export class ClientDocumentationProvider {
  name = "Documentation Technique & RFC";

  private standardDocs = [
    {
      keywords: ["ospf", "routage", "dijkstra"],
      title: "RFC 2328 — OSPF Version 2",
      url: "https://datatracker.ietf.org/doc/html/rfc2328",
      snippet: "OSPF (Open Shortest Path First) est un protocole de routage dynamique à état de liens basé sur Dijkstra.",
    },
    {
      keywords: ["bgp", "routage internet"],
      title: "RFC 4271 — Border Gateway Protocol 4 (BGP-4)",
      url: "https://datatracker.ietf.org/doc/html/rfc4271",
      snippet: "BGP-4 régit l'interconnexion mondiale des Systèmes Autonomes (AS) sur TCP port 179.",
    },
    {
      keywords: ["tls", "https", "ssl"],
      title: "RFC 8446 — The TLS Protocol Version 1.3",
      url: "https://datatracker.ietf.org/doc/html/rfc8446",
      snippet: "TLS 1.3 renforce le chiffrement avec Perfect Forward Secrecy obligatoire et handshake 1-RTT.",
    },
    {
      keywords: ["owasp", "failles", "injection"],
      title: "OWASP Top 10 — Vulnérabilités Majeures",
      url: "https://owasp.org/www-project-top-ten/",
      snippet: "Référentiel des risques de sécurité majeurs pour les applications web.",
    },
    {
      keywords: ["rsa", "clé publique", "chiffrement"],
      title: "RFC 8017 — PKCS #1: RSA Cryptography",
      url: "https://datatracker.ietf.org/doc/html/rfc8017",
      snippet: "Spécification de la cryptographie asymétrique RSA basée sur la factorisation de grands nombres premiers.",
    },
  ];

  async search(query: string, limit = 2): Promise<WebSearchResult[]> {
    const q = query.toLowerCase();
    const matches = this.standardDocs.filter((doc) =>
      doc.keywords.some((kw) => q.includes(kw)) || q.includes(doc.title.toLowerCase())
    );

    return matches.slice(0, limit).map((m) => ({
      title: m.title,
      url: m.url,
      snippet: m.snippet,
      sourceType: "official_doc" as const,
      confidence: 0.98,
    }));
  }
}
