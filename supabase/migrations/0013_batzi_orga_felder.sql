-- Orga bei den Batzi's: das Formular hat die Felder „Wer / was?“ (person) und „Nächster Termin“ (next_date),
-- die Tabelle aber nicht. Ohne diese Spalten lehnt Supabase jedes Speichern ab.
alter table public.batzi_orga_items
  add column if not exists person text,
  add column if not exists next_date date;

-- Supabase soll die neuen Spalten sofort kennen.
notify pgrst, 'reload schema';
