# Confidentialité

Niveaux :
- `public`
- `internal`
- `partner`
- `private`
- `restricted`

## Exemples
| Donnée | Niveau |
|---|---|
| Nom apprenant | partner |
| Téléphone | private |
| Adresse | private |
| Formation | partner |
| Présence | partner |
| Note | restricted |
| Paiement | restricted |
| Certificat | partner |
| Mot de passe | restricted |

Les vues `partner_*_view` exposent uniquement les colonnes autorisées.
