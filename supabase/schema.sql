-- ═══════════════════════════════════════════════════════════════
-- عيادة أحمد وضاح — مخطط قاعدة البيانات (Supabase / PostgreSQL)
-- طريقة التركيب: Supabase Dashboard → SQL Editor → الصق هذا الملف كاملا → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── أدوات مشتركة ───
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── الأطباء ───
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  name_ar TEXT,
  specialty TEXT,
  specialty_ar TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ─── الخدمات (الـ11 + أخرى — الأسعار بالدينار) ───
CREATE TABLE IF NOT EXISTS public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  code TEXT NOT NULL UNIQUE,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_fr TEXT,
  price_min NUMERIC DEFAULT 0,
  price_max NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.services (code, name_fr, name_ar, name_en, price_min, price_max) VALUES
  ('root-canal', 'Traitement canalaire', 'علاج الجذور', 'Root canal treatment', 8000, 15000),
  ('ortho', 'Orthodontie', 'تقويم الأسنان', 'Orthodontics', 60000, 120000),
  ('implants', 'Implant dentaire', 'زراعة الأسنان', 'Dental implant', 45000, 70000),
  ('hollywood', 'Hollywood Smile', 'ابتسامة هوليود', 'Hollywood smile', 80000, 200000),
  ('crowns', 'Prothèse fixe', 'التركيبات الثابتة', 'Fixed prosthesis', 12000, 25000),
  ('fillings', 'Composite esthétique', 'الحشوات التجميلية', 'Aesthetic fillings', 3000, 6000),
  ('whitening', 'Blanchiment laser', 'تبييض بالليزر', 'Laser whitening', 12000, 20000),
  ('kids', 'Dentisterie pédiatrique', 'أسنان الأطفال', 'Pediatric dentistry', 2000, 8000),
  ('gum', 'Parodontologie / Détartrage', 'علاج اللثة والتنظيف', 'Gum treatment & scaling', 3000, 8000),
  ('surgery', 'Chirurgie (dent de sagesse)', 'جراحة الأسنان', 'Oral surgery', 5000, 15000),
  ('sedation', 'Anesthésie générale', 'التخدير الكلي', 'General anesthesia', 15000, 30000),
  ('other', 'Autre soin', 'علاج آخر', 'Other care', 0, 0)
ON CONFLICT (code) DO NOTHING;

-- طبيب العيادة
INSERT INTO public.doctors (name, name_ar, specialty, specialty_ar, phone) VALUES
  ('Dr Ahmed Ouadah', 'د. أحمد وضاح', 'Chirurgien Dentiste - Implantologie', 'طبيب جراح أسنان — زراعة وتجميل', '+213553259607')
ON CONFLICT DO NOTHING;

-- ─── المرضى (رقم الهاتف هو المعرف العملي — UNIQUE) ───
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  birth_date DATE,
  address TEXT,
  medical_history TEXT,
  notes TEXT
);

CREATE OR REPLACE FUNCTION public.generate_patient_code() RETURNS TEXT AS $$
DECLARE new_code TEXT; counter INTEGER := 1;
BEGIN
  LOOP
    new_code := 'P' || LPAD(counter::TEXT, 6, '0');
    IF NOT EXISTS (SELECT 1 FROM public.patients WHERE patient_code = new_code) THEN
      RETURN new_code;
    END IF;
    counter := counter + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_patient_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_code IS NULL THEN NEW.patient_code := public.generate_patient_code(); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS patients_set_code ON public.patients;
CREATE TRIGGER patients_set_code BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_code();

DROP TRIGGER IF EXISTS patients_updated_at ON public.patients;
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── المواعيد ───
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  service_code TEXT NOT NULL DEFAULT 'other',
  appt_date DATE NOT NULL,
  appt_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','checked_in','in_treatment','completed','cancelled','no_show')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'website'
);

-- منع الحجز المزدوج على مستوى القاعدة (باستثناء الملغي/الغائب)
DROP INDEX IF EXISTS appointments_no_double_booking;
CREATE UNIQUE INDEX appointments_no_double_booking
  ON public.appointments (appt_date, appt_time)
  WHERE status NOT IN ('cancelled', 'no_show');

-- أي حجز جديد من الموقع يبقى "بانتظار التأكيد" حتى يؤكده الطبيب
CREATE OR REPLACE FUNCTION public.force_pending_on_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.status := 'pending';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_force_pending ON public.appointments;
CREATE TRIGGER appointments_force_pending BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.force_pending_on_insert();

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── خطة العلاج (خدمات المريض — التقسيط المرحلي) ───
CREATE TABLE IF NOT EXISTS public.patient_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','cancelled')),
  agreed_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  scheduled_date DATE,
  completed_date DATE
);

DROP TRIGGER IF EXISTS patient_services_updated_at ON public.patient_services;
CREATE TRIGGER patient_services_updated_at BEFORE UPDATE ON public.patient_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── المالية لكل مريض + الدفعات ───
CREATE TABLE IF NOT EXISTS public.patient_financials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_id UUID NOT NULL UNIQUE REFERENCES public.patients(id) ON DELETE CASCADE,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','ccp','transfer')),
  label TEXT,
  received_by TEXT
);

DROP TRIGGER IF EXISTS patient_financials_updated_at ON public.patient_financials;
CREATE TRIGGER patient_financials_updated_at BEFORE UPDATE ON public.patient_financials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── آراء المرضى ───
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_name TEXT NOT NULL,
  phone TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','published','hidden')),
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL
);

-- ─── قائمة الانتظار الذكية ───
CREATE TABLE IF NOT EXISTS public.waiting_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'any' CHECK (period IN ('any','morning','evening')),
  service_code TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','notified','done','cancelled')),
  notes TEXT
);

-- ─── الأدوار (للمصادقة لاحقا) ───
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

-- ═══════════ سياسات الأمان RLS ═══════════
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- قراءة عامة: الأطباء والخدمات والآراء المنشورة
DROP POLICY IF EXISTS "public read doctors" ON public.doctors;
CREATE POLICY "public read doctors" ON public.doctors FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "public read services" ON public.services;
CREATE POLICY "public read services" ON public.services FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "public read published feedback" ON public.feedback;
CREATE POLICY "public read published feedback" ON public.feedback FOR SELECT TO anon, authenticated USING (status = 'published');

-- الحجز من الموقع: إنشاء مريض + موعد + انضمام للانتظار + إرسال رأي (بدون قراءة)
DROP POLICY IF EXISTS "anon insert patients" ON public.patients;
CREATE POLICY "anon insert patients" ON public.patients FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon insert appointments" ON public.appointments;
CREATE POLICY "anon insert appointments" ON public.appointments FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon insert waiting" ON public.waiting_list;
CREATE POLICY "anon insert waiting" ON public.waiting_list FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon insert feedback" ON public.feedback;
CREATE POLICY "anon insert feedback" ON public.feedback FOR INSERT TO anon, authenticated WITH CHECK (true);

-- الطاقم (بعد تفعيل Auth): كل الصلاحيات
DROP POLICY IF EXISTS "staff full access" ON public.patients;
CREATE POLICY "staff full access" ON public.patients FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff full access" ON public.appointments;
CREATE POLICY "staff full access" ON public.appointments FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff full access" ON public.patient_services;
CREATE POLICY "staff full access" ON public.patient_services FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff full access" ON public.patient_financials;
CREATE POLICY "staff full access" ON public.patient_financials FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff full access" ON public.payments;
CREATE POLICY "staff full access" ON public.payments FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff full access" ON public.feedback;
CREATE POLICY "staff full access" ON public.feedback FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff full access" ON public.waiting_list;
CREATE POLICY "staff full access" ON public.waiting_list FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff manage doctors" ON public.doctors;
CREATE POLICY "staff manage doctors" ON public.doctors FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff manage services" ON public.services;
CREATE POLICY "staff manage services" ON public.services FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- الوقت الحقيقي للوحة الطبيب
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER TABLE public.waiting_list REPLICA IDENTITY FULL;
ALTER TABLE public.feedback REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
