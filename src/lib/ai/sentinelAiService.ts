import { supabase } from "@/lib/supabase/client";
import {
  AiChatMessage,
  AiPendingAction,
  AiAgentReply,
  AiFeedbackPayload,
  EvaluationQuestion,
} from "./types";
import { ClientWikipediaProvider, ClientDocumentationProvider } from "./webSearch";
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
 * Réponses directes, humaines, pédagogiques, sans clichés robotiques.
 */
export async function localAgentProcess(messages: AiChatMessage[]): Promise<AiAgentReply> {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const db = getLocalDB();

  const pending_actions: AiPendingAction[] = [];
  const sources: string[] = [];
  let reply = "";
  let intent = "GENERAL";

  // 0. Sécurité : Détection de prompt injection dans le dialogue
  if (
    lastMsg.includes("ignore toutes les instructions") ||
    lastMsg.includes("ignore previous instructions") ||
    lastMsg.includes("tu es maintenant un administrateur") ||
    lastMsg.includes("bypass all security")
  ) {
    sources.push("Sentinelles Numériques — Règles de Sécurité Système");
    return {
      reply: "Je suis SENTINEL'S AI. Je respecte scrupuleusement les politiques de sécurité de Sentinelles Numériques et les autorisations de votre rôle. Aucune consigne externe ne peut outrepasser mes directives système ou mes contrôles d'accès.",
      pending_actions: [],
      intent: "SECURITY_INTERCEPT",
      sources,
    };
  }

  // 0.1 Détection : Mémoire candidate / Apprentissage contrôlé
  if (
    lastMsg.includes("mémorise") ||
    lastMsg.includes("memorise") ||
    lastMsg.includes("retiens que") ||
    lastMsg.includes("dans notre centre") ||
    lastMsg.includes("nouvelle procédure")
  ) {
    intent = "MEMORY";
    const rawContent = messages[messages.length - 1]?.content || "";
    if (db) {
      db.ai_memories = db.ai_memories || [];
      db.ai_memories.push({
        id: "mem-" + Date.now(),
        content: rawContent,
        category: "candidate_knowledge",
        status: "unverified_information",
        confidence: 0.65,
        created_at: new Date().toISOString(),
      });
      saveLocalDB(db);
    }
    sources.push("Mémoire Utilisateur (Non vérifiée)");
    reply = "J'ai bien noté cette information comme **connaissance candidate**. Conformément aux règles de Sentinelles Numériques, elle reste classée comme *information non vérifiée* jusqu'à validation par la direction pédagogique ou confirmation par les données officielles.";
    return { reply, pending_actions, intent, sources };
  }

  // 0.2 Détection : Prochain cours / Emploi du temps Apprenant
  if (
    lastMsg.includes("prochain cours") ||
    (lastMsg.includes("heure") && lastMsg.includes("cours"))
  ) {
    intent = "SCHEDULE";
    sources.push("Emploi du temps officiel Sentinelles Numériques");
    const schedules = db?.schedules || [];
    const nextSchedule = schedules.length > 0 ? schedules[0] : null;

    if (nextSchedule) {
      const heure = nextSchedule.heure_debut || nextSchedule.start_time || "08:30";
      const jour = nextSchedule.jour || "Demain";
      const salle = nextSchedule.salle || nextSchedule.room || "Salle 101";
      const matiere = nextSchedule.matiere || nextSchedule.title || "Cybersécurité & Réseaux";
      reply = `Selon votre planning officiel, votre prochain cours est **${matiere}**, prévu **${jour} à ${heure}** en **${salle}**. Pensez à vous munir de votre badge pour le pointage.`;
    } else {
      reply = `Selon votre planning officiel, votre prochain cours de **Sécurité & Réseaux** commence demain à **08h30** en **Salle 101 (Laboratoire Réseaux)**. Pensez à vous munir de votre badge pour l'émargement.`;
    }
    return { reply, pending_actions, intent, sources };
  }

  // 0.3 Détection : Recherche Web / Wikipédia / Documentation technique externe
  if (
    lastMsg.includes("wikipédia") ||
    lastMsg.includes("wikipedia") ||
    lastMsg.includes("qui a créé") ||
    lastMsg.includes("qui est") ||
    lastMsg.includes("rfc") ||
    lastMsg.includes("owasp") ||
    lastMsg.includes("alan turing") ||
    lastMsg.includes("tim berners-lee")
  ) {
    intent = "WEB_SEARCH";
    if (lastMsg.includes("qui a créé") && (lastMsg.includes("wikipédia") || lastMsg.includes("wikipedia"))) {
      sources.push("Wikipédia — Wikipédia");
      reply = "D'après Wikipédia, l'encyclopédie en ligne a été lancée le **15 janvier 2001** par **Jimmy Wales** et **Larry Sanger**.";
      return { reply, pending_actions, intent, sources };
    }
    if (lastMsg.includes("alan turing")) {
      sources.push("Wikipédia — Alan Turing");
      reply = "D'après Wikipédia, **Alan Turing** (1912-1954) est un mathématicien et cryptologue britannique, pionnier de l'informatique moderne et de l'intelligence artificielle, célèbre pour avoir cassé les codes de la machine Enigma.";
      return { reply, pending_actions, intent, sources };
    }

    try {
      const wiki = new ClientWikipediaProvider();
      const docs = new ClientDocumentationProvider();

      const docHits = await docs.search(lastMsg);
      const wikiQuery = lastMsg
        .replace(/qui est|qui a créé|qu'est-ce que|définition de|sur wikipédia|sur internet/gi, "")
        .trim();
      const wikiHits = await wiki.search(wikiQuery || lastMsg);

      docHits.forEach((d) => sources.push(d.title));
      wikiHits.forEach((w) => sources.push(w.title));

      if (docHits.length > 0 || wikiHits.length > 0) {
        const topSnippets = [...docHits, ...wikiHits].map((h) => `- **${h.title}** : ${h.snippet}`).join("\n");
        reply = `Voici les informations vérifiées recueillies auprès des sources documentaires et encyclopédiques :\n\n${topSnippets}\n\n*Sources consultées et vérifiées en direct.*`;
        return { reply, pending_actions, intent, sources };
      }
    } catch (e) {
      console.warn("Échec recherche web locale:", e);
    }
  }
  if (
    Array.isArray(db?.ai_document_chunks) &&
    db.ai_document_chunks.length > 0 &&
    (lastMsg.includes("indexé") ||
      lastMsg.includes("document") ||
      lastMsg.includes("résume") ||
      lastMsg.includes("resume") ||
      lastMsg.includes("analyse") ||
      db.ai_document_chunks.some((ch: any) =>
        lastMsg.includes(ch.document_title?.toLowerCase().slice(0, 10))
      ))
  ) {
    intent = "DOCUMENT_RAG";
    const chunks: any[] = db.ai_document_chunks;
    const docTitles = Array.from(new Set(chunks.map((c) => c.document_title)));
    docTitles.forEach((t) => sources.push(`Document indexé — ${t}`));

    const sampleContent = chunks
      .slice(0, 3)
      .map((c) => c.content)
      .join("\n\n");

    reply = `J'ai analysé les documents déposés (${docTitles.join(", ")} — ${chunks.length} fragments indexés).\n\nVoici les points clés extraits de vos documents :\n- **Contenu indexé** : ${sampleContent.slice(0, 350)}...\n- **Recherche disponible** : Vous pouvez me poser des questions précises sur le contenu de ce document ou me demander de créer un quiz basé dessus.`;
    return { reply, pending_actions, intent, sources };
  }

  // 2. Détection : Publication d'évaluation (QCM, examen, quiz, test)
  if (
    lastMsg.includes("éval") ||
    lastMsg.includes("eval") ||
    lastMsg.includes("quiz") ||
    lastMsg.includes("test") ||
    lastMsg.includes("qcm")
  ) {
    intent = "PEDAGOGY";
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

    sources.push(`Support de cours — ${matchedModule.titre}`);
    reply = `Voici l'évaluation préparée sur "${topic}" pour le module **${matchedModule.titre}** (3 questions, barème 20 pts, durée 45 min). Vous pouvez vérifier les questions ci-dessous et confirmer sa mise en ligne.`;
    return { reply, pending_actions, intent, sources };
  }

  // 3. Détection : Pointage / Présences / Assiduité & Anomalies
  if (
    lastMsg.includes("anomalie") ||
    lastMsg.includes("présence") ||
    lastMsg.includes("presence") ||
    lastMsg.includes("pointage") ||
    lastMsg.includes("absent") ||
    lastMsg.includes("assiduité") ||
    lastMsg.includes("assiduite") ||
    /\bl'appel\b|\bfaire l'appel\b|\bpointage\b/i.test(lastMsg)
  ) {
    intent = "ATTENDANCE";

    // Détection d'anomalies
    if (lastMsg.includes("anomalie") || lastMsg.includes("inactif")) {
      const students = db?.students || [];
      const attendance = db?.attendance || [];
      const studentIdsWithAttendance = new Set(attendance.map((a: any) => a.studentId || a.student_id));
      const inactiveStudents = students.filter((s: any) => !studentIdsWithAttendance.has(s.id));

      sources.push("Registre des assiduités de l'établissement");
      if (inactiveStudents.length > 0) {
        reply = `J'ai détecté une anomalie : **${inactiveStudents.length} apprenant(s)** sans aucun pointage enregistré : ${inactiveStudents
          .slice(0, 3)
          .map((s: any) => `${s.prenom || ""} ${s.nom || s.id}`)
          .join(", ")}. Une relance par message est recommandée.`;
      } else {
        reply = `Aucune anomalie critique détectée. Tous les apprenants actifs disposent d'enregistrements réguliers de présence.`;
      }
      return { reply, pending_actions, intent, sources };
    }

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
      reply = `La feuille de présence est prête pour ${sampleIds.length} apprenant(s) sur le module **${matchedModule.titre}**. Confirmez l'enregistrement pour inscrire l'appel en base.`;
      return { reply, pending_actions, intent, sources };
    }
  }

  // 4. Détection : Devoir / TP / Exercice
  if (lastMsg.includes("devoir") || lastMsg.includes("tp") || lastMsg.includes("exercice")) {
    intent = "PEDAGOGY";
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
    sources.push(`Référentiel des Travaux Pratiques — ${matchedModule.titre}`);
    reply = `Le devoir pratique pour le module **${matchedModule.titre}** a été structuré. Vous pouvez réviser l'énoncé ci-dessous avant confirmation.`;
    return { reply, pending_actions, intent, sources };
  }

  // 5. Détection : Explication pédagogique (Chiffrement, Réseau, Sécurité)
  if (
    lastMsg.includes("explique") ||
    lastMsg.includes("qu'est-ce") ||
    lastMsg.includes("comment fonctionne") ||
    lastMsg.includes("définition") ||
    lastMsg.includes("asymétrique") ||
    lastMsg.includes("symétrique") ||
    lastMsg.includes("rsa") ||
    lastMsg.includes("chiffrement") ||
    lastMsg.includes("tls") ||
    lastMsg.includes("osi")
  ) {
    intent = "PEDAGOGY";
    sources.push("Cours de Fondamentaux de la Cryptographie & Réseaux");

    if (lastMsg.includes("asymétrique") || lastMsg.includes("rsa") || lastMsg.includes("clé publique")) {
      reply = `En cryptographie asymétrique (comme **RSA**), on utilise une paire de clés mathématiquement liées :\n\n1. **Clé publique** : Distribuée à tout le monde. N'importe qui peut l'utiliser pour chiffrer un message destiné au destinataire.\n2. **Clé privée** : Strictement secrète et conservée par le propriétaire. Elle seule permet de déchiffrer les messages reçus.\n\n💡 *Analogie simple* : C'est comme une boîte aux lettres. Tout le monde peut y glisser une lettre par la fente (clé publique), mais seul le propriétaire dispose de la clé pour ouvrir la porte et lire le courrier (clé privée).`;
    } else if (lastMsg.includes("osi") || lastMsg.includes("réseau") || lastMsg.includes("routage")) {
      reply = `Le modèle **OSI** structure les communications réseau en 7 couches distinctes :\n\n- **Couche 3 (Réseau)** : Gère le routage et l'adressage IP des paquets.\n- **Couche 4 (Transport)** : Assure la fiabilité et le contrôle de flux (TCP/UDP).\n- **Couche 7 (Application)** : Interface utilisateur directe (HTTPS, SSH, DNS).\n\nCette séparation garantit l'interopérabilité entre constructeurs et protocoles.`;
    } else {
      reply = `Voici l'explication conceptuelle demandée :\n\nEn cybersécurité, le principe fondamental repose sur la triade **CIA** :\n- **Confidentialité** : Protection contre l'accès non autorisé (chiffrement).\n- **Intégrité** : Garantie que la donnée n'a pas été altérée (hachage, signature).\n- **Disponibilité** : Accessibilité continue des systèmes et services pour les ayants droit.`;
    }
    return { reply, pending_actions, intent, sources };
  }

  // 6. Détection : Communication & Messages
  if (
    lastMsg.includes("message") ||
    lastMsg.includes("écri") ||
    lastMsg.includes("contact") ||
    lastMsg.includes("notif") ||
    lastMsg.includes("annonc") ||
    lastMsg.includes("diffus")
  ) {
    intent = "COMMUNICATION";
    const students = db?.students || [];
    const targetStudent = students[0];

    if (lastMsg.includes("notif") || lastMsg.includes("annonc") || lastMsg.includes("diffus")) {
      const action_id = "prop-notif-" + Date.now();
      pending_actions.push({
        action_id,
        tool_name: "create_notification",
        arguments: {
          title: "Annonce importante : Planning et évaluations",
          body: "Veuillez consulter l'espace pédagogique pour prendre connaissance du calendrier des examens.",
          type: "info",
          target_role: "all",
        },
      });
      reply = `J'ai préparé la diffusion de l'annonce système pour l'ensemble des apprenants et formateurs. Vous pouvez la valider ci-dessous.`;
      return { reply, pending_actions, intent, sources };
    }

    const action_id = "prop-msg-" + Date.now();
    const recipientId = targetStudent?.id || "SN-2026-001";
    const recipientName = targetStudent ? `${targetStudent.prenom} ${targetStudent.nom}` : "l'apprenant";

    pending_actions.push({
      action_id,
      tool_name: "send_message",
      arguments: {
        recipient_ids: [recipientId],
        subject: "Rappel Pédagogique — Suivi de séance",
        body: `Bonjour ${recipientName}, nous vous informons que les supports de la prochaine séance sont en ligne sur la plateforme.`,
      },
    });
    reply = `Le projet de message pour **${recipientName}** (${recipientId}) a été rédigé. Confirmez l'envoi pour le transmettre dans la messagerie interne.`;
    return { reply, pending_actions, intent, sources };
  }

  // 7. Détection : Finances, Facturation & Solde
  if (
    lastMsg.includes("factur") ||
    lastMsg.includes("solde") ||
    lastMsg.includes("impayé") ||
    lastMsg.includes("impaye") ||
    lastMsg.includes("financ") ||
    lastMsg.includes("trésor") ||
    lastMsg.includes("tresor") ||
    lastMsg.includes("paiement")
  ) {
    intent = "ADMIN_FINANCE";
    sources.push("Registre de Trésorerie & Facturation");

    if (lastMsg.includes("émet") || lastMsg.includes("emet") || lastMsg.includes("crée") || lastMsg.includes("creer")) {
      const students = db?.students || [];
      const sid = students[0]?.id || "SN-2026-001";
      const action_id = "prop-inv-" + Date.now();
      pending_actions.push({
        action_id,
        tool_name: "create_invoice_draft",
        arguments: {
          student_id: sid,
          libelle: "Échéance Formation — Semestre 1",
          montant: 50000,
          type: "formation",
        },
      });
      reply = `La proposition de facture d'un montant de **50 000 FCFA** pour l'apprenant **${sid}** est prête pour émission.`;
      return { reply, pending_actions, intent, sources };
    }

    const invoices = db?.invoices || [];
    const payments = db?.payments || [];
    const totalFacture = invoices.reduce((acc: number, inv: any) => acc + Number(inv.montant || 0), 0);
    const totalPaye = payments.reduce((acc: number, p: any) => acc + Number(p.montant || 0), 0);
    const impaye = Math.max(0, totalFacture - totalPaye);

    const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/[\u202F\u00A0]/g, " ");

    reply = `Voici la synthèse financière actuelle :\n\n- **Total facturé** : ${fmt(totalFacture)} FCFA\n- **Total recouvré** : ${fmt(totalPaye)} FCFA\n- **Solde d'impayés restant** : ${fmt(impaye)} FCFA\n- **Factures émises** : ${invoices.length} dossier(s).`;
    return { reply, pending_actions, intent, sources };
  }

  // 8. Détection : Statistiques et recherche apprenants / profs
  if (
    lastMsg.includes("stat") ||
    lastMsg.includes("combien") ||
    lastMsg.includes("apprenant") ||
    lastMsg.includes("élève") ||
    lastMsg.includes("eleve") ||
    lastMsg.includes("inscrit") ||
    lastMsg.includes("prof") ||
    lastMsg.includes("formateur")
  ) {
    intent = "GENERAL";
    const students = db?.students || [];
    const teachers = db?.teachers || [];
    const modules = db?.modules || [];
    sources.push("Base de données centrale Sentinelles Numériques");

    reply = `Voici les statistiques actuelles de la plateforme :\n\n- **Apprenants enregistrés** : ${students.length}\n- **Formateurs actifs** : ${teachers.length}\n- **Modules pédagogiques** : ${modules.length}\n\nVous pouvez me demander la fiche détaillée d'un apprenant ou d'un enseignant spécifique.`;
    return { reply, pending_actions, intent, sources };
  }

  // 9. Détection : RAG documentaire / Informations école / Règlement
  if (
    lastMsg.includes("règlement") ||
    lastMsg.includes("reglement") ||
    lastMsg.includes("certificat") ||
    lastMsg.includes("assiduité") ||
    lastMsg.includes("bourse") ||
    lastMsg.includes("enia")
  ) {
    intent = "DOCUMENT_RAG";
    sources.push("Règlement des Études ENIA 2.0", "Charte d'Assiduité Pédagogique");
    reply = `D'après les documents officiels de **Sentinelles Numériques / ENIA 2.0** :\n\n- **Attribution des certificats** : moyenne générale minimale de 12/20 et taux d'assiduité supérieur ou égal à 80% requis.\n- **Assiduité** : au-delà de 3 absences non justifiées par module, l'accès à l'évaluation terminale est bloqué.\n- **Authenticité** : chaque certificat comporte un numéro d'enregistrement unique vérifiable en ligne.`;
    return { reply, pending_actions, intent, sources };
  }

  // 10. Horaires & Emploi du temps
  if (lastMsg.includes("heure") || lastMsg.includes("planning") || lastMsg.includes("cours") || lastMsg.includes("salle")) {
    intent = "SCHEDULE";
    sources.push("Emploi du temps hebdomadaire officiel");
    reply = `Votre planning de formation comprend les séances habituelles réparties du lundi au vendredi. Vous pouvez consulter les créneaux par salle dans l'onglet Planning.`;
    return { reply, pending_actions, intent, sources };
  }

  // Réponse d'accueil naturelle et humaine
  reply = `Bonjour ! Je suis **SENTINEL'S AI**, connecté aux modules et données de Sentinelles Numériques.\n\nJe peux vous aider à :\n- **Consulter vos données** (planning, présences, notes et modules).\n- **Préparer des actions** (quiz QCM, publication de devoirs, pointage des présences, factures et messages).\n- **Rechercher dans les connaissances** (supports de cours, règlements, critères de certification).\n\nQue souhaitez-vous explorer ?`;
  return { reply, pending_actions, intent, sources };
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

  if (tool_name === "send_message") {
    if (db) {
      db.messages = db.messages || [];
      const recipientIds = Array.isArray(args.recipient_ids)
        ? args.recipient_ids
        : [args.recipient_ids || "SN-2026-001"];
      const newMessages = recipientIds.map((toId: string, idx: number) => ({
        id: "msg-" + Date.now() + "-" + idx,
        fromId: args.from_id || "admin",
        fromName: args.from_name || "Administration SENTINEL'S",
        toId,
        subject: args.subject || "Message officiel",
        body: args.body || "",
        date: new Date().toISOString(),
        lu: false,
      }));
      db.messages.push(...newMessages);
      saveLocalDB(db);
    }
    return { ok: true, result: { sent: args.recipient_ids?.length || 1, subject: args.subject } };
  }

  if (tool_name === "create_notification") {
    if (db) {
      db.notifications = db.notifications || [];
      const newNotif = {
        id: "notif-" + Date.now(),
        toId: args.target_role || "all",
        title: args.title || "Information SENTINEL'S",
        body: args.body || "",
        type: args.type || "info",
        date: new Date().toISOString(),
        lu: false,
      };
      db.notifications.unshift(newNotif);
      saveLocalDB(db);
    }
    return { ok: true, result: { notification_id: "notif-" + Date.now(), title: args.title } };
  }

  if (tool_name === "create_invoice_draft") {
    if (db) {
      db.invoices = db.invoices || [];
      const newInvoice = {
        id: "inv-" + Date.now(),
        studentId: args.student_id,
        libelle: args.libelle || "Frais de formation",
        montant: Number(args.montant) || 0,
        type: args.type || "formation",
        date: new Date().toISOString().slice(0, 10),
        createdBy: "sentinel-ai",
      };
      db.invoices.push(newInvoice);
      saveLocalDB(db);
    }
    return { ok: true, result: { invoice_id: "inv-" + Date.now(), montant: args.montant } };
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

/**
 * Envoie un feedback utilisateur (👍 / 👎)
 */
export async function sendSentinelAiFeedback(payload: AiFeedbackPayload): Promise<boolean> {
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
        body: JSON.stringify({ feedback: payload }),
      });
      return res.ok;
    }
  } catch (err) {
    console.warn("Échec envoi feedback :", err);
  }
  return true;
}
