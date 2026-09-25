// ============================================================
// WebSearchProvider & WikipediaProvider — SENTINEL'S AI
// Recherche encyclopédique, technique et documentaire réelle
// ============================================================

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceType: "wikipedia" | "official_doc" | "academic" | "web";
  confidence: number;
}

export interface WebSearchProvider {
  name: string;
  search(query: string, limit?: number): Promise<WebSearchResult[]>;
}

/**
 * Fournisseur Wikipédia en français avec fallback multilingue
 * Utilise les APIs ouvertes et gratuites de Wikimedia Foundation sans clé requise
 */
export class WikipediaProvider implements WebSearchProvider {
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
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(searchUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "SentinelAI-Code6Senti/2.0 (education@code6senti.org)" },
      });
      clearTimeout(timeoutId);

      if (!res.ok) return [];

      const data = await res.json();
      const items = data.query?.search || [];

      const results: WebSearchResult[] = [];

      for (const item of items) {
        // Nettoyage des balises HTML renvoyées par MediaWiki
        const cleanSnippet = item.snippet
          .replace(/<span class="searchmatch">/g, "")
          .replace(/<\/span>/g, "")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, "&");

        results.push({
          title: `Wikipédia — ${item.title}`,
          url: `https://${this.lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, "_"))}`,
          snippet: cleanSnippet,
          sourceType: "wikipedia",
          confidence: 0.95,
        });
      }

      return results;
    } catch (err) {
      console.warn("[WikipediaProvider] Échec de la recherche :", err);
      return [];
    }
  }

  /**
   * Récupère le résumé détaillé (page summary) d'un sujet précis
   */
  async getSummary(pageTitle: string): Promise<string | null> {
    const cleanTitle = encodeURIComponent(pageTitle.trim().replace(/\s+/g, "_"));
    const url = `https://${this.lang}.wikipedia.org/api/rest_v1/page/summary/${cleanTitle}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "SentinelAI-Code6Senti/2.0" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.extract || null;
    } catch {
      return null;
    }
  }
}

/**
 * Fournisseur de documentation technique officielle (RFC, MDN, OWASP, Linux)
 */
export class DocumentationProvider implements WebSearchProvider {
  name = "Documentation Technique";

  // Base de connaissances indexée de références standardisées
  private standardDocs: Array<{ keywords: string[]; title: string; url: string; snippet: string }> = [
    {
      keywords: ["ospf", "routage", "rfc 2328"],
      title: "IETF RFC 2328 — OSPF Version 2",
      url: "https://datatracker.ietf.org/doc/html/rfc2328",
      snippet: "OSPF (Open Shortest Path First) est un protocole de routage dynamique à état de liens (Link-State) basé sur l'algorithme de Dijkstra (SPF). Il opère au sein d'un même système autonome (IGP).",
    },
    {
      keywords: ["bgp", "routage", "rfc 4271"],
      title: "IETF RFC 4271 — A Border Gateway Protocol 4 (BGP-4)",
      url: "https://datatracker.ietf.org/doc/html/rfc4271",
      snippet: "BGP-4 est le protocole de routage inter-domaines standard d'Internet (EGP). Il utilise le routage à vecteur de chemins (Path Vector) au-dessus de TCP port 179.",
    },
    {
      keywords: ["tls", "https", "rfc 8446", "chiffrement"],
      title: "IETF RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3",
      url: "https://datatracker.ietf.org/doc/html/rfc8446",
      snippet: "TLS 1.3 accélère la négociation à 1 RTT (ou 0-RTT), supprime les algorithmes obsolètes et impose la confidentialité persistante (Perfect Forward Secrecy avec ECDHE).",
    },
    {
      keywords: ["owasp", "top 10", "injection", "vulnérabilité", "sécurité web"],
      title: "OWASP Top 10 Web Application Security Risks",
      url: "https://owasp.org/www-project-top-ten/",
      snippet: "Le classement OWASP Top 10 identifie : Broken Access Control (A01), Cryptographic Failures (A02), Injection (A03), Insecure Design (A04), Security Misconfiguration (A05).",
    },
    {
      keywords: ["zero trust", "nist sp 800-207"],
      title: "NIST SP 800-207 — Zero Trust Architecture",
      url: "https://csrc.nist.gov/publications/detail/sp/800-207/final",
      snippet: "Le paradigme Zero Trust postule qu'aucun utilisateur ou actif réseau n'est digne de confiance implicite, qu'il se trouve à l'intérieur ou à l'extérieur du périmètre d'entreprise. Authentification continue et moindre privilège.",
    },
    {
      keywords: ["rsa", "chiffrement asymétrique", "pkcs"],
      title: "PKCS #1 / RFC 8017 — RSA Cryptography Specifications",
      url: "https://datatracker.ietf.org/doc/html/rfc8017",
      snippet: "RSA s'appuie sur la difficulté algorithmique de factoriser le produit de deux grands nombres premiers distincts. Il permet le chiffrement et la signature numérique.",
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
      sourceType: "official_doc",
      confidence: 0.98,
    }));
  }
}

/**
 * Agrégateur de recherche Web combinant Wikipédia et Documentation officielle
 */
export class AggregateWebSearchProvider implements WebSearchProvider {
  name = "Recherche Web Hybride";
  private wiki = new WikipediaProvider("fr");
  private docs = new DocumentationProvider();

  async search(query: string, limit = 4): Promise<WebSearchResult[]> {
    const [docsResults, wikiResults] = await Promise.all([
      this.docs.search(query, 2),
      this.wiki.search(query, 3),
    ]);

    const combined = [...docsResults, ...wikiResults];
    return combined.slice(0, limit);
  }
}
