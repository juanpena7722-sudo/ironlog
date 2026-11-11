# Frontend

## Structure

| Path                | Contents                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.tsx`      | Entry point. Renders `App` inside `QueryClientProvider` and `HashRouter`.                                                                                                    |
| `src/App.tsx`       | Routes, the `ProtectedShell` session guard and the navigation. Every page is lazy-loaded with `React.lazy`.                                                                  |
| `src/pages/`        | One component per route: `Dashboard`, `Workouts`, `Diet`, `Progress`, `Health`, `Settings`, and `Auth` for `/login` and `/register`.                                         |
| `src/components/`   | Shared UI in `ui.tsx`: `Card`, `Stat`, `Meter`, `Empty`, `PageHead`, `Field` and the `chart` constants. `LocalDataBanner.tsx` (see [Local data import](#local-data-import)). |
| `src/store.tsx`     | Query hooks and mutations for the app data (see [Data layer](#data-layer)), `DEFAULT_GOALS`, `normalize()` and `unitHintFor()`.                                              |
| `src/units.ts`      | kg/cm to display unit conversion (see [Units](#units)).                                                                                                                      |
| `src/api/client.ts` | API client (see below).                                                                                                                                                      |
| `src/api/auth.ts`   | Session and account hooks (see [Authentication](#authentication)).                                                                                                           |
| `src/types.ts`      | Re-exports the data types and constants from `shared/schemas.ts`.                                                                                                            |
| `src/test/`         | Test setup and MSW handlers (see [`testing.md`](./testing.md)).                                                                                                              |

## Routes

| Path        | Page                       | Access    |
| ----------- | -------------------------- | --------- |
| `/login`    | `Auth` (`mode="login"`)    | Public    |
| `/register` | `Auth` (`mode="register"`) | Public    |
| `/`         | `Dashboard`                | Protected |
| `/workouts` | `Workouts`                 | Protected |
| `/diet`     | `Diet`                     | Protected |
| `/progress` | `Progress`                 | Protected |
| `/health`   | `Health`                   | Protected |
| `/settings` | `Settings`                 | Protected |

Any other path redirects to `/`. Protected routes render inside `ProtectedShell`, which shows
the navigation and the page.

## API client

`src/api/client.ts` is the only way the frontend calls the API. Pages read and write data only
through the hooks in `src/store.tsx`.

| Export                             | What it does                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apiRequest(path, schema, init?)`  | Calls `fetch` on `/api/v1` + `path` with `credentials: 'same-origin'` (any `credentials` in `init` is overridden). A 2xx body is parsed with `schema`, a Zod schema from `shared/`; a mismatch throws `ZodError`. An empty body (such as a 204) is parsed as `undefined`, and a body that is not JSON throws `SyntaxError`. A non-2xx response throws `ApiError`. A network failure rejects with the `TypeError` from `fetch`. |
| `ApiError`                         | `Error` with `status`, `title` and optional `detail`. Built from an RFC 9457 Problem Details body (`title`, `status`, `detail`). If the body is not Problem Details, `title` is the response status text and `detail` is `undefined`. `message` is `detail`, or `title` when there is no `detail`.                                                                                                                             |
| `jsonRequest(method, body)`        | `RequestInit` with `method`, `Content-Type: application/json` and `body` as JSON. Used by every request that sends a JSON body.                                                                                                                                                                                                                                                                                                |
| `shouldRetry(failureCount, error)` | TanStack Query retry rule: retry once, only when `error` is an `ApiError` with a status of 500 or above.                                                                                                                                                                                                                                                                                                                       |

The base `/api/v1` is fixed and relative. There is no configurable backend URL: the browser only
talks to its own origin (PRODUCTION_RULES §3.4).

## Authentication

`src/api/auth.ts` holds the session in the TanStack Query cache under `SESSION_KEY`
(`['session']`).

| Export                     | What it does                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSession()`             | Query on `GET /auth/me`, parsed with `UserSchema`. The data is the user, or `null` on a 401. `staleTime: Infinity`, so it is fetched once.                          |
| `useSignIn(mode)`          | Mutation on `POST /auth/login` or `POST /auth/register`. On success it removes every cached query except the session, then stores the returned user as the session. |
| `useLogout()`              | Mutation on `POST /auth/logout`.                                                                                                                                    |
| `useDeleteAccount()`       | Mutation on `DELETE /auth/account` with `{ password }`.                                                                                                             |
| `errorMessage(error)`      | The `ApiError` message (the server's `detail`), or `Something went wrong. Please try again.` for any other error.                                                   |
| `SESSION_KEY`              | Query key of the session.                                                                                                                                           |
| `createQueryClient(retry)` | Creates the app's `QueryClient` with `retry` for queries and the session-expiry handler (see [Server state](#server-state)).                                        |

After a successful logout or account deletion, the whole query cache is cleared, the session is
set to `null` and the app navigates to `/login`.

`ProtectedShell` in `src/App.tsx` guards every protected route:

- while the session loads it shows `Loading…`;
- if the session check fails (not a 401) it shows `Could not check your session.` with a
  **Retry** button;
- with no session it redirects to `/login` and passes the original path and query string as
  `state.from`;
- with a session it renders the navigation, which ends with a **Log out** button,
  `LocalDataBanner` and the page. A failed logout shows its error above the page.

`src/pages/Auth.tsx` renders the login and register forms. It validates with `LoginSchema` or
`RegisterSchema` from `shared/schemas.ts` before sending. Invalid fields show the schema's
message under the input and focus moves to the first invalid field. A server error shows its
`detail` in an alert above the submit button. When a session exists (after sign-in, or on
opening `/login` while logged in) it redirects to `state.from` if it is a path starting with `/`
(checked with Zod), and to `/` otherwise. The link between the two forms keeps `state.from`.

`Settings` has an **Account** card. **Delete account** opens a confirmation with a password
field, validated with `DeleteAccountSchema`; **Cancel** closes it. A wrong password shows the
server's `detail` inline.

`Field` in `src/components/ui.tsx` is a labelled input with an optional error message. When
there is an error the input gets `aria-invalid="true"` and `aria-describedby` pointing at the
message.

## Server state

`src/main.tsx` creates one `QueryClient` (TanStack Query v5) with `createQueryClient(shouldRetry)`
from `src/api/auth.ts`, and provides it to the whole app with `QueryClientProvider`.

**Session expiry.** The client's `QueryCache` and `MutationCache` have an `onError` handler. When
any query or mutation fails with an `ApiError` of status 401, it sets the session to `null` and
removes every other query from the cache, so `ProtectedShell` redirects to `/login`. Login,
register and account deletion are excluded with `meta: { isCredentialCheck: true }`: they answer
a wrong password with 401 while the session is still valid.

## Data layer

`src/store.tsx` reads and writes every collection through the API with TanStack Query. App data
is not kept in `localStorage`. Data left in the old `ironlog:data` key by the browser-only
version can be imported once (see [Local data import](#local-data-import)).

**Queries**

| Hook               | Request                               | Query key              |
| ------------------ | ------------------------------------- | ---------------------- |
| `useWorkouts()`    | `GET /workouts?from=1970-01-01`       | `['workouts', search]` |
| `useFoods(range?)` | `GET /foods?from=…[&to=…]`            | `['foods', search]`    |
| `useRecentFoods()` | `GET /foods/recent?limit=12`          | `['foods', 'recent']`  |
| `useBody()`        | `GET /body?from=1970-01-01`           | `['body', search]`     |
| `useHealth()`      | `GET /health-entries?from=1970-01-01` | `['health', search]`   |
| `useGoals()`       | `GET /goals`                          | `['goals']`            |

List endpoints return only recent days by default, so workouts, body and health ask for
`from=1970-01-01` (all history). `useFoods` takes a `{ from, to? }` range and defaults to all
history. Responses are validated with the schemas from `shared/schemas.ts`.

| Page        | Data it loads                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------- |
| `Dashboard` | goals, workouts, today's foods, recent foods (to tell whether any food exists), body, health  |
| `Workouts`  | workouts, goals (unit)                                                                        |
| `Diet`      | goals, foods of the selected day, foods of the last 14 days (chart), recent foods (quick add) |
| `Progress`  | body, goals (unit and target weight)                                                          |
| `Health`    | health, goals                                                                                 |
| `Settings`  | goals, and workouts, all foods, body and health (for the counts and the macro suggestion)     |

**Mutations.** Each one invalidates its collection's queries on success.

| Hook                 | Request                                                                                                                               | Invalidates |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `useSaveWorkout()`   | `{ id?, entry }`: `PUT /workouts/:id` when `id` is set, otherwise `POST /workouts`                                                    | `workouts`  |
| `useDeleteWorkout()` | `DELETE /workouts/:id`                                                                                                                | `workouts`  |
| `useAddFood()`       | `POST /foods`                                                                                                                         | `foods`     |
| `useDeleteFood()`    | `DELETE /foods/:id`                                                                                                                   | `foods`     |
| `useSaveBody()`      | `{ id?, entry }`: `PUT /body/:id` or `POST /body`                                                                                     | `body`      |
| `useDeleteBody()`    | `DELETE /body/:id`                                                                                                                    | `body`      |
| `useSaveHealth()`    | `PUT /health-entries/:date` (create or update the day)                                                                                | `health`    |
| `useDeleteHealth()`  | `DELETE /health-entries/:date`                                                                                                        | `health`    |
| `useSaveGoals()`     | `PUT /goals`                                                                                                                          | `goals`     |
| `useImportData()`    | `{ data, mode, unitHint? }`: `POST /backup/import?mode=<mode>&unitHint=<unitHint>` with a full `AppData`; `unitHint` defaults to `kg` | everything  |

Pages keep their look and behaviour. Forms are cleared only after a successful save. The Health
and Settings forms show the stored values until the user edits a field.

**Settings data card.** **Export backup** downloads `GET /backup`. **Import backup** reads the
file, sends it through `normalize()` and imports it with `useImportData()` in the mode chosen in
the **Import mode** select: **Merge (add new entries)** (the default) imports at once;
**Replace all data** first asks for confirmation. A file that is not valid JSON shows `That file
is not a valid IronLog backup.`; an API error shows the server's `detail`. **Load demo data**
sends `makeDemoData()` (with `DEFAULT_GOALS`) and **Clear all logs** sends empty collections with
the saved goals unchanged, so targets and unit are kept; both use `mode=replace` with
`unitHint=kg`. **Clear all logs** and its confirm button are disabled until `GET /goals` has
loaded. **Save targets** is also disabled until then.

Replace import, demo data and **Clear all logs** share one confirmation box
(`role="alertdialog"`, labelled by its question, ending in `This can’t be undone.`). Focus starts
on **Cancel**; **Cancel** closes it without sending anything.

**Backup units.** `unitHintFor(file)` picks the `unitHint` for an imported file:

| File                                        | `unitHint`                                    |
| ------------------------------------------- | --------------------------------------------- |
| `canonicalUnit: 'kg'` (exported by the API) | `kg`: values are already kg and cm            |
| No `canonicalUnit` (browser-only version)   | The file's `goals.unit` (`kg` if it has none) |

The browser-only version stored weights and lengths in the display unit, and the API export
always stores kg and cm while its `goals.unit` is the user's display unit. The marker keeps an
API export from an lb account from being converted a second time.

## Local data import

`LocalDataBanner` (`src/components/LocalDataBanner.tsx`) is rendered by `ProtectedShell` above
every page. On mount it reads `localStorage['ironlog:data']` and passes it through `normalize()`.
It shows a card (`aria-label="Import data from this browser"`) only when:

- `localStorage['ironlog:local-import-dismissed']` is not set;
- `ironlog:data` is valid JSON;
- it has at least one workout, food, body or health entry (goals alone are not offered, because a
  merge import never changes goals).

| Button                | Result                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Import local data** | `useImportData()` with `mode: 'merge'` and `unitHint` = the stored `goals.unit`. On success it removes `ironlog:data`, hides the card and every query is refreshed. On failure the data is kept, the card stays and the error shows in `role="alert"`. Buttons are disabled while it runs. |
| **Dismiss**           | Sets `ironlog:local-import-dismissed` to `true` and hides the card. `ironlog:data` is kept.                                                                                                                                                                                                |

The dismissal is per browser, not per account.

## Units

The API stores weights in kg and lengths in cm. The user's display unit is `Goals.unit` (`kg` or
`lb`), stored in the API with the other goals (`PUT /goals`), so it follows the account across
devices. With `lb`, weights show in lb and lengths in inches.

`src/units.ts`:

| Export                           | What it does                                                      |
| -------------------------------- | ----------------------------------------------------------------- |
| `toDisplayWeight(kg, unit)`      | kg to the display unit (× 2.20462 for `lb`), rounded to 1 decimal |
| `fromDisplayWeight(value, unit)` | display unit to kg (÷ 2.20462 for `lb`), rounded to 2 decimals    |
| `toDisplayLength(cm, unit)`      | cm to the display unit (÷ 2.54 for `lb`), rounded to 1 decimal    |
| `fromDisplayLength(value, unit)` | display unit to cm (× 2.54 for `lb`), rounded to 2 decimals       |

For example, 100 lb is saved as 45.36 kg and shown as 45.4 in kg. Dashboard (bodyweight, trend,
volume), Workouts (set inputs, lists, PRs, weekly volume), Progress (inputs, list, charts, target)
and Settings (target weight) convert with these functions. Body fat is a percentage and is never
converted. In Settings, switching the unit converts the target weight shown in the form; it is
saved in kg with **Save targets**.

## Development proxy

`vite.config.ts` sets `server.proxy` so the Vite dev server (`npm run dev`) forwards every
request under `/api` to `http://localhost:3000`, the API started with
`npm --prefix server run dev`. The proxy is `{ target: 'http://localhost:3000' }` without
`changeOrigin`, so the API sees the browser's `Host` (`localhost:5173`), which matches the
`Origin` header and passes the API's same-origin check on state-changing requests. It stands in for the gateway, which does the same in production
(see [`architecture.md`](./architecture.md#gateway)).

_Last updated by TF05._
