import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const infoModules = [
  { titre: "Programmation & Développement Web", icon: "code", notions: ["Algorithmique et logique de programmation", "Programmation en C++", "Programmation en Python", "Développement Web avec HTML, CSS et JavaScript"] },
  { titre: "Réseaux Informatiques", icon: "network", notions: ["Bases des réseaux informatiques", "Modèles OSI et TCP/IP", "Notions de sécurité réseau", "Pratique sur simulateurs réseau"] },
  { titre: "Systèmes d'Exploitation", icon: "server", notions: ["Administration de Windows et Windows Server", "Administration de Linux et Linux Server"] },
  { titre: "Hacking Éthique", icon: "terminal", notions: ["Fondamentaux des tests d'intrusion", "Utilisation des principaux outils de sécurité", "Simulations d'attaques et analyses"] },
  { titre: "Cybersécurité & Gestion des SI", icon: "shield", notions: ["Bases de la cybersécurité", "Architecture des systèmes d'information", "Gestion des risques et audit de sécurité"] },
  { titre: "Mathématiques pour Informatique", icon: "sigma", notions: ["Théorie des ensembles", "Arithmétique et cryptographie", "Algèbre de Boole", "Fonctions et intégrales"] },
  { titre: "Sécurité Informatique", icon: "lock", notions: ["Principes de la sécurité informatique", "Confidentialité, intégrité et disponibilité"] },
];

const industrielModules = [
  { titre: "Mécanique I et II", icon: "cog", notions: ["Cinématique • Statique • Dynamique", "Forces et moments • Travail et énergie"] },
  { titre: "Électricité I et II", icon: "zap", notions: ["Tension et courant • Lois d'Ohm et de Kirchhoff", "Circuits CC/CA • Puissance électrique", "Mesures électriques"] },
  { titre: "Électronique", icon: "cpu", notions: ["Composants électroniques • Diodes • Transistors", "Amplificateurs • Circuits électroniques"] },
  { titre: "Électrotechnique", icon: "plug", notions: ["Transformateurs • Moteurs électriques • Générateurs", "Distribution électrique • Protection électrique"] },
  { titre: "Machines Électriques", icon: "factory", notions: ["Types de machines • Fonctionnement • Commande", "Rendement • Maintenance"] },
  { titre: "Mécanique des vibrations", icon: "waves", notions: ["Vibrations libres • Vibrations forcées • Fréquence", "Amortissement • Résonance"] },
  { titre: "Les schémas électriques", icon: "git", notions: ["Lecture de schémas • Réalisation de schémas", "Normes et symboles • Applications pratiques"] },
  { titre: "Résistance des matériaux (RDM)", icon: "ruler", notions: ["Contraintes • Déformations • Traction", "Compression • Flexion • Torsion"] },
  { titre: "Automatismes (Algèbre de Boole)", icon: "binary", notions: ["Algèbre de Boole • Portes logiques", "Circuits combinatoires • Circuits séquentiels • Automates"] },
  { titre: "Électronique analogique", icon: "audio", notions: ["Amplificateurs opérationnels • Filtres • Oscillateurs", "Régulateurs • Traitement des signaux"] },
  { titre: "Mathématiques industrielles", icon: "calc", notions: ["Algèbre • Calcul différentiel • Calcul intégral", "Probabilités • Statistiques • Équations différentielles"] },
  { titre: "Gestion de la maintenance", icon: "wrench", notions: ["Maintenance préventive • Maintenance corrective", "Maintenance améliorative • Fiabilité • Disponibilité", "Coûts de maintenance"] },
];

async function main() {
  console.log("Seeding Database...");

  // 1. FORMATIONS
  const infoFormation = await prisma.formation.upsert({
    where: { code: "informatique" },
    update: {},
    create: {
      code: "informatique",
      name: "Génie Informatique",
      description: "Filière spécialisée en programmation, réseaux, hacking éthique et cybersécurité.",
    },
  });

  const indFormation = await prisma.formation.upsert({
    where: { code: "industriel" },
    update: {},
    create: {
      code: "industriel",
      name: "Génie Industriel",
      description: "Filière spécialisée en mécanique, électricité, électronique, automatique et maintenance.",
    },
  });

  // 2. MODULES & CHAPITRES
  const createdInfoModules = [];
  for (let i = 0; i < infoModules.length; i++) {
    const m = infoModules[i];
    const mod = await prisma.module.create({
      data: {
        formationId: infoFormation.id,
        numero: i + 1,
        titre: m.titre,
        icon: m.icon,
        description: `Programme d'études complet sur le module ${m.titre}.`,
        duree: "2 à 3 semaines",
        supports: "Supports PDF, séances interactives et TP en laboratoire.",
        infosSupp: "Prérequis : Aucun. Évaluation : Contrôle continu et examen terminal.",
        chapters: {
          create: m.notions.map((n, idx) => ({
            titre: `Chapitre ${idx + 1} — ${n}`,
            contenu: `Contenu détaillé des notions théoriques et exercices pour : ${n}.`,
            ordre: idx + 1,
          })),
        },
      },
    });
    createdInfoModules.push(mod);
  }

  const createdIndModules = [];
  for (let i = 0; i < industrielModules.length; i++) {
    const m = industrielModules[i];
    const mod = await prisma.module.create({
      data: {
        formationId: indFormation.id,
        numero: i + 1,
        titre: m.titre,
        icon: m.icon,
        description: `Programme d'études complet sur le module ${m.titre}.`,
        duree: "1 à 2 semaines",
        supports: "Fascicules, schémas électriques officiels et travaux pratiques.",
        infosSupp: "Évaluation : Exercices pratiques et contrôle théorique.",
        chapters: {
          create: m.notions.map((n, idx) => ({
            titre: `Chapitre ${idx + 1} — ${n}`,
            contenu: `Notions théoriques et fiches de travaux d'ateliers pour : ${n}.`,
            ordre: idx + 1,
          })),
        },
      },
    });
    createdIndModules.push(mod);
  }

  // 3. ENIA CONTENT SINGLETON
  await prisma.eniaContent.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      visible: true,
      titre: "ENIA 2.0",
      sousTitre: "École du Numérique et de l'Intelligence Artificielle",
      presentation: "ENIA 2.0 est une école supérieure spécialisée en numérique et intelligence artificielle, qui forme les étudiants à travers une approche pratique orientée vers l'emploi, l'innovation et la création d'entreprises.",
      bourseTitre: "Bourse ENIA 2.0",
      bourseIntro: "Programme lancé en 2024 permettant aux étudiants de se former dans un cadre complet, structuré et entièrement pris en charge.",
      bourseConcretement: "Le programme ne concerne pas uniquement les cours : il vise à intégrer l'étudiant dans un environnement complet favorisant l'apprentissage, la création et la réussite professionnelle.",
      noteInscription: "Les frais d'inscription ne sont pas remboursables.",
      allowDownloadAffiche: true,
      lienNom: "Site officiel ENIA 2.0",
      lienUrl: "https://enia.cg",
      lienDescription: "Visitez le site officiel d'ENIA 2.0 pour plus d'informations.",
      lienActif: true,
    },
  });

  // 4. ENIA ADVANTAGES
  const advantages = [
    { titre: "Formation 100 % financée pendant 3 ans", description: "Prise en charge globale permettant de se concentrer sur les études.", ordre: 1 },
    { titre: "Restauration entièrement prise en charge", description: "Repas couverts pendant la durée de la formation.", ordre: 2 },
    { titre: "Transport assuré via des bus scolaires", description: "Accès facilité au campus par abonnement bus scolaire.", ordre: 3 },
    { titre: "Kits scolaires offerts", description: "Matériel pédagogique fourni à l'inscription.", ordre: 4 },
    { titre: "Assurance et services de santé inclus", description: "Couverture santé et services associés.", ordre: 5 },
    { titre: "Encadrement, stages et suivi professionnel", description: "Accompagnement jusqu'à l'insertion professionnelle.", ordre: 6 },
    { titre: "Visites en entreprise", description: "Immersion concrète dans le monde professionnel.", ordre: 7 },
  ];
  for (const a of advantages) {
    await prisma.eniaAdvantage.create({ data: a });
  }

  // 5. ENIA FEES
  const fees = [
    { label: "Inscription annuelle", value: "119 000 FCFA", ordre: 1 },
    { label: "Première année", value: "0 FCFA / mois", ordre: 2 },
    { label: "Deuxième année", value: "0 FCFA / mois", ordre: 3 },
    { label: "Troisième année", value: "0 FCFA / mois", ordre: 4 },
    { label: "Logement", value: "Prise en charge à 50 %", ordre: 5 },
    { label: "Restauration", value: "100 % prise en charge", ordre: 6 },
    { label: "Kits scolaires", value: "Offerts", ordre: 7 },
    { label: "Assurance et services de santé", value: "Inclus", ordre: 8 },
    { label: "Accompagnement / stages", value: "100 % pris en charge", ordre: 9 },
    { label: "Formation de 3 ans", value: "100 % financée", ordre: 10 },
    { label: "Bus scolaire", value: "Par abonnement", ordre: 11 },
  ];
  for (const f of fees) {
    await prisma.eniaFeeItem.create({ data: f });
  }

  // 6. ENIA PIECES
  const pieces = [
    {
      titre: "Documents communs (tous les candidats)",
      pieces: "2 photos d'identité\n1 demande manuscrite adressée au CRO/CHI-TECH\n1 chemise cartonnée et une enveloppe kaki\n2 paquets de rames et 2 boîtes d'encre à l'inscription",
      ordre: 1,
    },
    {
      titre: "Niveau L1 — Avec Bac",
      pieces: "Copie de l'attestation du Bac\nCopie du relevé de notes du Bac",
      fraisDepot: "10 000 FCFA",
      ordre: 2,
    },
    {
      titre: "Candidats sans Bac",
      pieces: "Copie du relevé de notes de la classe de terminale",
      fraisDepot: "15 000 FCFA",
      ordre: 3,
    },
    {
      titre: "Niveau L2 / L3",
      pieces: "Copie des relevés de notes ou attestation justifiant le niveau précédent",
      fraisDepot: "12 500 FCFA pour L2 · 17 500 FCFA pour L3",
      ordre: 4,
    },
  ];
  for (const p of pieces) {
    await prisma.eniaPieceGroup.create({ data: p });
  }

  // 7. ENIA PARTNERS
  const partners = [
    { nom: "ENIA 2.0", description: "École nationale d'intelligence artificielle — partenaire académique principal.", url: "https://enia.cg", actif: true, ordre: 1 },
    { nom: "Université Marien Ngouabi", description: "Partenaire universitaire de référence au Congo.", actif: true, ordre: 2 },
    { nom: "Institut de Jeunes Sourds", description: "Lieu d'accueil de la formation (Chi-Tech).", actif: true, ordre: 3 },
    { nom: "Chi-Tech", description: "Partenaire technologique.", actif: true, ordre: 4 },
  ];
  for (const p of partners) {
    await prisma.eniaPartner.create({ data: p });
  }

  console.log("Database seeded successfully ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
