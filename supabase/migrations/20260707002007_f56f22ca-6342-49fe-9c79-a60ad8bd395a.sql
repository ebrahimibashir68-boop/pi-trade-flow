
CREATE POLICY "deny all" ON public.contracts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON public.contract_parties FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON public.contract_signatures FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON public.contract_translations FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON public.contract_compliance FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
