
CREATE TYPE public.contract_status AS ENUM ('draft','awaiting_signatures','signed','executed','cancelled');
CREATE TYPE public.party_role AS ENUM ('exporter','importer','witness');
CREATE TYPE public.party_type AS ENUM ('individual','company','government');
CREATE TYPE public.sig_method AS ENUM ('pi','typed','drawn');
CREATE TYPE public.compliance_kind AS ENUM ('hs','sanctions','docs');

CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_uid TEXT NOT NULL,
  author_username TEXT,
  status public.contract_status NOT NULL DEFAULT 'draft',
  commodity TEXT NOT NULL,
  quantity TEXT NOT NULL,
  incoterm TEXT NOT NULL,
  price_pi TEXT NOT NULL,
  delivery_window TEXT NOT NULL,
  notes TEXT DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE INDEX contracts_author_idx ON public.contracts(author_uid);

CREATE TABLE public.contract_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  role public.party_role NOT NULL,
  party_type public.party_type NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  identifier TEXT DEFAULT '',
  pi_username TEXT,
  email TEXT,
  invited_at TIMESTAMPTZ,
  joined_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.contract_parties TO service_role;
ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;
CREATE INDEX contract_parties_contract_idx ON public.contract_parties(contract_id);
CREATE INDEX contract_parties_joined_uid_idx ON public.contract_parties(joined_uid);

CREATE TABLE public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES public.contract_parties(id) ON DELETE CASCADE,
  signer_uid TEXT NOT NULL,
  signer_username TEXT,
  method public.sig_method NOT NULL,
  signed_hash TEXT NOT NULL,
  signature_image TEXT,
  typed_name TEXT,
  ip TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.contract_signatures TO service_role;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
CREATE INDEX contract_signatures_contract_idx ON public.contract_signatures(contract_id);

CREATE TABLE public.contract_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id, lang)
);
GRANT ALL ON public.contract_translations TO service_role;
ALTER TABLE public.contract_translations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.contract_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  kind public.compliance_kind NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.contract_compliance TO service_role;
ALTER TABLE public.contract_compliance ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER contracts_touch_updated_at BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
