  -- Supabase Database Schema for TowerDevDashboard Web3 Developer Dashboard
  -- Extended and optimized for developer metrics, subscriptions, quotas, webhooks, and auditing.

  -- Create custom enum for api key environment
  create type public.key_environment as enum ('test', 'live');

  -- Utility function to automatically handle updated_at timestamps
  create or replace function public.handle_updated_at()
  returns trigger as $$
  begin
    new.updated_at = timezone('utc'::text, now());
    return new;
  end;
  $$ language plpgsql;

  ---------------------------------------------------------
  -- 1. Users Table
  ---------------------------------------------------------
  create table public.users (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    email text not null unique,
    password_hash text not null,
    email_verified boolean not null default false,
    otp_code text,
    otp_expires_at timestamp with time zone,
    otp_attempts smallint not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on Users
  alter table public.users enable row level security;

  -- Policies for users
  create policy "Users can view their own record"
    on public.users for select
    using (auth.uid() = id);

  create policy "Users can update their own record"
    on public.users for update
    using (auth.uid() = id);

  create trigger update_users_timestamp
    before update on public.users
    for each row execute function public.handle_updated_at();


  ---------------------------------------------------------
  -- 2. API Products / Services & Scopes
  ---------------------------------------------------------
  create table public.api_products (
    id text primary key, -- e.g. 'swaps', 'bridges', 'wallets'
    name text not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on API Products
  alter table public.api_products enable row level security;

  -- Policies for API Products
  create policy "Anyone can read available API products"
    on public.api_products for select
    using (true);

  create trigger update_api_products_timestamp
    before update on public.api_products
    for each row execute function public.handle_updated_at();


  create table public.scopes (
    id text primary key, -- e.g. 'swaps', 'bridges'
    label text not null,
    description text not null,
    product_id text references public.api_products(id) on delete cascade
  );

  -- Enable RLS on Scopes
  alter table public.scopes enable row level security;

  -- Policies for scopes
  create policy "Anyone can read available scopes"
    on public.scopes for select
    using (true);

  create index idx_scopes_product_id on public.scopes(product_id);


  ---------------------------------------------------------
  -- 3. API Keys Table
  ---------------------------------------------------------
  create table public.api_keys (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    name text not null,
    environment public.key_environment not null default 'live',
    key_prefix text not null, -- Masked value shown in UI, e.g. "sk_live_2b8f"
    key_hash text not null unique, -- SHA-256 hash of secret key
    rate_limit integer, -- Speed limit in RPM. Nullable (unlimited if null)
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone, -- Nullable
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on API Keys
  alter table public.api_keys enable row level security;

  -- Policies for api_keys
  create policy "Users can view their own API keys"
    on public.api_keys for select
    using (auth.uid() = user_id);

  create policy "Users can generate their own API keys"
    on public.api_keys for insert
    with check (auth.uid() = user_id);

  create policy "Users can edit their own API keys"
    on public.api_keys for update
    using (auth.uid() = user_id);

  create policy "Users can revoke their own API keys"
    on public.api_keys for delete
    using (auth.uid() = user_id);

  create trigger update_api_keys_timestamp
    before update on public.api_keys
    for each row execute function public.handle_updated_at();

  create index idx_api_keys_user_id on public.api_keys(user_id);
  create index idx_api_keys_key_hash on public.api_keys(key_hash);


  ---------------------------------------------------------
  -- 4. API Key Scopes Table (Many-to-Many Join Table)
  ---------------------------------------------------------
  create table public.api_key_scopes (
    api_key_id uuid references public.api_keys(id) on delete cascade not null,
    scope_id text references public.scopes(id) on delete cascade not null,
    primary key (api_key_id, scope_id)
  );

  -- Enable RLS on API Key Scopes
  alter table public.api_key_scopes enable row level security;

  -- Policies for api_key_scopes
  create policy "Users can view scopes of their own keys"
    on public.api_key_scopes for select
    using (
      exists (
        select 1 from public.api_keys
        where public.api_keys.id = api_key_id
        and public.api_keys.user_id = auth.uid()
      )
    );

  create policy "Users can assign scopes to their own keys"
    on public.api_key_scopes for insert
    with check (
      exists (
        select 1 from public.api_keys
        where public.api_keys.id = api_key_id
        and public.api_keys.user_id = auth.uid()
      )
    );

  create policy "Users can delete scope bindings of their own keys"
    on public.api_key_scopes for delete
    using (
      exists (
        select 1 from public.api_keys
        where public.api_keys.id = api_key_id
        and public.api_keys.user_id = auth.uid()
      )
    );

  create index idx_api_key_scopes_scope_id on public.api_key_scopes(scope_id);


  ---------------------------------------------------------
  -- 5. Subscription Plans & Quotas
  ---------------------------------------------------------
  create table public.subscription_plans (
    id uuid default gen_random_uuid() primary key,
    name text not null unique,
    price_monthly numeric(10,2) not null default 0.00 check (price_monthly >= 0),
    request_limit bigint, -- Monthly volume quota (e.g. 100000). Null means unlimited.
    rate_limit integer, -- Rate limit (e.g. 60 RPM). Null means unlimited.
    features jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on Subscription Plans
  alter table public.subscription_plans enable row level security;

  -- Policies for Subscription Plans
  create policy "Anyone can read available subscription plans"
    on public.subscription_plans for select
    using (true);

  create trigger update_subscription_plans_timestamp
    before update on public.subscription_plans
    for each row execute function public.handle_updated_at();


  create table public.rate_limit_rules (
    id uuid default gen_random_uuid() primary key,
    plan_id uuid references public.subscription_plans(id) on delete cascade not null unique,
    requests_per_minute integer check (requests_per_minute > 0),
    requests_per_hour integer check (requests_per_hour > 0),
    requests_per_day integer check (requests_per_day > 0)
  );

  -- Enable RLS on Rate Limit Rules
  alter table public.rate_limit_rules enable row level security;

  -- Policies for Rate Limit Rules
  create policy "Anyone can read rate limit rules"
    on public.rate_limit_rules for select
    using (true);

  create index idx_rate_limit_rules_plan_id on public.rate_limit_rules(plan_id);


  create table public.usage_quotas (
    id uuid default gen_random_uuid() primary key,
    plan_id uuid references public.subscription_plans(id) on delete cascade not null unique,
    monthly_requests bigint not null check (monthly_requests >= 0),
    monthly_compute_units bigint not null default 0 check (monthly_compute_units >= 0)
  );

  -- Enable RLS on Usage Quotas
  alter table public.usage_quotas enable row level security;

  -- Policies for Usage Quotas
  create policy "Anyone can read usage quotas"
    on public.usage_quotas for select
    using (true);

  create index idx_usage_quotas_plan_id on public.usage_quotas(plan_id);


  ---------------------------------------------------------
  -- 6. User Subscriptions
  ---------------------------------------------------------
  create table public.user_subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    plan_id uuid references public.subscription_plans(id) on delete restrict not null,
    status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
    current_period_start timestamp with time zone not null,
    current_period_end timestamp with time zone not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on User Subscriptions
  alter table public.user_subscriptions enable row level security;

  -- Policies for User Subscriptions
  create policy "Users can view their own subscription"
    on public.user_subscriptions for select
    using (auth.uid() = user_id);

  create trigger update_user_subscriptions_timestamp
    before update on public.user_subscriptions
    for each row execute function public.handle_updated_at();

  create index idx_user_subscriptions_user_id on public.user_subscriptions(user_id);
  create index idx_user_subscriptions_plan_id on public.user_subscriptions(plan_id);


  ---------------------------------------------------------
  -- 7. Billing & Payments
  ---------------------------------------------------------
  create table public.invoices (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete set null not null,
    subscription_id uuid references public.user_subscriptions(id) on delete set null,
    amount numeric(10,2) not null check (amount >= 0),
    currency text not null default 'USD',
    status text not null check (status in ('draft', 'open', 'paid', 'uncollectible', 'void')),
    pdf_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on Invoices
  alter table public.invoices enable row level security;

  -- Policies for Invoices
  create policy "Users can view their own invoices"
    on public.invoices for select
    using (auth.uid() = user_id);

  create trigger update_invoices_timestamp
    before update on public.invoices
    for each row execute function public.handle_updated_at();

  create index idx_invoices_user_id on public.invoices(user_id);
  create index idx_invoices_sub_id on public.invoices(subscription_id);


  create table public.payment_methods (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    provider text not null, -- e.g. 'stripe'
    provider_customer_id text not null,
    card_brand text,
    card_last4 text,
    is_default boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on Payment Methods
  alter table public.payment_methods enable row level security;

  -- Policies for Payment Methods
  create policy "Users can manage their own payment methods"
    on public.payment_methods for all
    using (auth.uid() = user_id);

  create trigger update_payment_methods_timestamp
    before update on public.payment_methods
    for each row execute function public.handle_updated_at();

  create index idx_payment_methods_user_id on public.payment_methods(user_id);


  ---------------------------------------------------------
  -- 8. API Usage Tracking & Request Logs
  ---------------------------------------------------------
  create table public.api_usage (
    id bigint generated always as identity primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    api_key_id uuid references public.api_keys(id) on delete cascade not null,
    endpoint text not null,
    method text not null,
    requests_count integer not null default 1 check (requests_count >= 1),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on API Usage
  alter table public.api_usage enable row level security;

  -- Policies for API Usage
  create policy "Users can view their own usage statistics"
    on public.api_usage for select
    using (auth.uid() = user_id);

  create index idx_api_usage_user_id on public.api_usage(user_id);
  create index idx_api_usage_key_id on public.api_usage(api_key_id);
  create index idx_api_usage_created_at on public.api_usage(created_at);


  create table public.api_request_logs (
    id bigint generated always as identity primary key,
    api_key_id uuid references public.api_keys(id) on delete set null,
    user_id uuid references public.users(id) on delete set null,
    endpoint text not null,
    method text not null,
    status_code integer,
    response_time_ms integer check (response_time_ms >= 0),
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on Request Logs
  alter table public.api_request_logs enable row level security;

  -- Policies for Request Logs
  create policy "Users can view their own request logs"
    on public.api_request_logs for select
    using (auth.uid() = user_id);

  create index idx_request_logs_key_id on public.api_request_logs(api_key_id);
  create index idx_request_logs_user_id on public.api_request_logs(user_id);
  create index idx_request_logs_created_at on public.api_request_logs(created_at);


  ---------------------------------------------------------
  -- 9. Webhooks & Deliveries
  ---------------------------------------------------------
  create table public.webhooks (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    url text not null,
    secret text not null,
    active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on Webhooks
  alter table public.webhooks enable row level security;

  -- Policies for Webhooks
  create policy "Users can view their own webhooks"
    on public.webhooks for select
    using (auth.uid() = user_id);

  create policy "Users can manage their own webhooks"
    on public.webhooks for all
    using (auth.uid() = user_id);

  create trigger update_webhooks_timestamp
    before update on public.webhooks
    for each row execute function public.handle_updated_at();

  create index idx_webhooks_user_id on public.webhooks(user_id);


  create table public.webhook_deliveries (
    id bigint generated always as identity primary key,
    webhook_id uuid references public.webhooks(id) on delete cascade not null,
    event_type text not null,
    status_code integer,
    response_body text,
    response_time_ms integer check (response_time_ms >= 0),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on Webhook Deliveries
  alter table public.webhook_deliveries enable row level security;

  -- Policies for Webhook Deliveries
  create policy "Users can view deliveries of their own webhooks"
    on public.webhook_deliveries for select
    using (
      exists (
        select 1 from public.webhooks
        where public.webhooks.id = webhook_id
        and public.webhooks.user_id = auth.uid()
      )
    );

  create index idx_webhook_deliveries_webhook_id on public.webhook_deliveries(webhook_id);
  create index idx_webhook_deliveries_created_at on public.webhook_deliveries(created_at);


  ---------------------------------------------------------
  -- 10. Audit Logs
  ---------------------------------------------------------
  create table public.audit_logs (
    id bigint generated always as identity primary key,
    user_id uuid references public.users(id) on delete set null,
    action text not null,
    metadata jsonb default '{}'::jsonb not null,
    ip_address inet,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- Enable RLS on Audit Logs
  alter table public.audit_logs enable row level security;

  -- Policies for Audit Logs
  create policy "Users can view their own audit logs"
    on public.audit_logs for select
    using (auth.uid() = user_id);

  create index idx_audit_logs_user_id on public.audit_logs(user_id);
  create index idx_audit_logs_created_at on public.audit_logs(created_at);


  ---------------------------------------------------------
  -- 11. Default Seed Data
  ---------------------------------------------------------

  -- 11.1 Seed API Products
  insert into public.api_products (id, name, description) values
    ('swaps', 'Token Swaps Engine', 'Execute and query automated token swaps across multiple DeFi pools'),
    ('bridges', 'Cross-Chain Bridges', 'Bridge native assets and ERC-20 tokens seamlessly between EVM and Non-EVM networks'),
    ('wallets', 'Smart Wallet SDK', 'Programmable embedded wallets and Account Abstraction tools'),
    ('tokens', 'Token Data Services', 'Retrieve token metadata, real-time prices, historical volume, and balances'),
    ('nfts', 'NFT Indexer API', 'Query NFT ownership metadata, media asset validation, and collection floor prices')
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description;

  -- 11.2 Seed Scopes linked to products
  insert into public.scopes (id, label, description, product_id) values
    ('swaps', 'Swaps', 'Allow executing and querying token swaps', 'swaps'),
    ('bridges', 'Bridges', 'Allow bridging assets across chains', 'bridges'),
    ('read', 'Read Only', 'Allow read-only queries', null)
  on conflict (id) do update set
    label = excluded.label,
    description = excluded.description,
    product_id = excluded.product_id;

  -- 11.3 Seed Subscription Plans
  insert into public.subscription_plans (id, name, price_monthly, request_limit, rate_limit, features) values
    ('6d0d2bdf-fb3d-4c31-97b7-68b375b42d7a', 'Free', 0.00, 100000, 60, '{"analytics": false, "webhooks": false, "sla": "None"}'),
    ('b09c5d14-411a-4d37-9759-866468a52e72', 'Starter', 29.00, 1000000, 300, '{"analytics": true, "webhooks": true, "sla": "99.5%"}'),
    ('c490a612-42fe-4654-be87-57ad23ff3a9f', 'Pro', 99.00, 10000000, 1000, '{"analytics": true, "webhooks": true, "sla": "99.9%"}'),
    ('e5f9810a-3a78-43e6-993d-9d0b38ff13a1', 'Enterprise', 499.00, 100000000, 5000, '{"analytics": true, "webhooks": true, "sla": "99.99%"}')
  on conflict (id) do update set
    name = excluded.name,
    price_monthly = excluded.price_monthly,
    request_limit = excluded.request_limit,
    rate_limit = excluded.rate_limit,
    features = excluded.features;

  -- 11.4 Seed Rate Limit Rules for Plans
  insert into public.rate_limit_rules (plan_id, requests_per_minute, requests_per_hour, requests_per_day) values
    ('6d0d2bdf-fb3d-4c31-97b7-68b375b42d7a', 60, 3600, 86400),
    ('b09c5d14-411a-4d37-9759-866468a52e72', 300, 18000, 432000),
    ('c490a612-42fe-4654-be87-57ad23ff3a9f', 1000, 60000, 1440000),
    ('e5f9810a-3a78-43e6-993d-9d0b38ff13a1', 5000, 300000, 7200000)
  on conflict (plan_id) do update set
    requests_per_minute = excluded.requests_per_minute,
    requests_per_hour = excluded.requests_per_hour,
    requests_per_day = excluded.requests_per_day;

  -- 11.5 Seed Usage Quotas for Plans
  insert into public.usage_quotas (plan_id, monthly_requests, monthly_compute_units) values
    ('6d0d2bdf-fb3d-4c31-97b7-68b375b42d7a', 100000, 0),
    ('b09c5d14-411a-4d37-9759-866468a52e72', 1000000, 10000),
    ('c490a612-42fe-4654-be87-57ad23ff3a9f', 10000000, 100000),
    ('e5f9810a-3a78-43e6-993d-9d0b38ff13a1', 100000000, 1000000)
  on conflict (plan_id) do update set
    monthly_requests = excluded.monthly_requests,
    monthly_compute_units = excluded.monthly_compute_units;
