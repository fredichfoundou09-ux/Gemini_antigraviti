import { UserContext } from "./auth.ts";
import { searchKnowledgeBase } from "./rag.ts";
import { WikipediaProvider, DocumentationProvider, AggregateWebSearchProvider } from "./webSearch.ts";

export const WRITE_TOOLS = new Set([
  "valider_presence",
  "publier_devoir",
  "publier_evaluation",
  "send_message",
  "create_notification",
  "manage_notifications",
  "create_invoice_draft",
]);

// Registre standard OpenAI / NVIDIA NIM
export const TOOLS = [
  // =========================================================================
  // 1. WEB SEARCH, WIKIPEDIA & SOURCES EXTERNES
  // =========================================================================
  {
    type: "function",
    function: {
      name: "search_wikipedia",
      description: "Recherche encyclopédique sur Wikipédia en français (personnages historiques, concepts scientifiques, définitions, histoire).",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Terme ou sujet à rechercher sur Wikipédia" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Recherche sur le Web et dans la documentation technique officielle (RFC IETF, OWASP, NIST, MDN).",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Mots-clés de recherche technique ou web" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_web_page",
      description: "Récupère le contenu détaillé d'un article Wikipédia ou d'une documentation technique.",
      parameters: {
        type: "object",
        properties: { title_or_url: { type: "string", description: "Titre de l'article ou URL cible" } },
        required: ["title_or_url"],
      },
    },
  },

  // =========================================================================
  // 2. OUTILS APPRENANT (ESPACE ÉTUDIANT SCOPÉ)
  // =========================================================================
  {
    type: "function",
    function: {
      name: "get_my_next_course",
      description: "Récupère le prochain cours prévu dans l'emploi du temps de l'apprenant (heure, salle, module, enseignant).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_schedule",
      description: "Consulte l'emploi du temps complet de l'apprenant pour la journée ou la semaine.",
      parameters: {
        type: "object",
        properties: { date: { type: "string", description: "Date cible AAAA-MM-JJ" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_profile",
      description: "Récupère le profil complet de l'apprenant connecté (coordonnées, formation, statut de scolarité, solde).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_courses",
      description: "Liste les cours, chapitres et devoirs disponibles pour les modules de l'apprenant.",
      parameters: {
        type: "object",
        properties: { module_id: { type: "string", description: "Optionnel : filtrer par module" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_attendance",
      description: "Consulte le bilan d'assiduité personnel de l'apprenant (présences, retards, absences).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_grades",
      description: "Récupère le relevé des notes et évaluations passées par l'apprenant.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_course",
      description: "Explique un concept complexe d'un cours avec clarté pédagogique, métaphores et exemples progressifs.",
      parameters: {
        type: "object",
        properties: {
          concept: { type: "string", description: "Notion à expliquer (ex: chiffrement RSA, routage BGP, handshake TLS)" },
          niveau: { type: "string", enum: ["debutant", "intermediaire", "avance"], description: "Niveau d'explication" },
        },
        required: ["concept"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_practice_exercise",
      description: "Génère un exercice d'entraînement interactif adapté au niveau de l'apprenant pour réviser un cours.",
      parameters: {
        type: "object",
        properties: {
          sujet: { type: "string", description: "Matière ou concept ciblé" },
          type: { type: "string", enum: ["qcm", "cas_pratique", "questions_courtes"] },
        },
        required: ["sujet"],
      },
    },
  },

  // =========================================================================
  // 3. OUTILS FORMATEUR & INGÉNIERIE PÉDAGOGIQUE
  // =========================================================================
  {
    type: "function",
    function: {
      name: "get_assigned_students",
      description: "Liste les apprenants inscrits aux modules attribués à l'enseignant.",
      parameters: {
        type: "object",
        properties: { module_id: { type: "string", description: "Identifiant du module" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_quiz",
      description: "Conçoit un quiz d'évaluation équilibré (QCM, Vrai/Faux, courtes) basé sur les cours du module.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          sujet: { type: "string" },
          nombre_questions: { type: "number" },
        },
        required: ["sujet"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_lesson_plan",
      description: "Construit un déroulé pédagogique et plan de cours détaillé pour une séance de formation.",
      parameters: {
        type: "object",
        properties: {
          titre_seance: { type: "string" },
          duree_heures: { type: "number" },
          objectifs: { type: "string" },
        },
        required: ["titre_seance"],
      },
    },
  },

  // =========================================================================
  // 4. OUTILS D'ADMINISTRATION & DE PILOTAGE
  // =========================================================================
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Retourne les statistiques synthétiques globales adaptées au rôle (élèves, enseignants, modules).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_student",
      description: "Recherche un ou plusieurs apprenants par nom, prénom ou matricule.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nom ou identifiant" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_students",
      description: "Alias pluriel pour search_student.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_student",
      description: "Affiche le dossier complet d'un apprenant (profil, formation, coordonnées, solde).",
      parameters: {
        type: "object",
        properties: { student_id: { type: "string" } },
        required: ["student_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_teacher",
      description: "Recherche des enseignants par nom ou spécialité technique.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_teachers",
      description: "Alias pluriel pour search_teacher.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_schedule",
      description: "Consulte l'emploi du temps officiel par date, module ou enseignant.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string" },
          module_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_attendance",
      description: "Consulte le registre des présences et absences par date ou module.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          date: { type: "string" },
          student_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_finance_summary",
      description: "Synthèse de trésorerie (recettes globales, total facturé, solde impayés).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_student_balance",
      description: "Consulte le solde et les règlements d'un apprenant.",
      parameters: {
        type: "object",
        properties: { student_id: { type: "string" } },
        required: ["student_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_certificates",
      description: "Consulte les attestations officielles émises ou vérifie un matricule.",
      parameters: {
        type: "object",
        properties: { student_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_courses",
      description: "Recherche dans les cours et supports publiés.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_documents",
      description: "Recherche documentaire (RAG) dans les guides, règlements et manuels de l'école.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string", enum: ["general", "rules", "faq", "course", "system"] },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detecter_anomalies",
      description: "Détecte les apprenants inactifs ou en situation d'absentéisme récurrent.",
      parameters: {
        type: "object",
        properties: { jours: { type: "number" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "Génère un rapport synthétique (présences, académique ou financier).",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["presences", "pedagogique", "financier", "global"] },
          periode: { type: "string" },
        },
        required: ["type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_information",
      description: "Enregistre une information contextuelle (préférence d'apprentissage, consigne récurrente, fait).",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Information exacte à mémoriser" },
          type: { type: "string", enum: ["fact", "preference", "learning_context"] },
        },
        required: ["content"],
      },
    },
  },

  // =========================================================================
  // 5. ACTIONS SENSIBLES DE NIVEAU 3 (CONFIRMATION REQUISE)
  // =========================================================================
  {
    type: "function",
    function: {
      name: "valider_presence",
      description: "Enregistre les présences de séance en base de données. NÉCESSITE CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          student_ids: { type: "array", items: { type: "string" } },
          statut: { type: "string", enum: ["present", "absent", "retard"] },
          date: { type: "string" },
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
      description: "Publie un devoir officiel pour un module. NÉCESSITE CONFIRMATION.",
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
      description: "Crée et publie une évaluation complète avec questions QCM/VF/courtes. NÉCESSITE CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          titre: { type: "string" },
          duree: { type: "number" },
          bareme: { type: "number" },
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
      description: "Envoie un message formel dans la messagerie interne. NÉCESSITE CONFIRMATION.",
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
      description: "Diffuse une notification système aux utilisateurs. NÉCESSITE CONFIRMATION.",
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
      description: "Émet un appel de paiement / facture pour un apprenant. NÉCESSITE CONFIRMATION.",
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

/**
 * Exécute un outil autorisé de manière sécurisée sous le contexte d'accès de l'utilisateur
 */
export async function executeTool(user: UserContext, name: string, args: Record<string, any>): Promise<any> {
  const sb = user.sbUser;

  switch (name) {
    // =========================================================================
    // RECHERCHE WEB & WIKIPÉDIA
    // =========================================================================
    case "search_wikipedia": {
      const provider = new WikipediaProvider("fr");
      const results = await provider.search(args.query || "");
      return { query: args.query, results, provider: "Wikipédia" };
    }

    case "search_web": {
      const provider = new AggregateWebSearchProvider();
      const results = await provider.search(args.query || "");
      return { query: args.query, results, provider: "Recherche Web / Documentation" };
    }

    case "fetch_web_page": {
      const provider = new WikipediaProvider("fr");
      const summary = await provider.getSummary(args.title_or_url || "");
      return { title: args.title_or_url, extract: summary || "Contenu non trouvé ou indisponible." };
    }

    // =========================================================================
    // OUTILS APPRENANT SCOPÉS
    // =========================================================================
    case "get_my_next_course": {
      const today = new Date().toISOString().slice(0, 10);
      const nowTime = new Date().toTimeString().slice(0, 5);

      let query = sb
        .from("schedule")
        .select("id, date, jour, heure_debut, heure_fin, salle, module_id, modules(titre, code)")
        .gte("date", today)
        .order("date", { ascending: true })
        .order("heure_debut", { ascending: true })
        .limit(1);

      const { data, error } = await query;
      if (error) throw error;
      const nextCourse = data?.[0] || null;

      if (!nextCourse) {
        return { message: "Aucun prochain cours prévu dans votre planning immédiat." };
      }

      return {
        prochain_cours: {
          module: nextCourse.modules?.titre || "Module",
          date: nextCourse.date,
          horaire: `${nextCourse.heure_debut} - ${nextCourse.heure_fin}`,
          salle: nextCourse.salle || "Salle Virtuelle",
        },
      };
    }

    case "get_my_schedule": {
      const date = args.date || new Date().toISOString().slice(0, 10);
      const { data, error } = await sb
        .from("schedule")
        .select("id, date, jour, heure_debut, heure_fin, salle, module_id, modules(titre)")
        .gte("date", date)
        .limit(10);
      if (error) throw error;
      return { emploi_du_temps: data };
    }

    case "get_my_profile": {
      if (!user.studentId) {
        return { user_id: user.userId, nom: user.name, role: user.role };
      }
      const { data, error } = await sb
        .from("students")
        .select("id, nom, prenom, email, telephone, statut, formation_id, date_inscription")
        .eq("id", user.studentId)
        .maybeSingle();
      if (error) throw error;
      return { profil: data };
    }

    case "get_my_courses": {
      const { data, error } = await sb
        .from("courses")
        .select("id, titre, description, type, content, date_publication, modules(titre)")
        .eq("publie", true)
        .limit(10);
      if (error) throw error;
      return { cours_disponibles: data };
    }

    case "get_my_attendance": {
      if (!user.studentId) return { presences: [] };
      const { data, error } = await sb
        .from("attendance")
        .select("id, date, heure, statut, salle, module_id")
        .eq("student_id", user.studentId)
        .order("date", { ascending: false })
        .limit(20);
      if (error) throw error;

      const presents = (data || []).filter((p: any) => p.statut === "present").length;
      const retards = (data || []).filter((p: any) => p.statut === "retard").length;
      const absents = (data || []).filter((p: any) => p.statut === "absent").length;

      return {
        presences_detail: data,
        synthese: { presents, retards, absents, total: data?.length || 0 },
      };
    }

    case "get_my_grades": {
      if (!user.studentId) return { notes: [] };
      const { data, error } = await sb
        .from("test_results")
        .select("id, note, pourcentage, date, statut, tests(titre, bareme)")
        .eq("student_id", user.studentId)
        .order("date", { ascending: false })
        .limit(15);
      if (error) throw error;
      return { notes_obtenues: data };
    }

    case "explain_course": {
      return {
        concept: args.concept,
        niveau: args.niveau || "debutant",
        explication_pedagogique: `D'après les référentiels de cours, voici l'explication progressive sur ${args.concept}.`,
      };
    }

    case "create_practice_exercise": {
      return {
        exercice_entrainement: {
          sujet: args.sujet,
          type: args.type || "qcm",
          enonce: `Exercice d'application préparé pour vous sur : ${args.sujet}`,
          questions: [
            {
              type: "qcm",
              enonce: `Quelle est la propriété essentielle de ${args.sujet} ?`,
              options: ["Authenticité", "Intégrité", "Confidentialité", "Disponibilité"],
              bonne_reponse: "Confidentialité",
              explication: "Notion centrale vue en séance de formation.",
            },
          ],
        },
      };
    }

    // =========================================================================
    // OUTILS ENSEIGNANT
    // =========================================================================
    case "get_assigned_students": {
      const { data: students, error } = await sb
        .from("students")
        .select("id, nom, prenom, statut, formation_id")
        .limit(30);
      if (error) throw error;
      return { apprenants_assignes: students, total: students?.length ?? 0 };
    }

    case "create_quiz": {
      return {
        quiz_propose: {
          module_id: args.module_id || "general",
          sujet: args.sujet,
          questions: [
            {
              type: "qcm",
              enonce: `Question de synthèse sur ${args.sujet}`,
              options: ["Option 1", "Option 2", "Option 3", "Option 4"],
              bonne_reponse: "Option 2",
              points: 5,
            },
          ],
        },
      };
    }

    case "generate_lesson_plan": {
      return {
        plan_de_cours: {
          titre: args.titre_seance,
          duree: `${args.duree_heures || 2} heures`,
          objectifs: args.objectifs || "Acquisition des compétences pratiques et théoriques",
          parties: [
            "1. Introduction & Rappel des prérequis (15 min)",
            "2. Notions théoriques fondamentales & Démonstration (45 min)",
            "3. Travaux pratiques guidés (45 min)",
            "4. Synthèse, QCM de contrôle & Clôture (15 min)",
          ],
        },
      };
    }

    // =========================================================================
    // OUTILS LECTURE ADMIN & GÉNÉRAL
    // =========================================================================
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

    case "search_student":
    case "search_students": {
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

    case "search_teacher":
    case "search_teachers": {
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

    case "generate_report": {
      return {
        rapport_synthese: {
          type: args.type || "global",
          periode: args.periode || "Mois en cours",
          statut: "genere",
          date_generation: new Date().toISOString(),
        },
      };
    }

    case "remember_information": {
      try {
        await sb.from("ai_memories").insert({
          user_id: user.userId,
          scope: "user",
          type: args.type || "fact",
          content: args.content,
          source: "user_explicit",
          confidence: 0.95,
        });
        return { ok: true, message: "Information mémorisée avec succès." };
      } catch (err: any) {
        return { ok: false, error: String(err.message || err) };
      }
    }

    // =========================================================================
    // ACTIONS D'ÉCRITURE SENSIBLES DE NIVEAU 3
    // =========================================================================
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

      // Insertion dans question_options pour compatibilité
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

      const members = [user.userId, ...(args.recipient_ids || [])].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
      }));
      await sb.from("conversation_members").insert(members);

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

    case "create_notification":
    case "manage_notifications": {
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
