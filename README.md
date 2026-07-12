
# 🎯 Tracck

Tracck is an automated professional accomplishment tracker and ATS-optimized resume generator. It automatically syncs your activity across platforms like GitHub, X (Twitter), LinkedIn, and Figma, uses AI to extract meaningful achievements, and builds beautiful, ready-to-download resumes.

---

## 🚀 Features

- **Automated Social Sync**: Pulls data from external developer and social platforms on a recurring schedule.
- **AI-Powered Extraction**: Leverages **Google Gemini (`gemini-flash-latest`)** to filter the noise, detect genuine professional signals, and craft quantified resume bullets.
- **ATS-Optimized Resumes**: Programmatically builds and scores resumes in both PDF and DOCX formats.
- **Email Notifications**: Keep users in the loop when new achievements are detected using Resend.
- **Fully Decoupled Architecture**: Fast Next.js frontend with heavy processing offloaded to isolated background workers.

---

## 🏗️ Architecture

Tracck is split into three main deployment targets to ensure high performance and scalability:

1. **Frontend & API (Vercel)**
   - Next.js 14 App Router.
   - Handles OAuth, session management, and exposes standard REST API routes.
2. **Background Workers (Railway)**
   - Node.js 20 processes using **BullMQ** & **Upstash Redis**.
   - Handles asynchronous scraping, Gemini AI processing, and PDF/DOCX document generation.
3. **Database & Auth (Supabase)**
   - Managed PostgreSQL 15 database.
   - Supabase Auth integration.
   - Row-Level Security (RLS) and real-time database webhooks to enqueue jobs automatically.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **Job Queues**: [BullMQ](https://docs.bullmq.io/) + [Upstash Redis](https://upstash.com/)
- **AI Provider**: [Google Gemini API](https://aistudio.google.com/)
- **Emails**: [Resend](https://resend.com/)
- **Document Generation**: [Puppeteer](https://pptr.dev/) (PDF) + [docx-js](https://docx.js.org/) (DOCX)

---

## 📚 Documentation Reference

Detailed documentation can be found in the repository:

- [`system-design.md`](./system-design.md): In-depth system architecture and data flow diagrams.
- [`api-design.md`](./api-design.md): REST API contracts, error codes, and rate limiting.
- [`database-migrations.md`](./database-migrations.md): Core PostgreSQL schema, RLS policies, and triggers.
- [`env-secrets.md`](./env-secrets.md): Comprehensive list of environment variables and rotation policies.

---

## 💻 Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/0biken/traack.git
   cd traack
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local` and fill in the required keys. See `env-secrets.md` for specific details on acquiring keys for Gemini, Supabase, and OAuth providers.
   ```bash
   cp .env.example .env.local
   ```

3. **Set up the Database:**
   Run the 9 migration scripts located in the documentation (or via Supabase CLI) to set up your tables, webhooks, and RLS policies.

4. **Install Dependencies and Run:**
   *(Note: Codebase scaffolding in progress)*
   ```bash
   npm install
   npm run dev
   ```

## 📄 License

MIT License.
