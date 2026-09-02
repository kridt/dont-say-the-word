# Sig ikke ordet

Et festspil til **én delt telefon**. Hold sammen om at forklare ord – uden at
sige selve ordet.

Ingen konto, ingen server, ingen afhængigheder. Ren HTML, CSS og JavaScript,
så det kan lægges direkte på GitHub Pages.

## Spillets gang

1. **Opsætning** – navngiv de to hold og vælg rundetid (30/45/60/90/120 sekunder,
   standard er 60).
2. **Ordpuljen** – send telefonen rundt, og lad alle skrive ord ind. Listen er
   sløret som standard, så ingen kan skimme puljen. Dubletter afvises.
3. **Runden** – beskriveren holder telefonen, ser ordet og forklarer det. Holdet
   råber gæt.
   * **Gættet!** → 1 point, og næste ord kommer med det samme.
   * **Jeg sagde ordet** → runden slutter øjeblikkeligt, og ordet ryger tilbage
     i puljen. De point, holdet allerede har fået i runden, beholder de.
   * **Tiden løber ud** → det ord, man ikke nåede, ryger tilbage i puljen og kan
     komme igen – også til modstanderne.
4. **Skiftevis** – holdene skiftes til at have en runde, og en ny person på
   holdet beskriver hver gang.
5. **Slut** – spillet slutter, når puljen er tom. Flest point vinder.

Der er **ingen overspringere**: man får det ord, man får.

## Kør det lokalt

Åbn `index.html` direkte i en browser, eller server mappen:

```bash
python3 -m http.server 8000
# -> http://localhost:8000
```

## Læg det på GitHub Pages

Settings -> Pages -> Source: *Deploy from a branch* -> vælg branch og `/ (root)`.
Der er intet byggetrin.

## Filer

| Fil | Indhold |
| --- | --- |
| `index.html` | Alle skærme: forside, opsætning, ordpulje, klar, runde, rundeslut, slutresultat, regler |
| `styles.css` | Mørkt festspils-look, holdfarver (rød/blå), stor typografi, rød pulserende timer de sidste 10 sekunder |
| `app.js` | Tilstandsmaskine, timer, pointtælling, ordtrækning og lokal gemning |

## Detaljer under motorhjelmen

* **Ord trækkes tilfældigt** fra de resterende ord i puljen.
* **Timeren regnes ud fra et sluttidspunkt**, ikke fra antal tick, så den ikke
  driver, hvis fanen throttles.
* **Spillet gemmes lokalt** (`localStorage`) efter hver runde. Genindlæser man
  ved et uheld siden, kan man trykke *Fortsæt spil*; en afbrudt runde starter
  forfra, og ordet i spil ryger tilbage i puljen.
* **Skærmen holdes vågen** under en runde via Wake Lock API, hvor browseren
  understøtter det.
