import { describe, it, expect, vi, beforeEach } from "vitest";
import { idbSet, idbGet, idbDelete, getStorageQuotaEstimate } from "../lib/idbStorage";

describe("IndexedDB Storage Layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("gère gracieusement l'absence d'IndexedDB en environnement sans crash", async () => {
    // Si indexedDB n'est pas instancié dans Node/Vitest
    await expect(idbSet("test_key", { data: 123 })).resolves.toBeUndefined();
    const result = await idbGet("test_key");
    expect(result).toBeNull();
    await expect(idbDelete("test_key")).resolves.toBeUndefined();
  });

  it("fournit une estimation de quota sécurisée sans lever d'exception", async () => {
    const quota = await getStorageQuotaEstimate();
    // En environnement de test Node/JSDOM, navigator.storage peut être null ou renvoyer un mock
    expect(quota === null || typeof quota.percent === "number").toBe(true);
  });
});
