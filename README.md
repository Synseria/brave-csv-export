# Export CSV Commandes & Panier (Brave)

Extension Brave qui exporte vos **commandes** et votre **panier** en CSV.
Sites pris en charge : **Amazon** (.fr, .com, .de, .es, .it, .co.uk…) et **AliExpress**.

## Installation (2 minutes)

1. Décompressez `brave-csv-export.zip` dans un dossier que vous gardez (ex. `Documents/brave-csv-export`).
2. Dans Brave, ouvrez `brave://extensions`.
3. Activez **Mode développeur** (interrupteur en haut à droite).
4. Cliquez **Charger l'extension non empaquetée** et choisissez le dossier décompressé (celui qui contient `manifest.json`).
5. Épinglez l'extension (icône puzzle ▸ punaise) pour l'avoir sous la main.

## Utilisation

- **Commandes** : ouvrez la page « Vos commandes » (Amazon) ou « Mes commandes » (AliExpress), connecté, puis cliquez sur l'icône ▸ **Exporter les commandes**. Deux modes :
  - **Page affichée uniquement** : exporte strictement ce qui est à l'écran, sans charger autre chose.
  - **Tout l'historique, filtré par date** (Du / Au, vides = sans limite) :
    - Amazon : l'extension parcourt l'historique année par année et toutes les pages, et s'arrête à la date « Du ».
    - AliExpress : l'extension clique sur « Voir plus » (ou page suivante) jusqu'à la date « Du ». Laissez l'onglet et la fenêtre de l'extension ouverts pendant l'opération.
  - Sur Amazon, si vous avez fait une **recherche** dans vos commandes, ce sont les résultats de la recherche qui sont exportés (toutes leurs pages), filtrés par les dates.
- **Panier** : ouvrez le panier, puis **Exporter le panier**. Sur Amazon, les articles « Enregistrés pour plus tard » sont inclus (colonne *Section*).
- Si vous n'êtes pas sur la bonne page, le bouton devient « Ouvrir mes commandes / Ouvrir le panier » et vous y emmène.
- Séparateur `;` par défaut (Excel en français) ; choisissez `,` pour Google Sheets ou LibreOffice en anglais.
- Colonne **Date (ISO)** (AAAA-MM-JJ) pour trier facilement.

Le fichier arrive dans vos Téléchargements (`amazon-commandes-AAAA-MM-JJ.csv`…). Une ligne par article, avec les infos de la commande répétées.

**Rien trouvé ?** Cliquez « Enregistrer la page pour diagnostic » dans l'extension et envoyez le fichier `.html` obtenu : il permet d'ajuster l'extension à la mise en page exacte. (Il contient vos données de commande, ne l'envoyez qu'à qui vous faites confiance.)

## Confidentialité

Tout se passe dans votre navigateur : aucune donnée n'est envoyée ailleurs. L'extension ne lit la page qu'au moment où vous cliquez.

## Ajouter un site

1. Copiez `sites/amazon.js` en `sites/<site>.js` et adaptez les sélecteurs des fonctions `orders()` et `cart()`.
2. Ajoutez une entrée dans la liste `SITES` en haut de `popup.js`.
3. Rechargez l'extension dans `brave://extensions`.

Si un site change sa mise en page et que l'export renvoie « Aucune donnée trouvée », ce sont les sélecteurs de `sites/<site>.js` qu'il faut ajuster.
