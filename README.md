# Hematology Section Management Portal

A comprehensive internal management platform for the **Hematology Laboratory Section**, built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Project Overview

This portal provides end-to-end management for laboratory operations including employees, tasks, instruments, quality control, maintenance, TAT monitoring, training, documents, inventory, meetings, risk/CAPA, reports, and audit trails.

### Key Features

- **Role-Based Access Control** — 9 roles with granular permissions (UI + Supabase RLS)
- **Dynamic Dashboard** — Real-time KPIs, TAT indicators, and charts
- **Employee Management** — Profiles, FTE, evaluations, training, competencies
- **Task Management** — Kanban, table, and calendar views with approval workflow
- **Instrument & Maintenance** — Full lifecycle tracking with checklists
- **Quality Modules** — QC (Levey-Jennings), Critical Values, Sample Rejections, Corrected Results
- **TAT & Pending Samples** — Target tracking with visual breach alerts
- **Training & Documents** — Courses, quizzes, SOPs with version control
- **Inventory** — Stock tracking, expiry alerts, barcode support
- **Risk & CAPA** — Interactive risk matrix, incident reporting
- **Reports Center** — PDF/CSV export for all modules
- **Bilingual** — English (default) and Arabic with RTL support
- **Dark/Light Mode** — Theme switching
- **Demo Mode** — Full functionality without Supabase credentials

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| UI Components | shadcn/ui (Radix), Lucide Icons |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| PDF Export | jsPDF + jsPDF-AutoTable |
| i18n | next-intl |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| Testing | Vitest, Playwright |
| Deployment | Vercel + Supabase |

## Folder Structure

```
src/
├── app/[locale]/          # App Router with i18n
│   ├── (auth)/            # Login, password reset, unauthorized
│   └── (dashboard)/       # Protected module pages
├── components/
│   ├── ui/                # shadcn-style components
│   ├── layout/            # Sidebar, header, dashboard layout
│   ├── shared/            # DataTable, StatCard, EmptyState
│   └── providers/         # Auth, theme providers
├── lib/
│   ├── calculations/      # Evaluation, TAT, risk score logic
│   ├── mock/              # Demo mode data store
│   ├── permissions/       # RBAC definitions
│   ├── supabase/          # Supabase client setup
│   └── page-utils.ts      # Shared page helpers
├── messages/              # en.json, ar.json translations
├── types/                 # TypeScript interfaces
└── test/                  # Test setup
supabase/
├── migrations/            # SQL schema, RLS, seed data
└── config.toml            # Supabase CLI config
e2e/                       # Playwright E2E tests
```

## Installation

### Prerequisites

- Node.js 20+ and npm
- Supabase account (for production)
- Vercel account (for deployment)

### Quick Start (Demo Mode)

```bash
# Clone and install
npm install

# Copy environment file (demo mode enabled by default)
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000/en/login](http://localhost:3000/en/login)

### Demo Accounts

All demo accounts use password: `Demo@123456`

| Role | Email |
|------|-------|
| System Admin | admin@hematology.local |
| Lab Director | director@hematology.local |
| Lab Manager | manager@hematology.local |
| Head of Section | head@hematology.local |
| Section Supervisor | supervisor@hematology.local |
| Quality Link | quality@hematology.local |
| Senior Technologist | senior@hematology.local |
| Lab Technologist | tech@hematology.local |
| Viewer | viewer@hematology.local |

> **Note:** Demo passwords are for local development only. Never use these in production.

## Environment Variables

```env
# Supabase (required for production)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_MODE=true          # Set to false when Supabase is configured
NEXT_PUBLIC_DEFAULT_TIMEZONE=Asia/Riyadh
```

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy the Project URL and anon key to `.env.local`
3. Set `NEXT_PUBLIC_DEMO_MODE=false`

### 2. Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
# OR reset and apply all
supabase db reset
```

Migrations include:
- `001_initial_schema.sql` — All 40+ tables with constraints
- `002_rls_policies.sql` — Row Level Security for all roles
- `003_seed_data.sql` — 12 employees, 3 instruments, sample data

### 3. Create Demo Auth Users

After running migrations, create auth users in Supabase Dashboard:

1. Go to **Authentication > Users > Add User**
2. Create users matching seed data emails (e.g., `abdullah@hematology.local`)
3. Set secure passwords (not stored in repository)
4. The `handle_new_user()` trigger auto-creates profiles

### Creating First Admin

```sql
-- After creating auth user via dashboard, assign admin role:
UPDATE profiles SET role = 'system_admin'
WHERE email = 'your-admin@email.com';
```

## Testing

```bash
# Unit tests (calculations, permissions)
npm test

# Watch mode
npm run test:watch

# E2E tests (requires dev server)
npm run test:e2e
```

### Test Coverage

- Evaluation score calculations (weights, ratings)
- TAT calculations and KPI status
- Risk score matrix
- Role-based permission checks
- E2E: Login flow, dashboard, navigation

## Deployment

### Vercel (Frontend)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables from `.env.example`
4. Deploy

### Supabase (Backend)

Already hosted — ensure migrations are applied and RLS is enabled.

## Security Notes

- All sensitive tables have Row Level Security enabled
- Patient IDs are masked in dashboard views
- Audit log is append-only (no user modification)
- No real patient data in seed/demo data
- Demo passwords are NOT stored in the repository
- File uploads validate type and size (when Supabase Storage is configured)
- Input validation on both client (Zod) and server (RLS policies)

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Demo Mode with localStorage | Allows full evaluation without Supabase setup |
| next-intl for i18n | Native App Router support with RTL |
| Mock store mirrors DB schema | Easy migration path to Supabase |
| Asia/Riyadh timezone | Default per requirements |
| jsPDF for reports | Stable, client-side PDF generation |
| Evaluation weights: 40/30/10/10/10 | As specified in requirements |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Login fails in demo mode | Ensure `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` |
| Arabic layout broken | Check `dir="rtl"` is set; clear browser cache |
| Build errors | Run `npm run build` and check TypeScript output |
| Supabase auth not working | Verify URL/key; set `NEXT_PUBLIC_DEMO_MODE=false` |
| Empty dashboard | Demo data loads on first visit; clear localStorage if corrupted |

## Future Improvements

- [ ] Email notifications (infrastructure prepared)
- [ ] PWA support (service worker, manifest)
- [ ] Real-time updates via Supabase subscriptions
- [ ] Barcode scanner integration for inventory
- [ ] Advanced quiz builder with image upload
- [ ] Calendar view for tasks and meetings
- [ ] Two-factor authentication
- [ ] Automated backup scheduling

## License

Internal use only — Hematology Section Management Portal.
