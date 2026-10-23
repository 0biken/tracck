import type { RoleId } from '@tracck/shared';

// Dummy samples: the people, employers and figures are invented. They show tone and
// structure for the Classic red layout, nothing else.
export const CLASSIC_RED_EXAMPLES: Record<RoleId, string> = {
  dev: `Profile: Backend engineer with five years of payment APIs. Writes boring code on purpose, tests the edge cases first, and reads the logs before guessing.

Work experience
Senior Backend Engineer, Northwind Pay (2021 - present)
- Rebuilt the settlement queue in Go, cutting failed payouts from 3% to under 0.5%.
- Led a four-person on-call redesign that halved out-of-hours pages.
Backend Engineer, Lumen Labs (2019 - 2021)
- Added idempotent webhook handling for 40 merchant integrations.

Education
B.Sc. Computer Science, University of Lagos (2015 - 2019)

Skills: Go, PostgreSQL, Kafka, Terraform
Strengths: Ownership, Incident response, Clear writing`,

  devrel: `Profile: Developer advocate who turns complex APIs into workshops people finish. Equally at home on a conference stage and in a Discord thread.

Work experience
Developer Advocate, Brightgrid (2022 - present)
- Ran 24 developer workshops, with 70% of attendees shipping a working integration within a week.
- Wrote the quickstart guide that became the most-visited page on the docs site.
Community Lead, OpenQueue (2019 - 2022)
- Grew the community forum from 300 to 4,000 members and set up its moderation rota.

Education
B.A. English Literature, University of Ibadan (2014 - 2018)

Skills: TypeScript, Technical writing, Public speaking, Docker
Strengths: Patience, Communication, Empathy`,

  smm: `Profile: Social media manager for consumer brands. Plans content around what the audience already talks about, and reports on what moved sales.

Work experience
Social Media Manager, Halvard Foods (2021 - present)
- Grew Instagram followers from 12,000 to 58,000 in 18 months through a weekly recipe series.
- Ran four paid campaigns a quarter, bringing cost per order down by 22%.
Content Executive, Pulse Studio (2019 - 2021)
- Produced 150 short-form videos a year for six client accounts.

Education
BA Mass Communication, Covenant University (2015 - 2019)

Skills: Meta Ads, Canva, Hootsuite, Google Analytics
Strengths: Creativity, Deadline discipline, Audience insight`,

  va: `Profile: Virtual assistant for founders and small teams. Keeps inboxes, calendars and vendors in order, and catches the small things before they become problems.

Work experience
Virtual Assistant, Self-employed (2020 - present)
- Managed calendars and inboxes for three founders, handling about 150 emails a week.
- Set up a vendor payment process that cut late invoices to zero for two quarters.
Office Coordinator, Crestline Realty (2018 - 2020)
- Coordinated travel and events for a team of 30 across three offices.

Education
Diploma in Business Administration, Yaba College of Technology (2016 - 2018)

Skills: Notion, Google Workspace, Zoom, QuickBooks
Strengths: Organisation, Discretion, Follow-through`,

  ux: `Profile: Product designer who works closely with engineers. Starts from the user's task, tests early with real people, and cuts scope before it cuts quality.

Work experience
Product Designer, Kettle Health (2021 - present)
- Redesigned the appointment booking flow, lifting completion from 48% to 71%.
- Ran 14 usability sessions that changed the onboarding plan before launch.
UX Designer, Foldline (2019 - 2021)
- Built the design system used by six product teams, with 90 reusable components.

Education
B.Des Industrial Design, Obafemi Awolowo University (2014 - 2019)

Skills: Figma, User research, Prototyping, Design systems
Strengths: Empathy, Problem framing, Collaboration`,

  da: `Profile: Data analyst who answers business questions with clear numbers. Builds dashboards people use, and checks the data before trusting the chart.

Work experience
Data Analyst, Meridian Retail (2021 - present)
- Built a sales dashboard used daily by 40 store managers, replacing a weekly spreadsheet.
- Found a pricing error affecting 6% of SKUs, recovering an estimated monthly loss of 2.1M.
Junior Analyst, Sable Logistics (2019 - 2021)
- Automated a delivery-time report that had taken two days a month to compile.

Education
B.Sc. Statistics, University of Nigeria, Nsukka (2015 - 2019)

Skills: SQL, Python, Tableau, Excel
Strengths: Attention to detail, Clear communication, Curiosity`,
};
