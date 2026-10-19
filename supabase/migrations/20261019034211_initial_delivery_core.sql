-- KiranaProof Milestone 3 — invoice-first, owner-scoped persistence.
-- The browser is granted SELECT only. All writes run through authenticated,
-- server-only handlers that verify owner identity and recompute reconciliation.
-- No public supplier access is enabled by this migration.

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  preferred_language text not null default 'te-IN',
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  contact_phone text,
  created_at timestamptz not null default now(),
  unique (id, store_id)
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid not null,
  baseline_type text not null check (baseline_type in ('INVOICE', 'ORDER')),
  reference_number text not null check (length(btrim(reference_number)) > 0),
  delivery_date date not null default current_date,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','NEEDS_REVIEW','RECONCILED','HAS_DISCREPANCY','CANCELLED')),
  invoice_complete_confirmed boolean not null default false,
  unexpected_items_checked boolean not null default false,
  version integer not null default 1 check (version > 0),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (supplier_id, store_id) references public.suppliers(id, store_id),
  unique (id, store_id)
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  product_name text not null check (length(btrim(product_name)) > 0),
  variant text not null default '',
  unit text not null check (length(btrim(unit)) > 0),
  expected_qty numeric(12,3) not null check (expected_qty >= 0),
  unique (delivery_id, line_no),
  unique (id, delivery_id)
);

create table public.receipt_lines (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  invoice_line_id uuid unique,
  received_product_name text not null,
  received_variant text not null default '',
  unit text not null,
  received_qty numeric(12,3) check (received_qty >= 0),
  damaged_qty numeric(12,3) check (damaged_qty >= 0),
  identity_confirmed boolean not null default false,
  condition_confirmed boolean not null default false,
  checked_at timestamptz,
  foreign key (invoice_line_id, delivery_id)
    references public.invoice_lines(id, delivery_id) on delete cascade,
  check (received_qty is null or damaged_qty is null or damaged_qty <= received_qty),
  check (invoice_line_id is not null or length(btrim(received_product_name)) > 0)
);

create table public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  delivery_version integer not null check (delivery_version > 0),
  rules_version text not null default '1',
  result text not null check (result in ('RECONCILED','NEEDS_REVIEW','HAS_DISCREPANCY')),
  findings_json jsonb not null,
  confirmed_by uuid references auth.users(id),
  run_at timestamptz not null default now(),
  unique (delivery_id, delivery_version)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  actor_type text not null check (actor_type in ('RETAILER','SYSTEM','SUPPLIER')),
  actor_id uuid,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_suppliers_store on public.suppliers(store_id, name);
create index idx_deliveries_store on public.deliveries(store_id, created_at desc);
create index idx_deliveries_status on public.deliveries(store_id, status);
create index idx_invoice_lines_delivery on public.invoice_lines(delivery_id, line_no);
create index idx_receipt_lines_delivery on public.receipt_lines(delivery_id);
create index idx_runs_delivery on public.reconciliation_runs(delivery_id, run_at desc);
create index idx_events_store_delivery on public.audit_events(store_id, delivery_id, created_at desc);

-- Explicit RLS on every public table. No broad write policies.
alter table public.stores enable row level security;
alter table public.suppliers enable row level security;
alter table public.deliveries enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.receipt_lines enable row level security;
alter table public.reconciliation_runs enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.stores, public.suppliers, public.deliveries,
  public.invoice_lines, public.receipt_lines, public.reconciliation_runs,
  public.audit_events from anon, authenticated;
grant select on public.stores, public.suppliers, public.deliveries,
  public.invoice_lines, public.receipt_lines, public.reconciliation_runs,
  public.audit_events to authenticated;

create policy stores_read_owner on public.stores
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy suppliers_read_owner on public.suppliers
  for select to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = suppliers.store_id and s.owner_user_id = (select auth.uid())
  ));

create policy deliveries_read_owner on public.deliveries
  for select to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = deliveries.store_id and s.owner_user_id = (select auth.uid())
  ));

create policy invoice_lines_read_owner on public.invoice_lines
  for select to authenticated
  using (exists (
    select 1 from public.deliveries d
    join public.stores s on s.id = d.store_id
    where d.id = invoice_lines.delivery_id and s.owner_user_id = (select auth.uid())
  ));

create policy receipt_lines_read_owner on public.receipt_lines
  for select to authenticated
  using (exists (
    select 1 from public.deliveries d
    join public.stores s on s.id = d.store_id
    where d.id = receipt_lines.delivery_id and s.owner_user_id = (select auth.uid())
  ));

create policy reconciliation_runs_read_owner on public.reconciliation_runs
  for select to authenticated
  using (exists (
    select 1 from public.deliveries d
    join public.stores s on s.id = d.store_id
    where d.id = reconciliation_runs.delivery_id and s.owner_user_id = (select auth.uid())
  ));

create policy audit_events_read_owner on public.audit_events
  for select to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = audit_events.store_id and s.owner_user_id = (select auth.uid())
  ));

comment on table public.deliveries is 'Reconciliation record: clean deliveries never produce discrepancy claims.';
comment on table public.reconciliation_runs is 'Immutable-by-API reconciliation snapshots; backend must compute and version-check before insert.';
comment on table public.audit_events is 'Append-only from trusted handlers; audit history is not independent physical proof.';
