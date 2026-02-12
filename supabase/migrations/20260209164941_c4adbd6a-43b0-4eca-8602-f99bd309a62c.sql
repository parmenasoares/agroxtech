-- Fleet Management System Schema

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'COORDENADOR', 'OPERADOR');

-- Users table (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Machines table
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  model TEXT,
  serial_number TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  operator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  start_odometer NUMERIC(10,2) NOT NULL,
  end_odometer NUMERIC(10,2),
  start_gps JSONB,
  end_gps JSONB,
  start_photo_url TEXT,
  end_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_VALIDATION' CHECK (status IN ('PENDING_VALIDATION', 'VALIDATED', 'REJECTED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_user_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_operator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_user_role(_user_id, 'OPERADOR')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_coordenador_or_above(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('COORDENADOR', 'ADMIN', 'SUPER_ADMIN')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_activity_owner(_user_id UUID, _activity_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activities
    WHERE id = _activity_id AND operator_id = _user_id
  )
$$;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Coordenadores and above can view all users"
  ON public.users FOR SELECT
  USING (public.is_coordenador_or_above(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (public.is_admin_or_super_admin(auth.uid()));

-- RLS Policies for user_roles table
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin_or_super_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    public.is_admin_or_super_admin(auth.uid()) 
    AND role IN ('ADMIN', 'COORDENADOR', 'OPERADOR')
    AND user_id <> auth.uid()
  );

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (
    public.is_admin_or_super_admin(auth.uid())
  )
  WITH CHECK (
    role IN ('ADMIN', 'COORDENADOR', 'OPERADOR')
  );

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (
    public.is_admin_or_super_admin(auth.uid())
    AND NOT public.is_user_role(user_id, 'SUPER_ADMIN')
  );

-- RLS Policies for machines table
CREATE POLICY "Coordenadores and above can view machines"
  ON public.machines FOR SELECT
  USING (public.is_coordenador_or_above(auth.uid()));

CREATE POLICY "Admins can insert machines"
  ON public.machines FOR INSERT
  WITH CHECK (public.is_admin_or_super_admin(auth.uid()));

CREATE POLICY "Admins can update machines"
  ON public.machines FOR UPDATE
  USING (public.is_admin_or_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete machines"
  ON public.machines FOR DELETE
  USING (public.is_user_role(auth.uid(), 'SUPER_ADMIN'));

-- RLS Policies for activities table
CREATE POLICY "Operators can view own activities"
  ON public.activities FOR SELECT
  USING (public.is_activity_owner(auth.uid(), id));

CREATE POLICY "Coordenadores and above can view all activities"
  ON public.activities FOR SELECT
  USING (public.is_coordenador_or_above(auth.uid()));

CREATE POLICY "Operators can insert activities"
  ON public.activities FOR INSERT
  WITH CHECK (
    public.is_operator(auth.uid())
    AND operator_id = auth.uid()
  );

CREATE POLICY "Operators can update pending activities"
  ON public.activities FOR UPDATE
  USING (
    public.is_operator(auth.uid())
    AND operator_id = auth.uid()
    AND status = 'PENDING_VALIDATION'
  );

CREATE POLICY "Admins can update all activities"
  ON public.activities FOR UPDATE
  USING (public.is_admin_or_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete activities"
  ON public.activities FOR DELETE
  USING (public.is_user_role(auth.uid(), 'SUPER_ADMIN'));

-- Trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();