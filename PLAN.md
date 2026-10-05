# Prototype Change Plan: Read-only, single-shipment diagnostics

Scope: the React/TypeScript prototype in `src/` (sample data only, no backend).
Goal: simplify the diagnostics admin panel to **API**, **Notification** and **single-Shipment** diagnosis. The panel becomes fully read-only.

---

## 1. Summary of changes

| Area | Decision |
|---|---|
| Schedules | **Remove** completely |
| Driver diagnosis | **Remove** |
| GPS (fleet) diagnosis | **Remove** |
| "Scope" selection on New Run | **Remove**. The user picks a diagnosis type instead: Shipment, API, or Notifications |
| Shipment diagnosis | One run = **one shipment**. New filters to find that shipment |
| Run detail page with a list of shipments | **Remove**. A shipment run opens straight into that shipment's full diagnosis |
| API diagnosis / API findings | **Keep as is** (time window stays) |
| Notification diagnosis | **Keep as is** (time window stays), plus per-load notification status (see 5.6) |
| Overview page | **Keep as is** |
| Write operations | **Remove all** (acknowledge, comments, DB write mode, edit/delete rows, audit log) |
| Time window | Keep for API and Notifications. **Not needed for shipments** |

---

## 2. New Run page (`pages/NewRun.tsx`)

- Drop the multi-scope checkboxes, the "when" (now / schedule) section, schedule fields (frequency, time of day, days, name) and the driver picker.
- Replace with a single **Diagnosis type** choice (radio): `Shipment` | `API` | `Notifications`.
- **Shipment**: show the shipment picker with filters (below). Exactly one shipment must be selected. No time-window control.
- **API / Notifications**: show only the existing time-window control (presets and custom).
- The Run button is always "Run now".

### Shipment filters
Filters narrow a table of shipments; the user then selects **one** row (radio, not checkbox).

1. **Date filter**: from / to on the shipment date (pickup scheduled start).
2. **People filters** (each optional, combinable): **Carrier**, **Shipper**, **Driver**, and **User** (any person tied to the load: creator, accepter, org contact). Each is a dropdown fed from the sample people/org data. The Driver filter matches any driver assigned during the shipment, including replacements.
3. **String filter**: free-text search over load number, shipper, carrier, DC names and addresses, commodity.

The "Run diagnosis" button is disabled until exactly one shipment is selected. The summary line reads `Diagnose shipment <number>`.

---

## 3. Data model changes (`types.ts`, `store.tsx`, `sampleData/`)

- `RunScope`: `'shipments' | 'driver' | 'api' | 'gps' | 'notifications'` becomes `'shipment' | 'api' | 'notifications'`. A run has a single `kind` instead of `scopes[]`.
- `DiagnosisRun`: remove `trigger`, `scheduleId`, `scopes`, `targets`, `driverIds`. Replace `loadIds[]` with `loadId?: string`. `windowStart/End` become optional (set for api/notifications only).
- Remove: `RunTrigger`, `Schedule`, `Frequency`, `FindingComment`, `FindingReview`, `GpsReport`, `GpsDriftRow`, `AuditEntry`, `DbColumn.locked`.
- `FindingSection`: `'shipment' | 'api' | 'messaging'`.
- `Ping`: remove `flags` and `PingFlag`. Remove `offRouteM`. Change `PingContext` to `'pickup' | 'normal' | 'delivery'`.
- `Load`: `plannedRoute` is no longer displayed (field may be deleted or ignored).
- Add `Notification` records per load: `{ id, loadId, event, recipientRole: 'driver'|'shipper'|'carrier', recipientName, channel, sentAt, status: 'sent'|'delivered'|'failed'|'missing', reason? }`.
- `store.tsx`: remove schedules, `review`, `acknowledge`, `addComment`, `writeMode`, `updateCell`, `deleteRow`, `audit`.
- Sample data: delete driver and GPS-fleet runs, schedules, driver/gps findings, and `sampleData/runs.ts` schedule entries. Make every sample shipment run reference exactly one load.

---

## 4. Routes and files

**Delete**
- `pages/Schedules.tsx`
- `pages/DriverDiagnosis.tsx`
- `pages/GpsFindings.tsx`
- `components/WriteMode.tsx`
- Related schedule, driver and GPS code in `store.tsx`, `lib/runs.ts`, `sampleData/runs.ts`, `sampleData/reports.ts`, `components/ui.tsx` (`ScopeBadge`, `TriggerBadge`, `SCOPE_LABEL`)

**Routes (`App.tsx`)**
```
/diagnostics/runs                 -> RunsList
/diagnostics/runs/new             -> NewRun
/diagnostics/runs/:runId          -> RunDetail   (dispatches by run kind, see below)
/tables, /tables/:name            -> read-only
```
Remove: `/schedules`, `/runs/:runId/shipments/:loadId`, `/runs/:runId/drivers/:driverId`, `/runs/:runId/gps`. The API and Notification views render inside `RunDetail` or keep their current sub-routes.

**`RunDetail.tsx`**
- Shipment run: render the shipment diagnosis directly (merge `ShipmentDiagnosis` into it, or render it as a child), with no list of shipments and no severity roll-up across loads.
- API run: existing API findings view.
- Notification run: existing notification view plus 5.6.
- Keep the **Re-run** and **Export** buttons. Drop every acknowledge button.

**`RunsList.tsx`**
- Remove the trigger column and filter, and the "Schedules" link.
- Columns: Run, Type, Target (shipment number, or window), Status, Findings, Created.

---

## 5. Shipment diagnosis page (`pages/ShipmentDiagnosis.tsx` and `components/shipment/*`)

The page **always shows everything about the shipment, even when no rule fired.** Tabs: Findings, Overview, Map & pings, Timeline, Photos, Problems & breaks (plus Notifications, see 5.6).

### 5.1 Findings tab
- Remove "Acknowledged by", the acknowledge button, the comment thread and the "only open" filter (`FindingCard.tsx`).
- When there are no findings, show a "No abnormality detected" state. Do not hide the other tabs.
- For `FENCE_MISSED`, the finding card names the exact geofence (stop name, pickup or delivery, enter or exit, radius, expected time), the same as the timeline does.
- Each finding shows the rule code, a plain-language **rule description**, a severity badge, a summary and the evidence.
- Add a **Rule reference** panel on the page listing every rule code with its description and threshold (see section 6). Every rule is explained, not only the ones that fired.
- **Silence gaps**: list every gap (start, end, duration, last ping before, first ping after, nearest or inside geofence), and explain what a silence gap is and the threshold.

### 5.2 Overview tab
Keep as is (`OverviewTab.tsx`).

### 5.3 Map & pings tab
- Keep the map with driver ping points. Colour pings by pickup / normal / delivery.
- **Driver change**: when the shipment changed driver, every ping row shows which driver it belongs to (Driver column always on for such shipments), and the map colours or labels pings by driver.
- **Remove**: planned-route toggle and line, replay control, off-route display and the `replay` state.
- Keep an "actual path" line, the stop geofence circles, and the pickup / delivery markers.
- **Ping table (`PingTable.tsx`)**: remove the `Flags` column and the "Flagged only" checkbox. Remove the "Off route" and "On route" options from the location filter. The filter becomes All / Pickup radius / Delivery radius / Normal. Keep the other filters and columns as they are.
- **Add "Average ping interval"**:
  - Header stat above the table: the mean time between consecutive pings across the shipment, plus min and max.
  - New table column "Interval" showing the gap since the previous ping, for each ping.
  - Computed in `lib/geo.ts` or a new `lib/pings.ts`, sorted by `recordedAt`.

### 5.4 Timeline tab (`TimelineTab.tsx`, `lib/timeline.ts`)
- **Remove the trip strip.**
- Show the path actually followed as ordered segments. Each ping is labelled **At pickup geofence**, **Normal**, or **At drop-off geofence**. Do not compare against the planned route.
- Mark each GPS-missed (silence) gap on the timeline. **Name the exact geofence** that was missed, e.g. "Missed geofence: Pickup, DC Chicago North (enter)", with transition and expected time.
- Keep the geofence events, driver changes and notifications as they are.

### 5.5 Photos, Problems & breaks tabs
Keep as is.

### 5.6 Notifications (per load)
- New **Notifications** tab on the shipment page (and the same data reachable from the Notification run).
- Table of every notification for the load: **type** (geofence enter/exit, pickup, delivery, assignment and so on), **recipient role** (Driver / Shipper / Carrier), recipient name, channel, sent time, **status** (sent, delivered, failed, missing) and the failure reason.
- Raise `NOTIFICATION_ANOMALY` when a notification is missing, failed, or sent without a matching event.

---

## 6. Rule codes (keep only these, each with a description)

Delete every other rule from `sampleData/ruleInfo.ts` and `sampleData/analyze.ts`. Every rule must carry a `title`, a plain-language `description` (replaces `meaning`) and a `threshold`.

| Code | Status | Description | Notes |
|---|---|---|---|
| `STATIC_LOCATION` | Keep, renamed from `FROZEN_FIX` | The user was static at one location: the position did not change over the period | Shows location, duration, ping count |
| `DUP_EXACT` | Keep | The same GPS reading was stored more than once | |
| `SAME_TIME_SAME_POSITION` | Keep, renamed from `DUP_STORED_SAME_TIMESTAMP` (title "Same time, same position") | The same recorded time was stored more than once for the same position | See open question 1 |
| `SAME_TIME_DIFFERENT_POSITION` | Keep (existing "Same time, different position" behaviour) | The same recorded time was stored twice with differing positions (resend drift) | See open question 1 |
| `SILENCE_GAP` | Keep | No GPS received for longer than the threshold (GPS silence) | Every gap is listed and explained |
| `FENCE_MISSED` | Keep, extended | The user crossed a stop geofence but no event was recorded | **Must name which geofence** (stop, pickup/delivery, enter/exit), in both Findings and Timeline |
| `PICKUP_DELIVERY_NOT_VERIFIED` | **New** | The user did not verify the pickup or the delivery. Verified means a confirmed arrival event or a pickup/delivery photo at the stop | Name which one, pickup or delivery |
| `NOTIFICATION_ANOMALY` | Keep, renamed from `NOTIFY_GAP` | An anomaly in a notification related to the load | Links to per-recipient status (5.6) |
| `HANDOVER_ANOMALY` | Keep (driver changed) | A driver was replaced while the load was moving and the change looks wrong (parked too long, new driver started far away, no GPS after resume, changed without a park) | Each ping shows which driver it belongs to (5.3) |

**Removed rules**
- Driver: `DELIVERED_OUTSIDE_GEOFENCE`, `DELIVERY_NOT_COMPLETED`, `GPS_OFF_PATTERN`, `PHOTO_WRONG_LOCATION`, `PHOTO_REUSED`, `REPEATED_LATE`.
- GPS: `SAMPLING_DRIFT`.
- Off-route and on-route tracking (a path is shown, not judged).

**Kept as is**: the API rules (`API_SERVER_ERRORS`, `API_UNHANDLED_ERRORS`, `API_RATE_LIMITED`) and the notification delivery rule (`MSG_HIGH_FAILURE`), which stay with their runs.

---

## 7. Tables page (`pages/Tables.tsx`)

- Remove the `WriteModeBar`, the editable cells, row delete and the audit log.
- Keep table list, search, filters, sorting and sensitive-column masking. Everything is read mode.
- Delete `updateCell`, `deleteRow` and `audit` from the store.

---

## 8. Implementation order

1. **Types and store**: slim `types.ts` and `store.tsx` (no schedules, review or write mode). Fix compile errors.
2. **Sample data**: rule list and descriptions, the notification model and data, one-load-per-run runs, ping context and interval.
3. **Remove pages and routes**: Schedules, Driver, GPS, WriteMode. Update `App.tsx`, `Layout.tsx` nav and `RunsList`.
4. **New Run**: type selector and shipment filters with single selection.
5. **Run detail**: dispatch by run kind; shipment run opens directly into the diagnosis.
6. **Shipment tabs**: findings cleanup and the rule reference; map and ping table changes plus average interval; timeline rewrite (remove trip strip, named missed geofence, pickup / normal / drop-off labels); notifications tab.
7. **Tables**: read-only.
8. **Verify**: `npm run build` (type check), then click through every route. Check shipments both with findings and with none, and confirm every tab still renders.
9. Update `README.md`, then deploy via the existing GitHub Pages workflow.

---

## 9. Acceptance checklist

- [ ] No schedule, driver, GPS or scope UI anywhere
- [ ] New Run lets the user choose Shipment, API or Notifications
- [ ] Shipment run requires exactly one shipment, with date, carrier-user and text filters
- [ ] No multi-shipment run detail page; one click opens the full shipment view
- [ ] A shipment with zero findings still shows the timeline, map, photos, problems and notifications
- [ ] Every rule code has a visible description. Only the rules in section 6 exist
- [ ] All silence gaps are listed and explained
- [ ] Missed-geofence findings and timeline entries name the geofence
- [ ] Ping table has no Flags and no on/off-route filter, and shows interval per ping and average interval
- [ ] No replay and no planned route anywhere
- [ ] Timeline has no trip strip; pings are labelled pickup / normal / drop-off
- [ ] No acknowledge, comments, write mode, cell edit or row delete anywhere
- [ ] Overview, Photos, Problems & breaks, API and Notification views are unchanged
- [ ] `npm run build` passes

---

## 10. Decisions and open questions

**Decided**
- `DUP_STORED_SAME_TIMESTAMP` is renamed "Same time, same position".
- People filters are Carrier / Shipper / Driver / User plus text (section 2).
- `HANDOVER_ANOMALY` stays, with a driver shown on each ping. Every rule must explain itself.
- Re-run and Export stay. Acknowledge buttons go.
- "Verified" = a confirmed arrival event or a pickup/delivery photo at the stop.

**Open**
1. "Same time, same position" and "Same time, different position" are planned as two separate rules (the first covers identical duplicates at one timestamp, the second covers resend drift). If you meant one rule only, tell me which and I'll merge them.
