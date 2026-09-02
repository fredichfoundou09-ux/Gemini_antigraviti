import { createClient } from '@supabase/supabase-js';

const url = 'https://tvcuwhgqhrcvdgwlviju.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8';

const sb = createClient(url, key);

async function run() {
  console.log('Connexion Superadmin...');
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: 'fredichfoundou09@gmail.com',
    password: 'Sentinelle066328874//'
  });
  if (authErr) {
    console.error('Erreur authentification:', authErr.message);
    process.exit(1);
  }
  console.log('Connecte avec succes');

  // 1. Suppression methodique des donnees de test
  console.log('Nettoyage des tables de test...');
  await sb.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('grades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('test_answers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('test_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('tests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('payment_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('student_modules').delete().neq('student_id', 'none');
  await sb.from('students').delete().neq('id', 'none');
  await sb.from('teacher_modules').delete().neq('teacher_id', 'none');
  await sb.from('teachers').delete().neq('id', 'none');
  await sb.from('schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('registration_modules').delete().neq('registration_id', '00000000-0000-0000-0000-000000000000');
  await sb.from('registrations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('archived_registrations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Tables de test videes avec succes');

  // 2. Restauration de site_settings officiel
  console.log('Restauration des parametres officiels du centre et des partenaires...');
  const officialSettings = {
    settings: {
      branding: {
        name: "SENTINELLES NUMERIQUES",
        subtitle: "Centre de Formation en Genie Informatique et Genie Industriel",
        tagline: "Formons aujourd'hui les talents numeriques et industriels qui construiront l'avenir.",
        badge: "SENTINELLES * ACADEMY"
      },
      hero: {
        highlight: "RESPONSABLE DU CENTRE",
        responsibleName: "Coach Fredich FOUNDOU",
        responsibleTitle: "Etudiant-chercheur en Genie Informatique a ENIA 2.0",
        responsibleImage: "https://tvcuwhgqhrcvdgwlviju.supabase.co/storage/v1/object/public/public-media/hero/responsable-1788000712264.jpeg"
      },
      infos: {
        debut: "10 aout",
        duree: "3 mois intensifs",
        lieu: "Institut de Jeunes Sourds (ENIA 2.0), Brazzaville",
        whatsapp: ["06 63 28 87 4", "06 53 67 40 3"],
        inscription: "Ouverte - 5 000 FCFA"
      },
      frais: {
        inscription: 5000,
        informatique: [
          { id: "fr-inf-1", label: "1 module", modules: 1, montant: 3500 },
          { id: "fr-inf-2", label: "Inscription + 1 module", modules: 1, montant: 8500 }
        ],
        industriel: [
          { id: "fr-ind-1", label: "3 modules", modules: 3, montant: 5000 },
          { id: "fr-ind-2", label: "6 modules", modules: 6, montant: 10000 },
          { id: "fr-ind-3", label: "Programme complet (12 modules)", modules: 12, montant: 20000 }
        ]
      },
      formations: {
        informatique: { titre: "GENIE INFORMATIQUE", description: "Formation intensive et pratique en developpement web, cybersecurite et reseaux." },
        industriel: { titre: "GENIE INDUSTRIEL", description: "Formation pratique en electrotechnique, automatismes, electronique et maintenance." }
      },
      avantages: [
        "Formation 100% pratique avec ateliers et laboratoires technologiques dedies",
        "Accompagnement et mentorat personnalise vers l'emploi et l'entrepreneuriat",
        "Preparation aux certifications internationales et reseau d'entreprises partenaires",
        "Possibilite d'acces direct a la Bourse d'excellence ENIA 2.0 (100% financee pendant 3 ans)"
      ],
      bourse: { title: "3 ANS D'ETUDES", subtitle: "100% GRATUITES A ENIA 2.0.", button: "BOURSE MON AVENIR" },
      partenaires: [
        "ENIA 2.0 - Ecole du Numerique et de l'Intelligence Artificielle",
        "FSH Company"
      ],
      preInscription: {
        enabled: true,
        title: "Pre-inscription en ligne",
        description: "Reservez votre place des maintenant."
      },
      contact: { email: "contact@sentinelles-numeriques.cg", adresse: "Institut de Jeunes Sourds (ENIA 2.0), Brazzaville" }
    },
    partners: [
      { id: "p-1", nom: "ENIA 2.0 - Ecole du Numerique et de l'Intelligence Artificielle", actif: true },
      { id: "p-2", nom: "FSH Company", actif: true }
    ],
    advantages: [
      { id: "adv-1", titre: "Formation 100% Pratique", description: "Ateliers et laboratoires technologiques dedies", icone: "code" },
      { id: "adv-2", titre: "Mentorat Personnalise", description: "Accompagnement vers l'emploi et l'entrepreneuriat", icone: "users" },
      { id: "adv-3", titre: "Certifications Internationales", description: "Validation officielle des competences", icone: "award" },
      { id: "adv-4", titre: "Bourse d'Excellence ENIA 2.0", description: "3 ans d'etudes 100% financees", icone: "graduation-cap" }
    ],
    announcements: [],
    enia: {
      visible: true,
      titre: "ENIA 2.0",
      sousTitre: "Ecole du Numerique et de l'Intelligence Artificielle",
      presentation: "ENIA 2.0 est une ecole superieure specialisee en numerique et intelligence artificielle, qui forme les etudiants a travers une approche pratique orientee vers l'emploi, l'innovation et la creation d'entreprises.",
      bourseTitre: "Bourse ENIA 2.0",
      bourseIntro: "Programme lance en 2024 permettant aux etudiants de se former dans un cadre complet, structure et entierement pris en charge.",
      bourseConcretement: "Le programme ne concerne pas uniquement les cours : il vise a integrer l'etudiant dans un environnement complet favorisant l'apprentissage, la creation et la reussite professionnelle.",
      bourseAvantages: [
        { id: "ea-1", titre: "Formation 100 % financee pendant 3 ans", description: "Prise en charge globale permettant de se concentrer sur les etudes.", ordre: 1 },
        { id: "ea-2", titre: "Restauration entierement prise en charge", description: "Repas couverts pendant la duree de la formation.", ordre: 2 },
        { id: "ea-3", titre: "Transport assure via des bus scolaires", description: "Acces facilite au campus par abonnement bus scolaire.", ordre: 3 },
        { id: "ea-4", titre: "Kits scolaires offerts", description: "Materiel pedagogique fourni a l'inscription.", ordre: 4 },
        { id: "ea-5", titre: "Assurance et services de sante inclus", description: "Couverture sante et services associes.", ordre: 5 },
        { id: "ea-6", titre: "Encadrement, stages et suivi professionnel", description: "Accompagnement jusqu'a l'insertion professionnelle.", ordre: 6 },
        { id: "ea-7", titre: "Visites en entreprise", description: "Immersion concrete dans le monde professionnel.", ordre: 7 }
      ],
      bourseHighlights: ["Formation pratique", "Insertion professionnelle", "Acces facilite aux stages"],
      fraisScolaires: [],
      pieces: [],
      noteInscription: "Les frais d'inscription ne sont pas remboursables.",
      affiche: "",
      allowDownloadAffiche: true,
      lien: { nom: "Site officiel ENIA 2.0", url: "https://enia.cg", description: "Visitez le site officiel d'ENIA 2.0 pour plus d'informations.", actif: true },
      partenaires: [
        { id: "enia-p-1", nom: "ENIA 2.0", description: "Partenaire academique principal", actif: true, ordre: 1 },
        { id: "enia-p-2", nom: "FSH Company", description: "Partenaire industriel et technologique", actif: true, ordre: 2 }
      ]
    }
  };

  const { error: upErr } = await sb.from('site_settings').upsert({
    id: 'default',
    data: officialSettings,
    updated_at: new Date().toISOString()
  });

  if (upErr) {
    console.error('Erreur restauration site_settings:', upErr.message);
  } else {
    console.log('Configuration officielle du centre et partenaires restaures avec succes');
  }

  // 3. Verification des modules conserves
  const { data: mods, error: modErr } = await sb.from('modules').select('id, titre, numero');
  console.log(`Modules conserves en base : ${mods?.length || 0} modules.`);
}

run();
