-- Expandir tabela de máquinas com campos adicionais para gestão completa
-- (mantém campos existentes: id, name, model, serial_number, created_at, updated_at)

-- Adicionar campos novos
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS internal_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS plate TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE'));

-- Comentários para documentação
COMMENT ON COLUMN public.machines.internal_id IS 'ID interno da máquina (ex: AT12J0001)';
COMMENT ON COLUMN public.machines.brand IS 'Marca/fabricante (ex: JOHN DEERE)';
COMMENT ON COLUMN public.machines.plate IS 'Matrícula/placa (ex: AX3685)';
COMMENT ON COLUMN public.machines.status IS 'Estado da máquina: ACTIVE, MAINTENANCE, INACTIVE';
COMMENT ON COLUMN public.machines.model IS 'Modelo completo (ex: 5120 M)';
COMMENT ON COLUMN public.machines.serial_number IS 'Número de série (ex: JD66652R125438)';
