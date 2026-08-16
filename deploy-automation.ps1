# Script d'automatisation de déploiement — Sentinelles Numériques

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🚀 Déploiement de Sentinelles Numériques (Supabase & Vercel)" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Vérification Build Frontend
Write-Host "`n1. Vérification de la compilation du Frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur de build. Annulation du déploiement." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build du frontend réussi." -ForegroundColor Green

# 2. Push des Migrations Supabase
Write-Host "`n2. Déploiement des migrations vers Supabase..." -ForegroundColor Yellow
if (Get-Command "supabase" -ErrorAction SilentlyContinue) {
    supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migrations appliquées avec succès." -ForegroundColor Green
    } else {
        Write-Host "⚠️ Erreur lors du db push. Assurez-vous d'être connecté (supabase login / supabase link)." -ForegroundColor Red
    }

    # 3. Déploiement de la fonction Edge create-user
    Write-Host "`n3. Déploiement de la fonction Edge 'create-user'..." -ForegroundColor Yellow
    supabase functions deploy create-user
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Fonction Edge 'create-user' déployée." -ForegroundColor Green
    }
} else {
    Write-Host "ℹ️ Supabase CLI n'est pas installé localement. Installez-le avec 'npm i -g supabase' pour automatiser le push DB." -ForegroundColor Cyan
}

# 4. Instructions Vercel
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host "📋 Variables d'environnement à configurer sur Vercel :" -ForegroundColor Yellow
Write-Host "  - VITE_SUPABASE_URL            = https://<votre-project-id>.supabase.co" -ForegroundColor White
Write-Host "  - VITE_SUPABASE_PUBLISHABLE_KEY = <votre-cle-anon-ou-publishable>" -ForegroundColor White
Write-Host "  - VITE_USE_SUPABASE            = true" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan
