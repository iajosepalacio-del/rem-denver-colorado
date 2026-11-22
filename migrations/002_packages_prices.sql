alter table events add column if not exists hotel_price_cents int not null default 128000;
alter table financial_accounts add column if not exists package_kind text not null default '';

update events
set price_cents = 108000,
    hotel_price_cents = 128000,
    price_configured = true,
    updated_at = now()
where id = 'rem-denver-2027';
