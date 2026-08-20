-- Onboarding guiado: checklist de primeros pasos que aparece en el Dashboard
-- hasta que el usuario la completa o la oculta manualmente.
alter table public.profiles add column if not exists onboarding_checklist_dismissed boolean default false;
