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

## To måder at fylde puljen på

**Én delt telefon** (virker overalt): alle skriver ord ind på den samme telefon.
Listen er sløret undervejs, så ingen kan skimme puljen.

**Hver sin telefon** (kun som Artifact på claude.ai): værten opretter et rum og
læser en firetegnskode op. De andre åbner samme link, taster koden og skriver
ord fra deres egen telefon. Ingen ser hinandens ord – man ser kun sine egne og
et samlet antal. Når værten starter, spilles selve spillet som før på værtens
telefon, og de andres skærme viser stillingen live.

Rumlaget taler kun med én lille grænseflade, og to backends opfylder den:

* **Artefaktens `db`** – bruges automatisk inde på claude.ai. Kræver ingen
  opsætning, men artefakter med `db` kan kun deles internt i ens organisation.
* **Supabase** – bruges alle andre steder, fx GitHub Pages. Virker for hvem som
  helst med linket, uden login.

Er ingen af dem til rådighed, dukker knapperne aldrig op, og spillet opfører sig
præcis som med én delt telefon. Én kodebase, ingen byggeflag.

### Sådan slår du Supabase til

1. Opret et gratis projekt på [supabase.com](https://supabase.com) (intet kort).
2. Åbn **SQL Editor → New query**, indsæt hele `supabase-setup.sql`, og kør den.
   Den laver de to tabeller, åbner adgangen for den offentlige nøgle og slår
   live-opdateringer til.
3. Gå til **Project Settings → API** og kopier **Project URL** og **anon
   public**-nøglen ind i `supabase-config.js`.
4. Commit og push. Knapperne dukker op af sig selv.

`supabase-js` hentes først, når der faktisk står noget i konfigurationen – står
felterne tomme, hentes biblioteket slet ikke.

Begge værdier hører til i klienten og er offentlige; adgangen styres af
reglerne i `supabase-setup.sql`. Rækkerne er med vilje åbne for alle med
nøglen – der ligger kun ord til et selskabsspil i dem. Læg aldrig
`service_role`-nøglen i filen.

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
| `app.js` | Tilstandsmaskine, timer, pointtælling, ordtrækning, lokal gemning og det valgfrie rum-lag |
| `supabase-config.js` | Projekt-URL og offentlig nøgle. Tom som standard |
| `supabase-setup.sql` | Tabeller, adgangsregler og live-opdateringer. Køres én gang |

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
