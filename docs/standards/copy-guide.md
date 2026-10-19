# Copy Guide

Binding for every user-facing string in `apps/web` and `packages/ui`: labels, headings, buttons, tooltips, empty
states, errors, confirmations, aria-labels, CSV headers, page titles. All UI copy is English, written to a
professional enterprise standard.

## 1. Who we are writing for

- **Administrators** manage users, roles and permissions day to day. They scan, compare, act, and want exact
  numbers and next steps.
- **Everyone else** signs in, manages their own profile, password, two-factor method and sessions. They want plain
  outcomes, not internals.

Both are busy and competent. The app is an instrument panel, not a marketing site. Every word must earn its place.

## 2. Voice

| We are | We are not |
|---|---|
| Precise: "3 sessions active", "Quota 82% of 20 GB" | Vague: "Some activity", "Storage high" |
| Calm and factual, including when something is down | Alarmist ("Critical failure!"), cute ("Oops!"), apologetic ("Sorry") |
| Direct: imperative verbs, active voice | Passive or hedged ("It may be possible to…") |
| Consistent: one term per concept, everywhere | Synonym-hopping (session / connection / login) |
| Respectful of the reader's time: front-load the point | Preamble ("Please note that…", "In order to…") |

Tone shifts with the stakes, the voice does not. Routine: neutral. Degraded: specific and measured. Down or
destructive: short, explicit about impact, never dramatic.

## 3. Mechanics

- **Sentence case** everywhere: titles, buttons, tabs, column headers, menu items ("Export CSV", "Last sign-in").
  Proper nouns keep their case (Google, LDAP).
- **No terminal period** in labels, buttons, headers, chips, tooltips of one phrase. Use periods in full sentences
  (descriptions, empty-state bodies, errors).
- **Numerals always** ("3 sessions", not "three"). Units with a space: "20 GB", "350 ms", "2.4K tokens".
- **Dates/times**: `16 Oct 2026`, `14:05 WIB`, `16 Oct 2026, 14:05 WIB`; relative "3 min ago", "2 h ago",
  "Yesterday", always with the absolute time in a tooltip. Under 1 minute (and future timestamps from clock skew)
  → "Just now". Relative phrases are standalone strings; never splice them mid-sentence. Ranges with an en dash: "1–25 of 312".
- **Contractions** allowed in body text ("can't", "isn't"); avoid them in labels and buttons.
- **"You"** sparingly, never "we"/"our" for the system. The app is not a character. Prefer the object as the subject:
  "The session ended", not "We ended your session".
- **American spelling** (authorization, canceled, color, behavior).
- **No exclamation marks, no emoji, no ALL CAPS** in source strings (except acronyms and the environment ribbon
  `DEV`/`UAT`/`PROD`). The `eyebrow` overline style may render uppercase via CSS; its source text stays sentence case.
- **Placeholders** show format, never act as labels: label "Search", placeholder "Name or email".

## 4. Patterns

**Page title + description.** Title is a noun ("Users", "Roles", "Activity log"). Description is one sentence stating
scope and freshness: "Every user account, refreshed every 30 s."

**Buttons.** Verb + object, specific: "Create user", "Export CSV", "Revoke 2 sessions", "Load more".
Never "OK", "Yes", "Submit", "Click here". The primary action names its result.

**Confirmations.** Title asks with the action + target; body states impact; buttons repeat the verb.
> **Revoke 2 sessions for Rina Wulandari?**
> She is signed out on those devices immediately. Her account stays active.
> [Cancel] [Revoke sessions]

Never "Are you sure?".

Destructive actions on a named account ask for the name typed exactly (`Type rina to continue`); a generated secret
(password, recovery code) shows once in a dialog titled `New password for <name>` with a Copy button and "Close and clear".

**Errors.** What happened + why (if known) + what to do. No blame, no codes as the headline (codes go in detail).
> **Couldn't load users**
> The server didn't respond within 5 s. Try again in a minute.
> [Try again]

Field errors sit under the field and say how to fix: "Enter the 6-digit code from your authenticator app."
Never clear the user's input on error.

**Empty states.** Say why it's empty and when data will appear; offer the next step if there is one.
> **No sign-ins in the last 24 hours**
> Sign-ins appear here when a user signs in. Try a longer time range.

Filtered-empty is different from truly empty: "No users match "status:inactive"." + [Clear filters].

**Loading.** Skeletons, not words. Where text is needed: "Loading sessions…" (with ellipsis character).

**Stale / partial data.** State age and source plainly: "Showing data from 14:02 WIB. The activity feed isn't
responding; values may be out of date."

**Disabled actions.** Always explain why, in a tooltip, menu label, or helper text: "The activity log
isn't responding, so changes are off until it returns." / "The account isn't locked."

**Numbers and status in sentences.** Lead with the number: "4 of 6 users active", "12 sign-ins failed today".

**KPI tiles.** The label names the metric only: "Users", "Sign-ins", "Failed sign-ins".
The period and the comparison go in the caption under the value, number first in the pill:
> **Sign-ins** 12,840 [↑ +15%] — Last 7 days · vs previous 7 days

Today-counters say when "today" starts: "Today, since 00:00 WIB"; a detail tile may add one fact: "Today · 945
sign-ins". A tile without a comparison still states its period ("Last 24 hours"); "Same as 7 days ago" when nothing changed.

**Chart and panel descriptions.** Period, then granularity, after the title's middot: "Last 24 hours · per hour,
WIB", "Last 7 days · per day, WIB", "Last 30 days". Rankings say their size: "Top 10", "By sign-ins". The
summary under a ranking: "Top 5 total", "Share of all sign-ins", "Share of all failures".

**Bytes.** Table cells "16.4 GB / 20 GB"; tiles and prose "19 GB of 20 GB · 95%"; cards "95% of 20 GB". Always GB
(base 1024 via `formatBytes`), never GiB.

**Tooltips & status descriptions.** One sentence, present tense, states meaning + threshold + what to do when relevant:
> **Degraded** — Running, but a resource is above its warning threshold or a check is failing. Review the reason
> on the card.

State the real thresholds from `packages/ui/src/lib/status.ts` (the glossary is the single source); never copy
numbers from examples.

## 5. Glossary (use exactly these terms)

| Use | Not | Notes |
|---|---|---|
| user | member, account holder, person | A person with an account. "Account" only for the signed-in user's own ("Your account") |
| role | group, profile, level | A named set of permissions |
| permission | right, privilege, access | One capability, named `<resource>.<action>` (`user.view`, `role.edit`) |
| session | connection, login | One signed-in browser or device |
| activity log | history, audit trail | Who changed what: every create, edit and delete |
| sign-in log | login history, access log | Every sign-in attempt and its result |
| sign in / sign out | log in, log out, login (verb) | "Sign-in" as noun/adjective: "Last sign-in", "Sign-in log" |
| one-time code | OTP, token (in UI copy) | Field label "One-time code"; "OTP" only in technical detail |
| two-factor authentication | 2FA, MFA (in headings) | "2FA" is fine in a tight label |
| recovery code | backup code | Shown once; never display it again |
| active / inactive | enabled / disabled, on / off | A user's state; an inactive user can't sign in |
| Healthy / Degraded / Down / Stopped / Unknown | OK, Warning, Error, Offline, N/A | The five health states |
| Dashboard, Users, Roles, Permissions, Activity log, Sign-in log | Home, Admin, History | Navigation labels |

## 6. Words to avoid

Sorry, oops, please (except in rare requests to wait), simply, just (except the fixed phrase "Just now"), easily, successfully (say what happened),
utilize (use), in order to (to), at this time (now), unable to (can't), invalid (say what's wrong),
error occurred (say what failed), N/A (use the en dash "–" for a missing value, with a tooltip when the reason is known, or "Not available").

## 7. Review checklist

1. Can a busy admin act on it in one read?
2. Is every term from the glossary, and is it used consistently?
3. Sentence case, no stray periods, no exclamation marks?
4. Does every error say what, why, and what next? Does every empty state say when data appears?
5. Does every status chip and disabled control explain itself?
6. Are numbers, units, dates, and times in the house format?
7. Would this read well in front of the team that owns the product?
