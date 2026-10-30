# Homepage promotions

`jersey-preorder.ts` owns the DEC / Big Branch Bike Park MTB jersey promotion's
link, advertised prices, and deadline. Checkout pricing is controlled by Cognative.
The promotion ends at midnight Eastern after Sunday, November 15, 2026
(`2026-11-16T05:00:00Z`).

`JerseyPreorderBanner` starts hidden and checks this rule after hydration so stale
HTML from the site's long-lived caches cannot leave the promotion visible after
its deadline. It checks again at expiry, when the page regains focus or visibility,
and at least daily while open. JavaScript is required to display this optional
promotion. Expiration needs no scheduled job or follow-up deployment.

For later source cleanup, remove the banner import and render in `app/page.tsx`,
its component, this directory, and `src/__tests__/lib/jersey-preorder.test.ts`.
The deadline boundary is covered by the existing Vitest CI suite.
