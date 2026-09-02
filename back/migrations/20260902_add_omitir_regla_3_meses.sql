-- Agrega el campo global que permite al administrador omitir la regla de "< 3 meses de ingreso"
-- para imprimir carnets. Aplica a TODOS los roles (administrador y usuario común), pues es
-- un ajuste global controlado solo por el admin.
ALTER TABLE public.session_settings
    ADD COLUMN IF NOT EXISTS omitir_regla_3_meses boolean NOT NULL DEFAULT false;

ALTER TABLE public.session_settings
    ADD COLUMN IF NOT EXISTS habilitar_impresion_franja boolean NOT NULL DEFAULT true;
