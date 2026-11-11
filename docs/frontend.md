# Frontend

## Structure

| Path                | Contents                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main.tsx`      | Entry point. Renders `App` inside `QueryClientProvider`, `HashRouter` and `StoreProvider`.                                           |
| `src/App.tsx`       | Routes, the `ProtectedShell` session guard and the navigation. Every page is lazy-loaded with `React.lazy`.                          |
| `src/pages/`        | One component per route: `Dashboard`, `Workouts`, `Diet`, `Progress`, `Health`, `Settings`, and `Auth` for `/login` and `/register`. |
| `src/components/`   | Shared UI in `ui.tsx`: `Card`, `Stat`, `Meter`, `Empty`, `PageHead`, `Field` and the `chart` constants.                              |
| `src/store.tsx`     | `StoreProvider` and `useStore()`: app data kept in `localStorage` under `ironlog:data`.                                              |
| `src/api/client.ts` | API client (see below).                                                                                                              |
| `src/api/auth.ts`   | Session and account hooks (see [Authentication](#authentication)).                                                                   |
| `src/types.ts`      | Re-exports the data types and constants from `shared/schemas.ts`.                                                                    |
| `src/test/`         | Test setup and MSW handlers (see [`testing.md`](./testing.md)).                                                                      |

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

`src/api/client.ts` is the only way the frontend calls the API. Apart from authentication, pages
still read and write `src/store.tsx`.

| Export                             | What it does                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apiRequest(path, schema, init?)`  | Calls `fetch` on `/api/v1` + `path` with `credentials: 'same-origin'` (any `credentials` in `init` is overridden). A 2xx body is parsed with `schema`, a Zod schema from `shared/`; a mismatch throws `ZodError`. An empty body (such as a 204) is parsed as `undefined`, and a body that is not JSON throws `SyntaxError`. A non-2xx response throws `ApiError`. A network failure rejects with the `TypeError` from `fetch`. |
| `ApiError`                         | `Error` with `status`, `title` and optional `detail`. Built from an RFC 9457 Problem Details body (`title`, `status`, `detail`). If the body is not Problem Details, `title` is the response status text and `detail` is `undefined`. `message` is `detail`, or `title` when there is no `detail`.                                                                                                                             |
| `shouldRetry(failureCount, error)` | TanStack Query retry rule: retry once, only when `error` is an `ApiError` with a status of 500 or above.                                                                                                                                                                                                                                                                                                                       |

The base `/api/v1` is fixed and relative. There is no configurable backend URL: the browser only
talks to its own origin (PRODUCTION_RULES §3.4).

## Authentication

`src/api/auth.ts` holds the session in the TanStack Query cache under `SESSION_KEY`
(`['session']`).

| Export                | What it does                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `useSession()`        | Query on `GET /auth/me`, parsed with `UserSchema`. The data is the user, or `null` on a 401. `staleTime: Infinity`, so it is fetched once. |
| `useSignIn(mode)`     | Mutation on `POST /auth/login` or `POST /auth/register`. On success it stores the returned user as the session.                            |
| `useLogout()`         | Mutation on `POST /auth/logout`.                                                                                                           |
| `useDeleteAccount()`  | Mutation on `DELETE /auth/account` with `{ password }`.                                                                                    |
| `errorMessage(error)` | The `ApiError` message (the server's `detail`), or `Something went wrong. Please try again.` for any other error.                          |
| `SESSION_KEY`         | Query key of the session.                                                                                                                  |

After a successful logout or account deletion, the whole query cache is cleared, the session is
set to `null` and the app navigates to `/login`.

`ProtectedShell` in `src/App.tsx` guards every protected route:

- while the session loads it shows `Loading…`;
- if the session check fails (not a 401) it shows `Could not check your session.` with a
  **Retry** button;
- with no session it redirects to `/login` and passes the original path and query string as
  `state.from`;
- with a session it renders the navigation, which ends with a **Log out** button, and the page.
  A failed logout shows its error above the page.

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

`src/main.tsx` creates one `QueryClient` (TanStack Query v5) with `retry: shouldRetry` for
queries, and provides it to the whole app with `QueryClientProvider`.

## Development proxy

`vite.config.ts` sets `server.proxy` so the Vite dev server (`npm run dev`) forwards every
request under `/api` to `http://localhost:3000`, the API started with
`npm --prefix server run dev`. It stands in for the gateway, which does the same in production
(see [`architecture.md`](./architecture.md#gateway)).

_Last updated by TF03._
