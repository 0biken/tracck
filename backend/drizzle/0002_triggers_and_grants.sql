-- Custom migration: what the schema file cannot express.

-- Keep updated_at current on every change.
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_source_connections_updated_at BEFORE UPDATE ON public.source_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_source_connection_secrets_updated_at BEFORE UPDATE ON public.source_connection_secrets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_source_items_updated_at BEFORE UPDATE ON public.source_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_candidate_evidence_updated_at BEFORE UPDATE ON public.candidate_evidence FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_target_opportunities_updated_at BEFORE UPDATE ON public.target_opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_resume_documents_updated_at BEFORE UPDATE ON public.resume_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_api_clients_updated_at BEFORE UPDATE ON public.api_clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

-- Every new sign-up gets a profile.
CREATE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER trg_on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();--> statement-breakpoint

-- Tables only the API's server-only role may touch, even before row level security applies.
REVOKE ALL ON public.source_connection_secrets, public.audit_events, public.api_clients, public.api_keys,
  public.api_usage_events, public.webhook_events, public.llm_calls, public.deletion_requests,
  public.consent_requests, public.org_waitlist FROM anon, authenticated;--> statement-breakpoint

-- The one table a signed-out browser may write to: the organisation waitlist, insert only.
GRANT INSERT ON public.org_waitlist TO anon, authenticated;
