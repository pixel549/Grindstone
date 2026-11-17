# Known issues (v2.8.0)

**Fixed in 2.6.4: starred props did nothing on a phone.** A finger tap on the house canvas opened the prop's sheet on `pointerup`,
then the browser's follow-up synthetic `click` landed on the sheet's backdrop (`.scrim`, `data-m="close"`) and shut it in the same instant.
Props with tall sheets (sink, characters) survived because the click landed on the sheet itself. Mouse clicks never showed it.
Fix: `touchend` is cancelled on the canvas (hearth2d `_bind`), and app.js swallows one stray click inside `#modal` for 450 ms after a house tap.
Regression test: `node test/touch_ui.js` (touch emulation).

**Open (unverified on device):** the home-screen widget froze on the A54 under 2.6. 2.7 rebuilds the loop on leaving the app, each tick and a 15-minute alarm, and Records shows the last filming result
(captureWidgetClip/refreshWidgetClip in app.js, WidgetStore.java, WidgetCam.java).
