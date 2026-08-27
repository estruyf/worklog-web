# Northwind Traders

## Warehouse sync falls behind on Mondays
- id: t_nw0001
- status: in-progress
- priority: urgent
- link: https://example.com/northwind/tickets/4821
- created: 2026-08-19
- due: 2026-08-28
- worked: 2026-08-19
- worked: 2026-08-26
- worked: 2026-08-27
- tags: bug

The weekend backlog is bigger than one run can drain, so Monday starts behind
and never catches up.

### Notes
- 2026-08-26 09:05 — It is the batch size, not the schedule. 500 rows a run
  against a weekend of 40,000.

## Add CSV export to the orders screen
- id: t_nw0002
- status: open
- created: 2026-08-05
- due: 2026-09-07

## Decommission the legacy FTP drop
- id: t_nw0003
- status: waiting-for
- priority: low
- created: 2026-07-28

Two of their suppliers still push there. Waiting on the migration dates.

## Weekly summary for the ops team
- id: t_nw0004
- status: open
- created: 2026-06-12
- due: 2026-08-28
- repeat: weekly on fri
- lastDone: 2026-08-21
