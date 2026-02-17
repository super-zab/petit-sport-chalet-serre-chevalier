# Script de test pour l'envoi d'email
Write-Host "Test d'envoi d'email Gmail..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/test-email" -Method POST -ContentType "application/json" -UseBasicParsing
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "✅ Email envoyé avec succès !" -ForegroundColor Green
        Write-Host "Envoyé à: $($result.sentTo)" -ForegroundColor Yellow
        Write-Host "Message: $($result.message)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Vérifiez votre boîte de réception (et le dossier spam) !" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Erreur: $($result.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de l'envoi:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
