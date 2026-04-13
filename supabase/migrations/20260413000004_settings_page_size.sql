alter table public.settings
  add column if not exists receipt_page_size text not null default 'a5';

alter table public.settings
  add constraint settings_receipt_page_size_chk
  check (receipt_page_size in ('a4', 'a5', 'a6', 'letter'));
