# Frontend

## Structure

| Path                | Contents                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `src/main.tsx`      | Entry point. Renders `App` inside `QueryClientProvider`, `HashRouter` and `StoreProvider`.     |
| `src/App.tsx`       | Navigation and routes. Each page is lazy-loaded with `React.lazy` inside one `Suspense`.       |
| `src/pages/`        | One component per route: `Dashboard`, `Workouts`, `Diet`, `Progress`, `Health`, `Settings`.    |
| `src/components/`   | Shared UI in `ui.tsx`: `Card`, `Stat`, `Meter`, `Empty`, `PageHead` and the `chart` constants. |
| `src/store.tsx`     | `StoreProvider` and `useStore()`: app data kept in `localStorage` under `ironlog:data`.        |
| `src/api/client.ts` | API client (see below).                                                                        |
| `src/types.ts`      | Re-exports the data types and constants from `shared/schemas.ts`.                              |
| `src/test/`         | Test setup and MSW handlers (see [`testing.md`](./testing.md)).                                |

## Routes

| Path        | Page        |
| ----------- | ----------- |
| `/`         | `Dashboard` |
| `/workouts` | `Workouts`  |
| `/diet`     | `Diet`      |
| `/progress` | `Progress`  |
| `/health`   | `Health`    |
| `/settings` | `Settings`  |

Any other path redirects to `/`.

## API client

`src/api/client.ts` is the only way the frontend calls the API. Pages still read and write
`src/store.tsx`; none of them calls the API yet.

| Export                             | What it does                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiRequest(path, schema, init?)`  | Calls `fetch` on `/api/v1` + `path` with `credentials: 'same-origin'` (any `credentials` in `init` is overridden). A 2xx body is parsed with `schema`, a Zod schema from `shared/`; a mismatch throws `ZodError`. A non-2xx response throws `ApiError`. A network failure rejects with the `TypeError` from `fetch`. |
| `ApiError`                         | `Error` with `status`, `title` and optional `detail`. Built from an RFC 9457 Problem Details body (`title`, `status`, `detail`). If the body is not Problem Details, `title` is the response status text and `detail` is `undefined`. `message` is `detail`, or `title` when there is no `detail`.                   |
| `shouldRetry(failureCount, error)` | TanStack Query retry rule: retry once, only when `error` is an `ApiError` with a status of 500 or above.                                                                                                                                                                                                             |

The base `/api/v1` is fixed and relative. There is no configurable backend URL: the browser only
talks to its own origin (PRODUCTION_RULES §3.4).

## Server state

`src/main.tsx` creates one `QueryClient` (TanStack Query v5) with `retry: shouldRetry` for
queries, and provides it to the whole app with `QueryClientProvider`.

## Development proxy

`vite.config.ts` sets `server.proxy` so the Vite dev server (`npm run dev`) forwards every
request under `/api` to `http://localhost:3000`, the API started with
`npm --prefix server run dev`. It stands in for the gateway, which does the same in production
(see [`architecture.md`](./architecture.md#gateway)).

_Last updated by TF02._
