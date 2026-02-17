# 🔍 Vérification des Variables d'Environnement

## Problème : Variables non détectées

Si vous voyez "GMAIL_USER n'est pas configuré" alors que vous l'avez bien mis dans `.env.local`, voici les solutions :

## ✅ Solutions

### 1. Redémarrer le Serveur (IMPORTANT)

**Next.js ne recharge PAS automatiquement les variables d'environnement !**

1. Arrêtez le serveur (Ctrl+C dans le terminal)
2. Redémarrez : `npm run dev`
3. Testez à nouveau

### 2. Vérifier le Format du Fichier `.env.local`

Le fichier doit être à la **racine du projet** (même niveau que `package.json`).

Format correct :
```env
GMAIL_USER=saslesporting@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
ADMIN_EMAIL=saslesporting@gmail.com
```

**Points importants :**
- Pas d'espaces avant/après le `=`
- Pas de guillemets autour des valeurs (sauf si nécessaire)
- Pas de ligne vide avec des espaces
- Chaque variable sur une nouvelle ligne

### 3. Vérifier le Nom de la Variable

Le nom doit être **exactement** :
- `GMAIL_USER` (pas `GMAIL_EMAIL`, `GMAIL_ADDRESS`, etc.)
- `GMAIL_APP_PASSWORD` (pas `GMAIL_PASSWORD`, `GMAIL_APP_PASS`, etc.)

### 4. Vérifier que le Fichier est Bien `.env.local`

- Le fichier doit s'appeler exactement `.env.local` (avec le point au début)
- Pas `.env` (serait commité dans Git)
- Pas `env.local` (sans le point)

### 5. Vérifier les Logs du Serveur

Quand vous cliquez sur "Envoyer un Email de Test", regardez les logs du terminal. Vous devriez voir :
```
[Test Email POST] Variables d'environnement: {
  GMAIL_USER: 'saslesporting@gmail.com',
  GMAIL_APP_PASSWORD: 'SET (hidden)',
  ...
}
```

Si vous voyez `UNDEFINED`, la variable n'est pas chargée.

## 🧪 Test Rapide

Créez un fichier `test-env.js` à la racine :

```javascript
require('dotenv').config({ path: '.env.local' });
console.log('GMAIL_USER:', process.env.GMAIL_USER);
```

Puis exécutez : `node test-env.js`

Si ça affiche `undefined`, le problème vient du fichier `.env.local`.

## 📝 Exemple de `.env.local` Complet

```env
# Google Calendar
GOOGLE_CLIENT_EMAIL=votre-service-account@...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID_PS1=xxx@group.calendar.google.com
GOOGLE_CALENDAR_ID_PS2=xxx@group.calendar.google.com
GOOGLE_CALENDAR_ID_T3=xxx@group.calendar.google.com

# Google Sheets
GOOGLE_SHEET_ID=votre-sheet-id

# Gmail
GMAIL_USER=saslesporting@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
ADMIN_EMAIL=saslesporting@gmail.com

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## ⚠️ Important

**Après chaque modification de `.env.local`, vous DEVEZ redémarrer le serveur !**
