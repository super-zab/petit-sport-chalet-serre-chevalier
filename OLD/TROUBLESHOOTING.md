# 🔧 Guide de Dépannage

## Erreur 500 lors de la Réservation

### Symptômes
- Message "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
- Erreur 500 dans les logs
- Timeout de 30+ secondes

### Causes Possibles

#### 1. Calendar ID Incorrect ou Manquant
**Solution :**
- Vérifiez que les variables `GOOGLE_CALENDAR_ID_PS1`, `PS2`, `T3` sont bien définies dans `.env.local`
- Vérifiez que le Calendar ID est au format : `xxxxx@group.calendar.google.com`
- Vérifiez que le Service Account a bien accès au calendrier (partage configuré)

#### 2. Credentials Google Manquants
**Solution :**
- Vérifiez que `GOOGLE_CLIENT_EMAIL` et `GOOGLE_PRIVATE_KEY` sont définis
- Vérifiez que la clé privée est bien entre guillemets avec les `\n`

#### 3. Permissions Insuffisantes
**Solution :**
- Le Service Account doit avoir les droits "Make changes to events" sur le calendrier
- Vérifiez dans Google Calendar > Paramètres du calendrier > Partage

#### 4. Email Resend Échoue
**Note :** L'email est maintenant non-bloquant. Si l'email échoue, la réservation est quand même créée dans le calendrier.

### Vérifications à Faire

1. **Vérifier les logs du serveur** :
   ```bash
   # Regardez les logs dans le terminal où tourne `npm run dev`
   # Cherchez les erreurs "Google Calendar error" ou "Email error"
   ```

2. **Tester la connexion Google Calendar** :
   - Vérifiez que le Service Account peut accéder au calendrier
   - Testez manuellement la création d'un événement

3. **Vérifier les variables d'environnement** :
   ```env
   GOOGLE_CLIENT_EMAIL=...
   GOOGLE_PRIVATE_KEY="..."
   GOOGLE_CALENDAR_ID_PS1=...
   GOOGLE_CALENDAR_ID_PS2=...
   GOOGLE_CALENDAR_ID_T3=...
   ```

## Site Lent

### Optimisations Appliquées

1. **Cache des Prix** : Les règles de pricing sont mises en cache pendant 5 minutes
2. **Images Optimisées** : 
   - Lazy loading pour les images non-prioritaires
   - Formats modernes (WebP, AVIF)
   - Tailles adaptatives
3. **Optimisation des Packages** : Import optimisé de lucide-react

### Améliorations Supplémentaires Possibles

1. **Réduire la taille des images** :
   - Compressez vos images avant de les placer dans `public/images/`
   - Utilisez des outils comme TinyPNG ou ImageOptim
   - Recommandé : max 2000px de largeur, format JPEG ou WebP

2. **Vérifier les requêtes Google Sheets** :
   - Le cache de 5 minutes devrait aider
   - Si toujours lent, vérifiez la taille de votre Sheet

3. **Mode Production** :
   - En production (Vercel), les performances seront meilleures
   - Le build optimise automatiquement les assets

## Messages d'Erreur Courants

### "Calendar ID is missing for this apartment"
→ Vérifiez que le Calendar ID est bien défini dans la config de l'appartement

### "Calendrier introuvable"
→ Vérifiez que le Calendar ID est correct et que le Service Account a accès

### "Permission refusée"
→ Le Service Account n'a pas les droits sur le calendrier

### "Feuille 'DB_EXPORT' introuvable"
→ Vérifiez que la feuille s'appelle exactement "DB_EXPORT" dans votre Google Sheet

## Test Rapide

Pour tester si tout fonctionne :

1. **Test Calendar** :
   ```bash
   # Créez un événement de test manuellement dans Google Calendar
   # Vérifiez qu'il apparaît
   ```

2. **Test API** :
   ```bash
   # Visitez http://localhost:3000/api/pricing (GET)
   # Devrait retourner les règles de pricing
   ```

3. **Test Réservation** :
   - Allez sur une page d'appartement
   - Sélectionnez des dates
   - Remplissez le formulaire
   - Vérifiez les logs du serveur pour les erreurs

## Support

Si le problème persiste :
1. Vérifiez les logs du serveur (terminal)
2. Vérifiez la console du navigateur (F12)
3. Vérifiez que toutes les variables d'environnement sont correctes
