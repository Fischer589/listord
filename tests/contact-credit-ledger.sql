-- Run against an isolated production restore after the credit migration.
-- The transaction rolls back every fixture and does not change worker rows.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-0000000000c1');
do $$
declare
  v_owner uuid := '00000000-0000-4000-8000-0000000000c1';
  v_worker uuid; v_other uuid; v_order uuid; v_result record; v_status text;
begin
  select id into v_worker from public.workers where is_verified and whatsapp_number is not null order by id limit 1;
  select id into v_other from public.workers where is_verified and whatsapp_number is not null and id<>v_worker order by id limit 1;
  if v_worker is null or v_other is null then raise exception 'FIXTURE_WORKERS_MISSING'; end if;

  insert into public.employer_contact_credit_orders(owner_user_id,pack_size,amount,stripe_session_id)
    values(v_owner,5,44500,'cs_test_credit_ledger_fixture') returning id into v_order;
  select public.settle_contact_credit_order(v_order,v_owner,'cs_test_credit_ledger_fixture',
    'pi_credit_ledger_fixture','evt_credit_paid_fixture',44500,'dop','paid') into v_status;
  if v_status<>'updated' then raise exception 'PAYMENT_NOT_SETTLED'; end if;
  select public.settle_contact_credit_order(v_order,v_owner,'cs_test_credit_ledger_fixture',
    'pi_credit_ledger_fixture','evt_credit_paid_fixture',44500,'dop','paid') into v_status;
  if v_status<>'duplicate' then raise exception 'REPLAY_NOT_IDEMPOTENT'; end if;

  select * into v_result from public.authorize_worker_contact(v_owner,v_worker,'cs_live_',true);
  if v_result.allowed then raise exception 'CROSS_MODE_ACCESS'; end if;
  select * into v_result from public.authorize_worker_contact(v_owner,v_worker,'cs_test_',false);
  if v_result.allowed or v_result.remaining<>5 then raise exception 'STATUS_SPENT_CREDIT'; end if;
  select * into v_result from public.authorize_worker_contact(v_owner,v_worker,'cs_test_',true);
  if not v_result.allowed or v_result.remaining<>4 or v_result.already_unlocked then raise exception 'FIRST_UNLOCK_INVALID'; end if;
  select * into v_result from public.authorize_worker_contact(v_owner,v_worker,'cs_test_',true);
  if not v_result.allowed or v_result.remaining<>4 or not v_result.already_unlocked then raise exception 'REPEAT_CHARGED'; end if;
  select * into v_result from public.authorize_worker_contact(v_owner,v_other,'cs_test_',true);
  if not v_result.allowed or v_result.remaining<>3 then raise exception 'SECOND_UNLOCK_INVALID'; end if;
  if (select count(*) from public.employer_contact_credit_spends where order_id=v_order)<>2 then raise exception 'SPEND_COUNT_INVALID'; end if;

  select public.settle_contact_credit_order(v_order,v_owner,'cs_test_credit_ledger_fixture',
    'pi_credit_ledger_fixture','evt_credit_refund_fixture',44500,'dop','refunded') into v_status;
  if v_status<>'updated' then raise exception 'REFUND_NOT_SETTLED'; end if;
  select * into v_result from public.authorize_worker_contact(v_owner,v_worker,'cs_test_',true);
  if v_result.allowed or v_result.remaining<>0 then raise exception 'REFUNDED_UNLOCK_ACCESS'; end if;
  select public.settle_contact_credit_order(v_order,v_owner,'cs_test_credit_ledger_fixture',
    'pi_credit_ledger_fixture','evt_credit_paid_fixture',44500,'dop','paid') into v_status;
  if v_status<>'terminal' then raise exception 'REPLAY_RESTORED_REFUND'; end if;

  insert into public.employer_contact_credit_orders(owner_user_id,pack_size,amount,stripe_session_id)
    values(v_owner,1,10000,'cs_test_credit_repurchase_fixture') returning id into v_order;
  perform public.settle_contact_credit_order(v_order,v_owner,'cs_test_credit_repurchase_fixture',
    'pi_credit_repurchase_fixture','evt_credit_repurchase_fixture',10000,'dop','paid');
  select * into v_result from public.authorize_worker_contact(v_owner,v_worker,'cs_test_',true);
  if not v_result.allowed or v_result.remaining<>0 or v_result.already_unlocked then raise exception 'REPURCHASE_INVALID'; end if;
  select * into v_result from public.authorize_worker_contact(v_owner,v_worker,'cs_test_',true);
  if not v_result.allowed or v_result.remaining<>0 or not v_result.already_unlocked then raise exception 'REPURCHASE_REPEAT_CHARGED'; end if;
end $$;
rollback;
