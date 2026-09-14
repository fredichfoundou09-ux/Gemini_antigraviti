import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useAudit,
  useEnia,
  useFormations,
  useNotifications,
  useStudents,
  useSupabaseQuery,
  usePresence,
  useBackgroundSync,
} from "../hooks";

describe("Couche Hooks Sentinelles (Exportations et Initialisation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exporte l'ensemble des hooks requis sans exception", () => {
    expect(typeof useAudit).toBe("function");
    expect(typeof useEnia).toBe("function");
    expect(typeof useFormations).toBe("function");
    expect(typeof useNotifications).toBe("function");
    expect(typeof useStudents).toBe("function");
    expect(typeof useSupabaseQuery).toBe("function");
    expect(typeof usePresence).toBe("function");
    expect(typeof useBackgroundSync).toBe("function");
  });
});
