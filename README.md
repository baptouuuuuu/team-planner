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
1. Pousser le code sur la branche `main`.
2. *Settings → Pages* → *Build and deployment* : Source **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Le site est disponible à `https://<utilisateur>.github.io/team-planner/`.

## Modifier les textes
Tous les textes affichés sont dans l'objet `LABELS` en haut de `app.js`.
