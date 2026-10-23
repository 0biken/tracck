// What Tracck says by email. Short, plain, and always with the one link that matters.

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

type Data = Record<string, unknown>;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

const str = (data: Data, key: string, fallback = '') => (typeof data[key] === 'string' ? (data[key] as string) : fallback);

function layout(body: string[], action: { label: string; url: string } | null): Pick<Rendered, 'text' | 'html'> {
  const text = [...body, ...(action ? ['', `${action.label}: ${action.url}`] : []), '', 'Tracck'].join('\n');
  const paragraphs = body.map((line) => `<p style="margin:0 0 14px;font-size:16px;line-height:24px">${escapeHtml(line)}</p>`).join('');
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#141310;color:#ffffff;padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(action.label)}</a></p>`
    : '';
  return {
    text,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#141310;max-width:520px;margin:0 auto;padding:24px">${paragraphs}${button}<p style="margin:24px 0 0;font-size:13px;color:#6b665c">Tracck</p></div>`,
  };
}

const TEMPLATES: Record<string, (data: Data, origin: string) => Rendered> = {
  source_ready: (data, origin) => {
    const entries = Number(data.entries ?? 0);
    const body = [`Your ${str(data, 'provider', 'source')} has been read.`, `${entries} ${entries === 1 ? 'entry was' : 'entries were'} added to your record.`];
    return { subject: 'Your source is ready', ...layout(body, { label: 'Open Tracck', url: `${origin}/dashboard` }) };
  },
  source_failed: (data, origin) => ({
    subject: 'A source needs your attention',
    ...layout([str(data, 'message', 'We could not read one of your sources.')], { label: 'See your sources', url: `${origin}/dashboard/sources` }),
  }),
  resume_ready: (data, origin) => ({
    subject: 'Your resume is ready',
    ...layout([`Your resume for ${str(data, 'company') || str(data, 'title', 'that job')} is written. Open it to check each bullet against the entry behind it.`], {
      label: 'Open the draft',
      url: `${origin}/dashboard/resumes/${str(data, 'resumeId')}`,
    }),
  }),
  weekly_digest: (data, origin) => {
    const count = Number(data.entries ?? 0);
    return {
      subject: `${count} new ${count === 1 ? 'entry' : 'entries'} in your record`,
      ...layout([`This week Tracck added ${count} ${count === 1 ? 'entry' : 'entries'} from your sources.`, 'Nothing in your resumes changes unless you ask.'], {
        label: 'Review your record',
        url: `${origin}/dashboard/evidence`,
      }),
    };
  },
  student_verify: (data) => ({
    subject: 'Confirm your student email',
    ...layout(['Confirm this is your student email address to get the student price on Tracck Pro.', 'The link works for 24 hours.'], {
      label: 'Confirm my email',
      url: str(data, 'url'),
    }),
  }),
  payment_received: (data, origin) => ({
    subject: 'Payment received',
    ...layout([`Thank you. Your ${str(data, 'plan', 'Pro')} plan is active.`, `Paid ${str(data, 'amount')}. Reference ${str(data, 'reference')}.`], {
      label: 'See your plan',
      url: `${origin}/dashboard/settings`,
    }),
  }),
  data_export_ready: (_data, origin) => ({
    subject: 'Your Tracck data export is ready',
    ...layout(['Your data export is ready to download. The link in Settings works for a short time; ask for a new one if it runs out.'], {
      label: 'Download from Settings',
      url: `${origin}/dashboard/settings`,
    }),
  }),
  account_deleted: () => ({
    subject: 'Your Tracck account was deleted',
    ...layout(['Your account and everything in it was deleted, as you asked.', 'If this was not you, reply to this email.'], null),
  }),
};

export function renderEmail(template: string, data: Data, appOrigin: string): Rendered | null {
  return TEMPLATES[template]?.(data, appOrigin) ?? null;
}

/** The notification setting that decides whether a notification also goes by email. */
export const EMAIL_PREFERENCE: Record<string, 'done' | 'weekly' | 'attention'> = {
  source_ready: 'done',
  resume_ready: 'done',
  source_failed: 'attention',
  weekly_digest: 'weekly',
};
