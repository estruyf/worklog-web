# Acme Corp

## Social feed
- id: t_u6gxft
- status: open
- link: https://example.com/tasks/14350398
- created: 2026-06-30

## Rebuild the reporting export
- id: t_ip2dii
- status: in-progress
- link: https://example.com/issues/263 Tracking issue
- link: https://example.com/design/export
- created: 2026-07-14
- due: 2026-08-07
- worked: 2026-07-14
- worked: 2026-07-16
- tags: question, billing

The current export runs synchronously and times out on large date ranges.
Move it behind a queue and stream the CSV back.

### Notes
- 2026-07-14 — Reproduced the timeout with a 3-year range.
- 2026-07-16 09:30 — Queue prototype works end to end.
  Still need to decide where the generated file is stored.

## Group members overview
- id: t_mc0fiv
- status: open
- parent: t_u6gxft
- created: 2026-07-24

## Document the export runbook
- id: t_h2desc
- status: open
- created: 2026-07-28

Description prose that uses its own headings. These are not task delimiters:
only a `## ` heading with an `- id:` under it starts a task.

## Scripts

```
$ npm run export -- --range 2026-01-01..2026-12-31
```

## Resources

- https://example.com/runbook

### Notes
- 2026-07-28 10:00 — The headings above round-trip as description text.

## Shared onboarding checklist
- id: t_sh4red
- status: open
- client: acme globex
- created: 2026-07-20
- tags: onboarding

Runs across both accounts, so it carries an explicit client list.

- [x] Repo access
- [ ] Billing contact
- [ ] Kickoff call
