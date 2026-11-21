create table events (
  id text primary key,
  name text not null,
  brand text not null,
  slogan text not null,
  subtitle text not null,
  emotional_line text not null,
  city text not null,
  region text not null,
  country text not null,
  starts_on date not null,
  ends_on date not null,
  event_year int not null,
  currency text not null,
  price_cents int not null default 0,
  price_configured boolean not null default false,
  shirt_sizes jsonb not null,
  jacket_sizes jsonb not null,
  packing_items jsonb not null,
  semaforo_mode text not null default 'external',
  semaforo_external_url text not null default '',
  semaforo_per_spouse boolean not null default true,
  semaforo_group_size int not null default 1,
  waiver_requires_both boolean not null default true,
  official_site text not null,
  organizer_email text not null,
  retention_months int not null default 24,
  updated_at timestamptz not null default now()
);

create table couples (
  id text primary key,
  event_id text not null references events (id),
  public_code text not null unique,
  access_key_hash text not null,
  city text not null,
  region text not null default '',
  country text not null,
  locale text not null default 'es',
  is_demo boolean not null default false,
  privacy_accepted_at timestamptz not null,
  questionnaire_consent_at timestamptz not null,
  status text not null default 'en_proceso',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table participants (
  id text primary key,
  couple_id text not null references couples (id) on delete cascade,
  role text not null check (role in ('esposo', 'esposa')),
  full_name text not null,
  shirt_size text not null,
  jacket_size text not null,
  phone_country text not null,
  phone text not null,
  email text not null,
  answer_key_hash text,
  unique (couple_id, role)
);

create index participants_couple_idx on participants (couple_id);
create index participants_email_idx on participants (lower(email));

create table registrations (
  couple_id text primary key references couples (id) on delete cascade,
  last_step text not null default 'datos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table financial_accounts (
  couple_id text primary key references couples (id) on delete cascade,
  modality text not null default '',
  claim_paid_in_full boolean not null default false,
  price_override_cents int,
  admin_notes text not null default '',
  internal_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table payments (
  id text primary key,
  couple_id text not null references couples (id) on delete cascade,
  amount_cents int not null check (amount_cents > 0 and amount_cents <= 100000000),
  currency text not null,
  method text not null default '',
  paid_on date,
  status text not null check (status in ('pendiente', 'verificado', 'rechazado')),
  note text not null default '',
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_couple_idx on payments (couple_id);

create table payment_receipts (
  payment_id text primary key references payments (id) on delete cascade,
  couple_id text not null references couples (id) on delete cascade,
  file_name text not null,
  mime text not null,
  size_bytes int not null,
  content bytea not null,
  created_at timestamptz not null default now()
);

create table invitation_requests (
  couple_id text primary key references couples (id) on delete cascade,
  needed boolean,
  status text not null,
  requested_at timestamptz,
  delivered_at timestamptz,
  file_name text,
  mime text,
  size_bytes int,
  content bytea,
  reviewer_note text not null default '',
  updated_at timestamptz not null default now()
);

create table document_templates (
  id text primary key,
  event_id text not null references events (id),
  kind text not null,
  version text not null,
  file_name text not null,
  mime text not null,
  size_bytes int not null,
  content bytea not null,
  active boolean not null default true,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index document_templates_event_idx on document_templates (event_id, kind, active);

create table document_signatures (
  id text primary key,
  couple_id text not null references couples (id) on delete cascade,
  participant_id text not null references participants (id) on delete cascade,
  template_id text references document_templates (id) on delete set null,
  status text not null,
  method text not null default '',
  provider text not null default '',
  provider_ref text not null default '',
  version text not null default '',
  note text not null default '',
  signed_name text,
  signed_mime text,
  signed_size int,
  signed_content bytea,
  updated_at timestamptz not null default now(),
  unique (participant_id)
);

create table questionnaires (
  id text primary key,
  event_id text not null references events (id),
  version text not null,
  title text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table questionnaire_questions (
  id text primary key,
  questionnaire_id text not null references questionnaires (id) on delete cascade,
  position int not null,
  prompt text not null,
  help text not null default '',
  required boolean not null default true,
  unique (questionnaire_id, position)
);

create table questionnaire_submissions (
  participant_id text primary key references participants (id) on delete cascade,
  couple_id text not null references couples (id) on delete cascade,
  questionnaire_id text,
  status text not null,
  external_opened_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table questionnaire_answers (
  id text primary key,
  participant_id text not null references participants (id) on delete cascade,
  couple_id text not null references couples (id) on delete cascade,
  questionnaire_id text not null references questionnaires (id) on delete cascade,
  question_id text not null references questionnaire_questions (id) on delete cascade,
  answer text not null,
  updated_at timestamptz not null default now(),
  unique (participant_id, question_id)
);

create table packing_checks (
  participant_id text not null references participants (id) on delete cascade,
  couple_id text not null references couples (id) on delete cascade,
  item_key text not null,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (participant_id, item_key)
);

create table packing_acks (
  participant_id text primary key references participants (id) on delete cascade,
  couple_id text not null references couples (id) on delete cascade,
  acknowledged_at timestamptz not null default now()
);

create table administrators (
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null check (role in ('owner', 'payments', 'documents', 'questionnaire', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id text primary key,
  at timestamptz not null default now(),
  actor_type text not null,
  actor_id text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  result text not null,
  detail jsonb not null default '{}'::jsonb
);

create index audit_logs_at_idx on audit_logs (at desc);

create table drive_folders (
  path text primary key,
  drive_id text not null,
  updated_at timestamptz not null default now()
);

create table drive_files (
  id text primary key,
  couple_id text references couples (id) on delete cascade,
  local_kind text not null,
  local_id text not null,
  drive_file_id text,
  name text not null,
  status text not null,
  attempts int not null default 0,
  last_error text not null default '',
  updated_at timestamptz not null default now(),
  unique (local_kind, local_id)
);

create table email_outbox (
  id text primary key,
  couple_id text references couples (id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table sessions (
  id text primary key,
  token_hash text not null unique,
  kind text not null check (kind in ('couple', 'admin')),
  subject_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_subject_idx on sessions (subject_id);

create table rate_limits (
  bucket text primary key,
  hits int not null,
  window_start timestamptz not null
);

create table deletion_requests (
  id text primary key,
  couple_id text not null references couples (id) on delete cascade,
  status text not null,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create table brand_assets (
  kind text primary key,
  file_name text not null,
  mime text not null,
  size_bytes int not null,
  content bytea not null,
  updated_at timestamptz not null default now()
);

create table code_counters (
  event_id text primary key references events (id),
  last_value int not null
);
