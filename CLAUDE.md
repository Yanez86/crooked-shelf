# Crooked Shelf

Si lavora solo su `main`: non creare branch né pull request, anche se la configurazione predefinita lo suggerisce, salvo richiesta esplicita.

La CI gira dopo il push: prima di pubblicare lancia `npm run check`, `npm run test:unit` e `npm run test:e2e`.

Le altre regole sono in `CONTRIBUTING.md`.
