import { createClient } from '@supabase/supabase-js';

const url = 'https://tvcuwhgqhrcvdgwlviju.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8';

const sb = createClient(url, anonKey);

async function seed() {
  console.log('Authenticating as superadmin...');
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: 'fredichfoundou09@gmail.com',
    password: 'Sentinelle066328874//'
  });
  if (authErr) {
    console.error('Auth error:', authErr.message);
    process.exit(1);
  }
  console.log('Authenticated successfully ✓');

  // 1. FORMATIONS
  const { data: formInfo } = await sb.from('formations').select('id').eq('code', 'informatique').single();
  const { data: formInd } = await sb.from('formations').select('id').eq('code', 'industriel').single();
  
  if (!formInfo || !formInd) {
    console.error('Formations missing!');
    process.exit(1);
  }

  // 2. MODULES INFO (7 modules exactly matching screenshot 4)
  const infoModulesList = [
    {
      numero: 1,
      titre: "Programmation & Développement Web",
      icon: "code",
      description: "Module « Programmation & Développement Web » : parcours pédagogique complet mêlant théorie et pratique, conçu pour rendre l'apprenant opérationnel.",
      duree: "2 à 3 semaines",
      supports: "Supports PDF, séances interactives et TP en laboratoire.",
      infos_supp: "Prérequis : Aucun. Évaluation : Contrôle continu et examen terminal.",
      chapters: [
        "Algorithmique et logique de programmation",
        "Programmation en C++",
        "Programmation en Python",
        "Développement Web avec HTML, CSS et JavaScript"
      ]
    },
    {
      numero: 2,
      titre: "Réseaux Informatiques",
      icon: "network",
      description: "Module « Réseaux Informatiques » : parcours pédagogique complet mêlant théorie et pratique, conçu pour rendre l'apprenant opérationnel.",
      duree: "2 à 3 semaines",
      supports: "Supports PDF, simulateur Cisco Packet Tracer.",
      infos_supp: "Prérequis : Aucun.",
      chapters: [
        "Bases des réseaux informatiques",
        "Modèles OSI et TCP/IP",
        "Notions de sécurité réseau",
        "Pratique sur simulateurs réseau"
      ]
    },
    {
      numero: 3,
      titre: "Systèmes d'Exploitation",
      icon: "server",
      description: "Module « Systèmes d'Exploitation » : parcours pédagogique complet mêlant théorie et pratique, conçu pour rendre l'apprenant opérationnel.",
      duree: "2 à 3 semaines",
      supports: "Machines virtuelles Linux et Windows Server.",
      infos_supp: "Prérequis : Notions en informatique.",
      chapters: [
        "Administration de Windows et Windows Server",
        "Administration de Linux et Linux Server"
      ]
    },
    {
      numero: 4,
      titre: "Hacking Éthique",
      icon: "terminal",
      description: "Module « Hacking Éthique » : parcours pédagogique complet mêlant théorie et pratique, conçu pour rendre l'apprenant opérationnel.",
      duree: "2 à 3 semaines",
      supports: "Laboratoire Kali Linux, scénarios d'audit et de tests d'intrusion.",
      infos_supp: "Prérequis : Réseaux & Systèmes.",
      chapters: [
        "Fondamentaux des tests d'intrusion",
        "Utilisation des principaux outils de sécurité",
        "Simulations d'attaques et analyses"
      ]
    },
    {
      numero: 5,
      titre: "Cybersécurité & Gestion des SI",
      icon: "shield",
      description: "Module « Cybersécurité & Gestion des SI » : parcours pédagogique complet mêlant théorie et pratique, conçu pour rendre l'apprenant opérationnel.",
      duree: "2 à 3 semaines",
      supports: "Guides méthodologiques ISO 27001 et cadres d'audit SI.",
      infos_supp: "Prérequis : Fondamentaux sécurité.",
      chapters: [
        "Bases de la cybersécurité",
        "Architecture des systèmes d'information",
        "Gestion des risques et audit de sécurité"
      ]
    },
    {
      numero: 6,
      titre: "Mathématiques pour Informatique",
      icon: "sigma",
      description: "Module « Mathématiques pour Informatique » : parcours pédagogique complet mêlant théorie et pratique, conçu pour rendre l'apprenant opérationnel.",
      duree: "2 à 3 semaines",
      supports: "Fiches de TD, exercices appliqués à l'algorithmique.",
      infos_supp: "Prérequis : Niveau Bac.",
      chapters: [
        "Théorie des ensembles",
        "Arithmétique et cryptographie",
        "Algèbre de Boole",
        "Fonctions et intégrales"
      ]
    },
    {
      numero: 7,
      titre: "Sécurité Informatique",
      icon: "lock",
      description: "Module « Sécurité Informatique » : parcours pédagogique complet mêlant théorie et pratique, conçu pour rendre l'apprenant opérationnel.",
      duree: "2 à 3 semaines",
      supports: "Supports de sensibilisation et bonnes pratiques de sécurité.",
      infos_supp: "Prérequis : Aucun.",
      chapters: [
        "Principes de la sécurité informatique",
        "Confidentialité, intégrité et disponibilité"
      ]
    }
  ];

  // 3. MODULES INDUSTRIELS (12 modules)
  const indModulesList = [
    { numero: 1, titre: "Mécanique I et II", icon: "cog", duree: "2 à 3 semaines", chapters: ["Cinématique • Statique • Dynamique", "Forces et moments • Travail et énergie"] },
    { numero: 2, titre: "Électricité I et II", icon: "zap", duree: "2 à 3 semaines", chapters: ["Tension et courant • Lois d'Ohm et de Kirchhoff", "Circuits CC/CA • Puissance électrique"] },
    { numero: 3, titre: "Électronique", icon: "cpu", duree: "2 à 3 semaines", chapters: ["Composants électroniques • Diodes • Transistors", "Amplificateurs • Circuits électroniques"] },
    { numero: 4, titre: "Électrotechnique", icon: "plug", duree: "2 à 3 semaines", chapters: ["Transformateurs • Moteurs électriques • Générateurs", "Distribution électrique • Protection"] },
    { numero: 5, titre: "Machines Électriques", icon: "factory", duree: "2 à 3 semaines", chapters: ["Types de machines • Fonctionnement • Commande", "Rendement • Maintenance"] },
    { numero: 6, titre: "Mécanique des vibrations", icon: "waves", duree: "2 à 3 semaines", chapters: ["Vibrations libres • Vibrations forcées", "Amortissement • Résonance"] },
    { numero: 7, titre: "Les schémas électriques", icon: "git", duree: "2 à 3 semaines", chapters: ["Lecture de schémas • Réalisation de schémas", "Normes et symboles • Applications pratiques"] },
    { numero: 8, titre: "Résistance des matériaux (RDM)", icon: "ruler", duree: "2 à 3 semaines", chapters: ["Contraintes • Déformations • Traction", "Compression • Flexion • Torsion"] },
    { numero: 9, titre: "Automatismes (Algèbre de Boole)", icon: "binary", duree: "2 à 3 semaines", chapters: ["Algèbre de Boole • Portes logiques", "Circuits combinatoires • Automates"] },
    { numero: 10, titre: "Électronique analogique", icon: "audio", duree: "2 à 3 semaines", chapters: ["Amplificateurs opérationnels • Filtres", "Régulateurs • Traitement des signaux"] },
    { numero: 11, titre: "Mathématiques industrielles", icon: "calc", duree: "2 à 3 semaines", chapters: ["Algèbre • Calcul différentiel • Calcul intégral", "Probabilités • Statistiques"] },
    { numero: 12, titre: "Gestion de la maintenance", icon: "wrench", duree: "2 à 3 semaines", chapters: ["Maintenance préventive • Maintenance corrective", "Maintenance améliorative • Fiabilité • Coûts"] }
  ];

  console.log('Upserting modules and chapters...');
  const mapMods = new Map();

  for (const m of infoModulesList) {
    const { data: existing } = await sb.from('modules').select('id').eq('formation_id', formInfo.id).eq('numero', m.numero).maybeSingle();
    let modId = existing?.id;
    if (!modId) {
      const { data: created, error } = await sb.from('modules').insert({
        formation_id: formInfo.id,
        numero: m.numero,
        titre: m.titre,
        icon: m.icon,
        description: m.description,
        duree: m.duree,
        supports: m.supports,
        infos_supp: m.infos_supp,
        active: true
      }).select('id').single();
      if (error) console.error('Error creating module:', error);
      modId = created?.id;
    } else {
      await sb.from('modules').update({
        titre: m.titre,
        icon: m.icon,
        description: m.description,
        duree: m.duree,
        supports: m.supports,
        infos_supp: m.infos_supp,
        active: true
      }).eq('id', modId);
    }
    if (modId) {
      mapMods.set(`info-${m.numero}`, modId);
      await sb.from('chapters').delete().eq('module_id', modId);
      await sb.from('chapters').insert(m.chapters.map((ch, idx) => ({
        module_id: modId,
        titre: `Chapitre ${idx + 1} — ${ch}`,
        contenu: `Contenu détaillé du programme pour : ${ch}.`,
        ordre: idx + 1
      })));
    }
  }

  for (const m of indModulesList) {
    const { data: existing } = await sb.from('modules').select('id').eq('formation_id', formInd.id).eq('numero', m.numero).maybeSingle();
    let modId = existing?.id;
    if (!modId) {
      const { data: created, error } = await sb.from('modules').insert({
        formation_id: formInd.id,
        numero: m.numero,
        titre: m.titre,
        icon: m.icon,
        description: `Module « ${m.titre} » : formation pratique et théorique en Génie Industriel.`,
        duree: m.duree,
        supports: "Fascicules techniques et schémas d'atelier.",
        active: true
      }).select('id').single();
      if (error) console.error('Error creating ind module:', error);
      modId = created?.id;
    }
    if (modId) {
      mapMods.set(`ind-${m.numero}`, modId);
      await sb.from('chapters').delete().eq('module_id', modId);
      await sb.from('chapters').insert(m.chapters.map((ch, idx) => ({
        module_id: modId,
        titre: `Chapitre ${idx + 1} — ${ch}`,
        contenu: `Contenu détaillé du programme pour : ${ch}.`,
        ordre: idx + 1
      })));
    }
  }
  console.log(`Modules seeded: ${mapMods.size} total ✓`);

  // 4. TEACHERS (Screenshot 5: Clarisse MABIALA & Ange LOUBAKI)
  console.log('Seeding teachers...');
  const teachers = [
    {
      id: "ENS-001",
      nom: "MABIALA",
      prenom: "Clarisse",
      specialite: "Réseaux & Cybersécurité",
      email: "clarisse.m@sentinelles.local",
      phone: "+242 06 123 45 67",
      type_contrat: "Prestation",
      tarif_horaire: 5000,
      heures_prevues: 30,
      actif: true,
      modules: [mapMods.get("info-2"), mapMods.get("info-4"), mapMods.get("info-5")].filter(Boolean)
    },
    {
      id: "ENS-002",
      nom: "LOUBAKI",
      prenom: "Ange",
      specialite: "Programmation & Web",
      email: "ange.l@sentinelles.local",
      phone: "+242 05 987 65 43",
      type_contrat: "Prestation",
      tarif_horaire: 5000,
      heures_prevues: 30,
      actif: true,
      modules: [mapMods.get("info-1"), mapMods.get("info-3")].filter(Boolean)
    }
  ];

  for (const t of teachers) {
    await sb.from('teachers').upsert({
      id: t.id,
      nom: t.nom,
      prenom: t.prenom,
      specialite: t.specialite,
      email: t.email,
      phone: t.phone,
      type_contrat: t.type_contrat,
      tarif_horaire: t.tarif_horaire,
      heures_prevues: t.heures_prevues,
      actif: t.actif
    });

    await sb.from('teacher_modules').delete().eq('teacher_id', t.id);
    for (const mId of t.modules) {
      await sb.from('teacher_modules').insert({ teacher_id: t.id, module_id: mId });
    }
  }
  console.log('Teachers seeded ✓');

  // 5. STUDENTS (Screenshot 1 & 2: Kevin MBOUNGOU, Grâce NZINGOU, Bryan OKEMBA)
  console.log('Seeding students...');
  const students = [
    {
      id: "SN-2026-00001",
      formation_id: formInfo.id,
      nom: "MBOUNGOU",
      prenom: "Kevin",
      niveau: "Baccalauréat C",
      sexe: "M",
      telephone: "06 111 22 33",
      whatsapp: "06 111 22 33",
      email: "kevin.m@gmail.com",
      adresse: "Brazzaville, Quartier Bacongo",
      statut: "actif",
      date_inscription: "2026-07-10",
      modules: [mapMods.get("info-1"), mapMods.get("info-2"), mapMods.get("info-4"), mapMods.get("info-5")].filter(Boolean)
    },
    {
      id: "SN-2026-00002",
      formation_id: formInd.id,
      nom: "NZINGOU",
      prenom: "Grâce",
      niveau: "Baccalauréat D",
      sexe: "F",
      telephone: "06 222 33 44",
      whatsapp: "06 222 33 44",
      email: "grace.n@gmail.com",
      adresse: "Brazzaville, Makélékélé",
      statut: "actif",
      date_inscription: "2026-07-11",
      modules: [mapMods.get("ind-1"), mapMods.get("ind-2"), mapMods.get("ind-3")].filter(Boolean)
    },
    {
      id: "SN-2026-00003",
      formation_id: formInd.id,
      nom: "OKEMBA",
      prenom: "Bryan",
      niveau: "BEP Électrotechnique",
      sexe: "M",
      telephone: "05 333 44 55",
      whatsapp: "05 333 44 55",
      email: "bryan.o@gmail.com",
      adresse: "Brazzaville, Moungali",
      statut: "actif",
      date_inscription: "2026-07-12",
      modules: [mapMods.get("ind-1"), mapMods.get("ind-2"), mapMods.get("ind-3"), mapMods.get("ind-4"), mapMods.get("ind-5"), mapMods.get("ind-6")].filter(Boolean)
    }
  ];

  for (const s of students) {
    await sb.from('students').upsert({
      id: s.id,
      formation_id: s.formation_id,
      nom: s.nom,
      prenom: s.prenom,
      niveau: s.niveau,
      sexe: s.sexe,
      telephone: s.telephone,
      whatsapp: s.whatsapp,
      email: s.email,
      adresse: s.adresse,
      statut: s.statut,
      date_inscription: s.date_inscription
    });

    await sb.from('student_modules').delete().eq('student_id', s.id);
    for (const mId of s.modules) {
      await sb.from('student_modules').insert({ student_id: s.id, module_id: mId });
    }
  }
  console.log('Students seeded ✓');

  // 6. PRÉ-INSCRIPTION EN ATTENTE (Screenshot 1: IBARA Prisca)
  console.log('Seeding pre-registration...');
  const { data: regExisting } = await sb.from('registrations').select('id').eq('telephone', '06 777 88 99').maybeSingle();
  let regId = regExisting?.id;
  if (!regId) {
    const { data: reg, error: regErr } = await sb.from('registrations').insert({
      formation_id: formInfo.id,
      nom: "IBARA",
      prenom: "Prisca",
      telephone: "06 777 88 99",
      whatsapp: "06 777 88 99",
      email: "prisca.i@gmail.com",
      niveau: "Baccalauréat A",
      date: "2026-08-10",
      statut: "en_attente"
    }).select('id').single();
    if (!regErr && reg) {
      regId = reg.id;
      await sb.from('registration_modules').insert([
        { registration_id: reg.id, module_id: mapMods.get("info-1") },
        { registration_id: reg.id, module_id: mapMods.get("info-2") }
      ]);
    }
  }
  console.log('Pre-registration seeded ✓');

  // 7. INVOICES & PAYMENTS (Screenshot 3: Kevin MBOUNGOU finances)
  console.log('Seeding finances...');
  await sb.from('payments').delete().eq('student_id', 'SN-2026-00001');
  await sb.from('invoices').delete().eq('student_id', 'SN-2026-00001');

  const { data: inv1 } = await sb.from('invoices').insert({
    student_id: 'SN-2026-00001',
    type: 'inscription',
    libelle: "Frais d'inscription",
    montant: 5000,
    date: '2026-07-10'
  }).select('id').single();

  const { data: inv2 } = await sb.from('invoices').insert({
    student_id: 'SN-2026-00001',
    type: 'formation',
    libelle: "Formation — 4 modules (Génie Informatique)",
    montant: 15000,
    date: '2026-07-12'
  }).select('id').single();

  await sb.from('payments').insert([
    {
      student_id: 'SN-2026-00001',
      invoice_id: inv1?.id || null,
      type: 'inscription',
      libelle: "Frais d'inscription",
      montant: 5000,
      date: '2026-07-10',
      heure: '10:15',
      mode: 'Espèces',
      reference: 'REC-0001',
      created_by_name: 'Super Admin'
    },
    {
      student_id: 'SN-2026-00001',
      invoice_id: inv2?.id || null,
      type: 'formation',
      libelle: "Formation — 4 modules (Génie Informatique)",
      montant: 10000,
      date: '2026-07-12',
      heure: '14:30',
      mode: 'Mobile Money',
      reference: 'REC-0002',
      created_by_name: 'Super Admin'
    }
  ]);

  // Finances pour Grâce (Payée)
  const { data: invGrace1 } = await sb.from('invoices').insert({
    student_id: 'SN-2026-00002',
    type: 'inscription',
    libelle: "Frais d'inscription",
    montant: 5000,
    date: '2026-07-11'
  }).select('id').single();
  const { data: invGrace2 } = await sb.from('invoices').insert({
    student_id: 'SN-2026-00002',
    type: 'formation',
    libelle: "Formation — 3 modules (Génie Industriel)",
    montant: 15000,
    date: '2026-07-11'
  }).select('id').single();
  await sb.from('payments').insert([
    {
      student_id: 'SN-2026-00002',
      invoice_id: invGrace1?.id,
      type: 'inscription',
      libelle: "Frais d'inscription",
      montant: 5000,
      date: '2026-07-11',
      heure: '11:00',
      mode: 'Airtel Money',
      reference: 'REC-0003'
    },
    {
      student_id: 'SN-2026-00002',
      invoice_id: invGrace2?.id,
      type: 'formation',
      libelle: "Formation — 3 modules (Génie Industriel)",
      montant: 15000,
      date: '2026-07-11',
      heure: '11:05',
      mode: 'Airtel Money',
      reference: 'REC-0004'
    }
  ]);

  // Finances pour Bryan (Impayé)
  await sb.from('invoices').insert([
    {
      student_id: 'SN-2026-00003',
      type: 'inscription',
      libelle: "Frais d'inscription",
      montant: 5000,
      date: '2026-07-12'
    },
    {
      student_id: 'SN-2026-00003',
      type: 'formation',
      libelle: "Formation — 6 modules (Génie Industriel)",
      montant: 25000,
      date: '2026-07-12'
    }
  ]);
  console.log('Finances seeded ✓');

  // 8. SCHEDULE (Screenshot 2 & 5: Emploi du temps Clarisse & Ange)
  console.log('Seeding schedule...');
  await sb.from('schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  await sb.from('schedule').insert([
    {
      jour: "Lundi",
      heure_debut: "08:00",
      heure_fin: "10:00",
      module_id: mapMods.get("info-1"),
      teacher_id: "ENS-002",
      salle: "Salle 02",
      formation_id: formInfo.id
    },
    {
      jour: "Mardi",
      heure_debut: "08:00",
      heure_fin: "10:00",
      module_id: mapMods.get("info-2"),
      teacher_id: "ENS-001",
      salle: "Salle 01",
      formation_id: formInfo.id
    },
    {
      jour: "Mercredi",
      heure_debut: "08:00",
      heure_fin: "10:00",
      module_id: mapMods.get("info-4"),
      teacher_id: "ENS-001",
      salle: "Salle 03",
      formation_id: formInfo.id
    },
    {
      jour: "Jeudi",
      heure_debut: "08:00",
      heure_fin: "10:00",
      module_id: mapMods.get("info-5"),
      teacher_id: "ENS-001",
      salle: "Salle 01",
      formation_id: formInfo.id
    }
  ]);
  console.log('Schedule seeded ✓');

  // 9. COURSES & SUPPORTS (Screenshot 2: Introduction à l'algorithmique, Les bases du réseau TCP/IP)
  console.log('Seeding courses...');
  await sb.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('courses').insert([
    {
      titre: "Introduction à l'algorithmique",
      description: "Concepts de base, variables, structures conditionnelles et boucles.",
      module_id: mapMods.get("info-1"),
      teacher_id: "ENS-002",
      type: "cours",
      content: "Bienvenue dans ce cours d'introduction. Nous allons aborder les algorithmes fondamentaux.",
      audience: "module",
      publie: true
    },
    {
      titre: "Les bases du réseau TCP/IP",
      description: "Étude détaillée du modèle TCP/IP, adressage IP, masques et routage.",
      module_id: mapMods.get("info-2"),
      teacher_id: "ENS-001",
      type: "cours",
      content: "Ce support présente les couches TCP/IP, les protocoles ARP, IP, TCP, UDP et DNS.",
      audience: "module",
      publie: true
    }
  ]);
  console.log('Courses seeded ✓');

  console.log('ALL EXAMPLE DATA SEEDED SUCCESSFULLY INTO SUPABASE! 🎉');
}

seed().catch(console.error);
