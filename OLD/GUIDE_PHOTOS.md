# Guide de Placement des Photos

## 📁 Structure des Dossiers

Placez vos photos dans le dossier `public/images/` selon la structure suivante :

```
public/
└── images/
    ├── PS1/          # Photos du Petit Sport Chalet 1
    ├── PS2/          # Photos du Petit Sport Chalet 2
    ├── T3/           # Photos du T3 Capture Insecte
    └── general/      # Photos générales (devanture, extérieur, etc.)
```

## 📸 Où Placer les Photos

### Pour chaque appartement :

1. **PS1** (Petit Sport Chalet 1)
   - Placez toutes les photos du premier chalet dans `public/images/PS1/`
   - Formats acceptés : `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
   - Les images seront automatiquement détectées et affichées dans la galerie

2. **PS2** (Petit Sport Chalet 2)
   - Placez toutes les photos du deuxième chalet dans `public/images/PS2/`
   - Même format que PS1

3. **T3** (T3 Capture Insecte)
   - Placez toutes les photos du T3 dans `public/images/T3/`
   - Si le dossier est vide, une image placeholder sera affichée

4. **general** (Photos générales)
   - Photos de la devanture, extérieur, vue générale
   - Peuvent être utilisées sur la page d'accueil ou ailleurs

## 🎯 Bonnes Pratiques

- **Noms de fichiers** : Utilisez des noms descriptifs (ex: `chambre1.jpg`, `cuisine.jpg`, `vue-montagne.jpg`)
- **Ordre d'affichage** : Les images sont triées par ordre alphabétique, donc préfixez-les avec des numéros si vous voulez contrôler l'ordre (ex: `01-chambre.jpg`, `02-cuisine.jpg`)
- **Taille des images** : Optimisez vos images pour le web (recommandé : max 2000px de largeur, format JPEG ou WebP)
- **Première image** : La première image du dossier sera utilisée comme image hero en haut de la page

## 🔄 Après Ajout de Photos

1. Placez vos photos dans le bon dossier
2. Redémarrez le serveur de développement (`npm run dev`) si nécessaire
3. Les images apparaîtront automatiquement dans la galerie de l'appartement

## ⚠️ Note pour le T3

Si le dossier `T3` est vide, une image placeholder sera affichée. Vous pouvez ajouter une image placeholder temporaire si vous le souhaitez.
