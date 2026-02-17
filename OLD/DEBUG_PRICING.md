# 🔍 Guide de Débogage des Prix

## Problème : Les prix du Google Sheet ne s'affichent pas correctement

### Vérifications Rapides

1. **Vider le cache** :
   Visitez : `http://localhost:3000/api/pricing?clearCache=true`
   Cela force le rechargement depuis Google Sheets

2. **Vérifier les données chargées** :
   Visitez : `http://localhost:3000/api/pricing`
   Vous verrez :
   - Le nombre total de règles
   - Le nombre par slug (ps1, ps2, t3)
   - Les 20 premières règles
   - Toutes les règles pour le débogage

### Vérifier le Format dans Google Sheets

Votre Sheet "DB_EXPORT" doit avoir exactement ces colonnes :

| date_iso | apartment_slug | price |
|----------|----------------|-------|
| 2026-02-15 | ps1 | 100 |
| 2026-02-16 | ps1 | 100 |
| 2026-02-15 | ps2 | 100 |

**Points importants :**
- `date_iso` : Format `YYYY-MM-DD` (ex: `2026-02-15`)
- `apartment_slug` : Doit être exactement `ps1`, `ps2`, ou `t3` (en minuscules)
- `price` : Nombre entier ou décimal (ex: `100` ou `100.50`)

### Vérifier les Logs

Quand vous sélectionnez des dates, regardez les logs du serveur. Vous devriez voir :

```
[Pricing] Calcul pour slug: "ps1", prix par défaut: 150€
[Pricing] 50 règles trouvées pour "ps1"
[Pricing] Date 2026-02-15: 100€ (trouvé dans Sheet)
[Pricing] Date 2026-02-16: 100€ (trouvé dans Sheet)
[Pricing] Résultat: 2/2 dates avec prix du Sheet, total: 200€
```

### Problèmes Courants

#### 1. Le slug ne correspond pas
**Symptôme** : Les prix par défaut (150€) s'affichent au lieu de ceux du Sheet

**Solution** :
- Vérifiez que dans votre Sheet, `apartment_slug` est exactement `ps1`, `ps2`, ou `t3` (pas `PS1`, `Petit Sport Chalet 1`, etc.)
- Vérifiez dans les logs : `[Pricing] X règles trouvées pour "ps1"` - si X = 0, le slug ne correspond pas

#### 2. Les dates ne correspondent pas
**Symptôme** : Certaines dates utilisent le prix par défaut

**Solution** :
- Vérifiez le format des dates dans le Sheet : `YYYY-MM-DD` (ex: `2026-02-15`)
- Pas de formatage de date Excel, juste du texte
- Vérifiez dans les logs quelles dates utilisent le prix par défaut

#### 3. Le cache contient de vieilles données
**Symptôme** : Les modifications dans le Sheet ne s'affichent pas

**Solution** :
- Visitez `http://localhost:3000/api/pricing?clearCache=true`
- Attendez 5 minutes (durée du cache)
- Ou redémarrez le serveur

#### 4. La feuille s'appelle mal
**Symptôme** : Aucune règle chargée

**Solution** :
- La feuille doit s'appeler exactement **"DB_EXPORT"** (sensible à la casse)
- Vérifiez dans les logs : `Feuille 'DB_EXPORT' introuvable`

### Test Complet

1. **Vérifier le Sheet** :
   ```
   GET http://localhost:3000/api/pricing?clearCache=true
   ```
   Vérifiez que `rulesCount` > 0 et que `bySlug` contient vos slugs

2. **Tester le calcul** :
   - Allez sur une page d'appartement
   - Sélectionnez des dates qui ont des prix dans le Sheet
   - Regardez les logs du serveur
   - Vérifiez le prix affiché

3. **Vérifier les logs** :
   Les logs vous diront exactement :
   - Combien de règles sont chargées
   - Quelles dates utilisent le prix du Sheet
   - Quelles dates utilisent le prix par défaut

### Exemple de Logs Corrects

```
[Pricing] Chargement de 150 lignes depuis DB_EXPORT
[Pricing] 150 règles valides chargées
[Pricing] Exemple de règles: [
  { date: '2026-02-15', apartmentSlug: 'ps1', price: 100 },
  { date: '2026-02-16', apartmentSlug: 'ps1', price: 100 },
  ...
]
[Pricing] Calcul pour slug: "ps1", prix par défaut: 150€
[Pricing] 50 règles trouvées pour "ps1"
[Pricing] Date 2026-02-15: 100€ (trouvé dans Sheet)
[Pricing] Date 2026-02-16: 100€ (trouvé dans Sheet)
[Pricing] Résultat: 2/2 dates avec prix du Sheet, total: 200€
```

Si vous voyez `[Pricing] Date 2026-02-15: 150€ (prix par défaut)`, cela signifie qu'aucune règle n'a été trouvée pour cette date.
