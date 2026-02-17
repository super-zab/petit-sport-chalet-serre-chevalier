# Configuration Complète

## 📋 Variables d'Environnement Requises

Ajoutez ces variables dans votre fichier `.env.local` :

```env
# Google Calendar API - Service Account
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Calendar IDs - Un pour chaque appartement
GOOGLE_CALENDAR_ID_PS1=your-calendar-id-ps1@group.calendar.google.com
GOOGLE_CALENDAR_ID_PS2=your-calendar-id-ps2@group.calendar.google.com
GOOGLE_CALENDAR_ID_T3=your-calendar-id-t3@group.calendar.google.com

# Google Sheets ID pour le pricing dynamique
# Obtenez l'ID depuis l'URL : https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
GOOGLE_SHEET_ID=your-google-sheet-id

# Resend Email
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=your-email@example.com

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 📊 Configuration Google Sheets pour le Pricing

### Structure du Sheet

Créez un Google Sheet avec les colonnes suivantes :

| Appartement | DateDebut | DateFin | Prix |
|------------|-----------|---------|------|
| petit-sport-chalet-1 | 2026-02-15 | 2026-02-22 | 200 |
| petit-sport-chalet-2 | 2026-02-15 | 2026-02-22 | 200 |
| t3-capture-insecte | 2026-02-15 | 2026-02-22 | 150 |

### Instructions

1. **Créer le Sheet** :
   - Créez un nouveau Google Sheet
   - Nommez la première feuille (ou utilisez la feuille par défaut)
   - Ajoutez les en-têtes : `Appartement`, `DateDebut`, `DateFin`, `Prix`

2. **Partager avec le Service Account** :
   - Cliquez sur "Partager" dans le Sheet
   - Ajoutez l'email de votre Service Account (le même que `GOOGLE_CLIENT_EMAIL`)
   - Donnez-lui les droits "Éditeur" ou "Lecteur"

3. **Obtenir l'ID du Sheet** :
   - L'ID se trouve dans l'URL : `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
   - Copiez cet ID dans `GOOGLE_SHEET_ID`

4. **Format des dates** :
   - Utilisez le format `YYYY-MM-DD` (ex: `2026-02-15`)
   - Les dates sont inclusives (du DateDebut au DateFin inclus)

5. **Format des slugs** :
   - Utilisez exactement : `petit-sport-chalet-1`, `petit-sport-chalet-2`, `t3-capture-insecte`

### Logique de Pricing

- Si une période correspond à une règle dans le Sheet, le prix du Sheet est utilisé
- Sinon, le prix par défaut de l'appartement est utilisé
- Le prix est calculé nuit par nuit (chaque nuit peut avoir un prix différent)

## ✅ Vérification de la Configuration

### Tester Google Calendar

1. Vérifiez que chaque calendrier est bien partagé avec le Service Account
2. Testez une réservation depuis le site
3. Vérifiez que l'événement apparaît dans le bon calendrier

### Tester Google Sheets

1. Visitez `http://localhost:3000/api/pricing` (GET) pour voir les règles chargées
2. Testez le calcul de prix en sélectionnant des dates sur une page d'appartement
3. Vérifiez que le prix s'affiche correctement

### Tester les Photos

1. Placez vos photos dans `public/images/PS1/`, `PS2/`, `T3/`
2. Visitez une page d'appartement
3. Vérifiez que les images s'affichent dans la galerie

## 🔧 Dépannage

### "Calendar ID is missing"
→ Vérifiez que les variables `GOOGLE_CALENDAR_ID_PS1`, `PS2`, `T3` sont bien définies

### "GOOGLE_SHEET_ID is not configured"
→ Ajoutez l'ID du Sheet dans `.env.local`

### Les prix ne se calculent pas
→ Vérifiez que le Sheet est partagé avec le Service Account et que les colonnes sont correctes

### Les images ne s'affichent pas
→ Vérifiez que les photos sont dans `public/images/[folder]/` et que les noms de fichiers sont corrects
