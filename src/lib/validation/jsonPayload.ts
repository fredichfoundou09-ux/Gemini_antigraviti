/**
 * Utilitaire de validation et d'assainissement récursif de payloads JSON
 * Prévient les erreurs de sérialisation, cycles circulaires (HTMLButtonElement, FiberNode, etc.)
 */

export function sanitizeJsonPayload<T>(data: T): T {
  const seen = new WeakSet();

  function clean(val: any): any {
    if (val === null || val === undefined) return val;

    // Primitives sûres
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      return val;
    }

    // Exclusion des fonctions et symboles
    if (typeof val === "function" || typeof val === "symbol") {
      return undefined;
    }

    // Exclusion des éléments DOM et événements React
    if (
      typeof window !== "undefined" &&
      (val instanceof Node || val instanceof Event || val?.nativeEvent || val?._reactName || val?.__reactFiber$)
    ) {
      return undefined;
    }

    // Protection contre les références circulaires
    if (typeof val === "object") {
      if (seen.has(val)) {
        return undefined;
      }
      seen.add(val);

      if (Array.isArray(val)) {
        return val.map(clean).filter((item) => item !== undefined);
      }

      const res: Record<string, any> = {};
      for (const key of Object.keys(val)) {
        // Éviter les propriétés internes de React ou du DOM
        if (key.startsWith("__react") || key.startsWith("$$typeof") || key === "stateNode") {
          continue;
        }
        const cleanedValue = clean(val[key]);
        if (cleanedValue !== undefined) {
          res[key] = cleanedValue;
        }
      }
      return res;
    }

    return val;
  }

  return clean(data);
}
