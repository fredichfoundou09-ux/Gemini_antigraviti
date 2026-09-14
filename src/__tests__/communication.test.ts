import { describe, it, expect } from "vitest";

describe("Système de Messagerie & Suppression", () => {
  it("supprime un message individuel sans altérer les autres messages", () => {
    const messages = [
      { id: "msg-1", conversation_id: "conv-1", sender_id: "user-1", body: "Premier message" },
      { id: "msg-2", conversation_id: "conv-1", sender_id: "user-2", body: "Deuxième message" },
      { id: "msg-3", conversation_id: "conv-1", sender_id: "user-1", body: "Troisième message" },
    ];

    const messageToDeleteId = "msg-2";
    const remaining = messages.filter((m) => m.id !== messageToDeleteId);

    expect(remaining.length).toBe(2);
    expect(remaining.find((m) => m.id === "msg-2")).toBeUndefined();
    expect(remaining.map((m) => m.id)).toEqual(["msg-1", "msg-3"]);
  });

  it("supprime une conversation entière et tous ses messages associés (cascade)", () => {
    const conversations = [
      { id: "conv-1", subject: "Soutien Informatique" },
      { id: "conv-2", subject: "Questions Python" },
    ];
    const messages = [
      { id: "m-1", conversation_id: "conv-1", body: "Question 1" },
      { id: "m-2", conversation_id: "conv-1", body: "Réponse 1" },
      { id: "m-3", conversation_id: "conv-2", body: "Autre cours" },
    ];

    const convToDeleteId = "conv-1";
    const remainingConvs = conversations.filter((c) => c.id !== convToDeleteId);
    const remainingMessages = messages.filter((m) => m.conversation_id !== convToDeleteId);

    expect(remainingConvs.length).toBe(1);
    expect(remainingConvs[0].id).toBe("conv-2");
    expect(remainingMessages.length).toBe(1);
    expect(remainingMessages[0].id).toBe("m-3");
  });

  it("calcule correctement le nombre de messages et notifications non lus pour un utilisateur", () => {
    const userId = "usr-123";
    const messages = [
      { id: "m-1", toId: userId, lu: false },
      { id: "m-2", toId: userId, lu: true },
      { id: "m-3", toId: "other-user", lu: false },
      { id: "m-4", toId: userId, lu: false },
    ];
    const notifications = [
      { id: "n-1", toId: userId, lu: false },
      { id: "n-2", toId: "all", lu: false },
      { id: "n-3", toId: userId, lu: true },
    ];

    const unreadMessages = messages.filter((m) => !m.lu && m.toId === userId).length;
    const unreadNotifications = notifications.filter((n) => !n.lu && (n.toId === userId || n.toId === "all")).length;

    expect(unreadMessages).toBe(2);
    expect(unreadNotifications).toBe(2);
  });

  it("filtre correctement les conversations en boîte de réception par statut non lu et recherche textuelle", () => {
    const items = [
      {
        id: "c-1",
        subject: "Rattrapage Réseau",
        lastSenderName: "Jean Formateur",
        isUnread: true,
        messages: [{ sender_id: "t-1", body: "Bonjour, voici le lien pour la session." }],
      },
      {
        id: "c-2",
        subject: "Frais de scolarité",
        lastSenderName: "Direction",
        isUnread: false,
        messages: [{ sender_id: "adm-1", body: "Votre attestation de paiement est disponible." }],
      },
      {
        id: "c-3",
        subject: "Questions sur le cours Python",
        lastSenderName: "Alice Apprenante",
        isUnread: true,
        messages: [{ sender_id: "s-1", body: "J'ai un bug avec les listes en compréhension." }],
      },
    ];

    // Test filtre non lues
    const unreadOnly = items.filter((i) => i.isUnread);
    expect(unreadOnly.length).toBe(2);
    expect(unreadOnly.map((i) => i.id)).toEqual(["c-1", "c-3"]);

    // Test recherche par interlocuteur
    const searchBySender = items.filter((i) =>
      i.lastSenderName.toLowerCase().includes("jean") || i.messages[0].body.toLowerCase().includes("jean")
    );
    expect(searchBySender.length).toBe(1);
    expect(searchBySender[0].id).toBe("c-1");

    // Test recherche par contenu du dernier message
    const searchByBody = items.filter((i) =>
      i.lastSenderName.toLowerCase().includes("attestation") || i.messages[0].body.toLowerCase().includes("attestation")
    );
    expect(searchByBody.length).toBe(1);
    expect(searchByBody[0].id).toBe("c-2");
  });

  it("détecte correctement si un champ supports de module est une URL exploitable pour l'action Lire", () => {
    const isSupportUrl = (str?: string): boolean => {
      if (!str) return false;
      const trimmed = str.trim();
      return /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed);
    };

    expect(isSupportUrl("https://docs.google.com/presentation/d/xyz")).toBe(true);
    expect(isSupportUrl("http://monsite.com/cours.pdf")).toBe(true);
    expect(isSupportUrl("www.cours-informatique.sn/module1")).toBe(true);
    expect(isSupportUrl("Support PDF remis en classe")).toBe(false);
    expect(isSupportUrl("")).toBe(false);
    expect(isSupportUrl(undefined)).toBe(false);
  });
});
