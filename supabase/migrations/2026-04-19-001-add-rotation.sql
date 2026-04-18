-- Add rotation (degrees) to glyph_configs.
-- Positive = counter-clockwise (math convention), 0 = no rotation.

alter table fontline.glyph_configs
  add column if not exists rotation real not null default 0;

comment on column fontline.glyph_configs.rotation is
  'Rotation in degrees. Positive = counter-clockwise. Applied around the glyph centre.';
