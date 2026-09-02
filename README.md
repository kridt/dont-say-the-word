# Sig ikke ordet

Et festspil til **én delt telefon**. Hold sammen om at forklare ord – uden at
sige selve ordet.

Ingen konto, ingen server, ingen afhængigheder. Ren HTML, CSS og JavaScript,
så det kan lægges direkte på GitHub Pages.

## Spillets gang

1. **Opsætning** – navngiv de to hold og vælg rundetid (30/45/60/90/120 sekunder,
   standard er 60).
2. **Ordpuljen** – send telefonen rundt, og lad alle skrive ord ind. Listen er
   sløret som standard, så ingen kan skimme puljen – til gengæld holder appen
   selv øje med gengangere (se nedenfor).
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

## Hosting (GitHub Pages)

Siden ligger i roden af `main` og er klar til GitHub Pages. Der er intet
byggetrin – Pages skal bare pege på branchen.

1. **Gør repoet offentligt** – Settings → General → nederst *Change repository
   visibility* → *Make public*. (Pages virker ikke på private repos på gratis-
   planen; med GitHub Pro kan man springe dette over.)
2. **Slå Pages til** – Settings → Pages → Source: *Deploy from a branch* →
   Branch: `main` → mappe: `/ (root)` → *Save*.
3. Efter ca. et minut er spillet live på
   **https://kridt.github.io/dont-say-the-word/**

`.nojekyll` ligger i roden, så Pages serverer filerne, som de er, uden at køre
dem gennem Jekyll først.

Vil man hellere hoste et andet sted, kan mappen lægges direkte ind hos Netlify,
Vercel eller Cloudflare Pages – der er ingen afhængigheder at bygge.

## Filer

| Fil | Indhold |
| --- | --- |
| `index.html` | Alle skærme: forside, opsætning, ordpulje, klar, runde, rundeslut, slutresultat, regler |
| `styles.css` | Mørkt festspils-look, holdfarver (rød/blå), stor typografi, rød pulserende timer de sidste 10 sekunder |
| `app.js` | Tilstandsmaskine, timer, pointtælling, ordtrækning og lokal gemning |

## Detaljer under motorhjelmen

* **Gengangere fanges, selvom puljen er skjult.** Ord sammenlignes på en
  foldet nøgle, der ser bort fra store/små bogstaver, mellemrum, tegnsætning
  og de stavemåder, folk blander sammen (å/aa, æ/ae, ø/o, é/e). Er ordet det
  samme, afvises det. Ligner det bare noget i puljen – bøjet form som
  *fyrtårn/fyrtårnet*, eller én tastefejl fra – kommer der en advarsel med et
  *Tilføj alligevel*-knap, så man aldrig bliver spærret ude af et ord, der
  faktisk er nyt.
* **Ord trækkes tilfældigt** fra de resterende ord i puljen.
* **Timeren regnes ud fra et sluttidspunkt**, ikke fra antal tick, så den ikke
  driver, hvis fanen throttles.
* **Spillet fortsætter, hvor det slap.** Alt gemmes lokalt (`localStorage`) –
  holdnavne, rundetid, ordpuljen, stillingen og hvilken skærm man var på – og
  der gemmes også, når siden lægges væk (`pagehide` / `visibilitychange`), fordi
  telefoner smider baggrundsfaner væk uden varsel. Åbner man siden igen, er man
  tilbage samme sted uden at trykke på noget: midt i ordpuljen, på klar-skærmen
  eller på rundeopsamlingen.
  En **afbrudt runde spilles helt forfra**: ordene fra runden ryger tilbage i
  puljen, og pointene rulles tilbage, så ingen får point for en runde, de ikke
  spillede færdig. Spillet ryddes, når det er slut, når man trykker ✕, eller når
  man starter et nyt spil.
* **Skærmen holdes vågen** under en runde via Wake Lock API, hvor browseren
  understøtter det.
