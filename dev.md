# Guide développeur

Installation locale, mise en production, organisation du code et sécurité du site Le Petit Sport Chalet. Le fonctionnement côté utilisateur est décrit dans le [README](README.md).

## Développement local

### Prérequis

- **Node.js 20.9 ou plus récent** (`node -v` pour vérifier). npm est fourni avec.
- **Git.**
- Rien d'autre : pas de Postgres, de Docker ni de compte Google à installer. Une base de données embarquée est créée automatiquement au premier lancement.

### 1. Récupérer le code et installer les dépendances

```bash
git clone https://github.com/super-zab/petit-sport-chalet-serre-chevalier.git
cd petit-sport-chalet-serre-chevalier
npm install
```

`npm install` respecte les versions figées dans `package-lock.json`. Ne supprimez pas ce fichier.

### 2. Créer le fichier de configuration locale

```bash
cp .env.example .env.local
```

`.env.local` est ignoré par git : vous pouvez y mettre des secrets sans risque de les publier. Pour démarrer, une seule variable est indispensable.

| Variable | En local | Rôle |
| --- | --- | --- |
| `ADMIN_SETUP_TOKEN` | **Obligatoire** | Jeton demandé une seule fois pour créer le premier compte admin. Le générer avec `openssl rand -hex 32`. |
| `NEXT_PUBLIC_BASE_URL` | Conseillée | `http://localhost:3000`. Sert pour les liens dans les emails, le lien d'export iCal et le sitemap. |
| `DATABASE_URL` | Laisser vide | Vide = base embarquée. Renseignée = vraie base Postgres (voir plus bas). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Facultatives | Sans elles, les emails ne partent pas : ils sont seulement résumés dans le terminal. |
| `ADMIN_NOTIFICATION_EMAILS` | Facultative | Destinataires de l'alerte « nouvelle demande », séparés par des virgules. |
| `CRON_SECRET` | Facultative | Seulement pour tester la tâche planifiée à la main. |

Exemple de `.env.local` minimal :

```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
ADMIN_SETUP_TOKEN=collez-ici-le-résultat-de-openssl-rand-hex-32
```

Après toute modification de `.env.local`, arrêtez puis relancez `npm run dev`.

### 3. Lancer le site

```bash
npm run dev
```

Le site est sur http://localhost:3000. Pour un autre port : `npm run dev -- -p 3001` (et adaptez `NEXT_PUBLIC_BASE_URL`).

Le premier chargement de chaque page prend quelques secondes, le temps de la compiler. Les modifications du code s'affichent ensuite sans recharger.

`npm run dev` utilise webpack et non Turbopack (le mode par défaut de Next 16) : avec Turbopack, le serveur de développement de Next 16.4 rechargeait parfois la page en boucle (« HMR hash mismatch » dans la console du navigateur). Cela ne concerne que le développement, pas la production.

### 4. Créer son compte admin

1. Ouvrez http://localhost:3000/admin/installation.
2. Saisissez le jeton `ADMIN_SETUP_TOKEN`, un email et un mot de passe de 12 caractères minimum.
3. Vous arrivez sur le tableau de bord. La page d'installation se ferme dès qu'un compte existe ; les comptes suivants se créent dans `/admin/reglages`.

### 5. Tester le parcours complet

1. Ouvrez un appartement, par exemple http://localhost:3000/appartements/ps1.
2. Choisissez des dates et envoyez une demande. Le terminal affiche les emails qui auraient été envoyés :
   ```
   [email] non envoyé (RESEND_API_KEY ou EMAIL_FROM manquant) → … : Nouvelle demande : …
   ```
3. Dans `/admin`, la demande apparaît à droite et sous forme de pastille jaune dans le calendrier. Acceptez-la : les dates deviennent indisponibles sur la page publique.
4. Dans le calendrier admin, cliquez un jour puis un second pour sélectionner une période, et testez prix, blocage et réservation manuelle.

### La base de données locale

Sans `DATABASE_URL`, le site utilise PGlite, un vrai Postgres compilé pour Node.js :

- Elle est stockée dans `node_modules/.cache/petit-sport-chalet/pglite`, hors du dossier surveillé par le serveur de développement.
- Le schéma (`db/migrations/*.sql`) y est appliqué automatiquement au démarrage.
- Elle ne sert qu'en développement : `npm start` en mode production refuse de démarrer sans `DATABASE_URL`.

**Repartir de zéro** (comptes, réservations et prix effacés) :

```bash
# arrêter d'abord npm run dev
rm -rf node_modules/.cache/petit-sport-chalet
```

C'est aussi la solution si vous avez oublié votre mot de passe local ou si vous êtes bloqué par la limitation des tentatives (5 demandes de réservation par 10 minutes, 5 essais de connexion par 15 minutes).

Autres réglages possibles dans `.env.local` :

- `PGLITE_DIR=/un/autre/dossier` : stocker la base ailleurs.
- `PGLITE_DIR=memory` : base en mémoire, vidée à chaque redémarrage.

### Travailler avec une vraie base Postgres

Pour reproduire la production, par exemple avec une branche Neon de développement :

```bash
# dans .env.local
DATABASE_URL=postgres://utilisateur:motdepasse@hote/base?sslmode=require
```

```bash
npm run db:migrate   # applique les migrations (n'est pas automatique avec DATABASE_URL)
npm run dev
```

N'utilisez jamais la base de production pour développer.

### Modifier le schéma de la base

1. Créez un nouveau fichier dans `db/migrations/`, numéroté à la suite : `0002_description_courte.sql` (minuscules, chiffres et `_` uniquement).
2. Ne modifiez jamais une migration déjà appliquée en production : ajoutez-en une nouvelle.
3. En local, supprimez la base embarquée ou relancez le serveur : la migration s'applique au démarrage. Sur Vercel, elle s'applique au prochain déploiement.

Les migrations déjà appliquées sont listées dans la table `schema_migrations`.

### Tester les emails pour de vrai

1. Créez un compte sur https://resend.com et une clé API.
2. Dans `.env.local` :
   ```env
   RESEND_API_KEY=re_…
   EMAIL_FROM="Le Petit Sport Chalet <onboarding@resend.dev>"
   ADMIN_NOTIFICATION_EMAILS=votre-adresse@exemple.fr
   ```
3. Tant que votre domaine n'est pas vérifié dans Resend, l'expéditeur de test `onboarding@resend.dev` ne peut écrire qu'à l'adresse de votre compte Resend.

### Tester la synchronisation Airbnb / Booking

- **Import** : dans `/admin/reglages`, collez n'importe quel lien iCal public en `https://`, par exemple celui d'un agenda Google public. Les liens vers `localhost` ou des adresses privées sont volontairement refusés.
- **Export** : le lien « Notre calendrier » affiché dans les réglages s'ouvre directement dans le navigateur ou avec `curl`.
- **Tâche planifiée** : avec `CRON_SECRET` défini dans `.env.local`,
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
  ```

### Vérifications avant de pousser

```bash
npm test            # tests unitaires (dates, lecture/écriture iCal)
npm run typecheck   # vérification TypeScript
npm run build       # compilation de production
```

Pour essayer le build de production en local : `npm run build`, puis `npm start` avec `DATABASE_URL` défini.

### Problèmes fréquents

| Symptôme | Cause et solution |
| --- | --- |
| « L'installation est désactivée » sur `/admin/installation` | `ADMIN_SETUP_TOKEN` absent ou trop court (16 caractères minimum) dans `.env.local`. Relancez le serveur après l'avoir ajouté. |
| « Calendrier momentanément indisponible » sur une page appartement | La base n'est pas joignable. Avec `DATABASE_URL`, vérifiez l'adresse ; sinon regardez l'erreur `[calendar]` dans le terminal. |
| La page se recharge en boucle | Vous avez lancé `next dev` sans `--webpack`. Utilisez `npm run dev`. |
| Aucun email reçu | Normal sans `RESEND_API_KEY` et `EMAIL_FROM` : regardez le terminal. Avec, vérifiez l'expéditeur dans Resend. |
| « Trop de demandes envoyées » ou « Trop de tentatives » | Limitation anti-abus. Attendez, ou repartez d'une base vide. |
| Changement de `.env.local` sans effet | Arrêtez et relancez `npm run dev`. |
| Un fichier `AGENTS.md` apparaît | Il est créé par `next dev` lui-même ; il peut être commité. |

## Mise en production (Vercel)

1. **Base de données** — dans Vercel : Storage → Create Database → Neon. La variable `DATABASE_URL` est ajoutée au projet (utiliser l'adresse « pooled »).
2. **Variables d'environnement** — renseigner dans Vercel celles de `.env.example` : `NEXT_PUBLIC_BASE_URL`, `ADMIN_SETUP_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAILS`, `CRON_SECRET`.
3. **Déployer.** Le build (`vercel-build`) met à jour le schéma de la base avant de compiler.
4. **Créer le premier compte** sur `https://<domaine>/admin/installation`. La page se ferme définitivement dès qu'un compte existe ; vous pouvez ensuite retirer `ADMIN_SETUP_TOKEN`.
5. **Emails** — vérifier le domaine d'envoi dans Resend pour que `EMAIL_FROM` soit accepté.

La tâche planifiée de `vercel.json` (synchronisation nocturne) s'authentifie avec `CRON_SECRET`.

## Structure

```
app/(site)/            pages publiques (accueil, appartements)
app/admin/             tableau de bord, connexion, actions serveur
app/api/               calendrier public, demande de réservation, export iCal, tâche planifiée
components/            calendrier et formulaire publics ; components/admin/ pour le tableau de bord
config/                textes des appartements, coordonnées
db/migrations/         schéma SQL (appliqué par scripts/migrate.mjs)
lib/bookings.ts        règles métier : disponibilités, prix, demandes, blocages
lib/ical.ts            import / export des calendriers externes
lib/auth.ts            mots de passe et sessions
proxy.ts               politique de sécurité stricte pour /admin
```

Pour modifier le texte, les équipements ou les photos d'un appartement : `config/apartments.ts` et `public/images/`. Les prix ne se règlent plus dans le code.

## Sécurité

- Mots de passe hachés (scrypt), sessions en cookie `HttpOnly` / `Secure` dont seule l'empreinte est stockée ; tentatives de connexion limitées.
- Chaque page et chaque action de `/admin` vérifie la session côté serveur ; toutes les actions sont consignées dans la table `audit_log`.
- Formulaire public : validation stricte, limitation du nombre d'envois, champ piège anti-robots, refus des envois venant d'un autre site.
- Requêtes SQL toujours paramétrées ; en-têtes de sécurité (CSP, HSTS, anti-clickjacking) sur tout le site.
- Les liens iCal importés ne peuvent viser que des domaines publics en HTTPS.
- **Aucun secret dans le dépôt.** Les clés vivent dans les variables d'environnement. Les dossiers `Onboarding/` et `OLD/` sont ignorés par git : ils contenaient des identifiants.
