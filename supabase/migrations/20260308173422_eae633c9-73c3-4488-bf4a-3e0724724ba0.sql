-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'moderator');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has any admin role (owner, admin, or moderator)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin', 'moderator')
  )
$$;

-- RLS Policies for user_roles
-- Only owners can view all roles
CREATE POLICY "Staff can view all roles" ON public.user_roles
FOR SELECT USING (public.is_staff(auth.uid()));

-- Only owners can insert roles
CREATE POLICY "Owners can insert roles" ON public.user_roles
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Only owners can delete roles
CREATE POLICY "Owners can delete roles" ON public.user_roles
FOR DELETE USING (public.has_role(auth.uid(), 'owner'));

-- Create admin_logs table for audit
CREATE TABLE public.admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for admin_logs
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Only staff can view logs
CREATE POLICY "Staff can view logs" ON public.admin_logs
FOR SELECT USING (public.is_staff(auth.uid()));

-- Staff can insert logs
CREATE POLICY "Staff can insert logs" ON public.admin_logs
FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- Create announcements table for global notifications
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can view active announcements
CREATE POLICY "Anyone can view active announcements" ON public.announcements
FOR SELECT USING (is_active = true);

-- Staff can manage announcements
CREATE POLICY "Staff can insert announcements" ON public.announcements
FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update announcements" ON public.announcements
FOR UPDATE USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete announcements" ON public.announcements
FOR DELETE USING (public.is_staff(auth.uid()));