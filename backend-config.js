// Backend til "hver sin telefon". Udfyldt = knapperne dukker op.
// Er alt tomt, kører spillet som almindeligt pass-the-phone.
//
// Firebase-nøglen herunder er MENT til at ligge offentligt i klienten —
// den identificerer projektet, den giver ikke adgang. Adgangen styres af
// reglerne i firestore.rules. (Det gælder kun web-API-nøglen; en
// service-account-nøgle må aldrig lægges i et repo.)

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDHLiVzyBDE1f1PEHgvb9VfwRvedCUfUeo",
  authDomain: "do-not-say-it.firebaseapp.com",
  projectId: "do-not-say-it",
  storageBucket: "do-not-say-it.firebasestorage.app",
  messagingSenderId: "569328560917",
  appId: "1:569328560917:web:19a8a7528c36233d75571c"
};

// Virker det ikke, er versionen her det første sted at kigge —
// se firebase.google.com/support/release-notes/js for den nyeste.
window.FIREBASE_SDK_VERSION = "10.12.2";

// Alternativ backend. Bruges kun, hvis FIREBASE_CONFIG står tom.
// Se supabase-setup.sql for skemaet.
window.SUPABASE_CONFIG = {
  url: "",
  anonKey: ""
};
