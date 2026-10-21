Write short Hebrew text for a section added to a page Shlomi Zevin prepared for יפעה (Telos), who is pricing a government tender ("המשך פיתוח מערכת עולים לענן"). She sent a table of deliverables with quantities (base, additional, total) and asked him to fill in "שעות כולל תמיכה ובדיקות" (a bank of hours). The page now has an interactive table: she can change quantities, days per unit, hours per work day and unit price, and everything recalculates; she can copy it to Excel or download an Excel file with formulas.

Facts: hours per unit = days per unit × hours per work day (default 9). Days per unit are taken from the tender brief's SLA table for each deliverable (e.g. simple process 5 days, medium 10, complex 19, cloud setup 16, simple application change 1). Result with her quantities: 641 work days, 5,769 hours; base quantities only: 240 days, 2,160 hours. The brief's SLA is the delivery time of a standard team, so it is a conservative basis for an hours estimate; with spec-driven AI work actual effort is usually lower. Her table does not include two catalogue items: discovery of an existing system (small 7 days, large 13 days) — relevant because the winning supplier must learn the existing system — and annual maintenance, which the tender prices at 12% and not in hours.

Output exactly, in this format (parsed by a script):
TITLE: <section heading, e.g. "4. בנק שעות לפי תפוקות">
INTRO: <2 short sentences: what the table is and that every white cell can be edited>
NOTE1: <one sentence: how hours are calculated and where the days come from>
NOTE2: <one sentence: SLA is a standard team's delivery time, so this is a conservative basis>
NOTE3: <one sentence: discovery is missing and likely relevant, with the day figures>
NOTE4: <one sentence: maintenance is 12% in the tender, not hours, so it is not in the table>
Register: plain, direct, first person, short. No selling, no exclamation marks.
