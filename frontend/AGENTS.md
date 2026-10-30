<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- All backend calls go through the `Services` interface in `src/services/types.ts`; UI obtains it only via `getServices()` in `src/services/index.ts`. Why: swapping the mock for a real backend touches one file.
- `src/services/mock.ts` is a complete in-browser backend (localStorage, seeded demo data) and must keep enforcing the same rules a real backend would (auth, membership, read-only archived groups). Why: the app must run fully without a backend.
- Money maths (splits, rounding, balances, debt simplification) lives as pure functions in `src/domain/money.ts`, in integer minor units. Why: one tested source of truth shared by UI and services.
- The app renders after hydration (see `__root.tsx`) because the mock's data lives in browser storage.
