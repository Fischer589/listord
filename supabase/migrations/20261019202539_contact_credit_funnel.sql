-- Include paid contact-credit packs and reversals in the existing private financial funnel.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';
create or replace view public.commercial_funnel_daily as
with bound_orders as (
  select id, 'workspace'::text as product, browser_session_id, created_at, paid_at,
    reversed_at, reversal_kind, amount from public.employer_workspace_orders
    where stripe_session_id is not null
  union all
  select id, 'direct', browser_session_id, created_at, paid_at,
    reversed_at, reversal_kind, amount from public.employer_direct_contact_orders
    where stripe_session_id is not null
  union all
  select id, 'credit', null::uuid, created_at, paid_at,
    reversed_at, null::text, amount from public.employer_contact_credit_orders
    where stripe_session_id is not null
), attributed_sessions as (
  select distinct on (browser_session_id) browser_session_id, product
  from bound_orders where browser_session_id is not null
  order by browser_session_id, created_at, id
), event_rows as (
  select (e.created_at at time zone 'UTC')::date as day, coalesce(a.product, 'unassigned') as product,
    case when e.event_name = 'page_view' then e.metadata->>'session_id' end as visit_session,
    case when e.event_name in ('directory_search_submitted', 'request_matches') then 1 else 0 end as searches
  from public.analytics_events e
  left join attributed_sessions a on a.browser_session_id::text = e.metadata->>'session_id'
  where (e.event_name = 'page_view' and e.metadata->>'path' in
    ('/', '/solicitar', '/empleadores', '/empleadores/mi-cuenta', '/trabajador/[slug]'))
    or e.event_name in ('directory_search_submitted', 'request_matches')
), event_totals as (
  select day, product, count(distinct visit_session)::bigint as visits,
    sum(searches)::bigint as searches
  from event_rows group by day, product
), order_rows as (
  select (created_at at time zone 'UTC')::date as day, product, 1::bigint as checkout_starts, 0::bigint as paid_orders,
    0::bigint as refunds, 0::bigint as disputes, 0::bigint as refunded_cents,
    0::bigint as disputed_cents, 0::bigint as net_collected_cents from bound_orders
  union all
  select (paid_at at time zone 'UTC')::date, product, 0, 1, 0, 0, 0, 0, amount::bigint
  from bound_orders where paid_at is not null
), reversal_events as (
  -- Recompute from Stripe event time, not webhook delivery time. Refund snapshots
  -- sharing a second must be ordered by their cumulative amount.
  select r.*, b.amount,
    row_number() over (partition by r.product, r.order_id order by r.occurred_at,
      case when r.kind = 'refund' then 0 when r.kind = 'dispute_opened' then 1
        when r.kind = 'dispute_released' then 3 else 2 end,
      case when r.kind = 'refund' then r.cumulative_amount_cents end, r.stripe_event_id) as sequence
  from public.employer_payment_reversals r
  join bound_orders b on b.id = r.order_id and b.product = r.product
  where b.paid_at is not null
), reversal_balances as (
  -- A refund is permanent; a dispute holds only the remaining paid balance.
  -- A won closure alone does not release a hold: funds_reinstated confirms it.
  select r.product, r.order_id, r.kind, r.dispute_id, r.occurred_at, r.sequence,
    least(r.amount, coalesce(refunds.amount, 0))::bigint as refunded_total,
    least(greatest(r.amount - coalesce(refunds.amount, 0), 0),
      coalesce(disputes.amount, 0))::bigint as disputed_total
  from reversal_events r
  left join lateral (
    select max(cumulative_amount_cents) as amount from reversal_events e
    where e.product = r.product and e.order_id = r.order_id
      and e.sequence <= r.sequence and e.kind = 'refund'
  ) refunds on true
  left join lateral (
    select sum(latest.cumulative_amount_cents) as amount from (
      select distinct on (e.dispute_id) e.kind, e.cumulative_amount_cents
      from reversal_events e where e.product = r.product and e.order_id = r.order_id
        and e.sequence <= r.sequence and e.dispute_id is not null
        and e.kind in ('dispute_opened', 'dispute_lost', 'dispute_released')
      order by e.dispute_id, e.sequence desc
    ) latest where latest.kind in ('dispute_opened', 'dispute_lost')
  ) disputes on true
), reversal_deltas as (
  select r.product, r.kind, r.occurred_at, r.dispute_id,
    (r.refunded_total - coalesce(lag(r.refunded_total) over w, 0))::bigint as refund_delta,
    (r.disputed_total - coalesce(lag(r.disputed_total) over w, 0))::bigint as dispute_delta,
    row_number() over (partition by r.product, r.order_id, r.dispute_id order by r.sequence) as dispute_event_number
  from reversal_balances r
  window w as (partition by r.product, r.order_id order by r.sequence)
), financial_rows as (
  select day, product, checkout_starts, paid_orders, refunds, disputes,
    refunded_cents, disputed_cents, net_collected_cents from order_rows
  union all
  select (occurred_at at time zone 'UTC')::date, product, 0, 0,
    case when kind = 'refund' and refund_delta > 0 then 1 else 0 end,
    case when kind in ('dispute_opened', 'dispute_lost') and dispute_event_number = 1 then 1 else 0 end,
    refund_delta, dispute_delta, -(refund_delta + dispute_delta) from reversal_deltas
), order_totals as (
  select day, product, sum(checkout_starts) as checkout_starts, sum(paid_orders) as paid_orders,
    sum(refunds) as refunds, sum(disputes) as disputes,
    sum(refunded_cents) as refunded_cents, sum(disputed_cents) as disputed_cents,
    sum(net_collected_cents) as net_collected_cents from financial_rows group by day, product
), handoff_totals as (
  select (created_at at time zone 'UTC')::date as day, product, count(*)::bigint as authorized_handoffs
  from public.employer_contact_handoffs group by day, product
)
select coalesce(e.day, o.day, h.day) as day,
  coalesce(e.product, o.product, h.product) as product,
  coalesce(e.visits, 0)::bigint as visits,
  coalesce(e.searches, 0)::bigint as searches,
  coalesce(o.checkout_starts, 0)::bigint as checkout_starts,
  coalesce(o.paid_orders, 0)::bigint as paid_orders,
  coalesce(o.refunds, 0)::bigint as refunds,
  coalesce(o.disputes, 0)::bigint as disputes,
  coalesce(o.refunded_cents, 0)::bigint as refunded_cents,
  coalesce(o.disputed_cents, 0)::bigint as disputed_cents,
  coalesce(o.net_collected_cents, 0)::bigint as net_collected_cents,
  coalesce(h.authorized_handoffs, 0)::bigint as authorized_handoffs
from event_totals e full join order_totals o on o.day = e.day and o.product = e.product
full join handoff_totals h on h.day = coalesce(e.day, o.day) and h.product = coalesce(e.product, o.product);
comment on view public.commercial_funnel_daily is
  'Private UTC funnel including contact credits; net collected is paid minus refunds and active dispute holds before processor fees.';
commit;
