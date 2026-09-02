// Udfyld disse to felter for at slå "hver sin telefon" til på GitHub Pages.
//
//   1. Opret et gratis projekt på supabase.com
//   2. Kør indholdet af supabase-setup.sql i projektets SQL Editor
//   3. Project Settings -> API: kopier "Project URL" og den offentlige
//      "anon public"-nøgle herned
//
// Begge værdier er offentlige og skal ligge i klienten — det er sådan,
// Supabase er tænkt. Adgangen styres af reglerne i supabase-setup.sql,
// ikke af nøglen. Læg ALDRIG "service_role"-nøglen her.
//
// Står felterne tomme, findes knapperne til rum slet ikke, og spillet
// kører som almindeligt pass-the-phone.

window.SUPABASE_CONFIG = {
  url: "",
  anonKey: ""
};
