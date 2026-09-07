alter table public.projects
  add column google_sheet_id text,
  add column google_sheet_url text;

create unique index projects_google_sheet_id_idx
on public.projects (google_sheet_id)
where google_sheet_id is not null;
