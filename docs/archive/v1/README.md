# Archived: Tracck v1 design

**Superseded. Do not build from these files.**

These documents and SQL files describe the first design, which was never implemented. They are kept for history only. The current sources of truth are:

- [Technical Architecture v2](../../architecture/Tracck_Technical_Architecture_v2.md)
- [Design system](../../design/tracck-design-system.html)
- The migrations in `supabase/migrations/`

The [implementation audit](../../architecture/IMPLEMENTATION_AUDIT.md) explains what was wrong with this design, including two security holes in `008_functions_and_triggers.sql` and `009_rls_policies.sql`. File paths in the audit refer to these files before they were moved here from `docs/`.
