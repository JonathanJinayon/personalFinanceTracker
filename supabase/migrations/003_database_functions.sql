-- Atomic financial operations, integrity triggers, and default-data bootstrap.
-- Every ledger write is SECURITY DEFINER and re-checks auth.uid() ownership.

create or replace function public.assert_money_amount(
  p_amount numeric,
  p_field text,
  p_allow_zero boolean default false
)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
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

create or replace function public.assert_idempotency_key(p_key text)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
begin
  if char_length(coalesce(p_value, '')) > p_max then
    raise exception '% must be at most % characters', p_field, p_max using errcode = '22023';
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_archived_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
  insert into public.categories (user_id, name, category_type, icon)
  values
    (p_user_id, 'Salary', 'income', 'briefcase'),
    (p_user_id, 'Business', 'income', 'store'),
    (p_user_id, 'Gifts', 'income', 'gift'),
    (p_user_id, 'Other Income', 'income', 'plus'),
    (p_user_id, 'Food', 'expense', 'utensils'),
    (p_user_id, 'Transport', 'expense', 'car'),
    (p_user_id, 'Bills', 'expense', 'receipt'),
    (p_user_id, 'Shopping', 'expense', 'shopping-bag'),
    (p_user_id, 'Health', 'expense', 'heart-pulse'),
    (p_user_id, 'Entertainment', 'expense', 'clapperboard'),
    (p_user_id, 'Transfer Fees', 'expense', 'arrow-left-right'),
    (p_user_id, 'Other', 'expense', 'ellipsis')
  on conflict do nothing;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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
  return new;
end;
$$;

create or replace function public.validate_transaction_entries(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
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
set search_path = public, pg_temp
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

create or replace function public.create_account(
  p_name text,
  p_type public.account_type,
  p_opening_balance numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_opening_transaction_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
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

  select id into v_account_id
  from public.accounts
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_account_id is not null then
    return v_account_id;
  end if;

  insert into public.accounts (user_id, name, type, idempotency_key)
  values (v_user_id, v_name, p_type, p_idempotency_key)
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
      v_user_id, 'opening_balance', current_date, 'Opening balance', gen_random_uuid()::text
    )
    returning id into v_opening_transaction_id;

    insert into public.transaction_entries (user_id, transaction_id, account_id, amount)
    values (v_user_id, v_opening_transaction_id, v_account_id, p_opening_balance);
  end if;

  return v_account_id;
end;
$$;

create or replace function public.post_income(
  p_account_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_description text,
  p_idempotency_key text,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_id uuid;
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

  select id into v_transaction_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  if not exists (
    select 1 from public.accounts
    where id = p_account_id and user_id = v_user_id and status = 'active'
  ) then
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
    user_id, type, transaction_date, description, category_id, idempotency_key
  )
  values (
    v_user_id, 'income', p_transaction_date, coalesce(p_description, ''),
    p_category_id, p_idempotency_key
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

  return v_transaction_id;
end;
$$;

create or replace function public.post_expense(
  p_account_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_description text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_id uuid;
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

  select id into v_transaction_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  if not exists (
    select 1 from public.accounts
    where id = p_account_id and user_id = v_user_id and status = 'active'
  ) then
    raise exception 'Expense account not found or not active' using errcode = '42501';
  end if;

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
    user_id, type, transaction_date, description, category_id, idempotency_key
  )
  values (
    v_user_id, 'expense', p_transaction_date, coalesce(p_description, ''),
    p_category_id, p_idempotency_key
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

  return v_transaction_id;
end;
$$;

create or replace function public.post_transfer(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_fee numeric,
  p_transaction_date date,
  p_description text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_id uuid;
  v_fee_transaction_id uuid;
  v_fee_category_id uuid;
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

  insert into public.transactions (
    user_id, type, transaction_date, description, idempotency_key
  )
  values (
    v_user_id, 'transfer', p_transaction_date, coalesce(p_description, ''), p_idempotency_key
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
    select id into v_fee_category_id
    from public.categories
    where user_id = v_user_id
      and category_type = 'expense'
      and is_archived = false
      and lower(btrim(name)) = 'transfer fees'
    limit 1;

    if v_fee_category_id is null then
      begin
        insert into public.categories (user_id, name, category_type, icon)
        values (v_user_id, 'Transfer Fees', 'expense', 'arrow-left-right')
        returning id into v_fee_category_id;
      exception when unique_violation then
        select id into v_fee_category_id
        from public.categories
        where user_id = v_user_id
          and category_type = 'expense'
          and is_archived = false
          and lower(btrim(name)) = 'transfer fees'
        limit 1;
      end;
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

  return v_transaction_id;
end;
$$;

create or replace function public.reverse_transaction(
  p_transaction_id uuid,
  p_transaction_date date,
  p_description text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.transactions%rowtype;
  v_reversal_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_description, 500, 'Description');

  if p_transaction_date is null then
    raise exception 'Transaction date is required' using errcode = '22023';
  end if;

  select id into v_reversal_id
  from public.transactions
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_reversal_id is not null then
    return v_reversal_id;
  end if;

  select * into v_original
  from public.transactions
  where id = p_transaction_id and user_id = v_user_id;

  if not found then
    raise exception 'Transaction not found' using errcode = '42501';
  end if;

  if v_original.type = 'reversal' then
    raise exception 'A reversal transaction cannot be reversed' using errcode = '22023';
  end if;

  if v_original.type = 'opening_balance' then
    raise exception 'Opening balances cannot be reversed' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.transactions
    where user_id = v_user_id
      and type = 'reversal'
      and related_transaction_id = p_transaction_id
  ) then
    raise exception 'Transaction has already been reversed' using errcode = '23505';
  end if;

  insert into public.transactions (
    user_id, type, transaction_date, description, related_transaction_id, idempotency_key
  )
  values (
    v_user_id,
    'reversal',
    p_transaction_date,
    coalesce(nullif(btrim(p_description), ''), 'Reversal of transaction ' || left(v_original.id::text, 8)),
    p_transaction_id,
    p_idempotency_key
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
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_allocation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.assert_money_amount(p_amount, 'Allocation amount', false);
  perform public.assert_idempotency_key(p_idempotency_key);
  perform public.assert_text_length(p_note, 300, 'Note');

  if p_allocation_date is null then
    raise exception 'Allocation date is required' using errcode = '22023';
  end if;

  select id into v_allocation_id
  from public.savings_allocations
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_allocation_id is not null then
    return v_allocation_id;
  end if;

  if not exists (
    select 1 from public.savings_goals
    where id = p_goal_id and user_id = v_user_id and status <> 'archived'
  ) then
    raise exception 'Savings goal not found or archived' using errcode = '42501';
  end if;

  insert into public.savings_allocations (
    user_id, goal_id, amount, allocation_date, note, idempotency_key
  )
  values (
    v_user_id, p_goal_id, p_amount, p_allocation_date, coalesce(p_note, ''), p_idempotency_key
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_allocation_id;

  if v_allocation_id is null then
    select id into v_allocation_id
    from public.savings_allocations
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
  end if;

  return v_allocation_id;
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.assert_money_amount(numeric, text, boolean) from public, anon, authenticated;
revoke execute on function public.assert_idempotency_key(text) from public, anon, authenticated;
revoke execute on function public.assert_text_length(text, integer, text) from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.sync_archived_at() from public, anon, authenticated;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.validate_transaction_entries(uuid) from public, anon, authenticated;
revoke execute on function public.validate_transaction_entries_trigger() from public, anon, authenticated;

revoke execute on function public.create_account(text, public.account_type, numeric, text) from public, anon, authenticated;
revoke execute on function public.post_income(uuid, numeric, date, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.post_expense(uuid, uuid, numeric, date, text, text) from public, anon, authenticated;
revoke execute on function public.post_transfer(uuid, uuid, numeric, numeric, date, text, text) from public, anon, authenticated;
revoke execute on function public.reverse_transaction(uuid, date, text, text) from public, anon, authenticated;
revoke execute on function public.add_savings_allocation(uuid, numeric, date, text, text) from public, anon, authenticated;

grant execute on function public.create_account(text, public.account_type, numeric, text) to authenticated;
grant execute on function public.post_income(uuid, numeric, date, text, text, uuid) to authenticated;
grant execute on function public.post_expense(uuid, uuid, numeric, date, text, text) to authenticated;
grant execute on function public.post_transfer(uuid, uuid, numeric, numeric, date, text, text) to authenticated;
grant execute on function public.reverse_transaction(uuid, date, text, text) to authenticated;
grant execute on function public.add_savings_allocation(uuid, numeric, date, text, text) to authenticated;

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
  end loop;
end;
$$;
