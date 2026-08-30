-- Mise à jour des paramètres du site public avec les informations officielles
UPDATE public.site_settings
SET data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(data, '{}'::jsonb),
          '{settings,hero}',
          '{
            "highlight": "RESPONSABLE DU CENTRE",
            "responsibleName": "Coach Fredich FOUNDOU",
            "responsibleTitle": "Étudiant-chercheur en Génie Informatique à ENIA 2.0",
            "responsibleImage": "https://tvcuwhgqhrcvdgwlviju.supabase.co/storage/v1/object/public/public-media/hero/responsable-1788000712264.jpeg"
          }'::jsonb
        ),
        '{settings,infos}',
        '{
          "debut": "10 août",
          "duree": "3 mois intensifs",
          "lieu": "Institut de Jeunes Sourds (ENIA 2.0), Brazzaville",
          "whatsapp": ["06 63 28 87 4", "06 53 67 40 3"],
          "inscription": "Ouverte — 5 000 FCFA"
        }'::jsonb
      ),
      '{settings,frais}',
      '{
        "inscription": 5000,
        "informatique": [
          { "id": "fr-inf-1", "label": "1 module", "modules": 1, "montant": 3500 },
          { "id": "fr-inf-2", "label": "Inscription + 1 module", "modules": 1, "montant": 8500 }
        ],
        "industriel": [
          { "id": "fr-ind-1", "label": "3 modules", "modules": 3, "montant": 5000 },
          { "id": "fr-ind-2", "label": "6 modules", "modules": 6, "montant": 10000 },
          { "id": "fr-ind-3", "label": "Programme complet (12 modules)", "modules": 12, "montant": 20000 }
        ]
      }'::jsonb
    ),
    '{settings,partenaires}',
    '["ENIA 2.0 — École du Numérique et de l’Intelligence Artificielle", "FSH Company"]'::jsonb
  ),
  '{partners}',
  '[
    { "id": "p-1", "nom": "ENIA 2.0 — École du Numérique et de l’Intelligence Artificielle", "actif": true },
    { "id": "p-2", "nom": "FSH Company", "actif": true }
  ]'::jsonb
),
updated_at = now()
WHERE id = 'default';
