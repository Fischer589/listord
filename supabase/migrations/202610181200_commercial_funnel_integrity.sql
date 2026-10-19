-- Private commercial funnel. Apply before deploying code that writes these columns.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'page_view', 'worker_view', 'contact_click', 'paywall_open', 'checkout_start', 'checkout_success',
  'request_started', 'request_preview', 'request_abandoned', 'request_matches', 'request_contact',
  'directory_search_submitted', 'boost_purchase_started', 'boost_payment_success',
  'boost_activated', 'boost_expired', 'boosted_profile_view', 'boost_contact_initiated'
));

alter table public.employer_workspace_orders
  add column browser_session_id uuid,
  add column reversed_at timestamptz,
  add column reversal_kind text check (reversal_kind in ('refund', 'dispute'));
alter table public.employer_direct_contact_orders
  add column browser_session_id uuid,
  add column reversed_at timestamptz,
  add column reversal_kind text check (reversal_kind in ('refund', 'dispute'));
create index employer_workspace_orders_browser_session_idx on public.employer_workspace_orders(browser_session_id) where browser_session_id is not null;
create index employer_direct_orders_browser_session_idx on public.employer_direct_contact_orders(browser_session_id) where browser_session_id is not null;

create table public.employer_contact_handoffs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  product text not null check (product in ('direct', 'workspace')),
  route text not null check (route in ('worker', 'request', 'marketplace', 'workspace')),
  created_at timestamptz not null default now()
);
create index employer_contact_handoffs_created_idx on public.employer_contact_handoffs(created_at, product);
alter table public.employer_contact_handoffs enable row level security;
revoke all on public.employer_contact_handoffs from anon, authenticated;
grant all on public.employer_contact_handoffs to service_role;
comment on table public.employer_contact_handoffs is
  'Private count of server-authorized contact URL issuances; contains no phone, message, or URL.';

create table public.employer_payment_reversals (
  stripe_event_id text primary key,
  order_id uuid not null,
  product text not null check (product in ('direct', 'workspace')),
  kind text not null check (kind in ('refund', 'dispute')),
  cumulative_amount_cents integer not null check (cumulative_amount_cents > 0),
  occurred_at timestamptz not null
);
create index employer_payment_reversals_order_idx on public.employer_payment_reversals(product, order_id, occurred_at);
alter table public.employer_payment_reversals enable row level security;
revoke all on public.employer_payment_reversals from anon, authenticated;
grant all on public.employer_payment_reversals to service_role;
comment on table public.employer_payment_reversals is
  'Private idempotent snapshots of cumulative amounts from signed Stripe refund and dispute webhooks.';

-- Only service_role can read this view. Anonymous visits/searches are assigned to
-- the first bound Checkout product for that browser session, otherwise unassigned.
-- Payments come only from paid_at on private orders; browser events never count.
create view public.commercial_funnel_daily as
with bound_orders as (
  select id, 'workspace'::text as product, browser_session_id, created_at, paid_at,
    reversed_at, reversal_kind, amount from public.employer_workspace_orders
    where stripe_session_id is not null
  union all
  select id, 'direct', browser_session_id, created_at, paid_at,
    reversed_at, reversal_kind, amount from public.employer_direct_contact_orders
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
    0::bigint as refunds, 0::bigint as disputes, 0::bigint as net_collected_cents from bound_orders
  union all
  select (paid_at at time zone 'UTC')::date, product, 0, 1, 0, 0, amount::bigint
  from bound_orders where paid_at is not null
), reversal_deltas as (
  select r.product, r.kind, r.occurred_at,
    greatest(least(r.cumulative_amount_cents, b.amount) - coalesce(max(least(r.cumulative_amount_cents, b.amount))
      over (partition by r.product, r.order_id order by r.occurred_at, r.stripe_event_id
        rows between unbounded preceding and 1 preceding), 0), 0)::bigint as delta_cents
  from public.employer_payment_reversals r
  join bound_orders b on b.id = r.order_id and b.product = r.product
), financial_rows as (
  select day, product, checkout_starts, paid_orders, refunds, disputes, net_collected_cents from order_rows
  union all
  select (occurred_at at time zone 'UTC')::date, product, 0, 0,
    case when kind = 'refund' then 1 else 0 end,
    case when kind = 'dispute' then 1 else 0 end,
    -delta_cents from reversal_deltas
), order_totals as (
  select day, product, sum(checkout_starts) as checkout_starts, sum(paid_orders) as paid_orders,
    sum(refunds) as refunds, sum(disputes) as disputes,
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
  coalesce(o.net_collected_cents, 0)::bigint as net_collected_cents,
  coalesce(h.authorized_handoffs, 0)::bigint as authorized_handoffs
from event_totals e full join order_totals o on o.day = e.day and o.product = e.product
full join handoff_totals h on h.day = coalesce(e.day, o.day) and h.product = coalesce(e.product, o.product);
revoke all on public.commercial_funnel_daily from public, anon, authenticated;
grant select on public.commercial_funnel_daily to service_role;
comment on view public.commercial_funnel_daily is
  'Private UTC daily funnel. net_collected_cents is gross paid minus signed refund/dispute increments, before processor fees; historical reversals need reconciliation.';
commit;
