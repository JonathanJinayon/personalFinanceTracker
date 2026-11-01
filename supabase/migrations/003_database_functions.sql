-- Atomic financial operations, integrity triggers, and default-data bootstrap.
-- Application objects are schema-qualified; trusted functions use pg_catalog only
-- in search_path and call public objects explicitly.

create or replace function public.assert_money_amount(
  p_amount numeric,
  p_field text,
  p_allow_zero boolean default false
)
returns void
language plpgsql
immutable
  set search_path = pg_catalog
as $$
begin
  if p_amount is null then
    raise exception '% is required', p_field using errcode = '22023';
  end if;

  if p_allow_zero then
    if p_amount < 0 then
      raise exception '% must be zero or greater', p_field using errcode = '22023';
    end if;
  elsif p_amount <= 0 then
    raise exception '% must be greater than zero', p_field using errcode = '22023';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception '% must have at most two decimal places', p_field using errcode = '22023';
  end if;

  if p_amount > 999999999999.99 then
    raise exception '% exceeds the supported maximum', p_field using errcode = '22003';
  end if;
end;
$$;

create or replace function public.assert_signed_money_amount(
  p_amount numeric,
  p_field text
)
returns void
language plpgsql
immutable
  set search_path = pg_catalog
as $$
begin
  if p_amount is null then
    raise exception '% is required', p_field using errcode = '22023';
  end if;

  if p_amount = 0 then
    raise exception '% must not be zero', p_field using errcode = '22023';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception '% must have at most two decimal places', p_field using errcode = '22023';
  end if;

  if abs(p_amount) > 999999999999.99 then
    raise exception '% exceeds the supported maximum', p_field using errcode = '22003';
  end if;
end;
$$;

create or replace function public.assert_idempotency_key(p_key text)
returns void
language plpgsql
immutable
  set search_path = pg_catalog
as $$
begin
  if p_key is null or char_length(p_key) < 1 or char_length(p_key) > 100 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.assert_text_length(p_value text, p_max integer, p_field text)
returns void
language plpgsql
immutable
  set search_path = pg_catalog
as $$
begin
  if char_length(coalesce(p_value, '')) > p_max then
    raise exception '% must be at most % characters', p_field, p_max using errcode = '22023';
  end if;
end;
$$;

create or replace function public.request_fingerprint(VARIADIC p_values text[])
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select pg_catalog.md5(pg_catalog.array_to_string(p_values, E'\\x1f'));
$$;

create or replace function public.request_fingerprint(p1 text, p2 text, p3 text)
returns text language sql immutable set search_path = pg_catalog
as $$ select pg_catalog.md5(pg_catalog.array_to_string(array[p1,p2,p3], E'\\x1f')); $$;
create or replace function public.request_fingerprint(p1 text, p2 text)
returns text language sql immutable set search_path = pg_catalog
as $$ select pg_catalog.md5(pg_catalog.array_to_string(array[p1,p2], E'\\x1f')); $$;
create or replace function public.request_fingerprint(p1 text, p2 text, p3 text, p4 text)
returns text language sql immutable set search_path = pg_catalog
as $$ select pg_catalog.md5(pg_catalog.array_to_string(array[p1,p2,p3,p4], E'\\x1f')); $$;
create or replace function public.request_fingerprint(p1 text, p2 text, p3 text, p4 text, p5 text)
returns text language sql immutable set search_path = pg_catalog
as $$ select pg_catalog.md5(pg_catalog.array_to_string(array[p1,p2,p3,p4,p5], E'\\x1f')); $$;
create or replace function public.request_fingerprint(p1 text, p2 text, p3 text, p4 text, p5 text, p6 text)
returns text language sql immutable set search_path = pg_catalog
as $$ select pg_catalog.md5(pg_catalog.array_to_string(array[p1,p2,p3,p4,p5,p6], E'\\x1f')); $$;

create or replace function public.claim_idempotency_key(
  p_user_id uuid,
  p_key text,
  p_operation text,
  p_fingerprint text,
  p_result_id uuid default null
)
returns public.idempotency_requests
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_request public.idempotency_requests%rowtype;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_user_id is distinct from auth.uid() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.idempotency_requests (user_id, idempotency_key, operation_name, request_fingerprint, result_id)
  values (p_user_id, p_key, p_operation, p_fingerprint, p_result_id)
  on conflict (user_id, idempotency_key) do nothing;

  select * into v_request
  from public.idempotency_requests
  where user_id = p_user_id and idempotency_key = p_key
  for update;

  if v_request.operation_name <> p_operation
     or v_request.request_fingerprint <> p_fingerprint then
    raise exception 'Idempotency key was already used for a different request'
      using errcode = '22023', detail = 'IDEMPOTENCY_CONFLICT';
  end if;

  return v_request;
end;
$$;

create or replace function public.current_account_balance(
  p_account_id uuid
)
returns numeric
language sql
stable
security definer
  set search_path = pg_catalog
as $$
  select coalesce(sum(e.amount), 0)::numeric(14,2)
  from public.transaction_entries e
  where e.user_id = (select auth.uid())
    and e.account_id = p_account_id;
$$;

create or replace function public.assert_balance_not_negative(
  p_account_id uuid,
  p_delta numeric,
  p_context text
)
returns void
language plpgsql
stable
security definer
  set search_path = pg_catalog
as $$
declare
  v_balance numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = p_account_id and a.user_id = auth.uid()
  ) then
    raise exception 'Account not found' using errcode = '42501';
  end if;

  if p_delta >= 0 then
    return;
  end if;

  v_balance := public.current_account_balance(p_account_id);

  if v_balance + p_delta < 0 then
    raise exception 'Insufficient funds for %: available %, required %',
      p_context, v_balance, -p_delta using errcode = '23514';
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
  set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_archived_at()
returns trigger
language plpgsql
  set search_path = pg_catalog
as $$
begin
  if new.status = 'archived' then
    if new.archived_at is null then
      new.archived_at = now();
    end if;
  else
    new.archived_at = null;
  end if;
  return new;
end;
$$;

create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language sql
security definer
  set search_path = pg_catalog
as $$
  insert into public.categories (user_id, name, category_type, icon, is_system)
  values
    (p_user_id, 'Salary', 'income', 'briefcase', false),
    (p_user_id, 'Business', 'income', 'store', false),
    (p_user_id, 'Gifts', 'income', 'gift', false),
    (p_user_id, 'Other Income', 'income', 'plus', false),
    (p_user_id, 'Food', 'expense', 'utensils', false),
    (p_user_id, 'Transport', 'expense', 'car', false),
    (p_user_id, 'Bills', 'expense', 'receipt', false),
    (p_user_id, 'Shopping', 'expense', 'shopping-bag', false),
    (p_user_id, 'Health', 'expense', 'heart-pulse', false),
    (p_user_id, 'Entertainment', 'expense', 'clapperboard', false),
    (p_user_id, 'Transfer Fees', 'expense', 'arrow-left-right', true),
    (p_user_id, 'Other', 'expense', 'ellipsis', false)
  on conflict do nothing;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
  set search_path = pg_catalog
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    ''
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(v_display_name, 80))
  on conflict (id) do nothing;

  perform public.seed_default_categories(new.id);
  insert into public.categories (user_id, name, category_type, icon, is_system)
  values (new.id, 'Transfer Fees', 'expense', 'arrow-left-right', true)
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.validate_transaction_entries(p_transaction_id uuid)
returns void
language plpgsql
security definer
  set search_path = pg_catalog
as $$
declare
  v_transaction public.transactions%rowtype;
  v_original public.transactions%rowtype;
  v_entry_count integer;
  v_positive_count integer;
  v_negative_count integer;
  v_sum numeric;
  v_mismatch_count integer;
begin
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id;

  if not found then
    return;
  end if;

  select
    count(*),
    count(*) filter (where amount > 0),
    count(*) filter (where amount < 0),
    coalesce(sum(amount), 0)::numeric
  into v_entry_count, v_positive_count, v_negative_count, v_sum
  from public.transaction_entries
  where transaction_id = p_transaction_id;

  if v_entry_count = 0 then
    raise exception 'Transaction % has no entries', p_transaction_id using errcode = '23514';
  end if;

  if v_transaction.type in ('opening_balance', 'income') then
    if v_entry_count <> 1 or v_positive_count <> 1 then
      raise exception 'Transaction % of type % must have exactly one positive entry',
        p_transaction_id, v_transaction.type using errcode = '23514';
    end if;

    if v_transaction.type = 'opening_balance' and exists (
      select 1
      from public.transaction_entries e2
      join public.transactions t2
        on t2.id = e2.transaction_id and t2.user_id = e2.user_id
      where t2.user_id = v_transaction.user_id
        and t2.type = 'opening_balance'
        and t2.id <> p_transaction_id
        and e2.account_id = (
          select e3.account_id
          from public.transaction_entries e3
          where e3.transaction_id = p_transaction_id
          limit 1
        )
    ) then
      raise exception 'Account already has an opening balance' using errcode = '23505';
    end if;
  elsif v_transaction.type = 'expense' then
    if v_entry_count <> 1 or v_negative_count <> 1 then
      raise exception 'Expense transaction % must have exactly one negative entry',
        p_transaction_id using errcode = '23514';
    end if;
  elsif v_transaction.type = 'balance_adjustment' then
    if v_entry_count <> 1 then
      raise exception 'Balance adjustment % must have exactly one entry',
        p_transaction_id using errcode = '23514';
    end if;
  elsif v_transaction.type = 'transfer' then
    if v_entry_count <> 2 or v_positive_count <> 1 or v_negative_count <> 1 or v_sum <> 0 then
      raise exception 'Transfer transaction % must have exactly two entries summing to zero',
        p_transaction_id using errcode = '23514';
    end if;
  elsif v_transaction.type = 'reversal' then
    select * into v_original
    from public.transactions
    where id = v_transaction.related_transaction_id;

    if not found then
      raise exception 'Reversal % has no original transaction', p_transaction_id using errcode = '23514';
    end if;

    if v_original.type = 'reversal' then
      raise exception 'A reversal transaction cannot itself be reversed' using errcode = '23514';
    end if;

    if v_original.type = 'opening_balance' then
      raise exception 'Opening balances cannot be reversed' using errcode = '23514';
    end if;

    if v_original.type = 'balance_adjustment' then
      raise exception 'Balance adjustments cannot be reversed; post the opposite adjustment instead'
        using errcode = '23514';
    end if;

    select count(*) into v_mismatch_count
    from (
      select account_id, amount
      from public.transaction_entries
      where transaction_id = v_original.id
      except
      select account_id, -amount
      from public.transaction_entries
      where transaction_id = p_transaction_id
    ) differences;

    if v_mismatch_count <> 0 then
      raise exception 'Reversal % entries do not negate original transaction %',
        p_transaction_id, v_original.id using errcode = '23514';
    end if;

    select count(*) into v_mismatch_count
    from (
      select account_id, amount
      from public.transaction_entries
      where transaction_id = p_transaction_id
      except
      select account_id, -amount
      from public.transaction_entries
      where transaction_id = v_original.id
    ) differences;

    if v_mismatch_count <> 0 then
      raise exception 'Reversal % contains entries that do not match original transaction %',
        p_transaction_id, v_original.id using errcode = '23514';
    end if;
  end if;
end;
$$;

create or replace function public.validate_transaction_entries_trigger()
returns trigger
language plpgsql
security definer
  set search_path = pg_catalog
as $$
begin
  if tg_table_name = 'transactions' then
    perform public.validate_transaction_entries(new.id);
  elsif tg_op = 'DELETE' then
    perform public.validate_transaction_entries(old.transaction_id);
  else
    perform public.validate_transaction_entries(new.transaction_id);
  end if;
  return null;
end;
$$;

create or replace function public.guard_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Posted ledger rows cannot be deleted; use an approved correction RPC'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if tg_table_name = 'transaction_entries'
       and old.transaction_id = new.transaction_id
       and old.account_id = new.account_id
       and old.user_id = new.user_id
       and old.created_at = new.created_at
       and current_setting('tigom.opening_balance_correction', true) = 'on'
       and exists (
         select 1 from public.transactions t
         where t.id = old.transaction_id and t.type = 'opening_balance'
       ) then
      return new;
    end if;
    raise exception 'Posted ledger rows are immutable; use reversal or adjustment RPCs'
      using errcode = '42501';
  end if;

  raise exception 'Unsupported ledger mutation' using errcode = '42501';
end;
$$;

create trigger transactions_immutable_guard
  before update or delete on public.transactions
  for each row execute function public.guard_ledger_mutation();

create trigger transaction_entries_immutable_guard
  before update or delete on public.transaction_entries
  for each row execute function public.guard_ledger_mutation();

create or replace function public.guard_system_category()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' and old.is_system then
    if new.name is distinct from old.name
       or new.category_type is distinct from old.category_type
       or new.is_archived is distinct from old.is_archived
       or new.is_system is distinct from old.is_system then
      raise exception 'System categories cannot be renamed, retyped, or archived'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger categories_system_guard
  before update on public.categories
  for each row execute function public.guard_system_category();

create or replace function public.audit_savings_goal_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.name is distinct from old.name
     or new.target_amount is distinct from old.target_amount
     or new.target_date is distinct from old.target_date then
    insert into public.savings_goal_changes (
      user_id, goal_id, previous_name, new_name,
      previous_target_amount, new_target_amount,
      previous_target_date, new_target_date, changed_at, actor_user_id
    ) values (
      old.user_id, old.id, old.name, new.name,
      old.target_amount, new.target_amount,
      old.target_date, new.target_date, pg_catalog.clock_timestamp(), auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger savings_goals_audit_change
  before update on public.savings_goals
  for each row execute function public.audit_savings_goal_change();

create or replace function public.guard_immutable_metadata()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Immutable identity and created_at fields cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger accounts_immutable_metadata
  before update on public.accounts
  for each row execute function public.guard_immutable_metadata();
create trigger savings_goals_immutable_metadata
  before update on public.savings_goals
  for each row execute function public.guard_immutable_metadata();

create or replace function public.ensure_transfer_fee_category(p_user_id uuid, p_internal boolean default false)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_category_id uuid;
begin
  if not p_internal and p_user_id is distinct from auth.uid() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select id into v_category_id from public.categories
  where user_id = p_user_id and is_system and category_type = 'expense'
    and lower(btrim(name)) = 'transfer fees' and not is_archived
  for update;
  if v_category_id is null then
    insert into public.categories(user_id,name,category_type,icon,is_system)
    values(p_user_id,'Transfer Fees','expense','arrow-left-right',true)
    on conflict do nothing returning id into v_category_id;
  end if;
  if v_category_id is null then
    select id into v_category_id from public.categories
    where user_id = p_user_id and is_system and category_type = 'expense'
      and lower(btrim(name)) = 'transfer fees' and not is_archived;
  end if;
  if v_category_id is null then
    raise exception 'Canonical Transfer Fees category is unavailable' using errcode = '23514';
  end if;
  return v_category_id;
end;
$$;

create or replace function public.archive_account(p_account_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  update public.accounts
  set status = case when p_archived then 'archived'::public.account_status else 'active'::public.account_status end
  where id = p_account_id and user_id = v_user_id;
  if not found then raise exception 'Account not found' using errcode = '42501'; end if;
end;
$$;

create or replace function public.create_savings_goal(
  p_name text, p_target_amount numeric, p_target_date date, p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
  v_goal_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  perform public.assert_money_amount(p_target_amount, 'Goal target', false);
  perform public.assert_idempotency_key(p_idempotency_key);
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Goal name must be 1-80 characters' using errcode = '22023';
  end if;
  v_fingerprint := public.request_fingerprint(btrim(p_name), p_target_amount::text, coalesce(p_target_date::text, ''));
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'create_savings_goal', v_fingerprint);
  if v_request.result_id is not null then return v_request.result_id; end if;

  insert into public.savings_goals(user_id, name, target_amount, target_date)
  values(v_user_id, btrim(p_name), p_target_amount, p_target_date)
  returning id into v_goal_id;
  update public.idempotency_requests set result_id = v_goal_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  return v_goal_id;
end;
$$;

create or replace function public.update_savings_goal(
  p_goal_id uuid, p_name text, p_target_amount numeric, p_target_date date,
  p_status public.savings_goal_status
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  perform public.assert_money_amount(p_target_amount, 'Goal target', false);
  update public.savings_goals
  set name = btrim(p_name), target_amount = p_target_amount,
      target_date = p_target_date, status = p_status
  where id = p_goal_id and user_id = v_user_id;
  if not found then raise exception 'Savings goal not found' using errcode = '42501'; end if;
end;
$$;

create or replace function public.guard_balance_entry_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_type public.transaction_type;
  v_status public.account_status;
  v_delta numeric;
begin
  select type into v_type from public.transactions
  where id = new.transaction_id and user_id = new.user_id;
  if v_type is null then raise exception 'Transaction not found' using errcode = '23503'; end if;

  select status into v_status from public.accounts
  where id = new.account_id and user_id = new.user_id
  for update;
  if v_status is null then raise exception 'Account not found' using errcode = '23503'; end if;
  if v_status <> 'active' then
    raise exception 'Archived accounts reject new financial entries' using errcode = '23514';
  end if;

  if v_type in ('expense', 'transfer', 'balance_adjustment', 'reversal') then
    v_delta := new.amount;
    if v_delta < 0 then
      perform public.assert_balance_not_negative(new.account_id, v_delta, v_type::text);
    end if;
  end if;
  if v_type = 'expense'
     and exists (
       select 1 from public.transactions parent
       where parent.id = (select t.related_transaction_id from public.transactions t where t.id = new.transaction_id)
         and parent.type = 'transfer'
     ) then
    perform public.assert_balance_not_negative(new.account_id, new.amount, 'transfer amount and fee');
  end if;
  return new;
end;
$$;

create or replace function public.create_account(
  p_name text,
  p_type public.account_type,
  p_opening_balance numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
  set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_opening_transaction_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_type is null then
    raise exception 'Account type is required' using errcode = '22023';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Account name must be 1-80 characters' using errcode = '22023';
  end if;

  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_money_amount(p_opening_balance, 'Opening balance', true);

  v_fingerprint := public.request_fingerprint(p_name, p_type::text, p_opening_balance::text);
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'create_account', v_fingerprint);

  if v_request.result_id is not null then
    return v_request.result_id;
  end if;

  insert into public.accounts (user_id, name, type, idempotency_key, request_fingerprint)
  values (v_user_id, v_name, p_type, p_idempotency_key, v_fingerprint)
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_account_id;

  if v_account_id is null then
    select id into v_account_id
    from public.accounts
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
    return v_account_id;
  end if;

  if p_opening_balance > 0 then
  insert into public.transactions (
    user_id, type, transaction_date, description, idempotency_key
  )
  values (
    v_user_id, 'opening_balance', pg_catalog.clock_timestamp(), 'Opening balance', gen_random_uuid()::text
    )
    returning id into v_opening_transaction_id;

    insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
    values (v_user_id, v_opening_transaction_id, v_account_id, p_opening_balance);

    insert into public.account_opening_balance_changes (
      user_id, account_id, previous_amount, new_amount, changed_at, actor_user_id,
      opening_transaction_id, request_fingerprint, idempotency_key
    ) values (
      v_user_id, v_account_id, 0, p_opening_balance, pg_catalog.clock_timestamp(),
      v_user_id, v_opening_transaction_id, v_fingerprint, p_idempotency_key
    );
  end if;

  update public.idempotency_requests
  set result_id = v_account_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return v_account_id;
end;
$$;

create or replace function public.post_income(
  p_account_id uuid,
  p_amount numeric,
  p_transaction_date timestamptz,
  p_description text,
  p_idempotency_key text,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
  set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_id uuid;
  v_account_status public.account_status;
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_money_amount(p_amount, 'Income amount', false);
  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_description, 500, 'Description');

  if p_transaction_date is null then
    raise exception 'Transaction date is required' using errcode = '22023';
  end if;

  v_fingerprint := public.request_fingerprint(
    p_account_id::text, p_amount::text, p_transaction_date::text,
    coalesce(p_description, ''), coalesce(p_category_id::text, '')
  );
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'post_income', v_fingerprint);
  select id into v_transaction_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  select status into v_account_status
  from public.accounts
  where id = p_account_id and user_id = v_user_id
  for update;

  select id into v_transaction_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  if v_account_status is null or v_account_status <> 'active' then
    raise exception 'Income account not found or not active' using errcode = '42501';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories
    where id = p_category_id
      and user_id = v_user_id
      and category_type = 'income'
      and is_archived = false
  ) then
    raise exception 'Income category not found or invalid' using errcode = '42501';
  end if;

  insert into public.transactions (
    user_id, type, transaction_date, description, category_id, idempotency_key, request_fingerprint
  )
  values (
    v_user_id, 'income', p_transaction_date, coalesce(p_description, ''),
    p_category_id, p_idempotency_key, v_fingerprint
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    select id into v_transaction_id
    from public.transactions
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
    return v_transaction_id;
  end if;

  insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
  values (v_user_id, v_transaction_id, p_account_id, p_amount);

  update public.idempotency_requests
  set result_id = v_transaction_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return v_transaction_id;
end;
$$;

create or replace function public.post_expense(
  p_account_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_transaction_date timestamptz,
  p_description text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
  set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_id uuid;
  v_account_status public.account_status;
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_money_amount(p_amount, 'Expense amount', false);
  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_description, 500, 'Description');

  if p_transaction_date is null then
    raise exception 'Transaction date is required' using errcode = '22023';
  end if;

  v_fingerprint := public.request_fingerprint(
    p_account_id::text, p_category_id::text, p_amount::text,
    p_transaction_date::text, coalesce(p_description, '')
  );
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'post_expense', v_fingerprint);

  select id into v_transaction_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  select status into v_account_status
  from public.accounts
  where id = p_account_id and user_id = v_user_id
  for update;

  select id into v_transaction_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  if v_account_status is null or v_account_status <> 'active' then
    raise exception 'Expense account not found or not active' using errcode = '42501';
  end if;

  perform public.assert_balance_not_negative(p_account_id, -p_amount, 'expense');

  if not exists (
    select 1 from public.categories
    where id = p_category_id
      and user_id = v_user_id
      and category_type = 'expense'
      and is_archived = false
  ) then
    raise exception 'Expense category not found or invalid' using errcode = '42501';
  end if;

  insert into public.transactions (
    user_id, type, transaction_date, description, category_id, idempotency_key, request_fingerprint
  )
  values (
    v_user_id, 'expense', p_transaction_date, coalesce(p_description, ''),
    p_category_id, p_idempotency_key, v_fingerprint
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    select id into v_transaction_id
    from public.transactions
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
    return v_transaction_id;
  end if;

  insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
  values (v_user_id, v_transaction_id, p_account_id, -p_amount);

  update public.idempotency_requests
  set result_id = v_transaction_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return v_transaction_id;
end;
$$;

create or replace function public.post_transfer(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_fee numeric,
  p_transaction_date timestamptz,
  p_description text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_id uuid;
  v_fee_transaction_id uuid;
  v_fee_category_id uuid;
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_money_amount(p_amount, 'Transfer amount', false);
  perform public.assert_money_amount(p_fee, 'Transfer fee', true);
  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_description, 500, 'Description');

  if p_transaction_date is null then
    raise exception 'Transaction date is required' using errcode = '22023';
  end if;

  if p_source_account_id is null
     or p_destination_account_id is null
     or p_source_account_id = p_destination_account_id then
    raise exception 'Source and destination accounts must be different' using errcode = '22023';
  end if;

  v_fingerprint := public.request_fingerprint(
    p_source_account_id::text, p_destination_account_id::text, p_amount::text,
    p_fee::text, p_transaction_date::text, coalesce(p_description, '')
  );
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'post_transfer', v_fingerprint);

  select id into v_transaction_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  perform 1
  from public.accounts
  where user_id = v_user_id
    and id in (p_source_account_id, p_destination_account_id)
  order by id
  for update;

  select id into v_transaction_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  if not exists (
    select 1 from public.accounts
    where id = p_source_account_id and user_id = v_user_id and status = 'active'
  ) then
    raise exception 'Source account not found or not active' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.accounts
    where id = p_destination_account_id and user_id = v_user_id and status = 'active'
  ) then
    raise exception 'Destination account not found or not active' using errcode = '42501';
  end if;

  perform public.assert_balance_not_negative(
    p_source_account_id,
    -(p_amount + p_fee),
    'transfer amount and fee'
  );

  insert into public.transactions (
    user_id, type, transaction_date, description, idempotency_key, request_fingerprint
  )
  values (
    v_user_id, 'transfer', p_transaction_date, coalesce(p_description, ''), p_idempotency_key, v_fingerprint
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    select id into v_transaction_id
    from public.transactions
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
    return v_transaction_id;
  end if;

  insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
  values
    (v_user_id, v_transaction_id, p_source_account_id, -p_amount),
    (v_user_id, v_transaction_id, p_destination_account_id, p_amount);

  if p_fee > 0 then
    select id into v_fee_category_id from public.categories
    where user_id = v_user_id and is_system and category_type = 'expense'
      and lower(btrim(name)) = 'transfer fees' and not is_archived;
    if v_fee_category_id is null then
      raise exception 'Canonical Transfer Fees category is unavailable' using errcode = '23514';
    end if;

    insert into public.transactions (
      user_id, type, transaction_date, description,
      category_id, related_transaction_id, idempotency_key
    )
    values (
      v_user_id, 'expense', p_transaction_date,
      coalesce(nullif(btrim(p_description), ''), 'Transfer fee'),
      v_fee_category_id, v_transaction_id, gen_random_uuid()::text
    )
    returning id into v_fee_transaction_id;

    insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
    values (v_user_id, v_fee_transaction_id, p_source_account_id, -p_fee);
  end if;

  update public.idempotency_requests
  set result_id = v_transaction_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return v_transaction_id;
end;
$$;

create or replace function public.reverse_transaction(
  p_transaction_id uuid,
  p_transaction_date timestamptz,
  p_description text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.transactions%rowtype;
  v_reversal_id uuid;
  v_account_id uuid;
  v_delta numeric;
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_description, 500, 'Description');

  if p_transaction_date is null then
    raise exception 'Transaction date is required' using errcode = '22023';
  end if;

  select * into v_original
  from public.transactions
  where id = p_transaction_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Transaction not found' using errcode = '42501';
  end if;

  v_fingerprint := public.request_fingerprint(
    p_transaction_id::text, p_transaction_date::text, coalesce(p_description, '')
  );
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'reverse_transaction', v_fingerprint);

  if v_request.result_id is not null then
    return v_request.result_id;
  end if;

  select id into v_reversal_id
  from public.transactions
  where user_id = v_user_id and type = 'reversal'
    and related_transaction_id = p_transaction_id;
  if v_reversal_id is not null then
    update public.idempotency_requests
    set result_id = v_reversal_id
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
    return v_reversal_id;
  end if;

  if v_original.type = 'reversal' then
    raise exception 'A reversal transaction cannot be reversed' using errcode = '22023';
  end if;

  if v_original.type = 'opening_balance' then
    raise exception 'Opening balances cannot be reversed' using errcode = '22023';
  end if;

  if v_original.type = 'balance_adjustment' then
    raise exception 'Balance adjustments cannot be reversed; post the opposite adjustment instead'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.transactions
    where user_id = v_user_id
      and type = 'reversal'
      and related_transaction_id = p_transaction_id
  ) then
    raise exception 'Transaction has already been reversed' using errcode = '23505';
  end if;

  perform 1
  from public.accounts a
  where a.user_id = v_user_id
    and a.id in (
      select e.account_id
      from public.transaction_entries e
      where e.transaction_id = p_transaction_id and e.user_id = v_user_id
    )
  order by a.id
  for update;

  perform 1
  from public.transactions t
  where t.user_id = v_user_id
    and t.type = 'expense'
    and t.related_transaction_id = p_transaction_id
  for update;

  select id into v_reversal_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_reversal_id is not null then
    return v_reversal_id;
  end if;

  if exists (
    select 1
    from public.accounts a
    where a.user_id = v_user_id
      and a.status <> 'active'
      and a.id in (
        select e.account_id
        from public.transaction_entries e
        where e.transaction_id = p_transaction_id and e.user_id = v_user_id
      )
  ) then
    raise exception 'Archived accounts cannot receive new transactions' using errcode = '23514';
  end if;

  for v_account_id, v_delta in
    select x.account_id, sum(x.delta)::numeric(14,2)
    from (
      select e.account_id, -e.amount as delta
      from public.transaction_entries e
      where e.transaction_id = p_transaction_id and e.user_id = v_user_id
      union all
      select e.account_id, -e.amount as delta
      from public.transactions f
      join public.transaction_entries e
        on e.transaction_id = f.id and e.user_id = f.user_id
      where f.user_id = v_user_id
        and f.type = 'expense'
        and f.related_transaction_id = p_transaction_id
        and not exists (
          select 1 from public.transactions r
          where r.user_id = v_user_id
            and r.type = 'reversal'
            and r.related_transaction_id = f.id
        )
    ) x
    group by x.account_id
  loop
    perform public.assert_balance_not_negative(
      v_account_id,
      v_delta,
      'reversal (post a real deposit or an explicit balance adjustment first)'
    );
  end loop;

  insert into public.transactions (
    user_id, type, transaction_date, description, related_transaction_id, idempotency_key, request_fingerprint
  )
  values (
    v_user_id,
    'reversal',
    p_transaction_date,
    coalesce(nullif(btrim(p_description), ''), 'Reversal of transaction ' || left(v_original.id::text, 8)),
    p_transaction_id,
    p_idempotency_key,
    v_fingerprint
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_reversal_id;

  if v_reversal_id is null then
    select id into v_reversal_id
    from public.transactions
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
    return v_reversal_id;
  end if;

  insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
  select v_user_id, v_reversal_id, e.account_id, -e.amount
  from public.transaction_entries e
  where e.transaction_id = p_transaction_id and e.user_id = v_user_id;

  if v_original.type = 'transfer' then
    with fee_reversals as (
      insert into public.transactions (
        user_id, type, transaction_date, description, related_transaction_id, idempotency_key
      )
      select
        v_user_id,
        'reversal',
        p_transaction_date,
        'Reversal of transfer fee',
        f.id,
        gen_random_uuid()::text
      from public.transactions f
      where f.user_id = v_user_id
        and f.type = 'expense'
        and f.related_transaction_id = p_transaction_id
        and not exists (
          select 1 from public.transactions r
          where r.user_id = v_user_id
            and r.type = 'reversal'
            and r.related_transaction_id = f.id
        )
      returning id, related_transaction_id
    )
    insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
    select v_user_id, fr.id, e.account_id, -e.amount
    from fee_reversals fr
    join public.transaction_entries e
      on e.transaction_id = fr.related_transaction_id and e.user_id = v_user_id;
  end if;

  update public.idempotency_requests
  set result_id = v_reversal_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return v_reversal_id;
end;
$$;

create or replace function public.add_savings_allocation(
  p_goal_id uuid,
  p_amount numeric,
  p_allocation_date date,
  p_note text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_allocation_id uuid;
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_money_amount(p_amount, 'Allocation amount', false);
  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_note, 300, 'Note');

  if p_note is null or char_length(btrim(p_note)) < 3 then
    raise exception 'Allocation note must contain at least 3 non-space characters' using errcode = '22023';
  end if;

  if p_allocation_date is null then
    raise exception 'Allocation date is required' using errcode = '22023';
  end if;

  v_fingerprint := public.request_fingerprint(p_goal_id::text, p_amount::text, p_allocation_date::text, p_note);
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'add_savings_allocation', v_fingerprint);
  if v_request.result_id is not null then return v_request.result_id; end if;

  if not exists (
    select 1 from public.savings_goals
    where id = p_goal_id and user_id = v_user_id and status <> 'archived'
  ) then
    raise exception 'Savings goal not found or archived' using errcode = '42501';
  end if;

  insert into public.savings_allocations (
    user_id, goal_id, amount, allocation_date, note, idempotency_key, request_fingerprint
  )
  values (
    v_user_id, p_goal_id, p_amount, p_allocation_date, coalesce(p_note, ''), p_idempotency_key,
    v_fingerprint
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_allocation_id;

  if v_allocation_id is null then
    select id into v_allocation_id from public.savings_allocations
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
  end if;

  update public.idempotency_requests set result_id = v_allocation_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return v_allocation_id;
end;
$$;

create or replace function public.update_opening_balance(
  p_account_id uuid,
  p_amount numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_status public.account_status;
  v_opening_transaction_id uuid;
  v_opening_entry_id uuid;
  v_current_amount numeric;
  v_request public.idempotency_requests%rowtype;
  v_fingerprint text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_money_amount(p_amount, 'Opening balance', true);
  perform public.assert_idempotency_key(p_idempotency_key);

  select status into v_account_status
  from public.accounts
  where id = p_account_id and user_id = v_user_id
  for update;

  if v_account_status is null or v_account_status <> 'active' then
    raise exception 'Account not found or not active' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.transaction_entries e
    join public.transactions t
      on t.id = e.transaction_id and t.user_id = e.user_id
    where e.user_id = v_user_id
      and e.account_id = p_account_id
      and t.type <> 'opening_balance'
  ) then
    raise exception 'Opening balance can only be edited before financial activity; use adjust_account_balance'
      using errcode = '23514';
  end if;

  select t.id, e.id, e.amount
  into v_opening_transaction_id, v_opening_entry_id, v_current_amount
  from public.transactions t
  join public.transaction_entries e
    on e.transaction_id = t.id and e.user_id = t.user_id
  where t.user_id = v_user_id
    and t.type = 'opening_balance'
    and e.account_id = p_account_id
  limit 1;

  v_current_amount := coalesce(v_current_amount, 0);

  v_fingerprint := public.request_fingerprint(p_account_id::text, p_amount::text);
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'update_opening_balance', v_fingerprint);
  if v_request.result_id is not null then return v_request.result_id; end if;

  v_fingerprint := public.request_fingerprint(p_account_id::text, p_amount::text);
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'update_opening_balance', v_fingerprint);
  if v_request.result_id is not null then return v_request.result_id; end if;

  if p_amount = v_current_amount then
    return v_opening_transaction_id;
  end if;

  if v_opening_transaction_id is null then
    insert into public.transactions (
      user_id, type, transaction_date, description, idempotency_key
    )
    values (
      v_user_id, 'opening_balance', pg_catalog.clock_timestamp(), 'Opening balance', gen_random_uuid()::text
    )
    returning id into v_opening_transaction_id;

    insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
    values (v_user_id, v_opening_transaction_id, p_account_id, p_amount);

    return public.record_opening_balance_version(
      v_user_id, p_account_id, v_opening_transaction_id, v_current_amount, p_amount,
      p_idempotency_key, v_user_id
    );
  end if;

  perform pg_catalog.set_config('tigom.opening_balance_correction', 'on', true);
  update public.transaction_entries
  set amount = p_amount
  where id = v_opening_entry_id;
  perform pg_catalog.set_config('tigom.opening_balance_correction', 'off', true);

  return public.record_opening_balance_version(
    v_user_id, p_account_id, v_opening_transaction_id, v_current_amount, p_amount,
    p_idempotency_key, v_user_id
  );
end;
$$;

create or replace function public.adjust_account_balance(
  p_account_id uuid,
  p_amount numeric,
  p_effective_date timestamptz,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_status public.account_status;
  v_transaction_id uuid;
  v_description text;
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_signed_money_amount(p_amount, 'Adjustment amount');
  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_reason, 500, 'Reason');

  if p_reason is null or char_length(btrim(p_reason)) < 8 then
    raise exception 'A meaningful correction reason of at least 8 non-space characters is required'
      using errcode = '22023';
  end if;

  if p_effective_date is null then
    raise exception 'Effective date is required' using errcode = '22023';
  end if;

  v_fingerprint := public.request_fingerprint(
    p_account_id::text, p_amount::text, p_effective_date::text, btrim(p_reason)
  );
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'adjust_account_balance', v_fingerprint);
  if v_request.result_id is not null then
    return v_request.result_id;
  end if;

  select status into v_account_status
  from public.accounts
  where id = p_account_id and user_id = v_user_id
  for update;

  if v_account_status is null or v_account_status <> 'active' then
    raise exception 'Account not found or not active' using errcode = '42501';
  end if;

  perform public.assert_balance_not_negative(
    p_account_id, p_amount, 'balance adjustment'
  );

  v_description := btrim(p_reason);

  insert into public.transactions (
    user_id, type, transaction_date, description, idempotency_key, request_fingerprint
  )
  values (
    v_user_id, 'balance_adjustment', p_effective_date, v_description, p_idempotency_key, v_fingerprint
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    select id into v_transaction_id
    from public.transactions
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
    return v_transaction_id;
  end if;

  insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
  values (v_user_id, v_transaction_id, p_account_id, p_amount);

  update public.idempotency_requests
  set result_id = v_transaction_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return v_transaction_id;
end;
$$;

create or replace function public.claim_idempotency_key(
  p_user_id uuid,
  p_key text,
  p_operation text,
  p_fingerprint text,
  p_result_id uuid default null
)
returns public.idempotency_requests
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_request public.idempotency_requests%rowtype;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.idempotency_requests (user_id, idempotency_key, operation_name, request_fingerprint, result_id)
  values (p_user_id, p_key, p_operation, p_fingerprint, p_result_id)
  on conflict (user_id, idempotency_key) do nothing;

  select * into v_request from public.idempotency_requests
  where user_id = p_user_id and idempotency_key = p_key for update;

  if v_request.operation_name <> p_operation
     or v_request.request_fingerprint <> p_fingerprint then
    raise exception 'Idempotency key was already used for a different request'
      using errcode = '22023', detail = 'IDEMPOTENCY_CONFLICT';
  end if;
  return v_request;
end;
$$;

create or replace function public.record_opening_balance_version(
  p_user_id uuid,
  p_account_id uuid,
  p_transaction_id uuid,
  p_previous numeric,
  p_next numeric,
  p_key text,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
  v_change_id uuid;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_fingerprint := public.request_fingerprint(
    p_account_id::text, p_transaction_id::text, p_previous::text, p_next::text
  );
  v_request := public.claim_idempotency_key(p_user_id, p_key, 'update_opening_balance', v_fingerprint);
  if v_request.result_id is not null then return v_request.result_id; end if;

  if p_previous <> p_next then
    insert into public.account_opening_balance_versions (
      user_id, account_id, opening_transaction_id, previous_amount, new_amount,
      changed_at, actor_user_id, request_fingerprint, idempotency_key
    ) values (
      p_user_id, p_account_id, p_transaction_id, p_previous, p_next,
      pg_catalog.clock_timestamp(), p_actor, v_fingerprint, p_key
    ) returning id into v_change_id;

    insert into public.account_opening_balance_changes (
      user_id, account_id, previous_amount, new_amount, changed_at,
      opening_transaction_id, actor_user_id, request_fingerprint, idempotency_key
    ) values (
      p_user_id, p_account_id, p_previous, p_next, pg_catalog.clock_timestamp(),
      p_transaction_id, p_actor, v_fingerprint, p_key
    );

  end if;

  update public.idempotency_requests
  set result_id = coalesce(v_change_id, p_transaction_id)
  where user_id = p_user_id and idempotency_key = p_key;
  return coalesce(v_change_id, p_transaction_id);
end;
$$;

create or replace function public.adjust_savings_allocation(
  p_allocation_id uuid,
  p_amount numeric,
  p_adjustment_date date,
  p_note text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_allocation_amount numeric;
  v_adjustment_total numeric;
  v_adjustment_id uuid;
  v_fingerprint text;
  v_request public.idempotency_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_signed_money_amount(p_amount, 'Adjustment amount');
  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_note, 300, 'Note');
  if p_note is null or char_length(btrim(p_note)) < 3 then
    raise exception 'Adjustment note must contain at least 3 non-space characters' using errcode = '22023';
  end if;

  if p_adjustment_date is null then
    raise exception 'Adjustment date is required' using errcode = '22023';
  end if;

  v_fingerprint := public.request_fingerprint(
    p_allocation_id::text, p_amount::text, p_adjustment_date::text, coalesce(p_note, '')
  );
  v_request := public.claim_idempotency_key(v_user_id, p_idempotency_key, 'adjust_savings_allocation', v_fingerprint);

  select a.amount into v_allocation_amount
  from public.savings_allocations a
  where a.id = p_allocation_id and a.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Savings allocation not found' using errcode = '42501';
  end if;

  if v_request.result_id is not null then
    return v_request.result_id;
  end if;

  select coalesce(sum(j.amount), 0)::numeric(14,2)
  into v_adjustment_total
  from public.savings_allocation_adjustments j
  where j.user_id = v_user_id and j.allocation_id = p_allocation_id;

  if v_allocation_amount + v_adjustment_total + p_amount < 0 then
    raise exception 'Adjustment would reduce the allocation below zero' using errcode = '23514';
  end if;

  if v_allocation_amount + v_adjustment_total + p_amount > 999999999999.99 then
    raise exception 'Allocation exceeds the supported maximum' using errcode = '22003';
  end if;

  insert into public.savings_allocation_adjustments (
    user_id, allocation_id, amount, adjustment_date, note, idempotency_key, request_fingerprint
  )
  values (
    v_user_id, p_allocation_id, p_amount, p_adjustment_date,
    coalesce(p_note, ''), p_idempotency_key, v_fingerprint
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_adjustment_id;

  if v_adjustment_id is null then
    select id into v_adjustment_id
    from public.savings_allocation_adjustments
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
  end if;

  update public.idempotency_requests
  set result_id = v_adjustment_id
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return v_adjustment_id;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger accounts_sync_archived_at
  before insert or update on public.accounts
  for each row execute function public.sync_archived_at();

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger savings_goals_sync_archived_at
  before insert or update on public.savings_goals
  for each row execute function public.sync_archived_at();

create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

create constraint trigger transactions_validate_entries
  after insert or update on public.transactions
  deferrable initially deferred
  for each row execute function public.validate_transaction_entries_trigger();

create constraint trigger transaction_entries_validate_transaction
  after insert or update or delete on public.transaction_entries
  deferrable initially deferred
  for each row execute function public.validate_transaction_entries_trigger();

create trigger transaction_entries_balance_guard
  before insert on public.transaction_entries
  for each row execute function public.guard_balance_entry_insert();
create trigger transactions_immutable_guard
  before update or delete on public.transactions
  for each row execute function public.guard_ledger_mutation();
create trigger transaction_entries_immutable_guard
  before update or delete on public.transaction_entries
  for each row execute function public.guard_ledger_mutation();
create trigger categories_system_guard
  before update on public.categories
  for each row execute function public.guard_system_category();
create trigger savings_goals_audit_change
  before update on public.savings_goals
  for each row execute function public.audit_savings_goal_change();
create trigger accounts_immutable_metadata
  before update on public.accounts
  for each row execute function public.guard_immutable_metadata();
create trigger savings_goals_immutable_metadata
  before update on public.savings_goals
  for each row execute function public.guard_immutable_metadata();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.assert_money_amount(numeric, text, boolean) from public, anon, authenticated;
revoke execute on function public.assert_signed_money_amount(numeric, text) from public, anon, authenticated;
revoke execute on function public.assert_idempotency_key(text) from public, anon, authenticated;
revoke execute on function public.assert_text_length(text, integer, text) from public, anon, authenticated;
revoke all on function public.request_fingerprint(VARIADIC text[]) from public, anon, authenticated;
revoke all on function public.request_fingerprint(text,text) from public,anon,authenticated;
revoke all on function public.request_fingerprint(text,text,text) from public,anon,authenticated;
revoke all on function public.request_fingerprint(text,text,text,text) from public,anon,authenticated;
revoke all on function public.request_fingerprint(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.request_fingerprint(text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_idempotency_key(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.record_opening_balance_version(uuid, uuid, uuid, numeric, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.current_account_balance(uuid) from public, anon, authenticated;
revoke all on function public.assert_balance_not_negative(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.sync_archived_at() from public, anon, authenticated;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.validate_transaction_entries(uuid) from public, anon, authenticated;
revoke execute on function public.validate_transaction_entries_trigger() from public, anon, authenticated;
revoke all on function public.guard_ledger_mutation() from public, anon, authenticated;
revoke all on function public.guard_system_category() from public, anon, authenticated;
revoke all on function public.audit_savings_goal_change() from public, anon, authenticated;
revoke all on function public.guard_immutable_metadata() from public, anon, authenticated;
revoke all on function public.guard_balance_entry_insert() from public, anon, authenticated;
revoke all on function public.ensure_transfer_fee_category(uuid, boolean) from public, anon, authenticated;
revoke all on function public.archive_account(uuid, boolean) from public, anon, authenticated;
revoke all on function public.create_savings_goal(text, numeric, date, text) from public, anon, authenticated;
revoke all on function public.update_savings_goal(uuid, text, numeric, date, public.savings_goal_status) from public, anon, authenticated;
revoke all on function public.sync_archived_at() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_transaction_entries(uuid) from public, anon, authenticated;
revoke all on function public.validate_transaction_entries_trigger() from public, anon, authenticated;
revoke all on function public.seed_default_categories(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.create_account(text, public.account_type, numeric, text) to authenticated;
grant execute on function public.update_opening_balance(uuid, numeric) to authenticated;
grant execute on function public.adjust_account_balance(uuid, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.post_income(uuid, numeric, timestamptz, text, text, uuid) to authenticated;
grant execute on function public.post_expense(uuid, uuid, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.post_transfer(uuid, uuid, numeric, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.reverse_transaction(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.add_savings_allocation(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.adjust_savings_allocation(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.archive_account(uuid, boolean) to authenticated;
grant execute on function public.create_savings_goal(text, numeric, date, text) to authenticated;
grant execute on function public.update_savings_goal(uuid, text, numeric, date, public.savings_goal_status) to authenticated;

revoke all on function public.update_opening_balance(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.ensure_transfer_fee_category(uuid, boolean) from public, anon, authenticated;

grant execute on function public.update_opening_balance(uuid, numeric, text) to authenticated;
grant execute on function public.ensure_transfer_fee_category(uuid, boolean) to postgres;

grant execute on function public.assert_money_amount(numeric, text, boolean) to postgres;
grant execute on function public.assert_signed_money_amount(numeric, text) to postgres;
grant execute on function public.assert_idempotency_key(text) to postgres;
grant execute on function public.assert_text_length(text, integer, text) to postgres;
grant execute on function public.request_fingerprint(VARIADIC text[]) to postgres;
grant execute on function public.request_fingerprint(text,text) to postgres;
grant execute on function public.request_fingerprint(text,text,text) to postgres;
grant execute on function public.request_fingerprint(text,text,text,text) to postgres;
grant execute on function public.request_fingerprint(text,text,text,text,text) to postgres;
grant execute on function public.request_fingerprint(text,text,text,text,text,text) to postgres;
grant execute on function public.claim_idempotency_key(uuid, text, text, text, uuid) to postgres;
grant execute on function public.record_opening_balance_version(uuid, uuid, uuid, numeric, numeric, text, uuid) to postgres;
grant execute on function public.current_account_balance(uuid) to postgres;
grant execute on function public.assert_balance_not_negative(uuid, numeric, text) to postgres;
grant execute on function public.set_updated_at() to postgres;
grant execute on function public.sync_archived_at() to postgres;
grant execute on function public.seed_default_categories(uuid) to postgres;
grant execute on function public.handle_new_user() to postgres;
grant execute on function public.validate_transaction_entries(uuid) to postgres;
grant execute on function public.validate_transaction_entries_trigger() to postgres;
grant execute on function public.guard_ledger_mutation() to postgres;
grant execute on function public.guard_system_category() to postgres;
grant execute on function public.audit_savings_goal_change() to postgres;
grant execute on function public.guard_immutable_metadata() to postgres;
grant execute on function public.guard_balance_entry_insert() to postgres;
grant execute on function public.ensure_transfer_fee_category(uuid, boolean) to postgres;
grant execute on function public.archive_account(uuid, boolean) to postgres;
grant execute on function public.create_savings_goal(text, numeric, date, text) to postgres;
grant execute on function public.update_savings_goal(uuid, text, numeric, date, public.savings_goal_status) to postgres;

revoke execute on function public.create_account(text, public.account_type, numeric, text) from public, anon, authenticated;
revoke execute on function public.update_opening_balance(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.adjust_account_balance(uuid, numeric, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.post_income(uuid, numeric, timestamptz, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.post_expense(uuid, uuid, numeric, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.post_transfer(uuid, uuid, numeric, numeric, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.reverse_transaction(uuid, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.add_savings_allocation(uuid, numeric, date, text, text) from public, anon, authenticated;
revoke execute on function public.adjust_savings_allocation(uuid, numeric, date, text, text) from public, anon, authenticated;

grant execute on function public.create_account(text, public.account_type, numeric, text) to authenticated;
grant execute on function public.update_opening_balance(uuid, numeric) to authenticated;
grant execute on function public.adjust_account_balance(uuid, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.post_income(uuid, numeric, timestamptz, text, text, uuid) to authenticated;
grant execute on function public.post_expense(uuid, uuid, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.post_transfer(uuid, uuid, numeric, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.reverse_transaction(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.add_savings_allocation(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.adjust_savings_allocation(uuid, numeric, date, text, text) to authenticated;

insert into public.profiles (id, display_name)
select
  u.id,
  left(
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      ''
    ),
    80
  )
from auth.users u
on conflict (id) do nothing;

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in select id from auth.users loop
    perform public.seed_default_categories(v_user_id);
    insert into public.categories (user_id, name, category_type, icon, is_system)
    values (v_user_id, 'Transfer Fees', 'expense', 'arrow-left-right', true)
    on conflict do nothing;
  end loop;
end;
$$;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute pg_catalog.format('alter function %s owner to postgres', f.signature);
  end loop;
end;
$$;
