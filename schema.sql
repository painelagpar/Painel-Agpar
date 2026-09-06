-- ============================================================
-- Painel do AGAR — Esquema do banco de dados (Supabase / Postgres)
-- ------------------------------------------------------------
-- Como usar:
--   1. Crie um projeto no Supabase (https://supabase.com).
--   2. Abra "SQL Editor" > "New query".
--   3. Cole TODO o conteudo deste arquivo e clique em "Run".
--
-- Este script cria as 3 tabelas, ativa a seguranca (RLS) e ja
-- insere as listas iniciais de comorbidades, queixas e reclamacoes
-- do contexto do AGAR (Ambulatorio de Gestacao de Alto Risco).
--
-- Rodar de novo e seguro: nao duplica as tabelas nem o seed inicial.
-- (Os comentarios estao sem acento de proposito; os DADOS exibidos
--  para a equipe estao com acentuacao completa, como deve ser.)
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABELAS
-- ------------------------------------------------------------

-- Listas configuraveis (comorbidades, queixas, reclamacoes).
-- A "definicao" e o texto que aparece no icone de informacao (i).
create table if not exists agar_config (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('comorbidade','queixa','reclamacao')),
  nome       text not null,
  definicao  text not null default '',
  created_at timestamptz not null default now()
);

-- Registro de atendimento = marcacao de OCORRENCIA.
-- NUNCA identifica a paciente. Guarda apenas o que foi observado.
create table if not exists agar_registros (
  id            uuid primary key default gen_random_uuid(),
  profissional  text not null,
  data          date not null,
  comorbidades  jsonb not null default '[]'::jsonb,   -- ex.: ["DMG","HAS cronica"]
  queixas       jsonb not null default '[]'::jsonb,   -- ex.: ["Azia / pirose"]
  reclamacoes   jsonb not null default '[]'::jsonb,   -- ex.: [{"nome":"Tempo de espera","alvo":"Geral"}]
  created_at    timestamptz not null default now()
);

-- Faltometro: faltas por dia e turno, com absenteismo opcional.
create table if not exists agar_faltas (
  id          uuid primary key default gen_random_uuid(),
  data        date not null,
  turno       text not null check (turno in ('Manhã','Tarde')),
  agendados   integer not null default 0,
  faltas      integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Indices para os filtros de periodo do dashboard.
create index if not exists idx_agar_registros_data on agar_registros (data);
create index if not exists idx_agar_faltas_data    on agar_faltas (data);
create index if not exists idx_agar_config_tipo    on agar_config (tipo);

-- ------------------------------------------------------------
-- 2. SEGURANCA (RLS)
-- ------------------------------------------------------------
-- O painel usa um LOGIN UNICO compartilhado pela equipe do AGAR.
-- Regra: quem NAO estiver logado (anon) nao le nem escreve nada;
--        quem estiver logado (authenticated) tem acesso total.
-- Como nao ha dado de paciente, o login unico e suficiente.

alter table agar_config    enable row level security;
alter table agar_registros enable row level security;
alter table agar_faltas    enable row level security;

drop policy if exists "agar_config_auth_all" on agar_config;
create policy "agar_config_auth_all" on agar_config
  for all to authenticated using (true) with check (true);

drop policy if exists "agar_registros_auth_all" on agar_registros;
create policy "agar_registros_auth_all" on agar_registros
  for all to authenticated using (true) with check (true);

drop policy if exists "agar_faltas_auth_all" on agar_faltas;
create policy "agar_faltas_auth_all" on agar_faltas
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- 3. SEED — listas iniciais do contexto AGAR
-- ------------------------------------------------------------
-- So insere se agar_config estiver vazia (nao duplica em re-execucao).

insert into agar_config (tipo, nome, definicao)
select v.tipo, v.nome, v.definicao
from (values
  -- Comorbidades / condicoes
  ('comorbidade','HAS crônica','Hipertensão arterial já presente antes da gestação ou diagnosticada antes de 20 semanas.'),
  ('comorbidade','HAS gestacional','Pressão alta que surge após 20 semanas, sem proteinúria.'),
  ('comorbidade','Pré-eclâmpsia','Hipertensão após 20 semanas associada a proteinúria ou lesão de órgão-alvo.'),
  ('comorbidade','DMG','Diabetes Mellitus Gestacional: diabetes diagnosticado durante a gestação.'),
  ('comorbidade','Diabetes prévia','Diabetes (tipo 1 ou 2) já existente antes de engravidar.'),
  ('comorbidade','Obesidade','IMC pré-gestacional maior ou igual a 30 kg/m².'),
  ('comorbidade','Sobrepeso','IMC pré-gestacional entre 25 e 29,9 kg/m².'),
  ('comorbidade','Hipotireoidismo','Baixa produção de hormônios da tireoide; exige controle na gestação.'),
  ('comorbidade','ITU de repetição','Infecções urinárias recorrentes durante a gestação.'),
  ('comorbidade','Tabagismo','Uso de cigarro/tabaco durante a gestação.'),
  ('comorbidade','Anemia','Hemoglobina abaixo do valor de referência para a gestação.'),
  ('comorbidade','Adensamento domiciliar','Muitas pessoas morando na mesma casa (ex.: mais de 5), fator de vulnerabilidade social.'),
  -- Queixas
  ('queixa','Náuseas / vômitos','Enjoos, comuns principalmente no 1º trimestre.'),
  ('queixa','Azia / pirose','Queimação retroesternal, frequente no 3º trimestre.'),
  ('queixa','Constipação','Dificuldade ou infrequência para evacuar.'),
  ('queixa','Insônia / sono ruim','Dificuldade para dormir ou sono não reparador.'),
  ('queixa','Edema','Inchaço, geralmente em membros inferiores.'),
  ('queixa','Cefaleia','Dor de cabeça; atenção se associada a picos de PA.'),
  ('queixa','Ganho de peso elevado','Ganho acima do recomendado para a IG e IMC.'),
  ('queixa','Ganho de peso insuficiente','Ganho abaixo do recomendado para a IG e IMC.'),
  ('queixa','Inapetência','Falta de apetite ou redução da ingestão.'),
  ('queixa','Ansiedade','Queixa emocional relatada no atendimento.'),
  -- Reclamacoes / sugestoes
  ('reclamacao','Conduta de profissional','Reclamação sobre o atendimento ou postura de um profissional.'),
  ('reclamacao','Temperatura da sala','Ambiente muito quente ou muito frio.'),
  ('reclamacao','Tempo de espera','Demora para ser atendida.'),
  ('reclamacao','Limpeza','Higiene e limpeza do espaço.'),
  ('reclamacao','Acolhimento','Recepção e acolhimento na chegada.'),
  ('reclamacao','Falta de informação','Orientações pouco claras ou insuficientes.')
) as v(tipo, nome, definicao)
where not exists (select 1 from agar_config);

-- ============================================================
-- Fim do schema. Proximo passo: criar o usuario de login unico
-- em Authentication > Users > Add user (email + senha). Veja o README.
-- ============================================================
