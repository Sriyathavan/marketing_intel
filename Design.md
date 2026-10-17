calendar view, shows emails, when you click on one sequence it shows the details of that campaign, and then the rational

---

# Design guidance

## Requirement
Original (verbatim, above): a calendar view showing emails; clicking one email/sequence shows that campaign's details, then the rationale. Nothing beyond this is required.

## Calendar reference (from the supplied image)
Month-grid email marketing calendar, "Aug 2021".
- **Header row:** prev/next chevrons, month + year label with a small calendar icon, bell icon, a peach "Month" dropdown button, then (right side) help icon, rounded "Search" field, and a "..." overflow.
- **Grid:** 7 columns Mon-Sun, 5 week rows, thin light-grey cell borders, white background. Column headers are in the first row of cells ("Mon Jul 26", "Tue 27" ...), with the date in the top-left corner of each cell. The first day of a month is labelled with the month ("Aug 1", "Aug 2").
- **Date text:** small, light grey, regular weight. Days outside the month (Jul 26-31) are faded, including their header labels.
- **Today:** the cell for the 19th has a pale yellow fill. No other cell styling.
- **Email pills:** rounded-rectangle chips (about 4px radius), full cell width minus padding, title text only (dark grey, ~14px, wraps to 2-3 lines, no truncation, no icons, no times). Several stack vertically in one cell with small gaps (max 2 in the image). Cells grow to fit.
- **Color:** soft pastel fills, no borders. Families: teal/mint, blue, yellow, orange/peach, pink/rose, lavender/purple, green. Each family comes in a light and a more saturated shade. The same title (e.g. "New Arrivals", "Summer Sale") appears in different colors on different days, so color is not strictly tied to title; it reads as campaign/type grouping.
- **Density:** generous padding, calm and airy; the colored pills are the only strong visual element.

## Reference only, not required
Do NOT build these unless asked: search field, bell/notifications, help icon, "Month" view dropdown (month grid is the only view), "..." overflow, calendar icon beside the label, any Week/Day views. Prev/next month arrows and the month label are the minimum navigation needed to browse a calendar.

## Layout and hierarchy
1. Calendar grid is the page. Month label and prev/next sit above it.
2. Click a pill -> detail panel opens (right-side panel or modal; pick one, keep the grid visible behind it).
3. Panel order is fixed: campaign details first, rationale second (matches the requirement).
4. Weekends are not visually distinct. Today = pale yellow cell. Out-of-month days faded.
5. Reading order in a cell: date, then pills in send order.

## Color and typography tokens
Pastel palette (matching the reference; light = default pill, deep = hover/selected):

| Token | Light | Deep | Use |
|---|---|---|---|
| `--c-mint` | #D6EFE8 | #8FD3BC | campaign family A |
| `--c-sky` | #D6E6F7 | #7FB0DF | family B |
| `--c-butter` | #F8EBB0 | #EFC96A | family C |
| `--c-peach` | #F9DCC4 | #F0B27A | family D |
| `--c-rose` | #F6D9D9 | #D98B87 | family E |
| `--c-lilac` | #E4D8EE | #B58CC9 | family F |
| `--c-sage` | #D9F0D4 | #7FCB8C | family G |

Surfaces: grid bg #FFFFFF, border #E6E6E6, date text #9A9A9A, faded date #CFCFCF, today #FDF6E0, pill text #2B2B2B.

Status colors (shown as a small dot or 3px left edge on the pill, so the family color stays intact):
- Proposed: #E0A100 (amber)
- Approved: #2E9E6B (green)
- Rejected: #C0504D (red; pill also at 50% opacity)

Typography: one rounded sans-serif (the reference looks like Poppins-style). Date 12px, pill 13-14px/1.3 medium, panel title 20px semibold, panel body 14-15px. Keep text contrast of pill text on fills at 4.5:1 or better.

## Email pill and detail panel
**Pill:** title only, pastel fill, status marker. Nothing else on the pill.

**Detail panel (click pill):**
1. **Campaign details:** campaign/sequence name, which email in the sequence it is, send date, subject line, preview of the email body, audience/segment, status.
2. **Rationale:** why this email, on this date, to this audience. Show it as short plain-language reasons, each linked to its evidence (data point, source, date). Label anything that is a judgment vs. a sourced fact.
3. **Review actions:** Approve, Edit, Reject for proposed emails (human review of AI output). Rejection takes an optional reason. Status updates the pill marker.

Rules: rationale is visible without extra clicks inside the panel; never hide evidence behind hover; no new tabs, filters or metrics beyond the above.

## Tone for an outdoor/adventure travel brand
- Warm, first-person, inspiring but grounded; real trips and real people over polish (Intrepid, REI).
- Values before discounts: purpose and place (sustainability, community) carry the message (REI #OptOutside, Intrepid "Good Trips Only").
- Visual: soft, natural pastels (the palette above leans earthy/sky/sage), generous whitespace, rounded corners, plain-spoken labels. Avoid corporate jargon in UI copy.
- Marketer-facing UI copy is neutral and short; the adventure tone belongs in the email content shown, not in the app chrome.

## Sources
Takeaways below are from search result summaries only; no page was read in full.
- a16z, "Big Ideas 2026: Part 2": https://a16z.com/newsletter/big-ideas-2026-part-2/ . Describes apps that observe behavior and propose actions for the user to review. Supports the propose -> human review model.
- a16z, "Leaders, gainers and unexpected winners in the Enterprise AI arms race": https://a16z.com/leaders-gainers-and-unexpected-winners-in-the-enterprise-ai-arms-race/ . Cites survey data tying explainability to trust and adoption. Supports showing rationale.
- a16z, "Big Ideas 2026: Voice Agents and High-Stakes Trust": https://a16z.com/podcast/big-ideas-2026-voice-agents-and-high-stakes-trust/ . Trust as the differentiator in high-stakes AI. Only loosely relevant.
- a16z: search found no a16z piece with concrete guidance on dashboards, calendars, or showing citations/reasoning in UI. Treat the above as directional only.
- Airbnb, "Building a Visual Language": https://airbnb.design/building-a-visual-language/ . Principles reported as Unified, Universal, Iconic, Conversational (via secondary summary at https://www.designprinciplesftw.com/collections/airbnbs-design-principles). Takeaway: one consistent component language, no one-off elements.
- Intrepid Travel: https://econsultancy.com/eight-examples-of-top-notch-copywriting-from-travel-brands/ (inspirational, experience-led copy) and https://www.travelmonitor.com.au/intrepid-launches-new-chapter-of-only-intrepid-brand-campaign/ (purpose-led brand campaign).
- REI Co-op: https://www.campaignmonitor.com/blog/email-marketing/positively-good-marketing-rei/ . Email used to advocate values, not only sell.
- Not found: nothing useful retrieved for Booking.com, Expedia, G Adventures, or Lonely Planet. Not searched in depth.
