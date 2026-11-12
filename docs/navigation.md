# Responsive navigation

The shell owns one Back control. Page-level BackButton components register their action and label in NavigationProvider; they render their own button only outside the shell. This keeps report-to-parameters and nested photo/store-selection steps intact without duplicate controls.

- Desktop (1200px and wider): full sidebar, scrollable content and top Back control.
- Tablet (768–1199px): narrow sidebar with labels and 44px-or-larger touch targets.
- Phone (up to 767px): persistent bottom section navigation in its own layout row, top Back control, remaining sections/theme/install in Menu. Safe-area insets are reserved. Text/date entry hides the bottom row while focused.

The workspace, rather than the browser window, scrolls. The shell resets workspace scroll on a screen change. Existing full-viewport modal/report viewers retain their sizing; normal page containers fill the available workspace. Mobile report action bars reserve `--soda-navigation-height` so they do not cover the bottom section buttons.

Profile, Menu and shared confirmation popups use native modal dialogs in a portal, keeping background controls inert and containing keyboard focus. Native Back closes these dialogs before leaving the page. Existing report dialogs remain supported through their close controls. Back from a generated sales report returns to parameters; Back from daily sales respects its entry screen.

Authenticated sessions register beforeunload and one same-URL history guard. Closing/reloading uses the browser's own warning; native Back navigates within SODA first and asks before leaving home. Cancellation restores the active history entry without clearing auth/data. Confirmed history exit suppresses a duplicate unload prompt. Listener cleanup and reuse on remount prevent accumulating guard entries.

Browser limitations: beforeunload requires user activation and may be suppressed, particularly when a mobile OS kills an app from its task switcher. Custom browser-dialog text and guaranteed native app closure are outside a website's control.

Validation: production build; lint on all changed TS/TSX files; `node --test test/*.test.cjs test/*.test.mjs`. Full repository lint has existing failures in StoreCheckReviewPage, useMessagesCenter and constants/version.js. Local cloud-browser access was unavailable in the execution environment, so real-device layout/OS-back verification remains required before release.
