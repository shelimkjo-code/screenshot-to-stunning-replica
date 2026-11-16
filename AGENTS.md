<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Photo processing runs client-orchestrated (src/lib/studio/processor.ts) with paid AI calls in authenticated server functions (src/lib/ai.functions.ts); server-only files must not live under a `server/` folder because import protection blocks client imports from it.
- All print geometry is computed in millimetres by src/lib/studio/layout.ts (tested); rendering converts mm to pixels at 300 DPI only at the last step so PDF/PNG sizes stay exact.
- Customer photos live in the private `photos` bucket under `{userId}/{jobId}/{photoId}/`; storage RLS keys off the first folder, so keep that path shape.
- remove.bg reads the `REMOVE_BG_API_KEY` secret; Replicate goes through the Lovable connector gateway. Missing services must surface as "not connected", never as fake success.
- UI text comes from src/lib/i18n.tsx (Bangla default); add every new string in both languages.
- AI enhance modes (`chatgptRestore` restore + user bg color, `geminiEnhance` fixed identity-preserving prompt) live in src/lib/ai.functions.ts; the built-in cut-out still runs afterwards so framing/cropping keeps working.
- Android APK is a Capacitor shell built by .github/workflows/main.yml that loads the published URL; the app needs its server, so never ship a static bundle in the APK.
