# TIBE Zerkleinerungstechnik — Website

Statische Einzelseiten-Website (eine `index.html`, kein Framework, keine externen
Abhängigkeiten). Läuft per Doppelklick im Browser und wird über GitHub Pages
veröffentlicht.

## Dateien

| Datei                          | Zweck                                      |
|--------------------------------|--------------------------------------------|
| `index.html`                   | die komplette Seite inkl. CSS              |
| `tibe-logo-hell.png`           | Logo für dunkle Flächen (Kopf/Fuß)         |
| `tibe-logo-dunkel.png`         | Logo für helle Flächen (Reserve)           |
| `tibe-produktbild.png`         | Produktfoto                                |
| `verschleisszyklen-planer.pdf` | Download aus dem Lead-Magnet-Abschnitt     |
| `.nojekyll`                    | schaltet die Jekyll-Verarbeitung bei Pages ab |

## Noch fehlende Bilder

`index.html` verweist auf drei Dateien, die es noch nicht gibt. Bis sie
hochgeladen sind, zeigt die Seite an diesen Stellen einen gestalteten
Platzhalter mit dem Alternativtext — sie bleibt also funktionsfähig.

- `tibe-vorher.jpg`
- `tibe-nachher.jpg`
- `tibe-team.jpg`

Empfehlung: auf ca. 1400 px Breite verkleinern, als JPG unter 250 kB speichern,
in dieses Verzeichnis legen und committen.

## Ändern und veröffentlichen

Jede Änderung auf `main` wird von GitHub Pages automatisch übernommen
(ein bis zwei Minuten Verzögerung).

```bash
git add -A
git commit -m "Text angepasst"
git push
```

## Unterordner `kontaktkarte/`

Enthält die private Handy-App „Kontaktkarte“ (Expo / React Native) – unabhängig
von der Website. Details, Datenbankschema und Installationsanleitung:
[`kontaktkarte/README.md`](kontaktkarte/README.md).
