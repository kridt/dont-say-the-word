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
* **Firebase (Firestore)** – bruges alle andre steder, fx GitHub Pages. Virker
  for hvem som helst med linket, uden login.
* **Supabase** – alternativ til Firebase, hvis man hellere vil have SQL.

Er ingen af dem til rådighed, dukker knapperne aldrig op, og spillet opfører sig
præcis som med én delt telefon. Én kodebase, ingen byggeflag.

### Sådan slår du Firebase til

Projektet er allerede konfigureret i `backend-config.js`. Der mangler to ting
i Firebase Console:

1. **Opret databasen** – Build → Firestore Database → *Create database* → vælg
   en placering (fx `eur3`). Start i produktionstilstand; reglerne kommer i
   næste trin.
2. **Indsæt reglerne** – Firestore Database → fanen **Rules** → erstat alt med
   indholdet af `firestore.rules` → **Publish**.

Så virker det. Spillerne skal ikke logge ind, og web-API-nøglen i
`backend-config.js` er ment til at ligge offentligt – den identificerer
projektet, den giver ikke adgang. Det er reglerne, der bestemmer, hvad man må.
Reglerne holder dokumenterne i den form, spillet forventer, og sætter loft over
ordlængden, så ingen kan proppe vilkårlige data ind.

Firebase-bibliotekerne hentes først, når `FIREBASE_CONFIG` er udfyldt. Går
hentningen galt – fx en SDK-version, der ikke findes – falder spillet stille
tilbage til pass-the-phone. Versionen står i `FIREBASE_SDK_VERSION`.

### Supabase i stedet

Tøm `FIREBASE_CONFIG`, udfyld `SUPABASE_CONFIG` i samme fil, og kør
`supabase-setup.sql` i projektets SQL Editor. Resten er ens.

## Filer

| Fil | Indhold |
| --- | --- |
| `index.html` | Alle skærme: forside, opsætning, ordpulje, klar, runde, rundeslut, slutresultat, regler |
| `styles.css` | Mørkt festspils-look, holdfarver (rød/blå), stor typografi, rød pulserende timer de sidste 10 sekunder |
| `app.js` | Tilstandsmaskine, timer, pointtælling, ordtrækning, lokal gemning og det valgfrie rum-lag |
| `backend-config.js` | Firebase- eller Supabase-projekt. Tom = pass-the-phone |
| `firestore.rules` | Adgangsregler til Firestore. Indsættes én gang i konsollen |
| `supabase-setup.sql` | Skema til Supabase, hvis man vælger den vej |

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
