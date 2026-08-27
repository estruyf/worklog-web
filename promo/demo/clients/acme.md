# Acme Corp

## Rebuild the reporting export
- id: t_ac0001
- status: in-progress
- priority: high
- link: https://example.com/acme/issues/263 Tracking issue
- link: https://example.com/acme/design/export
- created: 2026-08-17
- due: 2026-08-31
- worked: 2026-08-17
- worked: 2026-08-24
- worked: 2026-08-25
- worked: 2026-08-27
- tags: billing, performance

The export runs synchronously and times out on anything over a year. Move it
behind a queue and stream the CSV back as it is generated.

### Prompts
- [ ] Draft the queue migration checklist
  Read src/export/*.ts and list every synchronous call that has to move behind
  the queue, in the order they can be moved.

  Call out anything that writes to the response stream.

- [x] 2026-08-24 09:10 — Summarise the timeout reports
  Summarise the three timeout reports in one paragraph a non-engineer can read.

### Notes
- 2026-08-17 11:20 — Reproduced with a three-year range. 94 seconds, then a 504.
- 2026-08-25 16:40 — Queue prototype works end to end. Still deciding where the
  generated file is parked.

## Stream the CSV rather than buffering it
- id: t_ac0002
- status: open
- parent: t_ac0001
- created: 2026-08-25

## Ship the invoice PDF template
- id: t_ac0003
- status: waiting-for
- created: 2026-08-11
- due: 2026-09-03
- tags: billing

Blocked on the new VAT wording coming back from their accountant.

## Audit the webhook retries
- id: t_ac0004
- status: open
- priority: urgent
- created: 2026-08-06
- due: 2026-08-25
- worked: 2026-08-18

Three deliveries went missing last week and nothing retried them.

## Quarterly roadmap review
- id: t_ac0005
- status: in-review
- created: 2026-08-20
- due: 2026-09-10

## Migrate staging onto the new database
- id: t_ac0006
- status: open
- created: 2026-08-26
- tags: infrastructure
