# Guide de Configuration Rapide

Ce guide vous accompagne étape par étape pour configurer votre site de réservation.

## 📦 Étape 1 : Installation

```bash
npm install
```

## 🔐 Étape 2 : Configuration Google Calendar

### A. Créer un Service Account

1. Allez sur https://console.cloud.google.com/
2. Créez un projet (ou sélectionnez-en un)
3. Activez **Google Calendar API** dans "APIs & Services" > "Library"
4. Créez un **Service Account** :
   - APIs & Services > Credentials > Create Credentials > Service Account
   - Nommez-le (ex: "booking-service")
   - Créez une clé JSON (Keys > Add Key > Create new key > JSON)
   - **Téléchargez le fichier JSON** (gardez-le secret !)



### C. Extraire les Variables

Du fichier JSON téléchargé, copiez :
- `client_email` → `GOOGLE_CLIENT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY` (avec les guillemets et `\n`)

## 📧 Étape 3 : Configuration Resend

1. Créez un compte sur https://resend.com/
2. Allez dans "API Keys" et créez une clé
3. Copiez la clé → `RESEND_API_KEY`
4. Pour les tests, utilisez `onboarding@resend.dev` comme `RESEND_FROM_EMAIL`
5. Pour la production, ajoutez votre domaine dans Resend

## ⚙️ Étape 4 : Créer le fichier .env.local

Créez un fichier `.env.local` à la racine du projet :

```env
# Google Calendar
GOOGLE_CLIENT_EMAIL=votre-email@votre-projet.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nVotre clé privée ici\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=votre-calendar-id@group.calendar.google.com

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@votredomaine.com
ADMIN_EMAIL=votre-email@example.com

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**⚠️ Important :** 
- Le `GOOGLE_PRIVATE_KEY` doit être entre guillemets et garder les `\n`
- Ne commitez JAMAIS le fichier `.env.local` (il est dans `.gitignore`)

## 🚀 Étape 5 : Lancer le projet

```bash
npm run dev
```

Ouvrez http://localhost:3000 dans votre navigateur.

## ✅ Test du Workflow

1. Allez sur la page d'accueil
2. Cliquez sur "Voir disponibilités" pour un appartement
3. Sélectionnez des dates sur le calendrier
4. Remplissez le formulaire
5. Vérifiez que vous recevez l'email admin avec les liens d'approbation
6. Testez les liens "Confirmer" et "Refuser"

## 🐛 Problèmes Courants

### "GOOGLE_CALENDAR_ID is not configured"
→ Vérifiez que votre `.env.local` existe et contient toutes les variables

### "Failed to create calendar event"
→ Vérifiez que le Service Account a bien accès au calendrier (partage configuré)

### Les emails ne partent pas
→ Vérifiez votre `RESEND_API_KEY` et que votre domaine est vérifié (ou utilisez `onboarding@resend.dev`)

## 📝 Prochaines Étapes

- Remplacez les images placeholder par vos vraies photos
- Personnalisez les couleurs dans `app/globals.css`
- Ajoutez vos propres équipements dans `lib/apartments.ts`
- Configurez votre domaine pour Resend en production
