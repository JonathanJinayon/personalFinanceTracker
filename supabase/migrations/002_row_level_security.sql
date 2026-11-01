-- Row Level Security and table privileges.
-- Reads are RLS-filtered. Ledger writes are intentionally not exposed directly;
-- they are performed by the SECURITY DEFINER functions in 003.

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.account_opening_balance_changes enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_entries enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_allocations enable row level security;
alter table public.savings_allocation_adjustments enable row level security;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy accounts_select_own
  on public.accounts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy accounts_update_own
  on public.accounts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy account_opening_balance_changes_select_own
  on public.account_opening_balance_changes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy categories_select_own
  on public.categories for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy categories_insert_own
  on public.categories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy categories_update_own
  on public.categories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy transactions_select_own
  on public.transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy transaction_entries_select_own
  on public.transaction_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy savings_goals_select_own
  on public.savings_goals for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy savings_goals_insert_own
  on public.savings_goals for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy savings_goals_update_own
  on public.savings_goals for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy savings_allocations_select_own
  on public.savings_allocations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy savings_allocation_adjustments_select_own
  on public.savings_allocation_adjustments for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table
  public.profiles,
  public.accounts,
  public.account_opening_balance_changes,
  public.categories,
  public.transactions,
  public.transaction_entries,
  public.savings_goals,
  public.savings_allocations,
  public.savings_allocation_adjustments
from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.accounts to authenticated;
grant select on public.account_opening_balance_changes to authenticated;
grant select, insert, update on public.categories to authenticated;
grant select on public.transactions to authenticated;
grant select on public.transaction_entries to authenticated;
grant select, insert, update on public.savings_goals to authenticated;
grant select on public.savings_allocations to authenticated;
grant select on public.savings_allocation_adjustments to authenticated;

revoke all on table
  public.account_balances,
  public.transaction_effects,
  public.transaction_summary,
  public.monthly_totals,
  public.savings_allocation_effective,
  public.savings_goal_progress
from anon, authenticated;

grant select on
  public.account_balances,
  public.transaction_effects,
  public.transaction_summary,
  public.monthly_totals,
  public.savings_allocation_effective,
  public.savings_goal_progress
to authenticated;

revoke usage on type
  public.account_type,
  public.account_status,
  public.category_type,
  public.transaction_type,
  public.savings_goal_status
from public, anon;

grant usage on type
  public.account_type,
  public.account_status,
  public.category_type,
  public.transaction_type,
  public.savings_goal_status
to authenticated;
