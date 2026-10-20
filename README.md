# Team Planner

Application web de planification d'équipe (interface en français), 100 % statique : HTML / CSS / JavaScript, sans backend ni build.

## Fonctionnalités
- **Tâches** : ajout, renommage, suppression, choix de la couleur.
- **Personnes** : ajout, suppression, total d'heures assignées sur la période, indicateur si les heures par jour sortent de la plage min/max (orange = trop peu, rouge = trop, vert = ok).
- **Chronogramme** (lignes = tâches, colonnes = créneaux) : compteur `affectés/requis`, boutons **+** / **−** par cellule, fusion visuelle des créneaux adjacents ayant le même besoin, couleur verte (complet), orange (manque) ou rouge (surplus).
- **Popup d'affectation** au clic sur une cellule : nom et couleur de la tâche, personnes cliquables (affecter / retirer), fermeture par bouton, clic extérieur ou Échap. Une personne déjà affectée à une autre tâche sur le même créneau est grisée.
- **Période configurable** (jours, heures, créneaux 30 min / 1 h). Modifier la période réinitialise besoins et affectations (après confirmation).
- **Persistance** dans le `localStorage` + **export / import JSON**.

## Utilisation en local
Ouvrir `index.html` dans un navigateur (ou `python3 -m http.server`).

## Déploiement sur GitHub Pages
1. Dans *Settings → Pages → Build and deployment*, choisir **GitHub Actions** comme source.
2. Le workflow déploie automatiquement le site à chaque push sur `main`. Il peut aussi être lancé manuellement depuis l'onglet *Actions*.
3. Le site est disponible à `https://<utilisateur>.github.io/team-planner/`.

## Modifier les textes
Tous les textes affichés sont dans l'objet `LABELS` en haut de `app.js`.
