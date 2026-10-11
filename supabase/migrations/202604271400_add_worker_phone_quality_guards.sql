-- Shared WhatsApp numbers can belong to distinct profiles; the phone is not identity.
create index if not exists workers_whatsapp_digits_idx
on public.workers ((regexp_replace(whatsapp_number, '\D', '', 'g')))
where whatsapp_number is not null
  and regexp_replace(whatsapp_number, '\D', '', 'g') <> '';
