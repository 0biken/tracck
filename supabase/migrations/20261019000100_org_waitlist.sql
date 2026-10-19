-- Organisation API waitlist: interest from universities, bootcamps and job
-- platforms, collected from the public /waitlist page.
--
-- This is the one table a signed-out browser may write to, so the policy is
-- narrow: insert only, never read, update or delete. Rows are read by staff
-- through the server-only role.

create table public.org_waitlist (
  id           uuid primary key default gen_random_uuid(),
  org_name     text not null check (char_length(org_name) between 1 and 200),
  contact_name text not null check (char_length(contact_name) between 1 and 200),
  email        text not null check (char_length(email) between 3 and 320 and email like '%_@_%._%'),
  org_type     text not null check (org_type in ('university', 'bootcamp', 'job_platform', 'other')),
  volume       text check (volume is null or char_length(volume) <= 100),
  message      text check (message is null or char_length(message) <= 2000),
  created_at   timestamptz not null default now()
);

-- One entry per address, however it is capitalised.
create unique index org_waitlist_email_idx on public.org_waitlist (lower(email));

alter table public.org_waitlist enable row level security;

revoke all on public.org_waitlist from anon, authenticated;
grant insert on public.org_waitlist to anon, authenticated;

create policy org_waitlist_insert on public.org_waitlist
  for insert to anon, authenticated
  with check (true);
