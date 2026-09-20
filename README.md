# Eventor admin dashboard (`eventor-admin-web`)

Next.js admin dashboard for Eventor, plus the public web forms (`/f/:slug`).
Screens follow Figma **Admin Dashboard v2** (file `5GRFrMfyv979o63DSFXLjB`) and the docs in the main repo:

- `docs/admin-dashboard-screen-map.md` — routes, screens, shared rules
- `docs/dashboard-components.md` — component list, tokens, conventions (authoritative)
- `docs/build-plan.md` — module order (this repo ships **module 0 — foundation** and **module 1 — admin auth & accounts**)
- `backend/docs/api-standards.md` — response / error shapes the API layer relies on

## Stack

| Area       | Choice                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19, TypeScript strict                                                              |
| Styling    | Tailwind CSS 4; tokens as CSS variables in `src/styles/tokens.css`, read by the theme in `src/app/globals.css`               |
| i18n       | next-intl 4 — locales `en` (default) and `ar`, routes `/[locale]/…`, `dir="rtl"` for Arabic, Figtree + Cairo via `next/font` |
| Primitives | Radix UI (dialog, dropdown, popover, tabs, checkbox, switch, radio group), lucide-react icons, sonner toasts                 |
| Data       | TanStack Query 5, TanStack Table 9, nuqs (URL state), react-hook-form + zod 4                                                |
| API types  | openapi-typescript from `../backend/openapi.json`                                                                            |
| Tests      | Vitest + Testing Library, Playwright                                                                                         |
| Docs       | Storybook 10 (`@storybook/nextjs-vite`)                                                                                      |

## Setup

npm is broken on the dev machine — use pnpm through npx:

```bash
npx pnpm@12.4.1 install
cp .env.example .env.local          # NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1, NEXT_PUBLIC_AUTH_ENABLED=true
npx pnpm@12.4.1 dev                 # http://localhost:3001/en  (the API uses :3000)
```

## Scripts

| Script                          | What it does                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`                           | `next dev -p 3001`                                                                                                                              |
| `build` / `start`               | production build / serve on 3001. `NEXT_DIST_DIR=.next-build pnpm build` builds into another folder while `dev` is running                      |
| `lint`                          | ESLint (next core-web-vitals + typescript + storybook)                                                                                          |
| `typecheck`                     | `tsc --noEmit`                                                                                                                                  |
| `format` / `format:check`       | Prettier (+ Tailwind class sorting)                                                                                                             |
| `test` / `test:watch`           | Vitest                                                                                                                                          |
| `test:e2e`                      | Playwright (reuses a running dev server on 3001; `npx playwright install chromium` once)                                                        |
| `api:types`                     | regenerates `src/lib/api/schema.d.ts` from `../backend/openapi.json` (or a URL argument). Keeps the placeholder when the file doesn't exist yet |
| `storybook` / `build-storybook` | Storybook on 6006 / static build                                                                                                                |

## Structure

```
messages/                 en.json, ar.json (all shell strings)
e2e/                      Playwright smoke tests
.storybook/               main, preview (locale/RTL toolbar, providers)
scripts/api-types.mjs     OpenAPI → TypeScript
src/
  proxy.ts                next-intl locale routing (Next 16 "proxy" = middleware)
  i18n/                   routing (locales, getDirection), request config, navigation helpers
  styles/tokens.css       design tokens (dashboard-components §1)
  app/
    globals.css           Tailwind theme reading the tokens
    [locale]/layout.tsx   <html lang dir>, fonts, providers
    [locale]/(app)/       protected group: AuthGuard + AppShell, one placeholder page per sidebar route
    [locale]/(app)/%5Fdemo/data-list   → /en/_demo/data-list (DataList + ConfirmDialog + Toast demo)
    [locale]/login/       SHL-03 sign in            [locale]/forgot-password, reset-password  SHL-04
    [locale]/accept-invitation/  admin invitation (?token=)
    [locale]/(app)/account/     SHL-05 profile, password, sessions
    [locale]/(app)/settings/    SET-01 SectionNav (module 2 placeholders) + Admin accounts + SET-02 invite (?invite=true)
    [locale]/f/[slug]/    public web form placeholder (no AppShell)
  components/
    layout/               AppShell, ProtectedShell (AuthGuard + session), AuthLayout, Sidebar, Topbar, LanguageSwitch,
                          NotificationBell, AccountMenu, GlobalSearchTrigger + CommandPalette, PageHeader,
                          DetailHeader, LinkedCounts, TwoColumn, SectionNav, CardLinkRow, nav-config
    ui/                   Button, IconButton, Pill, Count, StatusBadge (tone map), Card/CardHeader,
                          KeyValueList, Tabs (+ URL-synced), ActionMenu
    feedback/             ConfirmDialog, FormDialog, FormDrawer, dialog/drawer shells, toast helper,
                          EmptyState, TableSkeleton, CardSkeleton, ErrorState, Banner, UnsavedChangesGuard
    forms/                Field, TextInput, Textarea, Select, Checkbox, Toggle, RadioCards, NumberInput, PhoneInput,
                          EmailInput, PasswordInput, SegmentedControl, DateInput, DateRangeInput, TimeSelect, MultiSelect,
                          AsyncSelect, BilingualFields, PhotoUploader, LineItemsEditor, ReasonPicker, FormFooter, DiffList
    data-list/            DataList, DataTable, FilterBar (DebouncedSearch, FilterSelect, SortSelect, FilterChips),
                          QuickFilterCards, AdvancedFiltersDrawer, SavedViewsMenu + SaveViewDialog, ColumnsMenu,
                          BulkBar, Pagination, useListState, cells (User, Entity, Link, Stack, Money, Rating,
                          StatusBadge, Date, CountLink, Toggle, Bilingual, DragHandle)
  lib/api/                fetch wrapper, ApiError, in-memory token store, schema.d.ts
  providers/              TanStack Query, nuqs adapter, Toaster
  mocks/                  mock users (demo, stories, tests)
  test/                   Vitest setup + renderWithProviders
```

## API layer (`src/lib/api`)

- `api.get/post/patch/put/delete<T>(path, …)` → `NEXT_PUBLIC_API_URL + path`, `credentials: "include"`,
  `Accept-Language` from the current locale, `Authorization: Bearer <access token>` (kept in memory only).
- Non-2xx responses are parsed into `ApiError { status, code, message, details, requestId }` (api-standards §5);
  `error.fieldErrors` gives `VALIDATION_FAILED` details for forms (FormDialog maps them onto fields).
- On `401` the client calls `POST /admin/auth/refresh` once (httpOnly cookie → `{ data: { accessToken } }`),
  retries the request, and otherwise calls the auth-failure handler (AuthGuard → `/login?next=…`).
- `AuthGuard` is on by default (`NEXT_PUBLIC_AUTH_ENABLED=false` turns it off): no token → refresh → `GET /admin/me`;
  a rejected session redirects to `/login?next=…`, an unreachable API shows ErrorState with Try again.
  Refresh is single-flight in the tab and serialized across tabs with Web Locks (refresh tokens rotate).

## Module 1 API contract (`src/lib/api/auth.ts`, types from `schema.d.ts`)

| Call                                                                                         | Body → response                                                                      | Error codes handled                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /admin/auth/login`                                                                     | `{email,password,remember}` → `{data:{accessToken,expiresIn,user}}` + refresh cookie | `INVALID_CREDENTIALS` (field), `ACCOUNT_LOCKED` 429 `details.retryAfterSeconds` (countdown), `ACCOUNT_BLOCKED`, `FORBIDDEN_ROLE`, `VALIDATION_FAILED` |
| `POST /admin/auth/refresh` / `logout`                                                        | cookie → same as login / 204                                                         | 401 → login                                                                                                                                           |
| `POST /admin/auth/forgot`                                                                    | `{email}` → 202 (always neutral)                                                     |                                                                                                                                                       |
| `POST /admin/auth/reset`                                                                     | `{token,password}` → 204 → `/login?reset=1` toast                                    | `PASSWORD_WEAK`, `RESET_TOKEN_INVALID`, `RESET_TOKEN_EXPIRED`                                                                                         |
| `GET /admin/auth/invitations/:token`, `POST …/accept`                                        | `{password}` → login body                                                            | `INVITATION_INVALID`, `INVITATION_EXPIRED`, `PASSWORD_WEAK`                                                                                           |
| `GET/PATCH /admin/me`                                                                        | `{fullName?,email?,language?,currentPassword?}` → AdminMe                            | `EMAIL_TAKEN`, `CURRENT_PASSWORD_INVALID`, `VALIDATION_FAILED`                                                                                        |
| `POST /admin/me/password`                                                                    | `{currentPassword,newPassword}` → 204                                                | `CURRENT_PASSWORD_INVALID`, `PASSWORD_WEAK`                                                                                                           |
| `GET /admin/me/sessions`, `DELETE …/:id`                                                     | `{data: Session[]}` / 204                                                            |                                                                                                                                                       |
| `GET /admin/admins`                                                                          | `{data: AdminListItem[], meta}`                                                      |                                                                                                                                                       |
| `POST /admin/admins/invitations`, `…/:id/resend`, `…/:id/revoke`, `DELETE /admin/admins/:id` | `{fullName,email}` → row / row / 204 / 204                                           | `EMAIL_TAKEN`, `INVITATION_EXISTS` (email field), `LAST_ADMIN`, `CANNOT_REMOVE_SELF`                                                                  |

## Conventions (dashboard-components §7)

- **Screens only compose components.** Missing a component? Add it to `docs/dashboard-components.md` first.
- **Routing** follows the screen map (`/users`, `/users/[id]`, …). Dialogs/drawers that have a route use search
  params (`?edit=1`, `?new=1`) so refresh/share keeps them open.
- **List state** (tab, q, filters, sort, page, limit) lives in the URL (`useListState`, nuqs). Defaults are omitted.
- **Server state:** TanStack Query with one query-key factory per resource. Mutations invalidate the affected
  list + detail; optimistic updates only for toggles and hide/show.
- **Sensitive actions:** `ConfirmDialog` (impact, reason, message) → audit log (API) → toast (with Undo when reversible, 8 s).
- **Permissions:** single admin role; buttons are still disabled on invalid status moves (same rules as the API).
- **RTL:** logical properties only (`ps-/pe-/ms-/me-/start-/end-`, `text-start`); directional icons get `flip-rtl`.
- **Tokens:** use theme colours (`bg-brand`, `text-muted`, `border-border`, …) and the type scale `text-11 … text-26`.
  Never hard-code a hex that exists as a token.
- **Accessibility:** every icon button has a label (`IconButton label`), dialogs trap focus, Esc closes overlays,
  tables are keyboard navigable.
- **Tests:** Vitest + Testing Library for components; one Playwright flow per module.
- **Storybook:** one story per component and state (default, loading, empty, error, RTL — use the Locale toolbar
  or `globals: { locale: "ar" }`).

## Modules 2–3 (settings, activity log, exports, saved views, categories, locations)

| Screen          | Route                                          | Files                                                   | API (`src/lib/api`)                                                                                                                 |
| --------------- | ---------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| SET-01          | `/settings#commission…#admins`                 | `settings/settings-screen.tsx`, `settings-sections.tsx` | `settings.ts`: 409 `SETTINGS_CONFIRM_REQUIRED` → DiffList confirm → resend `confirm: true` (+ note); `STALE_UPDATE` → reload banner |
| LOG-01 / LOG-02 | `/activity-log`, `?entry=<id>`                 | `activity-log/*`                                        | `activity-log.ts` (tab/date presets mapped to `source`/`level`/`from`/`to`)                                                         |
| STA-05          | Export buttons                                 | `components/feedback/export-dialog.tsx`                 | `exports.ts` (done → download, queued → toast + background poll)                                                                    |
| CAT-01 / CAT-02 | `/categories`, `?new=1`, `?edit=<id>&focus=ar` | `categories/*`                                          | `catalog.ts`: drag / arrow-key reorder, `CATEGORY_HAS_SERVICES` → move-to dialog                                                    |
| LOC-01 / LOC-02 | `/locations`, `?wilaya=16`                     | `locations/*`                                           | `catalog.ts`: `WILAYA_CLOSE_CONFIRM_REQUIRED` confirm, inline communes, CSV import                                                  |

Every list passes `savedViews={savedViewsSource("<resource>")}` (`saved-views.ts`). DataList gained `tabCounts`, `rowProps`,
`onRowClick`, `footer`, `onParamsChange`, `hidePagination`. `src/lib/api/contract-check.ts` fails `typecheck` if the hand-written
types drift from `schema.d.ts`. E2E: `e2e/setup-screens.spec.ts` signs in through the API (skips when it is down).

## Modules 4–5 (users, provider verification)

| Screen                | Route                                                       | Files                                                     | API (`src/lib/api`)                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USR-01 / 02 / 03      | `/users?tab=&status=&verificationStatus=&wilaya=&joined=&…` | `users/users-screen.tsx`                                  | `users.ts` `usersQuery()` maps URL filters (`joined`, `bookings` ranges) to `joinedFrom/To`, `min/maxCompletedBookings`                                                       |
| USR-04                | bulk bar → dialog                                           | `users/user-dialogs.tsx` `BulkUsersDialog`                | `POST /admin/users/bulk`, 409 `BULK_ACTION_REFUSED` (`details.refused`) shown in the dialog                                                                                   |
| USR-05 / 06           | `/users?new=1`, `/users/:id?edit=1`                         | `users/user-form-dialogs.tsx`                             | `EMAIL_TAKEN` / `PHONE_TAKEN` → field errors; `reason` required when email/phone change                                                                                       |
| USR-07 / 08 / 09 / 13 | profile Actions ▾, Account controls, row menu               | `users/user-dialogs.tsx`, `users/[id]/profile-screen.tsx` | live `block-impact`; Undo toast calls `unblock`; 409 `ACCOUNT_HAS_ACTIVE_ITEMS` details; temporary password shown once                                                        |
| USR-10 / 11           | `/users/:id?tab=`                                           | `users/[id]/profile-screen.tsx`                           | `GET /admin/users/:id` (stats + recent lists + notes); tabs of later modules show "Coming soon"                                                                               |
| VER-01                | `/verifications?tab=waiting…`                               | `verifications/verifications-screen.tsx`                  | `GET /admin/verifications` (`meta.counts` → tabs, cards, sidebar badge)                                                                                                       |
| VER-02 / 03 / 04      | `/verifications/:userId?<list state>&doc=`                  | `verifications/[userId]/*`                                | slots `{type, current, previous[]}`; approve / reject / undo (Undo toast); keyboard A / R / J / K; PDFs are framed from a blob (file URLs send `X-Frame-Options: SAMEORIGIN`) |

E2E: `e2e/users-verifications.spec.ts` (seeded API; the auth throttle is 10 req/min, so run the specs with `--workers=1`).

## Modules 6–7 (services & availability, Ready Packs)

| Screen           | Route                                                             | Files                                                                                       | API (`src/lib/api`)                                                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRV-01 / 02      | `/services?tab=&provider=&categoryId=&wilaya=&price=&…`           | `services/services-screen.tsx`                                                              | `services.ts` `servicesQuery()` (`provider` → `providerId`, `price`/`created` ranges); bulk hide / show / change category / delete loop per row (no bulk endpoint)                                               |
| SRV-03 / 06      | row menu, detail                                                  | `services/service-dialogs.tsx`                                                              | hide `{reason,message,allowResubmit}` + Undo (`show`); delete → 409 `SERVICE_HAS_BOOKINGS` shows an override checkbox → `DELETE ?force=true`; feature/unfeature + Undo, `FEATURED_LIMIT`                         |
| SRV-04           | `/services/:id?tab=details\|availability\|packs\|…`               | `services/[id]/service-detail-screen.tsx`, `availability-calendar.tsx`, `photo-gallery.tsx` | `GET /admin/services/:id`; availability month grid (Sat-first) with day dialog: `POST /admin/providers/:id/availability/blocks`, `DELETE /admin/availability-blocks/:id`                                         |
| SRV-05           | `/services/new?provider=`, `/services/:id/edit?missing=`          | `services/service-form.tsx`, `service-form-utils.ts`                                        | draft `POST`/`PATCH`, then `publish`/`show`; `SERVICE_PUBLISH_INVALID details.missing` → field errors + scroll to first (Arabic tab opened); photos saved immediately (upload / order / delete, polls `pending`) |
| PCK-01 / 02 / 03 | `/packs`, `/packs/:id`, `/packs/new?provider=`, `/packs/:id/edit` | `packs/*` (`service-picker.tsx`: provider's published services, 2–6, drag/arrow order)      | `packs.ts` (`packTotals()` live savings); `PACK_PUBLISH_INVALID` → checklist + fields; `PACK_HAS_BOOKINGS` refused; duplicate → edit copy                                                                        |

Photo limits come from settings `max_photos_per_service` / `max_photos_per_pack`. `LineItemsEditor` gained `bilingual`, `hideSummary`,
`addLabel`, `errors` (service extras). User profile Services / Ready Packs tabs now list real rows. E2E: `e2e/services-packs.spec.ts`
(signs in once and carries the rotated refresh cookie between tests; `--workers=1`).

## Modules 8 & 11 (bookings & invoices, messages)

| Screen           | Route                                                                | Files                                                                             | API (`src/lib/api`)                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BKG-01 / 02      | `/bookings?tab=&noReply=&client=&provider=&service=&pack=&status=&…` | `bookings/bookings-screen.tsx`                                                    | `bookings.ts` `bookingsQuery()` (URL `client`/`provider`/`service`/`pack` → `…Id`, `status` → tab, `eventDate`/`created`/`amount` ranges); `meta.counts` → tabs, cards, sidebar badge (`noReply`)           |
| Create booking   | `/bookings?new=1`                                                    | `bookings/create-booking-drawer.tsx`, `availability-picker.tsx`                   | `POST /admin/bookings`; live totals mirror the API policy (`priceTotals`, per-person / per-hour quantity, fee from settings); errors (DATE_UNAVAILABLE, MIN_NOTICE…) shown in the drawer                    |
| BKG-03           | `/bookings/:id` (UUID or `EVT-…`)                                    | `bookings/[id]/booking-detail-screen.tsx`                                         | `GET /admin/bookings/:id`; `allowedTransitions` drive the status menu/panel; Remind (429 REMINDER_TOO_SOON → info toast); event details drawer (`PATCH`)                                                    |
| BKG-04 / 05 / 06 | status dialog, reschedule dialog, `?price=1`                         | `bookings/booking-dialogs.tsx`                                                    | reason required except accept, note always; reschedule: busy day or 409 DATE_UNAVAILABLE → "Book anyway" (`force`), pending proposal banner + cancel; price: kinds + quantity lines, negative total refused |
| BKG-07           | `?invoice=1`                                                         | `InvoiceModal` + `components/domain/invoice-document.tsx`                         | `GET …/invoice` (404 INVOICE_NOT_FOUND → "No invoice yet"), PDF fetched with the bearer token, `POST …/invoice/send`                                                                                        |
| MSG-01           | `/messages/:conversationId?filter=&q=&user=&booking=`                | `messages/[[...conversationId]]/page.tsx`, `inbox-screen.tsx`, `inbox-thread.tsx` | `messaging.ts`; cursor pages (`before`), hide/unhide optimistic + Undo, delete confirm; live updates via `admin-socket.ts` (Socket.IO `/admin`, `auth.token`, `conversation:join`)                          |
| MSG-02 / 03      | `/messages?new=1&to=<userId>[&booking=]`, close/reopen               | `messages/message-dialogs.tsx`                                                    | `POST /admin/conversations` (recipient locked when opened from a profile or booking party), `POST …/close { scope, userId, reason, resolveReports }`, `…/reopen`                                            |

Domain components (`src/components/domain`): `StatusTimeline`, `PriceSummary`, `MessageBubble` / `Composer`, `HistoryList`,
`InvoiceDocument` (stories: "Domain/Bookings & messages"). `LineItemsEditor` gained `kindOptions`, `showQuantity`, `newLine`.
Sidebar badges: Bookings = pending past the reply deadline, Messages = reported + unread. Profile "Message" opens MSG-02.
E2E: `e2e/bookings-messages.spec.ts`. All specs share one sign-in (`e2e/session.ts` persists the token and the rotating
refresh cookie in `e2e/.auth/`), so `npx playwright test --workers=1` stays under the auth throttle.

## Modules 9 & 10 (disputes, academic requests & dynamic forms)

| Screen          | Route                                                                                        | Files                                                                                            | API (`src/lib/api`)                                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DSP-01          | `/disputes?tab=open&type=&openedByRole=&assignedAdminId=&userId=`                            | `disputes/disputes-screen.tsx`                                                                   | `disputes.ts` `disputesQuery()` (`status` quick cards win over the tab, `created` range); `meta.counts` (`inReview`) → tabs; sidebar badge = open count, refreshed by socket `dispute:new`                                 |
| Open dispute    | `/disputes?new=1[&booking=<id>]` (BKG-03 / BKG-01 "Open dispute")                            | `disputes/dispute-dialogs.tsx` `OpenDisputeDialog`                                               | `POST /admin/disputes`; `DISPUTE_WINDOW_CLOSED` → "open outside the window" + note (`ignoreWindow`); evidence files uploaded after creation through `POST …/:id/evidence` for the opener                                   |
| DSP-02 / DSP-03 | `/disputes/:id` (UUID or `DSP-…`)                                                            | `disputes/[id]/dispute-detail-screen.tsx`, `dispute-dialogs.tsx`                                 | `allowedActions` drive the buttons; chat = MSG-01 `Thread` with `send` → `POST …/messages` (live via socket room); resolve outcomes mirror `outcomeActions` (`outcomeAllowed()`); close / ask for evidence / add evidence  |
| ACR-01 / 02     | `/academic-requests?tab=&formId=&wilaya=&eventDate=`, `/:id?action=approve\|changes\|reject` | `academic-requests/requests-screen.tsx`, `[id]/request-detail-screen.tsx`, `request-dialogs.tsx` | `academic-requests.ts`; answers grouped by the version's sections (`GET /admin/forms/:id/versions/:versionId`); attachments in `FileViewerDialog`; proposals (search published services, "Fits" = needs) and book → BKG-03 |
| ACR-05          | `/academic-requests/forms`                                                                   | `academic-requests/forms/forms-screen.tsx`                                                       | `forms.ts`; delete → 409 `FORM_HAS_SUBMISSIONS` offers "Close instead"; `SLUG_TAKEN` → field error                                                                                                                         |
| ACR-06          | `/academic-requests/forms/:id/edit[?preview=1]`                                              | `forms/[id]/edit/form-builder.tsx`, `builder-panels.tsx`                                         | dnd-kit palette → canvas + sortable; autosave `PUT …/draft` (1.2 s, `updatedAt`), 422 `FORM_SCHEMA_INVALID` / `FORM_TRANSLATION_MISSING` paths mapped to fields; publish confirm; versions read-only in the preview drawer |
| ACR-07          | `/f/:slug`, `/f/:slug/edit?token=` and `/f/:slug/edit/:token`                                | `app/[locale]/f/public-form-screens.tsx`, `components/domain/form-renderer.tsx`                  | public calls (no token): steps per section, `lib/forms/validate.ts` mirrors `form-answers.ts`, XHR uploads with progress, email code (60 s resend), autosave in `localStorage`, `FORM_ANSWERS_INVALID` → fields            |

Pure schema helpers live in `src/lib/forms/schema.ts` (builder operations, mapping / showIf rules, issues) and `validate.ts`
(answer validation). The wilaya list for the public form is static (`lib/forms/wilayas.ts`). Stories: "Domain/Disputes & forms".
E2E: `e2e/disputes-academic.spec.ts`.

## Modules 12 & 13 (reviews & reports, overview, global search, notifications)

| Screen          | Route                                                              | Files                                                                                     | API (`src/lib/api`)                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OVR-01          | `/?range=today\|7d\|30d\|this_month\|custom&from=&to=`             | `(app)/_overview/overview-screen.tsx`, `components/domain/charts.tsx`, `DateRangePopover` | `overview.ts` `overviewQuery()` (custom without both days → 30d); attention cards link to filtered lists; KPI → list for the period; Export report = client-side CSV (no overview export resource)      |
| SHL-01          | Ctrl K / topbar                                                    | `components/layout/command-palette.tsx`                                                   | `GET /admin/search` (debounced 250 ms, scope chips + Tab, ↑↓ / Enter); Enter on `exactMatch` jumps (fetches first when the debounce has not fired); recent searches in `localStorage`                   |
| SHL-02          | bell                                                               | `components/layout/notification-panel.tsx`                                                | `notifications.ts`: unread count (poll 60 s), list when opened, `POST …/read {ids}` on click, `{all:true}`; socket `notification:new` refreshes                                                         |
| Sidebar         | all pages                                                          | `components/layout/protected-shell.tsx` `navBadges()`                                     | `GET /admin/nav-counts` (poll 60 s, socket events, and 0.8 s after any successful write through `onApiWrite`)                                                                                           |
| REV-01          | `/reviews?tab=&status=&rating=&provider=&service=&pack=&author=&…` | `reviews/reviews-screen.tsx`                                                              | `reviews.ts` `reviewsQuery()` (`status` quick cards win over the tab); Average rating card = overview KPI (30 days); row ⋯ hide/show + Undo, dismiss reports, delete                                    |
| REV-02 / REV-03 | `/reviews?review=<id>` (`/reviews/:id` redirects)                  | `reviews/review-drawer.tsx`, `review-dialogs.tsx`                                         | decisions from `allowedActions`; redact prefilled with `maskContacts()` (required); reply hide/show/delete; reports dismiss / convert; ⋯ Edit text (reason) / Delete (reason, "Hide instead") / Convert |
| Reports queue   | `/reviews?view=reports&tab=open…`                                  | `reviews/reports-list.tsx`                                                                | `GET /admin/reports`, resolve (note + action), dismiss, convert-to-dispute (open review/message reports with a booking)                                                                                 |
| MSG-01 banner   | `/messages/:id`                                                    | `messages/inbox-screen.tsx`                                                               | Dismiss report → `POST /admin/messages/:messageId/reports/dismiss`; Convert to dispute → `POST /admin/reports/:id/convert-to-dispute`                                                                   |

Profile (USR-10/11), service (SRV-04) and pack (PCK-02) pages list real reviews (`reviews/reviews-card.tsx`). The public web form
uses `GET /public/categories` and `/public/wilayas` (static wilaya list as fallback); DSP-01 reads `meta.counts.resolved30d/closed30d`
and filters by `bookingStatus`. API routes returned by the backend (`/reviews/:id`, `/activity-log/:id`) are mapped with
`dashboardHref()`. E2E: `e2e/reviews-overview.spec.ts`.
