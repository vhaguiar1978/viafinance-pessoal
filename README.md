# ViaFinance Pessoal

Sistema completo de controle financeiro pessoal (Next.js 16 + Prisma + PostgreSQL).

## 🚀 Deploy em produção (Vercel + Supabase)

Passo a passo pra subir o sistema online com URL permanente, grátis.

### 1. Criar conta no Supabase (banco PostgreSQL)

1. Acesse https://supabase.com → **Start your project**
2. Login com **GitHub** (mais rápido) ou email
3. Clica em **New project**:
   - **Name**: `viafinance`
   - **Database password**: gera uma forte e **anota** (vai usar)
   - **Region**: `South America (São Paulo)` (mais rápido pro BR)
4. Espera ~2 minutos pro banco subir
5. Em **Settings → Database → Connection string**, copia:
   - **Transaction pooler** (porta 6543) → será o `DATABASE_URL`
   - **Session pooler** ou **Direct connection** (porta 5432) → será o `DIRECT_DATABASE_URL`

### 2. Criar repositório no GitHub

1. https://github.com/new
2. Nome: `viafinance-pessoal` (ou outro)
3. Privado é o recomendado
4. **NÃO** inicialize com README/license (já temos)
5. Copia a URL do tipo `https://github.com/seu-user/viafinance-pessoal.git`

### 3. Subir o código pro GitHub

No terminal, dentro da pasta do projeto:

```bash
git remote add origin https://github.com/SEU-USER/viafinance-pessoal.git
git branch -M main
git push -u origin main
```

(o `git init` e o commit inicial já foram feitos)

### 4. Criar projeto na Vercel

1. https://vercel.com → **Sign Up** com GitHub
2. **Add New → Project**
3. Importa o repositório que acabou de criar
4. **Framework Preset**: Next.js (detecta sozinho)
5. **Environment Variables** — adiciona:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | Connection string do Supabase (transaction pooler, porta 6543) |
| `DIRECT_DATABASE_URL` | Direct connection do Supabase (porta 5432) |
| `AUTH_SECRET` | Token longo aleatório |
| `AUTH_TRUST_HOST` | `true` |

6. Clica **Deploy** — leva ~3 minutos

### 5. Rodar migrations no banco

Depois do primeiro deploy, ainda falta criar as tabelas no Supabase:

**Localmente** (recomendado):
```bash
# Cria um .env apontando pro Supabase (igual ao .env.example)
npx prisma migrate deploy
```

### 6. Importar seus dados (do backup `data-backup.json`)

Com o banco já migrado e o `.env` apontando pro Supabase:

```bash
node scripts/import-data.mjs
```

Vai trazer todos os usuários, contas, lançamentos etc. pro Postgres.

### 7. URL final

A Vercel te dá uma URL tipo `https://viafinance-xxx.vercel.app` que funciona 24/7.

## 🛠️ Rodar localmente (dev)

Funciona contra o mesmo banco do Supabase:

```bash
cp .env.example .env
# Edita .env com as URLs do Supabase + AUTH_SECRET
npm install
npm run dev
```

Acessa http://localhost:3000

## 📂 Scripts úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda em modo desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:migrate` | Aplica migrations no banco |
| `npm run db:export` | Exporta dados pra `data-backup.json` |
| `npm run db:import` | Importa `data-backup.json` no banco |

## 📦 Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Prisma + PostgreSQL
- NextAuth (Auth.js v5)
- Recharts
- unpdf (parser de PDF)
