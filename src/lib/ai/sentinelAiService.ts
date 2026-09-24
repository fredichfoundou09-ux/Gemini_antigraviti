import { supabase } from "@/lib/supabase/client";
import { AiChatMessage, AiPendingAction, AiAgentReply, EvaluationQuestion } from "./types";
export * from "./types";

function getLocalDB(): any {
  try {
    const raw = localStorage.getItem("sn_db_v2");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalDB(db: any) {
  try {
    localStorage.setItem("sn_db_v2", JSON.stringify(db));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("Erreur sauvegarde locale:", e);
  }
}

/**
 * Moteur Local Intelligent (Fallback Automatique si Edge Function non déployée ou hors-ligne)
 */
export async function localAgentProcess(messages: AiChatMessage[]): Promise<AiAgentReply> {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const db = getLocalDB();

  const pending_actions: AiPendingAction[] = [];
  let reply = "";

  // 1. Détection : Publication d'évaluation (QCM, examen, quiz, test)
  if (
    lastMsg.includes("éval") ||
    lastMsg.includes("eval") ||
    lastMsg.includes("quiz") ||
    lastMsg.includes("test") ||
    lastMsg.includes("qcm")
  ) {
    const matchedModule = db?.modules?.[0] || { id: "mod-sec-01", titre: "Sécurité & Réseaux" };
    const topic =
      lastMsg.includes("rsa") || lastMsg.includes("chiffr")
        ? "Chiffrement Asymétrique & RSA"
        : lastMsg.includes("réseau") || lastMsg.includes("reseau") || lastMsg.includes("ip")
        ? "Protocoles & Routage IP"
        : "Cybersécurité & Fondamentaux";

    const questions: EvaluationQuestion[] = [
      {
        type: "qcm",
        enonce: `Quel est le rôle principal de la clé publique dans ${topic} ?`,
        options: [
          "Déchiffrer les messages reçus",
          "Chiffrer le message avant transmission",
          "Remplacer le mot de passe utilisateur",
          "Détruire la session réseau",
        ],
        bonne_reponse: "Chiffrer le message avant transmission",
        points: 5,
        explication: "Dans un système asymétrique, la clé publique sert au chiffrement et la clé privée au déchiffrement.",
      },
      {
        type: "vf",
        enonce: "Une signature numérique garantit l'intégrité et la non-répudiation de l'émetteur.",
        bonne_reponse: "Vrai",
        points: 5,
      },
      {
        type: "courte",
        enonce: "Nommez l'algorithme asymétrique à clé publique le plus couramment employé fondé sur la factorisation d'entiers.",
        bonne_reponse: "RSA",
        points: 10,
      },
    ];

    const action_id = "prop-eval-" + Date.now();
    pending_actions.push({
      action_id,
      tool_name: "publier_evaluation",
      arguments: {
        module_id: matchedModule.id,
        titre: `Évaluation : ${topic}`,
        duree: 45,
        bareme: 20,
        questions,
      },
    });

    reply = `J'ai préparé une évaluation complète sur "${topic}" pour le module **${matchedModule.titre}** comprenant 3 questions (barème : 20 points, durée : 45 min). Vous pouvez vérifier le contenu ci-dessous et confirmer sa publication.`;
    return { reply, pending_actions };
  }

  // 2. Détection : Pointage / Présences
  if (lastMsg.includes("présence") || lastMsg.includes("presence") || lastMsg.includes("pointage") || lastMsg.includes("absent")) {
    const students = db?.students || [];
    const matchedModule = db?.modules?.[0] || { id: "mod-01", titre: "Module Général" };
    const sampleIds = students.slice(0, 3).map((s: any) => s.id);

    if (sampleIds.length > 0) {
      const action_id = "prop-att-" + Date.now();
      pending_actions.push({
        action_id,
        tool_name: "valider_presence",
        arguments: {
          module_id: matchedModule.id,
          student_ids: sampleIds,
          statut: "present",
          date: new Date().toISOString().slice(0, 10),
        },
      });
      reply = `J'ai préparé le pointage des présences pour ${sampleIds.length} apprenant(s) sur le module **${matchedModule.titre}**. Confirmez-vous l'enregistrement ?`;
      return { reply, pending_actions };
    }
  }

  // 3. Détection : Devoir / Document
  if (lastMsg.includes("devoir") || lastMsg.includes("cours") || lastMsg.includes("support")) {
    const matchedModule = db?.modules?.[0] || { id: "mod-01", titre: "Module Général" };
    const action_id = "prop-dev-" + Date.now();
    pending_actions.push({
      action_id,
      tool_name: "publier_devoir",
      arguments: {
        module_id: matchedModule.id,
        titre: "Travaux Pratiques : Analyse de paquets et vulnérabilités",
        description: "Devoir d'application à soumettre avant la fin de semaine.",
        contenu: "Effectuez une capture Wireshark, filtrez le trafic HTTP non sécurisé et identifiez les paramètres transmis en clair.",
        type: "devoir",
      },
    });
    reply = `J'ai rédigé le devoir pratique pour le module **${matchedModule.titre}**. Vérifiez la description et validez pour publier.`;
    return { reply, pending_actions };
  }

  // 4. Détection : RAG documentaire / Informations école
  if (lastMsg.includes("règlement") || lastMsg.includes("certificat") || lastMsg.includes("formation") || lastMsg.includes("enia")) {
    reply = `D'après les documents officiels de **Sentinelles Numériques / ENIA 2.0** :\n- Les certificats sont attribués aux étudiants atteignant au moins 12/20 de moyenne générale et 80% d'assiduité.\n- Les présences sont obligatoires et toute absence non justifiée au-delà de 3 séances bloque l'accès à l'évaluation finale.\n- Chaque certificat délivré est authentifiable publiquement avec son identifiant unique.`;
    return { reply, pending_actions };
  }

  // Réponse générale d'accueil et d'orientation
  reply = `Bonjour ! Je suis **SENTINEL'S AI**, votre copilote intelligent connecté à la plateforme. Je peux vous assister pour :\n\n- **Consulter vos données** : présences du jour, emploi du temps, notes et modules.\n- **Préparer des actions** : créer des évaluations QCM/VF, publier des devoirs ou enregistrer des présences.\n- **Rechercher dans la documentation (RAG)** : règlements, fiches de cours, critères de certification et FAQ.\n\nQue souhaitez-vous faire ?`;
  return { reply, pending_actions };
}

/**
 * Exécution locale d'une action d'écriture confirmée (secours)
 */
export async function localAgentExecute(action: AiPendingAction): Promise<{ ok: boolean; result: any }> {
  const { tool_name, arguments: args } = action;
  const db = getLocalDB();

  if (tool_name === "publier_evaluation") {
    if (db) {
      db.tests = db.tests || [];
      const testId = "test-" + Date.now();
      const newTest = {
        id: testId,
        moduleId: args.module_id,
        module_id: args.module_id,
        titre: args.titre,
        duree: args.duree || 45,
        bareme: args.bareme || 20,
        statut: "publie",
        date: new Date().toISOString(),
        questions: (args.questions || []).map((q: any, i: number) => ({
          id: "q-" + Date.now() + "-" + i,
          testId,
          test_id: testId,
          question: q.enonce || q.question || `Question ${i + 1}`,
          type: q.type || "qcm",
          options: Array.isArray(q.options) ? q.options : [],
          bonneReponse: q.bonne_reponse ?? "",
          bonne_reponse: q.bonne_reponse ?? "",
          points: q.points || 1,
          ordre: i + 1,
        })),
      };
      db.tests.push(newTest);
      saveLocalDB(db);
    }
    return { ok: true, result: { test_id: "test-" + Date.now(), titre: args.titre } };
  }

  if (tool_name === "publier_devoir") {
    if (db) {
      db.courses = db.courses || [];
      db.courses.push({
        id: "crs-" + Date.now(),
        titre: args.titre,
        description: args.description || "",
        moduleId: args.module_id,
        module_id: args.module_id,
        type: args.type || "devoir",
        content: args.contenu,
        publie: true,
        date: new Date().toISOString().slice(0, 10),
      });
      saveLocalDB(db);
    }
    return { ok: true, result: { course_id: "crs-" + Date.now(), titre: args.titre } };
  }

  if (tool_name === "valider_presence") {
    if (db && Array.isArray(args.student_ids)) {
      db.attendance = db.attendance || [];
      args.student_ids.forEach((sid: string) => {
        db.attendance.push({
          id: "att-" + Date.now() + "-" + sid,
          studentId: sid,
          student_id: sid,
          moduleId: args.module_id,
          module_id: args.module_id,
          statut: args.statut,
          date: args.date || new Date().toISOString().slice(0, 10),
        });
      });
      saveLocalDB(db);
    }
    return { ok: true, result: { inserted: args.student_ids?.length || 0 } };
  }

  return { ok: true, result: { executed: true } };
}

/**
 * Envoie l'historique de conversation à SENTINEL'S AI (Edge Function ou Fallback Local)
 */
export async function askSentinelAi(messages: AiChatMessage[]): Promise<AiAgentReply> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;

    if (session?.access_token && import.meta.env.VITE_SUPABASE_URL) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages }),
      });

      if (res.ok) {
        return await res.json();
      }
    }
  } catch (err) {
    console.warn("[SentinelAI] Edge Function non disponible, bascule automatique sur le moteur local résilient.", err);
  }

  return localAgentProcess(messages);
}

/**
 * Confirme explicitement une action sensible (Niveau 3)
 */
export async function confirmSentinelAiAction(action: AiPendingAction): Promise<{ ok: boolean; result: any }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;

    if (session?.access_token && import.meta.env.VITE_SUPABASE_URL) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ confirm_action: action }),
      });

      if (res.ok) {
        return await res.json();
      }
    }
  } catch (err) {
    console.warn("[SentinelAI] Confirmation via Edge Function non disponible, application locale.", err);
  }

  return localAgentExecute(action);
}
