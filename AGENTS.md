1. Never guess object shapes/properties (e.g. defaulting with `??`/`||` to paper over uncertainty). Verify against the source of truth first — the backend/data layer or schema where the object is defined.

2. I use pnpm, don't modify migration files directly, always use the script/helper the orm supports for running migration, don't run these migrations unless i said so explicitely

3. Produce clean code, that is easy to maintain
4. When generating prompts for AI models, ensure it's concise & specific not verbose.
