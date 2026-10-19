-- Defense in depth: supplier bearer-link hashes must never be visible to a normal user.
-- No anon/authenticated SELECT grants exist. Explicit deny policy silences
-- the informational "RLS enabled without policy" advisor lint.
create policy claim_share_links_no_browser_access
on public.claim_share_links
for select to authenticated
using (false);