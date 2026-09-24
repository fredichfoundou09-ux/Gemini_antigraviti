/** Détection basique des tentatives courantes d'injection de prompt */
export function checkPromptInjection(input: string): { isSuspicious: boolean; reason?: string } {
  const lower = input.toLowerCase();

  const patterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    /oublie\s+(toutes\s+)?(les\s+)?instructions\s+précédentes/i,
    /révèle(\s+-moi)?\s+(ta|la)\s+clé\s+api/i,
    /give\s+me\s+the\s+api\s+key/i,
    /system\s+prompt/i,
    /afficher\s+le\s+prompt\s+système/i,
    /jailbreak/i,
    /dan\s+mode/i,
    /drop\s+table/i,
    /bypass\s+security/i,
  ];

  for (const p of patterns) {
    if (p.test(lower)) {
      return { isSuspicious: true, reason: "Tentative d'altération des consignes de sécurité détectée." };
    }
  }

  return { isSuspicious: false };
}

/** Nettoyage des sorties pour empêcher toute fuite de secret */
export function sanitizeOutput(text: string): string {
  if (!text) return text;
  return text
    .replace(/nvapi-[a-zA-Z0-9_-]{20,}/g, "[SECRET_MASQUÉ]")
    .replace(/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g, "[JWT_MASQUÉ]")
    .replace(/(password|mot_de_passe|secret)[\s:=]+["']?[^"'\s\n]{6,}["']?/gi, "$1: [CONFIDENTIEL]");
}
