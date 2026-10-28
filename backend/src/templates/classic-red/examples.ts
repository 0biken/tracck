import type { RoleId, TemplateSectionId } from '@tracck/shared';
import type { SampleLine } from '../template';

// Dummy samples: the people, employers and figures are invented. Each line says what it does
// for the reader, so the writer copies the move and never the facts.
const line = (section: TemplateSectionId, text: string, intent: string): SampleLine => ({ section, text, intent });

export const CLASSIC_RED_SAMPLES: Record<RoleId, SampleLine[]> = {
  dev: [
    line('profile', 'Backend engineer with five years of payment APIs. Writes boring code on purpose, tests the edge cases first, and reads the logs before guessing.', 'Names the specialism and two habits that predict reliability, in one breath, so the reader knows what kind of engineer this is.'),
    line('experience', 'Senior Backend Engineer, Northwind Pay (2021 - present)', 'Gives title, employer and span, which the reader scans first to judge seniority and recency.'),
    line('experience', 'Rebuilt the settlement queue in Go, cutting failed payouts from 3% to under 0.5%.', 'Opens with the action and the system it touched, then a before and after figure that proves the work mattered.'),
    line('experience', 'Led a four-person on-call redesign that halved out-of-hours pages.', 'Shows leadership through a measurable change in how the team works, not through a job title.'),
    line('experience', 'Backend Engineer, Lumen Labs (2019 - 2021)', 'Shows the earlier step of the same career, so the reader sees growth rather than a single job.'),
    line('experience', 'Added idempotent webhook handling for 40 merchant integrations.', 'Names a technical pattern and the breadth of its use, so the reader sees reach as well as depth.'),
    line('education', 'B.Sc. Computer Science, University of Lagos (2015 - 2019)', 'States the degree, institution and span, and nothing more, because the work above carries the weight.'),
    line('skills', 'Go, PostgreSQL, Kafka, Terraform', 'Lists the tools the work above already proved, so the list is checkable and never padded.'),
    line('strengths', 'Ownership, Incident response, Clear writing', 'Lists traits the work shows, not tools, so this section adds what the reader cannot see in the bullets.'),
  ],
  devrel: [
    line('profile', 'Developer advocate who turns complex APIs into workshops people finish. Equally at home on a conference stage and in a Discord thread.', 'Positions the person by the result they create for developers: people who finish the workshop.'),
    line('experience', 'Developer Advocate, Brightgrid (2022 - present)', 'Gives title, employer and span so the reader sees the current role first.'),
    line('experience', 'Ran 24 developer workshops, with 70% of attendees shipping a working integration within a week.', 'Counts the activity, then gives the outcome that the activity produced, which is what this role is judged on.'),
    line('experience', 'Wrote the quickstart guide that became the most-visited page on the docs site.', 'Shows lasting impact through a piece of writing, which is evidence the reader can picture.'),
    line('experience', 'Community Lead, OpenQueue (2019 - 2022)', 'Shows the earlier community role, so the reader sees a sustained pattern of community work.'),
    line('experience', 'Grew the community forum from 300 to 4,000 members and set up its moderation rota.', 'Pairs growth with the operational work that kept the growth healthy.'),
    line('education', 'B.A. English Literature, University of Ibadan (2014 - 2018)', 'Gives the degree briefly; the reader is looking for writing and communication ability, which the bullets show.'),
    line('skills', 'TypeScript, Technical writing, Public speaking, Docker', 'Mixes technical and communication skills, because the role needs both, and each one is something the work used.'),
    line('strengths', 'Patience, Communication, Empathy', 'Names the traits that make teaching work, the qualities a reader cannot infer from a list of tools.'),
  ],
  smm: [
    line('profile', 'Social media manager for consumer brands. Plans content around what the audience already talks about, and reports on what moved sales.', 'Positions the person around audience insight and accountability for sales, the two things brand teams hire for.'),
    line('experience', 'Social Media Manager, Halvard Foods (2021 - present)', 'Gives title, employer and span so the current brand and role come first.'),
    line('experience', 'Grew Instagram followers from 12,000 to 58,000 in 18 months through a weekly recipe series.', 'States the audience growth with its timeframe and the repeatable format behind it.'),
    line('experience', 'Ran four paid campaigns a quarter, bringing cost per order down by 22%.', 'Links paid activity to a cost result, which is the number a brand manager is measured on.'),
    line('experience', 'Content Executive, Pulse Studio (2019 - 2021)', 'Shows the earlier role that built the production skill behind the current one.'),
    line('experience', 'Produced 150 short-form videos a year for six client accounts.', 'Shows volume and client range, which proves the person can deliver to a schedule.'),
    line('education', 'BA Mass Communication, Covenant University (2015 - 2019)', 'Gives the degree briefly, since the field of study matches the work without needing explanation.'),
    line('skills', 'Meta Ads, Canva, Hootsuite, Google Analytics', 'Lists the platforms and tools the campaigns and reports above actually used.'),
    line('strengths', 'Creativity, Deadline discipline, Audience insight', 'Names the traits behind the results: ideas that land, delivery on time, and knowing the audience.'),
  ],
  va: [
    line('profile', 'Virtual assistant for founders and small teams. Keeps inboxes, calendars and vendors in order, and catches the small things before they become problems.', 'Positions the person by reliability and foresight, the two qualities a founder cannot easily delegate.'),
    line('experience', 'Virtual Assistant, Self-employed (2020 - present)', 'Gives title and span so the reader sees the current arrangement first.'),
    line('experience', 'Managed calendars and inboxes for three founders, handling about 150 emails a week.', 'Shows the load carried for several people, which is the scale a founder needs to trust.'),
    line('experience', 'Set up a vendor payment process that cut late invoices to zero for two quarters.', 'Shows a process the person designed, with an outcome that a founder can see in their own accounts.'),
    line('experience', 'Office Coordinator, Crestline Realty (2018 - 2020)', 'Shows the earlier office role, which explains the operational habits behind the current work.'),
    line('experience', 'Coordinated travel and events for a team of 30 across three offices.', 'Gives the size and spread of the coordination, which proves the person can run logistics at scale.'),
    line('education', 'Diploma in Business Administration, Yaba College of Technology (2016 - 2018)', 'Gives the qualification briefly, because the reader is looking for administrative judgement shown in the work.'),
    line('skills', 'Notion, Google Workspace, Zoom, QuickBooks', 'Lists the tools used day to day, which is what an employer checks first.'),
    line('strengths', 'Organisation, Discretion, Follow-through', 'Names the traits of a trusted assistant, the things that cannot be listed as tools.'),
  ],
  ux: [
    line('profile', 'Product designer who works closely with engineers. Starts from the user\'s task, tests early with real people, and cuts scope before it cuts quality.', 'Positions the person by the way they work with others, which is what design teams weigh most after craft.'),
    line('experience', 'Product Designer, Kettle Health (2021 - present)', 'Gives title, employer and span so the reader sees the current product and role first.'),
    line('experience', 'Redesigned the appointment booking flow, lifting completion from 48% to 71%.', 'Starts from the design problem and ends with the completion rate, the measure a product team reports on.'),
    line('experience', 'Ran 14 usability sessions that changed the onboarding plan before launch.', 'Shows research that changed a decision, which is more convincing than research that only happened.'),
    line('experience', 'UX Designer, Foldline (2019 - 2021)', 'Shows the earlier design role, where the systems skill behind the current work was built.'),
    line('experience', 'Built the design system used by six product teams, with 90 reusable components.', 'Shows work that multiplies across teams, which signals senior systems thinking.'),
    line('education', 'B.Des Industrial Design, Obafemi Awolowo University (2014 - 2019)', 'Gives the design qualification briefly, since the portfolio of work is what the reader will examine.'),
    line('skills', 'Figma, User research, Prototyping, Design systems', 'Lists the tools and methods the case studies above used, so each one can be checked.'),
    line('strengths', 'Empathy, Problem framing, Collaboration', 'Names the traits that make design work with engineers and users, which the bullets demonstrate.'),
  ],
  da: [
    line('profile', 'Data analyst who answers business questions with clear numbers. Builds dashboards people use, and checks the data before trusting the chart.', 'Positions the person by trust in the numbers, the thing that decides whether a dashboard gets used.'),
    line('experience', 'Data Analyst, Meridian Retail (2021 - present)', 'Gives title, employer and span so the current role and sector come first.'),
    line('experience', 'Built a sales dashboard used daily by 40 store managers, replacing a weekly spreadsheet.', 'Shows adoption, not just delivery: the dashboard is valuable because people use it every day.'),
    line('experience', 'Found a pricing error affecting 6% of SKUs, recovering an estimated monthly loss of 2.1M.', 'Shows checking that found money, which is the strongest proof of the careful habit in the profile.'),
    line('experience', 'Junior Analyst, Sable Logistics (2019 - 2021)', 'Shows the earlier role where the automation habit started.'),
    line('experience', 'Automated a delivery-time report that had taken two days a month to compile.', 'Shows time given back to the business, stated in the units the business would count.'),
    line('education', 'B.Sc. Statistics, University of Nigeria, Nsukka (2015 - 2019)', 'Gives the degree briefly, since statistical training is shown by the analysis in the work.'),
    line('skills', 'SQL, Python, Tableau, Excel', 'Lists the tools the analysis and dashboards used, in the order a hiring manager scans them.'),
    line('strengths', 'Attention to detail, Clear communication, Curiosity', 'Names the traits behind catching the pricing error and explaining the numbers to non-analysts.'),
  ],
};
