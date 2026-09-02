/* Sig ikke ordet — spillogik. Én delt enhed, ingen backend. */
(function () {
  "use strict";

  var STORE_KEY = "sig-ikke-ordet:v2";
  var URGENT_AT = 10; // sekunder tilbage hvor timeren bliver rød

  var $ = function (sel) { return document.querySelector(sel); };

  /* ---------- Tilstand ---------- */

  function newState() {
    return {
      screen: "home",
      teams: [
        { name: "Hold 1", score: 0 },
        { name: "Hold 2", score: 0 }
      ],
      turnSeconds: 60,
      pool: [],        // ord der stadig kan komme i spil
      current: null,   // ordet i spil lige nu
      turnWords: [],   // ord gættet i denne runde — føres tilbage, hvis runden afbrydes
      active: 0,       // hvilket hold der har turen
      turnPoints: 0,
      endReason: null, // "time" | "foul" | "cleared"
      started: false
    };
  }

  var state = newState();
  var ticker = null;
  var deadline = 0;
  var wakeLock = null;

  /* ---------- Gem / hent ---------- */

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* privat browsing o.l. — spillet kører videre uden */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.teams) || !Array.isArray(s.pool)) return null;
      return s;
    } catch (e) { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  // Gemte data er brugerinput fra en tidligere session — læs dem defensivt.
  function hydrate(s) {
    var base = newState();
    for (var i = 0; i < 2; i++) {
      var t = (s.teams && s.teams[i]) || {};
      base.teams[i].name = typeof t.name === "string" && t.name ? t.name : "Hold " + (i + 1);
      base.teams[i].score = Math.max(0, Number(t.score) || 0);
    }
    base.turnSeconds = Number(s.turnSeconds) || 60;
    base.pool = Array.isArray(s.pool) ? s.pool.filter(function (w) { return typeof w === "string"; }) : [];
    base.turnWords = Array.isArray(s.turnWords) ? s.turnWords.filter(function (w) { return typeof w === "string"; }) : [];
    base.current = typeof s.current === "string" ? s.current : null;
    base.active = s.active === 1 ? 1 : 0;
    base.turnPoints = Math.max(0, Number(s.turnPoints) || 0);
    base.endReason = s.endReason || null;
    base.started = !!s.started;
    base.screen = s.screen || "home";
    return base;
  }

  var RESUMABLE = ["setup", "words", "ready", "play", "turnend"];

  function isResumable(s) {
    if (!s || RESUMABLE.indexOf(s.screen) === -1) return false;
    return !!s.started || (Array.isArray(s.pool) && s.pool.length > 0);
  }

  // Sætter spillet tilbage præcis der, hvor det slap.
  function resumeFrom(s) {
    state = hydrate(s);
    fillSetupInputs();

    if (state.screen === "play") {
      // Runden nåede aldrig at blive færdig. Den spilles helt forfra:
      // ordene fra runden ryger tilbage i puljen, og pointene rulles tilbage,
      // så ingen får point for en runde, de ikke spillede færdig.
      if (state.current) { state.pool.push(state.current); state.current = null; }
      state.pool = state.pool.concat(state.turnWords);
      state.teams[state.active].score =
        Math.max(0, state.teams[state.active].score - state.turnPoints);
      state.turnWords = [];
      state.turnPoints = 0;
      goReady();
      return;
    }
    if (state.screen === "ready") { goReady(); return; }
    if (state.screen === "turnend") { renderTurnEnd(); return; }
    if (state.screen === "words") { renderWords(); show("words"); save(); return; }
    show("setup");
    save();
  }

  /* ---------- Skærme ---------- */

  function show(name) {
    state.screen = name;
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("is-active", screens[i].id === "screen-" + name);
    }
    if (name === "home") $("#btn-resume").hidden = !isResumable(load());
    window.scrollTo(0, 0);
  }

  function setAccent(teamIndex) {
    document.documentElement.style.setProperty(
      "--accent", teamIndex === 1 ? "var(--t2)" : "var(--t1)"
    );
  }

  function teamName(i) {
    return state.teams[i].name || "Hold " + (i + 1);
  }

  /* ---------- Opsætning ---------- */

  function paintTimeSeg() {
    var segs = document.querySelectorAll("#time-seg .seg-btn");
    for (var i = 0; i < segs.length; i++) {
      var on = Number(segs[i].dataset.seconds) === state.turnSeconds;
      segs[i].classList.toggle("is-on", on);
      segs[i].setAttribute("aria-checked", on ? "true" : "false");
    }
  }

  // Kun når man går ind på skærmen — ellers ville vi overskrive det, folk skriver.
  function fillSetupInputs() {
    $("#team1-name").value = state.teams[0].name === "Hold 1" ? "" : state.teams[0].name;
    $("#team2-name").value = state.teams[1].name === "Hold 2" ? "" : state.teams[1].name;
    paintTimeSeg();
  }

  document.querySelectorAll("#time-seg .seg-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.turnSeconds = Number(btn.dataset.seconds);
      paintTimeSeg();
      save();
    });
  });

  // Navne gemmes mens der skrives, så de ikke kan gå tabt undervejs.
  [["#team1-name", 0, "Hold 1"], ["#team2-name", 1, "Hold 2"]].forEach(function (pair) {
    $(pair[0]).addEventListener("input", function () {
      state.teams[pair[1]].name = this.value.trim() || pair[2];
      save();
    });
  });

  $("#btn-to-words").addEventListener("click", function () {
    state.teams[0].name = $("#team1-name").value.trim() || "Hold 1";
    state.teams[1].name = $("#team2-name").value.trim() || "Hold 2";
    if (onlineMode) { hostCreateRoom(this); return; }
    renderWords();
    show("words");
    save();
    $("#word-input").focus();
  });

  /* ---------- Ordpulje ---------- */

  function normalize(w) {
    return w.trim().replace(/\s+/g, " ");
  }

  function renderWords() {
    var list = $("#word-list");
    list.innerHTML = "";
    state.pool.forEach(function (word, i) {
      var li = document.createElement("li");
      li.className = "chip";
      var span = document.createElement("span");
      span.textContent = word;
      var del = document.createElement("button");
      del.type = "button";
      del.textContent = "×";
      del.setAttribute("aria-label", "Fjern " + word);
      del.addEventListener("click", function () {
        state.pool.splice(i, 1);
        clearPending();
        setMsg("", null);
        renderWords();
        save();
      });
      li.appendChild(span);
      li.appendChild(del);
      list.appendChild(li);
    });
    $("#word-count").textContent = String(state.pool.length);
    $("#btn-start-game").disabled = state.pool.length === 0;
  }

  // Puljen er skjult, mens man skriver, så appen må selv fange gengangere.
  // Nøglen folder store/små bogstaver, mellemrum, tegnsætning og de
  // stavemåder, danskere blander sammen: å/aa, æ/ae, ø/o, é/e.
  function foldWord(w) {
    var key = w.toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/aa/g, "a")
      .replace(/[^a-z0-9]/g, "");
    return key || w.toLowerCase();
  }

  // Grov dansk stamme: skærer bestemt form og flertal af, så "fyrtårnet"
  // og "fyrtårne" lander samme sted som "fyrtårn".
  var ENDINGS = ["erne", "ene", "ers", "en", "et", "er", "e", "s"];
  function stemWord(key) {
    for (var i = 0; i < ENDINGS.length; i++) {
      var end = ENDINGS[i];
      if (key.length - end.length >= 3 && key.slice(-end.length) === end) {
        return key.slice(0, -end.length);
      }
    }
    return key;
  }

  // Højst én tilføjelse, sletning eller ombytning fra hinanden — fanger tastefejl.
  function withinOneEdit(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, diffs = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diffs > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    return true;
  }

  // Returnerer det ord i puljen, det nye ord kolliderer med.
  // exact: samme ord trods stavemåde — blokeres. Ellers: kun en advarsel.
  function findClash(word) {
    var key = foldWord(word);
    var stem = stemWord(key);
    var near = null;
    for (var i = 0; i < state.pool.length; i++) {
      var other = state.pool[i];
      var okey = foldWord(other);
      if (okey === key) return { word: other, exact: true };
      if (near) continue;
      var close = stemWord(okey) === stem ||
        (key.length >= 5 && okey.length >= 5 && withinOneEdit(key, okey));
      if (close) near = { word: other, exact: false };
    }
    return near;
  }

  var pendingWord = null;

  function setMsg(msg, kind) {
    var el = $("#word-msg");
    el.textContent = msg;
    el.classList.toggle("is-error", kind === "error");
    el.classList.toggle("is-warn", kind === "warn");
    clearTimeout(setMsg.t);
    if (kind === "ok") {
      setMsg.t = setTimeout(function () { el.textContent = ""; }, 2000);
    }
  }

  function clearPending() {
    pendingWord = null;
    $("#btn-add-anyway").hidden = true;
    $("#word-form").classList.remove("is-warned");
  }

  function shakeForm() {
    var form = $("#word-form");
    form.classList.remove("is-rejected");
    void form.offsetWidth; // genstarter animationen
    form.classList.add("is-rejected");
  }

  function addWord(word) {
    state.pool.push(word);
    $("#word-input").value = "";
    $("#word-input").focus();
    clearPending();
    renderWords();
    save();
    setMsg("Tilføjet", "ok");
  }

  $("#word-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("#word-input");
    var word = normalize(input.value);
    if (!word) return;

    var clash = findClash(word);

    if (clash && clash.exact) {
      clearPending();
      shakeForm();
      setMsg("“" + word + "” er allerede i puljen", "error");
      input.select();
      return;
    }

    if (clash) {
      pendingWord = word;
      $("#btn-add-anyway").hidden = false;
      $("#word-form").classList.add("is-warned");
      setMsg("Ligner “" + clash.word + "”, som allerede er i puljen.", "warn");
      input.select();
      return;
    }

    addWord(word);
  });

  $("#btn-add-anyway").addEventListener("click", function () {
    if (pendingWord) addWord(pendingWord);
  });

  // Skriver man videre, gælder advarslen ikke længere det, der står i feltet.
  $("#word-input").addEventListener("input", function () {
    if (pendingWord) { clearPending(); setMsg("", null); }
    $("#word-form").classList.remove("is-rejected", "is-warned");
  });

  $("#btn-toggle-words").addEventListener("click", function () {
    var list = $("#word-list");
    var hidden = list.classList.toggle("is-hidden");
    this.textContent = hidden ? "Vis ord" : "Skjul ord";
    this.setAttribute("aria-pressed", hidden ? "false" : "true");
  });

  /* ---------- Spilstart ---------- */

  $("#btn-start-game").addEventListener("click", function () {
    if (!state.pool.length) return;
    state.teams[0].score = 0;
    state.teams[1].score = 0;
    state.active = 0;
    state.current = null;
    state.turnWords = [];
    state.turnPoints = 0;
    state.started = true;
    goReady();
  });

  function goReady() {
    setAccent(state.active);
    $("#ready-team").textContent = teamName(state.active);
    $("#ready-pool").textContent = String(state.pool.length);
    $("#ready-score").innerHTML =
      '<span class="s1"></span><span class="sep">&ndash;</span><span class="s2"></span>';
    $("#ready-score .s1").textContent = state.teams[0].score;
    $("#ready-score .s2").textContent = state.teams[1].score;
    show("ready");
    save();
    syncRoom("playing");
  }

  /* ---------- Runde ---------- */

  function drawWord() {
    var i = Math.floor(Math.random() * state.pool.length);
    state.current = state.pool.splice(i, 1)[0];
    $("#play-word").textContent = state.current;
  }

  function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      wakeLock = lock;
    }).catch(function () { /* ikke kritisk */ });
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(function () {});
      wakeLock = null;
    }
  }

  function paintTimer(secs) {
    $("#timer").textContent = String(secs);
    var pct = Math.max(0, secs / state.turnSeconds) * 100;
    $("#timer-fill").style.width = pct + "%";
    $("#screen-play").classList.toggle("is-urgent", secs <= URGENT_AT);
  }

  function startTurn() {
    state.turnPoints = 0;
    state.turnWords = [];
    state.endReason = null;
    setAccent(state.active);
    $("#play-team").textContent = teamName(state.active);
    $("#play-points").textContent = "0";
    drawWord();
    paintTimer(state.turnSeconds);
    show("play");
    save();
    requestWakeLock();

    deadline = Date.now() + state.turnSeconds * 1000;
    clearInterval(ticker);
    ticker = setInterval(function () {
      var left = Math.ceil((deadline - Date.now()) / 1000);
      if (left <= 0) {
        paintTimer(0);
        endTurn("time");
        return;
      }
      paintTimer(left);
    }, 100);
  }

  $("#btn-start-turn").addEventListener("click", startTurn);

  $("#btn-correct").addEventListener("click", function () {
    if (state.screen !== "play") return;
    state.turnPoints += 1;
    state.teams[state.active].score += 1;
    state.turnWords.push(state.current);
    $("#play-points").textContent = String(state.turnPoints);
    state.current = null;
    save();
    if (!state.pool.length) {
      endTurn("cleared");
      return;
    }
    drawWord();
  });

  $("#btn-foul").addEventListener("click", function () {
    if (state.screen !== "play") return;
    endTurn("foul");
  });

  function endTurn(reason) {
    clearInterval(ticker);
    ticker = null;
    releaseWakeLock();
    $("#screen-play").classList.remove("is-urgent");

    // Ordet i spil ryger tilbage i puljen — både ved tid og ved forbudt ord.
    if (state.current) {
      state.pool.push(state.current);
      state.current = null;
    }
    state.turnWords = [];
    state.endReason = reason;

    if (reason === "cleared" || state.pool.length === 0) {
      renderGameOver();
      return;
    }
    renderTurnEnd();
  }

  function renderTurnEnd() {
    var reason = state.endReason;
    var head = $("#turnend-reason");
    head.textContent = reason === "foul" ? "Du sagde ordet!" : "Tiden er udløbet";
    head.classList.toggle("is-foul", reason === "foul");
    $("#turnend-points").textContent = String(state.turnPoints);
    $("#turnend-label").innerHTML = 'point til <span id="turnend-team"></span>';
    $("#turnend-team").textContent = teamName(state.active);

    var note = $("#turnend-returned");
    note.hidden = false;
    note.textContent = reason === "foul"
      ? "Runden er slut med det samme. Ordet ryger tilbage i puljen."
      : "Ordet, I ikke nåede, ryger tilbage i puljen.";

    renderBoard($("#turnend-board"));
    show("turnend");
    save();
    syncRoom("playing");
  }

  $("#btn-next-turn").addEventListener("click", function () {
    state.active = state.active === 0 ? 1 : 0;
    goReady();
  });

  /* ---------- Scoreboard ---------- */

  function renderBoard(el) {
    var lead = state.teams[0].score === state.teams[1].score
      ? -1
      : (state.teams[0].score > state.teams[1].score ? 0 : 1);
    el.innerHTML = "";
    state.teams.forEach(function (team, i) {
      var box = document.createElement("div");
      box.className = "sb-team" + (i === lead ? " is-lead" : "");
      box.style.setProperty("--team", i === 1 ? "var(--t2)" : "var(--t1)");
      var name = document.createElement("div");
      name.className = "sb-name";
      name.textContent = teamName(i);
      var score = document.createElement("div");
      score.className = "sb-score";
      score.textContent = String(team.score);
      box.appendChild(name);
      box.appendChild(score);
      el.appendChild(box);
    });
  }

  /* ---------- Slut ---------- */

  function renderGameOver() {
    var a = state.teams[0].score, b = state.teams[1].score;
    var winner = a === b ? -1 : (a > b ? 0 : 1);
    setAccent(winner === -1 ? 0 : winner);
    $("#winner-text").textContent = winner === -1
      ? "Uafgjort!"
      : teamName(winner) + " vinder!";
    renderBoard($("#final-board"));
    show("gameover");
    state.started = false;
    clearSave();
    syncRoom("done");
  }

  $("#btn-play-again").addEventListener("click", function () {
    if (roomRef) { leaveRoom(true); return; }
    // Samme hold og samme tid — ordpuljen fyldes forfra.
    state.pool = [];
    state.teams[0].score = 0;
    state.teams[1].score = 0;
    state.active = 0;
    state.current = null;
    state.turnWords = [];
    state.turnPoints = 0;
    state.started = false;
    renderWords();
    show("words");
    save();
  });

  /* ---------- Navigation ---------- */

  $("#btn-new-game").addEventListener("click", function () {
    var keep = state.teams;
    state = newState();
    state.teams = keep.map(function (t) { return { name: t.name, score: 0 }; });
    clearSave();
    onlineMode = false;
    role = null;
    $("#btn-to-words").textContent = "Videre til ordene";
    fillSetupInputs();
    show("setup");
  });

  $("#btn-home").addEventListener("click", function () {
    if (roomRef) { leaveRoom(true); return; }
    show("home");
  });

  $("#btn-rules").addEventListener("click", function () { show("rules"); });
  $("#btn-rules-back").addEventListener("click", function () { show("home"); });

  document.querySelectorAll("[data-goto]").forEach(function (btn) {
    btn.addEventListener("click", function () { show(btn.dataset.goto); });
  });

  $("#btn-quit").addEventListener("click", function () {
    if (!confirm("Afslut spillet? Stillingen går tabt.")) return;
    if (roomRef) { clearSave(); leaveRoom(true); return; }
    clearSave();
    state = newState();
    fillSetupInputs();
    show("home");
  });


  /* ---------- Online: alle skriver ord fra hver sin telefon ----------
     Hele dette lag er valgfrit. Uden en db-runtime (fx på GitHub Pages)
     bliver `db` aldrig sat, knapperne vises aldrig, og spillet opfører sig
     præcis som på én delt telefon. */

  var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // uden O/0 og I/1
  var db = null;
  var onlineMode = false;   // værten har valgt "hver sin telefon"
  var role = null;          // "host" | "player"
  var roomCode = null;
  var roomRef = null;
  var unsubRoom = null;
  var unsubWords = null;
  var roomWords = [];       // {id, text, by} — kun til optælling og dubletcheck
  var pendingRoomWord = null;

  var ME = (function () {
    var id = null;
    try { id = localStorage.getItem("sig-ikke-ordet:client"); } catch (e) {}
    if (!id) {
      id = "c" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      try { localStorage.setItem("sig-ikke-ordet:client", id); } catch (e) {}
    }
    return id;
  })();

  // Kapabiliteten kommer først efter vores første kørsel — siden skal virke uden.
  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("db").then(function (d) {
      db = d || null;
      if (db && $("#online-entry")) $("#online-entry").hidden = false;
    }, function () { db = null; });
  }

  function randomCode() {
    var s = "";
    for (var i = 0; i < 4; i++) {
      s += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    }
    return s;
  }

  function cleanCode(raw) {
    return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  }

  function dbMessage(e) {
    var code = e && e.code;
    if (code === "quota_exceeded") return "Der er ikke plads til flere ord.";
    if (code === "resource_exhausted") return "Lidt for hurtigt — prøv igen om et øjeblik.";
    if (code === "revoked" || code === "not_granted") return "Forbindelsen til rummet er væk.";
    return "Det virkede ikke. Prøv igen.";
  }

  // Tager en ledig kode. acquire() sikrer, at to værter ikke tager den samme.
  async function createRoom() {
    for (var attempt = 0; attempt < 6; attempt++) {
      var code = randomCode();
      var ref = db.doc("rooms/" + code);
      var lease = await ref.acquire({ holder: ME, ttlMs: 5000 });
      if (!lease.acquired) continue;
      var snap = await ref.get();
      var body = snap.exists ? (snap.data() || {}) : {};
      if (body.host && body.status !== "done") continue; // koden er i brug
      await ref.set({
        status: "lobby",
        host: ME,
        turnSeconds: state.turnSeconds,
        active: 0,
        teams: [
          { name: teamName(0), score: 0 },
          { name: teamName(1), score: 0 }
        ],
        at: Date.now()
      });
      return { code: code, ref: ref };
    }
    return null;
  }

  async function joinRoom(code) {
    var ref = db.doc("rooms/" + code);
    var snap = await ref.get();
    var body = snap.exists ? (snap.data() || {}) : null;
    if (!body || !body.host) return { error: "Der er ikke noget rum med den kode." };
    if (body.status === "done") return { error: "Det spil er slut." };
    return { ref: ref, body: body };
  }

  function enterRoom(code, ref) {
    roomCode = code;
    roomRef = ref;
    roomWords = [];
    clearRoomPending();

    unsubRoom = ref.onSnapshot(function (snap) {
      if (snap.exists) applyRoomState(snap.data() || {});
    }, function () { /* terminal — lad skærmen stå, som den er */ });

    unsubWords = ref.collection("words").onSnapshot(function (qs) {
      roomWords = qs.docs.map(function (d) {
        var v = d.data() || {};
        return { id: d.id, text: String(v.text || ""), by: String(v.by || "") };
      });
      renderRoom();
    }, function () {});

    renderRoomChrome();
    renderRoom();
    show("room");
  }

  function leaveRoom(markDone) {
    if (markDone && roomRef && role === "host") {
      roomRef.update({ status: "done" }).catch(function () {});
    }
    if (unsubRoom) { unsubRoom(); unsubRoom = null; }
    if (unsubWords) { unsubWords(); unsubWords = null; }
    roomRef = null; roomCode = null; role = null;
    roomWords = []; onlineMode = false;
    clearRoomPending();
    show("home");
  }

  // Værten ejer selv spillet; kun deltagerne følger rummets tilstand.
  function applyRoomState(body) {
    if (role === "host") return;
    if (body.status === "playing" || body.status === "done") {
      renderWatch(body);
      if (state.screen !== "watch") show("watch");
    }
  }

  function renderWatch(body) {
    var teams = Array.isArray(body.teams) ? body.teams : [];
    for (var i = 0; i < 2; i++) {
      var t = teams[i] || {};
      state.teams[i].name = t.name || "Hold " + (i + 1);
      state.teams[i].score = Math.max(0, Number(t.score) || 0);
    }
    var done = body.status === "done";
    var active = body.active === 1 ? 1 : 0;

    if (done) {
      var a = state.teams[0].score, b = state.teams[1].score;
      var winner = a === b ? -1 : (a > b ? 0 : 1);
      setAccent(winner === -1 ? 0 : winner);
      $("#watch-status").textContent = "Spillet er slut";
      $("#watch-team").textContent = winner === -1 ? "Uafgjort!" : teamName(winner) + " vinder!";
      $("#watch-note").textContent = "Tak for kampen.";
    } else {
      setAccent(active);
      $("#watch-status").textContent = "Spillet er i gang";
      $("#watch-team").textContent = teamName(active);
      $("#watch-note").textContent = "Runden spilles på værtens telefon.";
    }
    renderBoard($("#watch-board"));
  }

  function renderRoomChrome() {
    var host = role === "host";
    $("#room-code").textContent = roomCode || "—";
    $("#btn-room-start").hidden = !host;
    $("#room-waiting").hidden = host;
    $("#room-hint").textContent = host
      ? "Læs koden op. De andre åbner samme link, taster koden og skriver ord."
      : "Skriv de ord ind, som de andre skal gætte. Ingen kan se dine ord.";
  }

  function renderRoom() {
    var mine = [], seen = {}, people = 0;
    for (var i = 0; i < roomWords.length; i++) {
      var w = roomWords[i];
      if (w.by === ME) mine.push(w);
      if (w.by && !seen[w.by]) { seen[w.by] = 1; people++; }
    }
    $("#room-total").textContent = String(roomWords.length);
    $("#room-people").textContent = people === 1 ? "1 person" : people + " personer";
    $("#room-mine").textContent = "dine: " + mine.length;
    $("#btn-room-start").disabled = roomWords.length === 0;

    var list = $("#room-list");
    list.innerHTML = "";
    mine.forEach(function (w) {
      var li = document.createElement("li");
      li.className = "chip is-own";
      var span = document.createElement("span");
      span.textContent = w.text;
      var del = document.createElement("button");
      del.type = "button";
      del.textContent = "×";
      del.setAttribute("aria-label", "Fjern " + w.text);
      del.addEventListener("click", function () {
        roomRef.collection("words").doc(w.id).delete().catch(function () {});
      });
      li.appendChild(span);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  // Samme foldning som lokalt, men uden at røbe HVILKET ord der ligner —
  // puljen er jo netop skjult for de andre.
  function findRoomClash(word) {
    var key = foldWord(word);
    var stem = stemWord(key);
    var near = null;
    for (var i = 0; i < roomWords.length; i++) {
      var okey = foldWord(roomWords[i].text);
      if (okey === key) return { exact: true };
      if (near) continue;
      if (stemWord(okey) === stem ||
          (key.length >= 5 && okey.length >= 5 && withinOneEdit(key, okey))) {
        near = { exact: false };
      }
    }
    return near;
  }

  function setRoomMsg(msg, kind) {
    var el = $("#room-msg");
    el.textContent = msg;
    el.classList.toggle("is-error", kind === "error");
    el.classList.toggle("is-warn", kind === "warn");
    clearTimeout(setRoomMsg.t);
    if (kind === "ok") {
      setRoomMsg.t = setTimeout(function () { el.textContent = ""; }, 2000);
    }
  }

  function clearRoomPending() {
    pendingRoomWord = null;
    var btn = $("#btn-room-anyway");
    if (btn) btn.hidden = true;
    var form = $("#room-form");
    if (form) form.classList.remove("is-warned", "is-rejected");
  }

  function addRoomWord(word) {
    roomRef.collection("words").add({ text: word, by: ME, at: Date.now() })
      .then(function () {
        $("#room-input").value = "";
        $("#room-input").focus();
        clearRoomPending();
        setRoomMsg("Tilføjet", "ok");
      })
      .catch(function (e) { setRoomMsg(dbMessage(e), "error"); });
  }

  // Ordene lever videre i værtens spil, så rummets ord ryddes ved start.
  function pruneWords(ids) {
    var i = 0;
    (function next() {
      if (i >= ids.length || !roomRef) return;
      var chunk = ids.slice(i, i + 5);
      i += 5;
      Promise.all(chunk.map(function (id) {
        return roomRef.collection("words").doc(id).delete().catch(function () {});
      })).then(next, function () {});
    })();
  }

  function startRoomGame() {
    var pool = roomWords.map(function (w) { return w.text; });
    if (!pool.length) return;
    var ids = roomWords.map(function (w) { return w.id; });

    state.pool = pool;
    state.teams[0].score = 0;
    state.teams[1].score = 0;
    state.active = 0;
    state.current = null;
    state.turnWords = [];
    state.turnPoints = 0;
    state.started = true;

    syncRoom("playing");
    pruneWords(ids);
    goReady();
  }

  // Deltagernes telefoner viser stillingen; én skrivning pr. tur, ikke pr. gæt.
  function syncRoom(status) {
    if (role !== "host" || !roomRef) return;
    roomRef.update({
      status: status,
      active: state.active,
      teams: [
        { name: teamName(0), score: state.teams[0].score },
        { name: teamName(1), score: state.teams[1].score }
      ]
    }).catch(function () {});
  }

  function hostCreateRoom(btn) {
    if (!db) return;
    btn.disabled = true;
    btn.textContent = "Opretter rum…";
    createRoom().then(function (res) {
      btn.disabled = false;
      btn.textContent = "Opret rum";
      if (!res) { alert("Kunne ikke oprette et rum lige nu. Prøv igen."); return; }
      enterRoom(res.code, res.ref);
    }, function (e) {
      btn.disabled = false;
      btn.textContent = "Opret rum";
      alert(dbMessage(e));
    });
  }

  /* ---------- Online: knapper ---------- */

  $("#btn-host-room").addEventListener("click", function () {
    onlineMode = true;
    role = "host";
    fillSetupInputs();
    $("#btn-to-words").textContent = "Opret rum";
    show("setup");
  });

  $("#btn-join-room").addEventListener("click", function () {
    role = "player";
    $("#join-code").value = "";
    $("#join-msg").textContent = "";
    $("#btn-do-join").disabled = true;
    show("join");
    $("#join-code").focus();
  });

  $("#join-code").addEventListener("input", function () {
    this.value = cleanCode(this.value);
    $("#btn-do-join").disabled = this.value.length !== 4;
    $("#join-msg").textContent = "";
  });

  $("#join-form").addEventListener("submit", function (e) {
    e.preventDefault();
    $("#btn-do-join").click();
  });

  $("#btn-do-join").addEventListener("click", function () {
    var code = cleanCode($("#join-code").value);
    if (code.length !== 4 || !db) return;
    var btn = this;
    btn.disabled = true;
    $("#join-msg").textContent = "Finder rummet…";
    $("#join-msg").classList.remove("is-error");
    joinRoom(code).then(function (res) {
      if (res.error) {
        $("#join-msg").textContent = res.error;
        $("#join-msg").classList.add("is-error");
        btn.disabled = false;
        return;
      }
      $("#join-msg").textContent = "";
      state.turnSeconds = Number(res.body.turnSeconds) || 60;
      enterRoom(code, res.ref);
    }, function (e) {
      $("#join-msg").textContent = dbMessage(e);
      $("#join-msg").classList.add("is-error");
      btn.disabled = false;
    });
  });

  $("#btn-leave-room").addEventListener("click", function () {
    var host = role === "host";
    if (host && !confirm("Luk rummet? Ordene går tabt.")) return;
    leaveRoom(host);
  });

  $("#btn-watch-leave").addEventListener("click", function () { leaveRoom(false); });

  $("#btn-room-start").addEventListener("click", startRoomGame);

  $("#room-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("#room-input");
    var word = normalize(input.value);
    if (!word || !roomRef) return;

    var clash = findRoomClash(word);

    if (clash && clash.exact) {
      clearRoomPending();
      $("#room-form").classList.add("is-rejected");
      setRoomMsg("Det ord er allerede i puljen", "error");
      input.select();
      return;
    }
    if (clash) {
      pendingRoomWord = word;
      $("#btn-room-anyway").hidden = false;
      $("#room-form").classList.add("is-warned");
      setRoomMsg("Ligner et ord, en anden allerede har skrevet.", "warn");
      input.select();
      return;
    }
    addRoomWord(word);
  });

  $("#btn-room-anyway").addEventListener("click", function () {
    if (pendingRoomWord) addRoomWord(pendingRoomWord);
  });

  $("#room-input").addEventListener("input", function () {
    if (pendingRoomWord) { clearRoomPending(); setRoomMsg("", null); }
    $("#room-form").classList.remove("is-rejected", "is-warned");
  });

  /* ---------- Genoptag ---------- */

  $("#btn-resume").addEventListener("click", function () {
    var s = load();
    if (isResumable(s)) resumeFrom(s);
  });

  // Telefoner smider baggrundsfaner væk uden varsel, så vi gemmer også,
  // når siden lægges væk — ikke kun ved skift af skærm.
  function saveOnLeave() {
    if (state.screen !== "home" && state.screen !== "gameover") save();
  }
  window.addEventListener("pagehide", saveOnLeave);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      saveOnLeave();
      return;
    }
    // Skifter man væk fra fanen midt i en runde, stopper vi ikke tiden —
    // men wake lock skal hentes igen, når man kommer tilbage.
    if (state.screen === "play") requestWakeLock();
  });

  fillSetupInputs();

  var savedGame = load();
  if (isResumable(savedGame)) {
    resumeFrom(savedGame);   // fortsætter af sig selv, hvor spillet slap
  } else {
    show("home");
  }
})();
