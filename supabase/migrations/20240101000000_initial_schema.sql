-- Enums
CREATE TYPE program_enum AS ENUM ('EGX 100', 'EDEX Next');
CREATE TYPE gender_enum AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE payment_status_enum AS ENUM ('payment_pending', 'paid', 'failed', 'expired');
CREATE TYPE admission_status_enum AS ENUM ('New', 'Contacted', 'Under Review', 'Selected', 'Enrolled');

-- Sequences for Application IDs and Receipts
CREATE SEQUENCE egx_application_id_seq START 1;
CREATE SEQUENCE next_application_id_seq START 1;
CREATE SEQUENCE receipt_number_seq START 1;

-- Applications
CREATE TABLE applications (
  id TEXT PRIMARY KEY, -- Will be like EGX-00001 or NEXT-00001
  program program_enum, -- Can be null initially if they haven't selected
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE,
  gender gender_enum,
  guardian_name TEXT,
  guardian_contact TEXT,
  mobile TEXT NOT NULL,
  second_mobile TEXT,
  email TEXT NOT NULL,
  house_name TEXT,
  area TEXT,
  post_office TEXT,
  district TEXT,
  state TEXT,
  pincode TEXT,
  highest_qualification TEXT,
  custom_qualification TEXT,
  onboarding_reason TEXT,
  payment_status payment_status_enum NOT NULL DEFAULT 'payment_pending',
  admission_status admission_status_enum NOT NULL DEFAULT 'New',
  internal_notes TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Application Drafts
CREATE TABLE application_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  program program_enum NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, program)
);

-- Resume Tokens
CREATE TABLE resume_tokens (
  token_hash TEXT PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES application_drafts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email Verifications
CREATE TABLE email_verifications (
  email TEXT PRIMARY KEY,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  resends INTEGER NOT NULL DEFAULT 0,
  last_resend_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment Transactions
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id TEXT NOT NULL REFERENCES applications(id),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook Events (Idempotency)
CREATE TABLE payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Receipts
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  application_id TEXT NOT NULL REFERENCES applications(id),
  amount NUMERIC NOT NULL,
  razorpay_payment_id TEXT NOT NULL,
  drive_file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Confirmation Tokens
CREATE TABLE confirmation_tokens (
  token_hash TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Testimonials
CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  place TEXT NOT NULL,
  batch TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admins
CREATE TABLE admins (
  id UUID PRIMARY KEY, -- References auth.users, but we might not enforce FK here to avoid strict coupling
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_applications_email ON applications(email);
CREATE INDEX idx_applications_mobile ON applications(mobile);
CREATE INDEX idx_applications_program ON applications(program);
CREATE INDEX idx_applications_payment_status ON applications(payment_status);
CREATE INDEX idx_applications_admission_status ON applications(admission_status);
CREATE INDEX idx_application_drafts_email ON application_drafts(email);
CREATE INDEX idx_payment_transactions_order_id ON payment_transactions(razorpay_order_id);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);

-- RLS setup
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create minimal public policies (most logic is handled by server-side with service_role)
-- Testimonials are viewable by everyone
CREATE POLICY "Testimonials are viewable by everyone" ON testimonials
  FOR SELECT USING (is_active = true AND is_deleted = false);

-- All other operations require service_role, so no policies for them by default.
