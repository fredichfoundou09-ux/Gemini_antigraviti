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
if (Get-Command "npx" -ErrorAction SilentlyContinue) {
    npx supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migrations appliquées avec succès." -ForegroundColor Green
    } else {
        Write-Host "⚠️ Erreur lors du db push. Assurez-vous d'être connecté." -ForegroundColor Red
    }

    # 3. Déploiement de la fonction Edge create-user
    Write-Host "`n3. Déploiement de la fonction Edge 'create-user'..." -ForegroundColor Yellow
    npx supabase functions deploy create-user
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Fonction Edge 'create-user' déployée." -ForegroundColor Green
    }
} else {
    Write-Host "ℹ️ Supabase CLI n'est pas installé localement." -ForegroundColor Cyan
}

# 4. Instructions Vercel
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host "📋 Variables d'environnement à configurer sur Vercel :" -ForegroundColor Yellow
Write-Host "  - VITE_SUPABASE_URL            = https://tvcuwhgqhrcvdgwlviju.supabase.co" -ForegroundColor White
Write-Host "  - VITE_SUPABASE_PUBLISHABLE_KEY= eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8" -ForegroundColor White
Write-Host "  - VITE_USE_SUPABASE            = true" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan
