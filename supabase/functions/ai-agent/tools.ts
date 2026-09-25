import { UserContext } from "./auth.ts";
import { searchKnowledgeBase } from "./rag.ts";

export const WRITE_TOOLS = new Set([
  "valider_presence",
  "publier_devoir",
  "publier_evaluation",
  "send_message",
  "create_notification",
  "create_invoice_draft",
]);

// Définitions des outils au format standard OpenAI / NVIDIA NIM
export const TOOLS = [
  // --- NIVEAU 1 : LECTURE ---
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Retourne les statistiques synthétiques adaptées au rôle de l'utilisateur (étudiants, formateurs, cours, assiduité).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_student",
      description: "Recherche un ou plusieurs apprenants par nom, prénom ou identifiant.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Terme de recherche (nom ou identifiant)" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_student",
      description: "Récupère les informations complètes d'un apprenant (profil, formation, solde).",
      parameters: {
        type: "object",
        properties: { student_id: { type: "string", description: "Identifiant étudiant (ex: SN-2026-0001)" } },
        required: ["student_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_teacher",
      description: "Recherche des formateurs et affiche leurs spécialités et modules enseignés.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nom ou spécialité du formateur" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_schedule",
      description: "Récupère l'emploi du temps pour une date ou une semaine donnée.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date cible AAAA-MM-JJ (par défaut aujourd'hui)" },
          module_id: { type: "string", description: "Identifiant optionnel d'un module" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_attendance",
      description: "Consulte le registre des présences et absences pour une date ou un module.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string", description: "Identifiant du module" },
          date: { type: "string", description: "Date au format AAAA-MM-JJ" },
          student_id: { type: "string", description: "Identifiant de l'apprenant" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_finance_summary",
      description: "Affiche le récapitulatif financier global (recettes, impayés, factures) — réservé à l'administration.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_student_balance",
      description: "Consulte le solde et l'historique des règlements d'un apprenant.",
      parameters: {
        type: "object",
        properties: { student_id: { type: "string", description: "Identifiant de l'apprenant" } },
        required: ["student_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_certificates",
      description: "Liste les certificats émis ou obtenus avec leurs numéros de vérification.",
      parameters: {
        type: "object",
        properties: { student_id: { type: "string", description: "Optionnel : filtrer par apprenant" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_courses",
      description: "Recherche parmi les cours, chapitres et devoirs publiés.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Titre ou mot-clé de recherche" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_documents",
      description: "Recherche documentaire (RAG) dans les guides, règlements, FAQ et manuels de l'école.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Question ou mot-clé pour le RAG" },
          category: { type: "string", enum: ["general", "rules", "faq", "course", "system"], description: "Catégorie documentaire" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detecter_anomalies",
      description: "Détecte les apprenants inactifs ou non pointés depuis plus d'un certain nombre de jours.",
      parameters: {
        type: "object",
        properties: { jours: { type: "number", description: "Nombre de jours d'inactivité (défaut 14)" } },
        required: [],
      },
    },
  },

  // --- NIVEAU 2 : PRÉPARATION / BROUILLONS ---
  {
    type: "function",
    function: {
      name: "prepare_message",
      description: "Prépare un projet de message pour un ou plusieurs utilisateurs cibles (ne l'envoie pas immédiatement).",
      parameters: {
        type: "object",
        properties: {
          recipient_ids: { type: "array", items: { type: "string" }, description: "Liste des UUIDs ou identifiants destinataires" },
          subject: { type: "string", description: "Objet du message" },
          body: { type: "string", description: "Contenu complet du message" },
        },
        required: ["recipient_ids", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_notification",
      description: "Prépare une annonce ou notification système sans la diffuser immédiatement.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre de la notification" },
          body: { type: "string", description: "Corps du texte" },
          target_role: { type: "string", enum: ["all", "teacher", "student", "partner"], description: "Public cible" },
        },
        required: ["title", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "Génère un rapport de synthèse (présences, académique ou financier) prêt à être consulté.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["presences", "pedagogique", "financier", "global"], description: "Type de rapport" },
          periode: { type: "string", description: "Période couverte (ex: mois en cours, trimestre)" },
        },
        required: ["type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_learning_exercise",
      description: "Génère un exercice pratique, quiz ou étude de cas pédagogique adapté au module et au niveau.",
      parameters: {
        type: "object",
        properties: {
          sujet: { type: "string", description: "Thématique ciblée (ex: cryptographie symétrique, routage OSPF)" },
          niveau: { type: "string", enum: ["debutant", "intermediaire", "avance"], description: "Niveau de difficulté" },
          nombre_questions: { type: "number", description: "Nombre de questions souhaité" },
        },
        required: ["sujet"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_schedule_draft",
      description: "Prépare une proposition de séance de cours dans l'emploi du temps.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          teacher_id: { type: "string" },
          date: { type: "string", description: "Date AAAA-MM-JJ" },
          heure_debut: { type: "string", description: "HH:MM" },
          heure_fin: { type: "string", description: "HH:MM" },
          salle: { type: "string" },
        },
        required: ["module_id", "date", "heure_debut", "heure_fin"],
      },
    },
  },

  // --- NIVEAU 3 : ACTIONS SENSIBLES (CONFIRMATION REQUISE) ---
  {
    type: "function",
    function: {
      name: "valider_presence",
      description: "Enregistre formellement les présences ou retards en base de données. NÉCESSITE UNE CONFIRMATION EXPLICITE.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          student_ids: { type: "array", items: { type: "string" }, description: "Identifiants des étudiants pointés" },
          statut: { type: "string", enum: ["present", "absent", "retard"] },
          date: { type: "string", description: "Date AAAA-MM-JJ" },
          salle: { type: "string" },
        },
        required: ["module_id", "student_ids", "statut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publier_devoir",
      description: "Publie un devoir ou document de cours officiel. NÉCESSITE UNE CONFIRMATION EXPLICITE.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          titre: { type: "string" },
          description: { type: "string" },
          contenu: { type: "string" },
          type: { type: "string", enum: ["cours", "document", "devoir"] },
        },
        required: ["module_id", "titre", "contenu"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publier_evaluation",
      description: "Crée et publie une évaluation complète avec questions QCM/VF/courtes. NÉCESSITE UNE CONFIRMATION EXPLICITE.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          titre: { type: "string" },
          duree: { type: "number", description: "Durée en minutes" },
          bareme: { type: "number", description: "Total barème (ex: 20)" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["qcm", "vf", "courte"] },
                enonce: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                bonne_reponse: { type: "string" },
                points: { type: "number" },
              },
              required: ["type", "enonce", "bonne_reponse", "points"],
            },
          },
        },
        required: ["module_id", "titre", "questions", "duree", "bareme"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Envoie un message formel dans la messagerie interne. NÉCESSITE UNE CONFIRMATION EXPLICITE.",
      parameters: {
        type: "object",
        properties: {
          recipient_ids: { type: "array", items: { type: "string" } },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["recipient_ids", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_notification",
      description: "Diffuse une notification aux utilisateurs cibles. NÉCESSITE UNE CONFIRMATION EXPLICITE.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          type: { type: "string", enum: ["info", "alerte", "rappel"] },
        },
        required: ["title", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_invoice_draft",
      description: "Émet un appel de paiement / facture pour un apprenant. NÉCESSITE UNE CONFIRMATION EXPLICITE.",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string" },
          libelle: { type: "string" },
          montant: { type: "number" },
          type: { type: "string", enum: ["inscription", "formation"] },
        },
        required: ["student_id", "libelle", "montant", "type"],
      },
    },
  },
];

/** Exécution concrète d'un outil avec les droits RLS du client connecté */
export async function executeTool(user: UserContext, name: string, args: Record<string, any>): Promise<any> {
  const sb = user.sbUser;

  switch (name) {
    // --- LECTURE ---
    case "get_dashboard_stats": {
      const stats: Record<string, any> = { role: user.role };
      if (user.role === "superadmin" || user.role === "admin") {
        const [stRes, tcRes, mdRes] = await Promise.all([
          sb.from("students").select("id", { count: "exact", head: true }),
          sb.from("teachers").select("id", { count: "exact", head: true }),
          sb.from("modules").select("id", { count: "exact", head: true }),
        ]);
        stats.total_apprenants = stRes.count ?? 0;
        stats.total_enseignants = tcRes.count ?? 0;
        stats.total_modules = mdRes.count ?? 0;
      } else if (user.role === "teacher" && user.teacherId) {
        const { data: mods } = await sb.from("teacher_modules").select("module_id").eq("teacher_id", user.teacherId);
        stats.mes_modules_count = mods?.length ?? 0;
      } else if (user.role === "student" && user.studentId) {
        const { data: sm } = await sb.from("student_modules").select("module_id").eq("student_id", user.studentId);
        stats.mes_modules_inscrits = sm?.length ?? 0;
      }
      return stats;
    }

    case "search_student": {
      const q = args.query || "";
      const { data, error } = await sb
        .from("students")
        .select("id, nom, prenom, formation_id, date_inscription, statut")
        .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,id.ilike.%${q}%`)
        .limit(10);
      if (error) throw error;
      return { count: data?.length ?? 0, students: data };
    }

    case "get_student": {
      const sid = args.student_id;
      const { data: st, error } = await sb
        .from("students")
        .select("id, nom, prenom, email, telephone, statut, formation_id, date_inscription")
        .eq("id", sid)
        .maybeSingle();
      if (error) throw error;
      if (!st) return { error: `Apprenant introuvable avec l'identifiant ${sid}` };
      return { student: st };
    }

    case "search_teacher": {
      const q = args.query || "";
      const { data, error } = await sb
        .from("teachers")
        .select("id, nom, prenom, specialite, email, phone, actif")
        .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,specialite.ilike.%${q}%`)
        .limit(10);
      if (error) throw error;
      return { count: data?.length ?? 0, teachers: data };
    }

    case "get_schedule": {
      const today = args.date || new Date().toISOString().slice(0, 10);
      let query = sb
        .from("schedule")
        .select("id, date, jour, heure_debut, heure_fin, salle, module_id, modules(titre)")
        .limit(15);
      if (args.date) {
        query = query.eq("date", args.date);
      }
      const { data, error } = await query;
      if (error) throw error;
      return { date_cible: today, seances: data };
    }

    case "get_attendance": {
      let query = sb.from("attendance").select("id, student_id, date, heure, statut, module_id").limit(20);
      if (args.module_id) query = query.eq("module_id", args.module_id);
      if (args.date) query = query.eq("date", args.date);
      if (args.student_id) query = query.eq("student_id", args.student_id);
      const { data, error } = await query;
      if (error) throw error;
      return { presences: data, count: data?.length ?? 0 };
    }

    case "get_finance_summary": {
      const [invRes, payRes] = await Promise.all([
        sb.from("invoices").select("montant"),
        sb.from("payments").select("montant"),
      ]);
      const totalFacture = (invRes.data || []).reduce((acc: number, curr: any) => acc + Number(curr.montant || 0), 0);
      const totalPaye = (payRes.data || []).reduce((acc: number, curr: any) => acc + Number(curr.montant || 0), 0);
      return {
        total_facture: totalFacture,
        total_recouvre: totalPaye,
        solde_restant_du: Math.max(0, totalFacture - totalPaye),
      };
    }

    case "get_student_balance": {
      const sid = args.student_id;
      const [invRes, payRes] = await Promise.all([
        sb.from("invoices").select("montant").eq("student_id", sid),
        sb.from("payments").select("montant").eq("student_id", sid),
      ]);
      const factures = (invRes.data || []).reduce((acc: number, c: any) => acc + Number(c.montant || 0), 0);
      const paiements = (payRes.data || []).reduce((acc: number, c: any) => acc + Number(c.montant || 0), 0);
      return {
        student_id: sid,
        total_facture: factures,
        total_paye: paiements,
        reste_a_payer: Math.max(0, factures - paiements),
      };
    }

    case "get_certificates": {
      let query = sb.from("certificates").select("id, student_id, numero, periode, resultat, note, date").limit(10);
      if (args.student_id) query = query.eq("student_id", args.student_id);
      const { data, error } = await query;
      if (error) throw error;
      return { certificats: data };
    }

    case "search_courses": {
      const q = args.query || "";
      const { data, error } = await sb
        .from("courses")
        .select("id, titre, description, type, date_publication, modules(titre)")
        .ilike("titre", `%${q}%`)
        .limit(8);
      if (error) throw error;
      return { courses: data };
    }

    case "search_documents": {
      const docs = await searchKnowledgeBase(user, args.query, args.category);
      return { query: args.query, results: docs };
    }

    case "detecter_anomalies": {
      const jours = args.jours ?? 14;
      const seuil = new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);
      const { data: inscrits } = await sb.from("students").select("id, nom, prenom, statut").eq("statut", "actif").limit(50);
      const { data: pointes } = await sb.from("attendance").select("student_id").gte("date", seuil);
      const pointesIds = new Set((pointes || []).map((p: any) => p.student_id));
      const anomalies = (inscrits || [])
        .filter((s: any) => !pointesIds.has(s.id))
        .map((s: any) => ({ ...s, anomalie: `Aucune présence enregistrée depuis plus de ${jours} jours` }));
      return { anomalies, total: anomalies.length, seuil_jours: jours };
    }

    // --- PRÉPARATION (NIVEAU 2) ---
    case "prepare_message": {
      return {
        brouillon: {
          destinataires: args.recipient_ids,
          objet: args.subject,
          contenu: args.body,
          statut: "pret_pour_envoi",
        },
      };
    }

    case "prepare_notification": {
      return {
        notification_prete: {
          titre: args.title,
          message: args.body,
          cible: args.target_role || "all",
          date_preparation: new Date().toISOString(),
        },
      };
    }

    case "generate_report": {
      return {
        rapport_synthese: {
          type: args.type,
          periode: args.periode || "Actuelle",
          date_generation: new Date().toISOString(),
          statut: "généré",
        },
      };
    }

    case "create_learning_exercise": {
      return {
        exercice: {
          sujet: args.sujet,
          difficulte: args.niveau || "intermediaire",
          questions_proposees: [
            {
              type: "qcm",
              enonce: `Question de synthèse sur : ${args.sujet}`,
              options: ["Option A - Définition de base", "Option B - Approche recommandée", "Option C - Vulnérabilité", "Option D - Hors sujet"],
              bonne_reponse: "Option B - Approche recommandée",
              explication: "Cette réponse reflète la bonne pratique standard en ingénierie de sécurité.",
            },
          ],
        },
      };
    }

    case "create_schedule_draft": {
      return {
        creneau_brouillon: {
          module_id: args.module_id,
          date: args.date,
          heure_debut: args.heure_debut,
          heure_fin: args.heure_fin,
          salle: args.salle || "Salle Virtuelle",
          statut: "brouillon_a_valider",
        },
      };
    }

    // --- ACTIONS D'ÉCRITURE SENSIBLES (NIVEAU 3) : EXÉCUTÉES APRÈS CONFIRMATION ---
    case "valider_presence": {
      const date = args.date || new Date().toISOString().slice(0, 10);
      let teacherId = user.teacherId;
      if (!teacherId) {
        const { data: tm } = await sb.from("teacher_modules").select("teacher_id").eq("module_id", args.module_id).limit(1);
        if (tm && tm.length > 0) {
          teacherId = tm[0].teacher_id;
        } else {
          const { data: t } = await sb.from("teachers").select("id").limit(1);
          teacherId = t?.[0]?.id || "ENS-001";
        }
      }

      const rows = (args.student_ids as string[]).map((sid) => ({
        student_id: sid,
        module_id: args.module_id,
        teacher_id: teacherId,
        date,
        heure: new Date().toTimeString().slice(0, 5),
        salle: args.salle || "",
        statut: args.statut,
        schedule_id: args.schedule_id || null,
      }));
      const { data, error } = await sb.from("attendance").upsert(rows, { onConflict: "student_id,schedule_id,date" }).select();
      if (error) throw error;
      return { presences_enregistrees: data?.length ?? 0 };
    }

    case "publier_devoir": {
      let teacherId = user.teacherId;
      if (!teacherId) {
        const { data: tm } = await sb.from("teacher_modules").select("teacher_id").eq("module_id", args.module_id).limit(1);
        teacherId = tm?.[0]?.teacher_id || "ENS-001";
      }

      const { data, error } = await sb
        .from("courses")
        .insert({
          titre: args.titre,
          description: args.description || "",
          module_id: args.module_id,
          teacher_id: teacherId,
          type: args.type || "devoir",
          content: args.contenu,
          publie: true,
        })
        .select()
        .single();
      if (error) throw error;
      return { id: data.id, titre: data.titre, statut: "publie" };
    }

    case "publier_evaluation": {
      const duree = Number(args.duree) || 45;
      const bareme = Number(args.bareme) || 20;

      let teacherId = user.teacherId;
      if (!teacherId) {
        const { data: tm } = await sb.from("teacher_modules").select("teacher_id").eq("module_id", args.module_id).limit(1);
        teacherId = tm?.[0]?.teacher_id || "ENS-001";
      }

      const { data: test, error: tErr } = await sb
        .from("tests")
        .insert({
          titre: args.titre,
          module_id: args.module_id,
          teacher_id: teacherId,
          duree,
          bareme,
          statut: "publie",
          date: new Date().toISOString(),
          date_publication: new Date().toISOString(),
        })
        .select()
        .single();
      if (tErr) throw tErr;

      const questionsToInsert = (args.questions || []).map((q: any, idx: number) => ({
        test_id: test.id,
        question: q.enonce || q.question || `Question ${idx + 1}`,
        type: q.type || "qcm",
        bonne_reponse: String(q.bonne_reponse ?? ""),
        points: Number(q.points) || 1,
        ordre: idx + 1,
        explication: q.explication || null,
        options_json: Array.isArray(q.options) ? q.options : [],
      }));

      const { data: insertedQuestions, error: qErr } = await sb
        .from("questions")
        .insert(questionsToInsert)
        .select();
      if (qErr) throw qErr;

      // Insertion dans question_options pour compatibilité relationnelle
      if (insertedQuestions && insertedQuestions.length > 0) {
        const optionsToInsert: any[] = [];
        insertedQuestions.forEach((iq: any, idx: number) => {
          const original = args.questions?.[idx];
          if (original && Array.isArray(original.options)) {
            original.options.forEach((optText: string, oIdx: number) => {
              optionsToInsert.push({
                question_id: iq.id,
                option_text: optText,
                ordre: oIdx + 1,
              });
            });
          }
        });
        if (optionsToInsert.length > 0) {
          await sb.from("question_options").insert(optionsToInsert);
        }
      }

      return { test_id: test.id, titre: test.titre, total_questions: questionsToInsert.length };
    }

    case "send_message": {
      const { data: conv, error: cErr } = await sb
        .from("conversations")
        .insert({ subject: args.subject })
        .select()
        .single();
      if (cErr) throw cErr;

      // Inscription des membres
      const members = [user.userId, ...(args.recipient_ids || [])].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
      }));
      await sb.from("conversation_members").insert(members);

      // Insertion du message
      const { data: msg, error: mErr } = await sb
        .from("messages")
        .insert({
          conversation_id: conv.id,
          sender_id: user.userId,
          body: args.body,
        })
        .select()
        .single();
      if (mErr) throw mErr;

      return { conversation_id: conv.id, message_id: msg.id, statut: "envoye" };
    }

    case "create_notification": {
      const { data, error } = await sb
        .from("notifications")
        .insert({
          title: args.title,
          body: args.body,
          type: args.type || "info",
        })
        .select();
      if (error) throw error;
      return { statut: "diffuse", count: data?.length ?? 1 };
    }

    case "create_invoice_draft": {
      const { data, error } = await sb
        .from("invoices")
        .insert({
          student_id: args.student_id,
          libelle: args.libelle,
          montant: args.montant,
          type: args.type,
          created_by: user.userId,
        })
        .select()
        .single();
      if (error) throw error;
      return { facture_id: data.id, montant: data.montant, statut: "creee" };
    }

    default:
      throw new Error(`Outil non reconnu : ${name}`);
  }
}
