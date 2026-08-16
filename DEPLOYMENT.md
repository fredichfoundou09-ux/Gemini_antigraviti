# Déploiement

## Vercel (frontend)
1. Importer le repo GitHub
2. Framework preset: Vite
3. Build: `npm run build`
4. Output: `dist`
5. Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_USE_SUPABASE=true`

## Supabase
1. Créer projet
2. `supabase link`
3. `supabase db push`
4. Déployer Edge Function `create-user`
5. Configurer Auth URL:
   - Site URL production
   - Redirect URLs (local + preview + prod)

## SPA
`vercel.json` réécrit toutes les routes vers `index.html`.
