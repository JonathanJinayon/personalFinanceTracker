-- TIGOM initial schema.
-- Money is always numeric(14,2). Balances are derived from transaction_entries.

create type public.account_type as enum ('bank', 'ewallet', 'cash');
create type public.account_status as enum ('active', 'archived');
create type public.category_type as enum ('income', 'expense');
create type public.transaction_type as enum (
  'opening_balance',
  'income',
  'expense',
  'transfer',
  'reversal',
  'balance_adjustment'
);
create type public.savings_goal_status as enum ('active', 'completed', 'archived');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  type public.account_type not null,
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  status public.account_status not null default 'active',
  archived_at timestamptz,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  request_fingerprint text not null,
  constraint accounts_id_user_unique unique (id, user_id),
  constraint accounts_user_idempotency_unique unique (user_id, idempotency_key),
  constraint accounts_archived_at_consistent check ((status = 'archived') = (archived_at is not null))
);

create table public.account_opening_balance_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  previous_amount numeric(14,2) not null check (previous_amount >= 0),
  new_amount numeric(14,2) not null check (new_amount >= 0),
  changed_at timestamptz not null default clock_timestamp(),
  opening_transaction_id uuid,
  actor_user_id uuid references auth.users (id) on delete set null,
  request_fingerprint text,
  idempotency_key text,
  constraint account_opening_balance_changes_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action deferrable initially deferred,
  constraint account_opening_balance_changes_actual_change check (previous_amount <> new_amount)
);

create index account_opening_balance_changes_user_account_idx
  on public.account_opening_balance_changes (user_id, account_id, changed_at desc);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  category_type public.category_type not null,
  icon text check (icon is null or char_length(icon) between 1 and 50),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_system boolean not null default false,
  constraint categories_id_user_unique unique (id, user_id)
);

create unique index categories_user_active_name_type_uidx
  on public.categories (user_id, lower(btrim(name)), category_type)
  where is_archived = false;

create unique index categories_one_system_transfer_fees_uidx
  on public.categories (user_id)
  where is_system and category_type = 'expense' and lower(btrim(name)) = 'transfer fees';

create index categories_user_type_idx on public.categories (user_id, category_type, is_archived);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  transaction_date timestamptz not null,
  description text not null default '' check (char_length(description) <= 500),
  category_id uuid,
  related_transaction_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 100),
  created_at timestamptz not null default now(),
  constraint transactions_id_user_unique unique (id, user_id),
  constraint transactions_user_idempotency_unique unique (user_id, idempotency_key),
  constraint transactions_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete no action deferrable initially deferred,
  constraint transactions_related_fk foreign key (related_transaction_id, user_id)
    references public.transactions (id, user_id) on delete no action deferrable initially deferred,
  constraint transactions_category_required_for_expense
    check (type <> 'expense' or category_id is not null),
  constraint transactions_category_only_for_income_expense
    check (category_id is null or type in ('income', 'expense')),
  constraint transactions_related_only_for_reversal_or_fee
    check (related_transaction_id is null or type in ('reversal', 'expense')),
  constraint transactions_reversal_requires_related
    check (type <> 'reversal' or related_transaction_id is not null),
  constraint transactions_no_self_relation
    check (related_transaction_id is null or related_transaction_id <> id)
);

create unique index transactions_one_reversal_per_original_uidx
  on public.transactions (related_transaction_id)
  where type = 'reversal';

create index transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc, created_at desc, id desc);

create index transactions_user_type_date_idx
  on public.transactions (user_id, type, transaction_date desc);

create index transactions_user_category_idx
  on public.transactions (user_id, category_id);

create index transactions_user_related_idx
  on public.transactions (user_id, related_transaction_id);

create unique index accounts_user_active_name_uidx
  on public.accounts (user_id, lower(btrim(name))) where status = 'active';
create index accounts_user_status_idx on public.accounts (user_id, status);

create table public.transaction_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null,
  account_id uuid not null,
  amount numeric(14,2) not null check (amount <> 0),
  created_at timestamptz not null default now(),
  constraint transaction_entries_transaction_fk foreign key (transaction_id, user_id)
    references public.transactions (id, user_id) on delete no action deferrable initially deferred,
  constraint transaction_entries_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action deferrable initially deferred,
  constraint transaction_entries_transaction_account_unique unique (transaction_id, account_id)
);

create index transaction_entries_user_account_idx
  on public.transaction_entries (user_id, account_id);

create index transaction_entries_transaction_idx
  on public.transaction_entries (transaction_id);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  target_amount numeric(14,2) not null check (target_amount > 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  target_date date,
  status public.savings_goal_status not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_goals_id_user_unique unique (id, user_id),
  constraint savings_goals_archived_at_consistent check ((status = 'archived') = (archived_at is not null))
);

create index savings_goals_user_status_idx on public.savings_goals (user_id, status);

create table public.savings_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  allocation_date date not null,
  note text not null default '' check (char_length(note) <= 300),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 100),
  created_at timestamptz not null default now(),
  request_fingerprint text not null,
  constraint savings_allocations_goal_fk foreign key (goal_id, user_id)
    references public.savings_goals (id, user_id) on delete no action deferrable initially deferred,
  constraint savings_allocations_id_user_unique unique (id, user_id),
  constraint savings_allocations_user_idempotency_unique unique (user_id, idempotency_key),
  constraint savings_allocations_request_fingerprint_required check (request_fingerprint is not null)
);

create index savings_allocations_user_goal_idx
  on public.savings_allocations (user_id, goal_id, allocation_date desc);

create table public.savings_allocation_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  allocation_id uuid not null,
  amount numeric(14,2) not null check (amount <> 0),
  adjustment_date date not null,
  note text not null default '' check (char_length(note) <= 300),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 100),
  created_at timestamptz not null default now(),
  request_fingerprint text not null,
  constraint savings_allocation_adjustments_allocation_fk
    foreign key (allocation_id, user_id)
    references public.savings_allocations (id, user_id)
    on delete no action deferrable initially deferred,
  constraint savings_allocation_adjustments_user_idempotency_unique
    unique (user_id, idempotency_key)
);

create index savings_allocation_adjustments_user_allocation_idx
  on public.savings_allocation_adjustments (user_id, allocation_id, adjustment_date desc);

create table public.account_opening_balance_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  opening_transaction_id uuid not null,
  previous_amount numeric(14,2) not null check (previous_amount >= 0),
  new_amount numeric(14,2) not null check (new_amount >= 0),
  changed_at timestamptz not null default clock_timestamp(),
  actor_user_id uuid references auth.users (id) on delete set null,
  request_fingerprint text not null,
  idempotency_key text not null,
  constraint account_opening_balance_versions_account_fk
    foreign key (account_id, user_id) references public.accounts (id, user_id)
    on delete no action deferrable initially deferred,
  constraint account_opening_balance_versions_transaction_fk
    foreign key (opening_transaction_id, user_id) references public.transactions (id, user_id)
    on delete no action deferrable initially deferred,
  constraint account_opening_balance_versions_unique_key
    unique (user_id, account_id, idempotency_key),
  constraint account_opening_balance_versions_distinct_amounts
    check (previous_amount <> new_amount)
);

create index account_opening_balance_versions_account_time_idx
  on public.account_opening_balance_versions (user_id, account_id, changed_at desc, id desc);

create table public.savings_goal_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  previous_name text not null,
  new_name text not null,
  previous_target_amount numeric(14,2) not null check (previous_target_amount > 0),
  new_target_amount numeric(14,2) not null check (new_target_amount > 0),
  previous_target_date date,
  new_target_date date,
  changed_at timestamptz not null default clock_timestamp(),
  actor_user_id uuid references auth.users (id) on delete set null,
  constraint savings_goal_changes_goal_fk
    foreign key (goal_id, user_id) references public.savings_goals (id, user_id)
    on delete no action deferrable initially deferred
);

create index savings_goal_changes_goal_time_idx
  on public.savings_goal_changes (user_id, goal_id, changed_at desc, id desc);

create table public.idempotency_requests (
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null,
  operation_name text not null,
  request_fingerprint text not null,
  result_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, idempotency_key),
  constraint idempotency_requests_result_transaction_fk
    foreign key (result_id, user_id) references public.transactions (id, user_id)
    on delete no action deferrable initially deferred
);

alter table public.account_opening_balance_changes
  add constraint account_opening_balance_changes_transaction_fk
  foreign key (opening_transaction_id, user_id)
  references public.transactions (id, user_id)
  on delete no action deferrable initially deferred;

comment on type public.account_type is
  'Asset account types for MVP. Liabilities can be added as enum values in a future migration.';
comment on table public.transactions is
  'Append-oriented financial transaction header. Rows are written only by SECURITY DEFINER RPCs.';
comment on table public.transaction_entries is
  'Authoritative signed ledger. Positive = money into an account, negative = money out.';
comment on table public.savings_allocations is
  'Informational savings earmarks. They never change account balances and are not income or expenses.';
comment on table public.savings_allocation_adjustments is
  'Signed, append-only corrections to an allocation. They never change account balances.';
comment on table public.account_opening_balance_changes is
  'Append-only audit of opening-balance edits. Written only by account opening RPCs; never deleted.';
comment on table public.account_opening_balance_versions is
  'Append-only opening-balance corrections; opening transaction identity is retained and ledger entries are never edited.';
comment on table public.savings_goal_changes is
  'Append-only audit of goal name, target, and target-date changes.';
comment on column public.transactions.related_transaction_id is
  'Reversal target, or the parent transfer for a transfer-fee expense.';
comment on column public.transactions.transaction_date is
  'Instant the activity occurred, stored as timestamptz in UTC. Display and reporting use Asia/Manila.';
comment on column public.transactions.created_at is
  'Record creation instant. Used only for deterministic ordering, never for reporting periods.';

create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.user_id,
  a.name as account_name,
  a.type as account_type,
  a.currency,
  a.status,
  a.archived_at,
  coalesce(sum(e.amount) filter (where t.type = 'opening_balance'), 0)::numeric(14,2) as opening_balance,
  coalesce(sum(e.amount) filter (where t.type = 'balance_adjustment'), 0)::numeric(14,2) as balance_adjustments,
  coalesce(sum(e.amount), 0)::numeric(14,2) as balance,
  count(e.id) as entry_count
from public.accounts a
left join public.transaction_entries e
  on e.account_id = a.id and e.user_id = a.user_id
left join public.transactions t
  on t.id = e.transaction_id and t.user_id = e.user_id
group by a.id, a.user_id, a.name, a.type, a.currency, a.status, a.archived_at;

create view public.transaction_effects
with (security_invoker = true)
as
select
  e.id as entry_id,
  e.user_id,
  e.transaction_id,
  e.account_id,
  e.amount,
  t.type as transaction_type,
  case when t.type = 'reversal' then orig.type else t.type end as effective_type,
  t.transaction_date,
  case when t.type = 'reversal' then orig.category_id else t.category_id end as category_id,
  t.description,
  t.created_at
from public.transaction_entries e
join public.transactions t
  on t.id = e.transaction_id and t.user_id = e.user_id
left join public.transactions orig
  on orig.id = t.related_transaction_id and orig.user_id = t.user_id;

create view public.transaction_summary
with (security_invoker = true)
as
select
  t.id as transaction_id,
  t.user_id,
  t.type,
  t.transaction_date,
  t.description,
  t.category_id,
  c.name as category_name,
  t.related_transaction_id,
  t.created_at,
  coalesce(greatest(e.amount_out, e.amount_in), 0)::numeric(14,2) as amount,
  coalesce(e.net_amount, 0)::numeric(14,2) as net_amount,
  e.source_account_id,
  sa.name as source_account_name,
  e.destination_account_id,
  da.name as destination_account_name,
  coalesce(f.fee_amount, 0)::numeric(14,2) as fee_amount
from public.transactions t
left join public.categories c
  on c.id = t.category_id and c.user_id = t.user_id
left join lateral (
  select
    sum(en.amount)::numeric(14,2) as net_amount,
    (-sum(en.amount) filter (where en.amount < 0))::numeric(14,2) as amount_out,
    (sum(en.amount) filter (where en.amount > 0))::numeric(14,2) as amount_in,
    (array_agg(en.account_id) filter (where en.amount < 0))[1] as source_account_id,
    (array_agg(en.account_id) filter (where en.amount > 0))[1] as destination_account_id
  from public.transaction_entries en
  where en.transaction_id = t.id and en.user_id = t.user_id
) e on true
left join public.accounts sa
  on sa.id = e.source_account_id and sa.user_id = t.user_id
left join public.accounts da
  on da.id = e.destination_account_id and da.user_id = t.user_id
left join lateral (
  select (-sum(en.amount))::numeric(14,2) as fee_amount
  from public.transactions ft
  join public.transaction_entries en
    on en.transaction_id = ft.id and en.user_id = ft.user_id
  where ft.user_id = t.user_id
    and ft.type = 'expense'
    and ft.related_transaction_id = t.id
) f on true;

create view public.monthly_totals
with (security_invoker = true)
as
select
  user_id,
  date_trunc('month', transaction_date at time zone 'Asia/Manila')::date as month,
  coalesce(sum(amount) filter (where effective_type = 'income'), 0)::numeric(14,2) as income_total,
  coalesce(-sum(amount) filter (where effective_type = 'expense'), 0)::numeric(14,2) as expense_total,
  (
    coalesce(sum(amount) filter (where effective_type = 'income'), 0)
    - coalesce(-sum(amount) filter (where effective_type = 'expense'), 0)
  )::numeric(14,2) as net_total,
  coalesce(sum(amount) filter (where effective_type = 'transfer'), 0)::numeric(14,2) as transfer_net
from public.transaction_effects
group by user_id, date_trunc('month', transaction_date at time zone 'Asia/Manila')::date;

create view public.savings_allocation_effective
with (security_invoker = true)
as
select
  a.id as allocation_id,
  a.user_id,
  a.goal_id,
  a.amount as original_amount,
  coalesce(sum(j.amount), 0)::numeric(14,2) as adjustment_amount,
  (a.amount + coalesce(sum(j.amount), 0))::numeric(14,2) as effective_amount,
  a.allocation_date,
  a.note,
  a.created_at
from public.savings_allocations a
left join public.savings_allocation_adjustments j
  on j.allocation_id = a.id and j.user_id = a.user_id
group by a.id, a.user_id, a.goal_id, a.amount, a.allocation_date, a.note, a.created_at;

create view public.savings_goal_progress
with (security_invoker = true)
as
select
  g.id as goal_id,
  g.user_id,
  g.name,
  g.target_amount,
  g.currency,
  g.target_date,
  g.status,
  coalesce(sum(a.effective_amount), 0)::numeric(14,2) as allocated_amount,
  greatest(g.target_amount - coalesce(sum(a.effective_amount), 0), 0)::numeric(14,2) as remaining_amount,
  least(
    round(coalesce(sum(a.effective_amount), 0) / g.target_amount * 100, 2),
    100
  )::numeric(5,2) as completion_percentage
from public.savings_goals g
left join public.savings_allocation_effective a
  on a.goal_id = g.id and a.user_id = g.user_id
group by g.id, g.user_id, g.name, g.target_amount, g.currency, g.target_date, g.status;

comment on view public.account_balances is
  'Derived balances. account_balances.balance is the only balance source of truth.';
comment on view public.monthly_totals is
  'Calendar-month income and expense totals in Asia/Manila. Opening balances, transfers, and balance adjustments are excluded.';
comment on view public.savings_allocation_effective is
  'Allocation amount plus its signed adjustments.';
comment on view public.savings_goal_progress is
  'Goal progress from effective allocation amounts. Informational only; never changes account balances.';
