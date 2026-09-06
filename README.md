# Painel do AGPAR

Aplicativo web para **metrificar os atendimentos** do AGPAR (Ambulatório de
Gestantes e Puérperas de Alto Risco). Registra **ocorrências** (nunca identifica a paciente),
faltas por turno e monta um dashboard com gráficos, boletim de texto e
exportação em PDF.

É um site estático (HTML + JavaScript, sem framework) que guarda os dados no
**Supabase** (banco de dados + login). Foi feito de propósito com tecnologia
padrão, para ser **100% seu** e fácil de qualquer profissional de TI manter
depois. Tudo o que ele usa tem plano gratuito.

## O que tem dentro

| Aba | O que faz |
|-----|-----------|
| **Registro** | Marca um atendimento: profissional + data + comorbidades/queixas (busca com autocomplete e ícone ⓘ com a definição) + reclamações opcionais com alvo. Tem "Salvar e novo", atalhos das mais usadas e contador do dia. |
| **Faltômetro** | Faltas por dia e turno (manhã/tarde), com cálculo da taxa de absenteísmo. |
| **Configurações** | Cadastrar/editar/excluir comorbidade, queixa ou reclamação (Nome + Definição, que vira o texto do ⓘ). |
| **Dashboard** | Filtros por período e profissional, gráfico em barra ou pizza, top comorbidades/queixas, incidência mês a mês, reclamações e faltas, boletim de texto automático (com botão copiar) e botão Baixar PDF. |

## Arquivos do projeto

```
painel-agar/
├── index.html          → a página
├── app.js              → a lógica do app
├── styles.css          → o visual
├── config.example.js   → modelo da configuração (copie para config.js)
├── schema.sql          → cria as tabelas no Supabase (rode uma vez)
├── logo.png            → (opcional) coloque aqui o logo do AGPAR
└── README.md           → este arquivo
```

---

# Passo a passo para colocar no ar

Leva ~15 minutos. Não precisa saber programar. Faça na ordem.

## 1. Criar o projeto no Supabase (o banco de dados)

1. Acesse **https://supabase.com** e crie uma conta (pode entrar com o Google).
2. Clique em **New project**.
3. Dê um nome (ex.: `painel-agar`), crie uma **Database Password** (anote e
   guarde — é diferente da senha de login do painel) e escolha a região
   **South America (São Paulo)**.
4. Clique em **Create new project** e espere ~2 minutos até ficar pronto.

## 2. Criar as tabelas (rodar o schema.sql)

1. No menu à esquerda, abra **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo **`schema.sql`** deste projeto, copie **todo** o conteúdo e
   cole na caixa.
4. Clique em **Run** (ou aperte Ctrl+Enter). Deve aparecer "Success".
   Isso cria as 3 tabelas e já preenche as listas iniciais de comorbidades,
   queixas e reclamações do AGPAR.

## 3. Pegar a URL e a chave, e colar na configuração

1. No menu à esquerda, abra **Project Settings** (o ícone de engrenagem) → **API**.
2. Copie dois valores:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - Em "Project API keys", a chave **`anon` `public`** (uma sequência longa).
   > Nunca use a chave `service_role`. Só a `anon` `public`.
3. Na pasta do projeto, faça uma **cópia** do arquivo `config.example.js` e
   renomeie a cópia para **`config.js`**.
4. Abra `config.js` num editor de texto e cole os dois valores nos lugares
   indicados (dentro das aspas). Salve.

## 4. Criar o usuário de login (o acesso único da equipe)

O painel usa **um login só**, compartilhado pela equipe.

1. No Supabase, menu à esquerda → **Authentication** → **Users**.
2. Clique em **Add user** → **Create new user**.
3. Preencha um **e-mail** (pode ser um de equipe, ex.: `equipe@agar.local`) e
   uma **senha** à sua escolha. Marque **Auto Confirm User** (para não precisar
   confirmar por e-mail).
4. Clique em **Create user**.

Esse e-mail e essa senha são o que a equipe vai digitar para entrar no painel.
Para trocar a senha depois, é nessa mesma tela.

## 5. Subir o site no ar (grátis)

Qualquer um destes serviços hospeda de graça. O mais simples é a **Netlify Drop**:

**Opção A — Netlify (arrastar e soltar, sem conta técnica):**
1. Acesse **https://app.netlify.com/drop**.
2. Arraste a **pasta inteira** `painel-agar` (já com o `config.js` preenchido)
   para a área indicada.
3. Em segundos ele gera um link `https://algo.netlify.app`. Pronto, está no ar.

**Opção B — Vercel:**
1. Suba a pasta para um repositório no GitHub (este projeto já é versionado).
2. Em **https://vercel.com**, clique em **Add New → Project**, importe o
   repositório e clique em **Deploy**. Não precisa configurar mais nada.
   > Lembre: o `config.js` fica de fora do Git (por segurança). Ou você o
   > adiciona manualmente no deploy, ou usa a Netlify Drop da Opção A, que já
   > envia o `config.js` junto.

**Opção C — GitHub Pages:** em Settings → Pages do repositório, aponte para a
branch e a pasta. Também funciona por ser um site estático.

## 6. Usar

Abra o link, digite o e-mail e a senha criados no passo 4, e comece a registrar.
Todos os que tiverem o link e a senha veem os mesmos dados (é um painel de
equipe, sem dado de paciente).

---

## Logo do AGPAR

Quando tiver o logo, salve como **`logo.png`** dentro da pasta do projeto e suba
de novo. Ele aparece na tela de login e no topo do painel. Enquanto não existir,
o espaço simplesmente fica vazio, sem quebrar nada.

## Perguntas comuns

- **Isso custa quanto?** No plano gratuito do Supabase e da Netlify/Vercel, zero
  para o volume de um ambulatório. Se um dia crescer muito, dá para escalar.
- **É meu mesmo?** Sim. Conta do Supabase e do serviço de hospedagem são suas.
  O código é padrão e sem travas — qualquer profissional de TI assume.
- **Os dados têm paciente?** Não. Por decisão de projeto, só se registra a
  ocorrência (o que foi observado), nunca quem é a paciente.
- **Como troco a senha de acesso?** Supabase → Authentication → Users → o
  usuário → resetar/definir senha.
- **Aparece "Configuração ausente" na tela de login.** Faltou criar o
  `config.js` (passo 3) ou os valores estão errados/incompletos.

## Para quem for manter (TI)

- Front-end estático: `index.html`, `app.js` (ES module), `styles.css`.
  Dependências por CDN: `@supabase/supabase-js` (esm.sh) e Chart.js (jsDelivr).
- Backend: Supabase (Postgres + Auth). Esquema versionado em `schema.sql`, com
  RLS ativo — `anon` não acessa nada, `authenticated` tem acesso total (login
  único, sem dado sensível de paciente).
- Tabelas com prefixo `agar_`: `agar_config`, `agar_registros`, `agar_faltas`.
- Configuração por `config.js` (`window.AGAR_CONFIG`), fora do versionamento.
