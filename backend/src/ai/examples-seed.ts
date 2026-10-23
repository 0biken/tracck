// Invented starter examples, one strong resume and one set of weak/strong rewrites per
// role. Replace or add to them through the `resume_examples` table; rows marked
// `synthetic` carry no rights questions. Run with `npm run ai:seed`.

import type { RoleId } from '@tracck/shared';
import type { GoodExample, Rewrite } from './examples';

interface Seed {
  good: GoodExample;
  rewrites: Rewrite[];
}

export const EXAMPLE_SEEDS: Record<RoleId, Seed> = {
  dev: {
    good: {
      summary: 'Backend developer who ships payment and messaging services in TypeScript and PostgreSQL, with a focus on reliability under load.',
      sections: [
        {
          heading: 'Projects',
          groups: [
            {
              title: 'Ledgerly: payments API',
              bullets: [
                'Built a double-entry ledger API in NestJS and PostgreSQL handling 12,000 transactions a day with idempotent retries.',
                'Cut p95 settlement time from 4.1s to 0.9s by moving reconciliation to a BullMQ worker.',
              ],
            },
          ],
        },
      ],
    },
    rewrites: [
      { before: 'Responsible for working on the backend.', after: 'Built the order-sync service in Node.js and PostgreSQL that keeps 3 storefronts consistent.', why: 'Names what was built, with what, and the scope.' },
      { before: 'Improved performance of the app.', after: 'Cut page load from 5.2s to 1.8s by caching product queries in Redis.', why: 'Gives the figure and the method.' },
    ],
  },
  devrel: {
    good: {
      summary: 'Community lead who grows developer audiences through talks, workshops and open-source programmes across West Africa.',
      sections: [
        {
          heading: 'Programmes',
          groups: [
            {
              title: 'Lagos Dev Meetup',
              bullets: [
                'Grew a monthly meetup from 40 to 380 attendees in 14 months by partnering with 6 universities.',
                'Ran 9 hands-on workshops on API design; 71% of attendees shipped a project within 30 days.',
              ],
            },
          ],
        },
      ],
    },
    rewrites: [
      { before: 'Organised community events.', after: 'Organised 11 events for 2,300 developers across 3 cities.', why: 'Audience size and count are the proof in this role.' },
      { before: 'Gave talks at conferences.', after: 'Gave 5 conference talks on API security to audiences of up to 600.', why: 'Topic and audience make it checkable.' },
    ],
  },
  smm: {
    good: {
      summary: 'Social media manager who turns campaigns into measurable audience and sales growth for consumer brands.',
      sections: [
        {
          heading: 'Results',
          groups: [
            {
              title: 'Freshbite (food delivery)',
              bullets: [
                'Grew Instagram followers from 8,000 to 41,000 in 6 months with a weekly short-video series.',
                'Raised campaign click-through from 1.2% to 3.4% by testing 5 creative formats in Meta Ads Manager.',
              ],
            },
          ],
        },
      ],
    },
    rewrites: [
      { before: 'Managed social media accounts.', after: 'Managed 4 brand accounts with 120,000 combined followers, posting 5 times a week.', why: 'Scope in numbers, not duties.' },
      { before: 'Increased engagement.', after: 'Lifted average engagement rate from 2.1% to 5.6% in one quarter.', why: 'Shows before, after and period.' },
    ],
  },
  va: {
    good: {
      summary: 'Virtual assistant who runs inboxes, calendars and back-office processes for founders, using automation to save hours every week.',
      sections: [
        {
          heading: 'Experience',
          groups: [
            {
              title: 'Executive assistant to a startup founder',
              bullets: [
                'Managed a calendar of 25 meetings a week across 3 time zones with zero double-bookings.',
                'Automated invoice follow-ups with Zapier and Google Sheets, saving about 6 hours a week.',
              ],
            },
          ],
        },
      ],
    },
    rewrites: [
      { before: 'Handled emails and scheduling.', after: 'Triaged 150 emails a day and scheduled 25 weekly meetings for two executives.', why: 'Volume shows trust and capacity.' },
      { before: 'Good at using tools.', after: 'Built a Notion and Zapier workflow that cut onboarding time from 3 days to 1.', why: 'Names the tools and the outcome.' },
    ],
  },
  ux: {
    good: {
      summary: 'Product designer who moves from research to shipped interfaces, with case studies that show the decision and the result.',
      sections: [
        {
          heading: 'Case studies',
          groups: [
            {
              title: 'Savings app onboarding redesign',
              bullets: [
                'Interviewed 14 users and mapped 3 drop-off points, then redesigned onboarding in Figma.',
                'Raised sign-up completion from 52% to 71% across 2,000 users in an A/B test.',
              ],
            },
          ],
        },
      ],
    },
    rewrites: [
      { before: 'Designed mobile screens.', after: 'Designed 18 mobile screens for a savings app after interviewing 14 users.', why: 'Process and scale, not just output.' },
      { before: 'Improved the user experience.', after: 'Cut checkout steps from 6 to 3, lifting completion by 19%.', why: 'The change and the outcome.' },
    ],
  },
  da: {
    good: {
      summary: 'Data analyst who turns messy operational data into decisions, using SQL and Python for analysis and dashboards.',
      sections: [
        {
          heading: 'Analysis work',
          groups: [
            {
              title: 'Churn analysis for a subscription app',
              bullets: [
                'Analysed 240,000 subscriber records in SQL and Python to find that users inactive for 10 days churn at 4x the rate.',
                'Built a Power BI dashboard used weekly by 3 teams, which led to a retention campaign that recovered 8% of at-risk users.',
              ],
            },
          ],
        },
      ],
    },
    rewrites: [
      { before: 'Worked with data and made reports.', after: 'Built 6 SQL reports on 1.2 million orders that the finance team uses to close each month.', why: 'Dataset size, tool and the user of the work.' },
      { before: 'Did data analysis.', after: 'Segmented 50,000 customers with k-means in Python, identifying a group worth 31% of revenue.', why: 'Method, size and insight.' },
    ],
  },
};
