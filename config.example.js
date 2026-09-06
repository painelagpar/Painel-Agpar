// ============================================================
// Painel do AGAR — Configuracao de conexao com o Supabase
// ------------------------------------------------------------
// COMO USAR:
//   1. Faca uma copia deste arquivo com o nome "config.js"
//      (no mesmo lugar, ao lado deste). O app carrega "config.js".
//   2. No painel do Supabase, va em:
//        Project Settings  >  API
//      e copie dois valores:
//        - "Project URL"        -> cole em SUPABASE_URL
//        - "anon" "public" key  -> cole em SUPABASE_ANON_KEY
//   3. Salve. Pronto.
//
// A chave "anon" pode ficar no navegador com seguranca: quem manda
// no acesso e o login (RLS no banco). NAO use aqui a "service_role".
// ============================================================

window.AGAR_CONFIG = {
  SUPABASE_URL: "COLE_AQUI_A_PROJECT_URL",       // ex.: https://xxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: "COLE_AQUI_A_ANON_KEY"      // ex.: eyJhbGciOi... (chave publica "anon")
};
