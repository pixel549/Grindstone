/* Web build only: stands in for the Android bridge (window.Native) so app.js runs in a browser.
 * Only the calls that have no browser equivalent are stubbed. Everything else is guarded in app.js
 * (it falls back to localStorage, direct fetch to the AI provider, or a file download). */
window.Native = {
  version: function () { return 'web'; },
  load: function () { try { return localStorage.getItem('grindstone') || ''; } catch (e) { return ''; } },
  save: function (raw) { localStorage.setItem('grindstone', raw); },
  interpInfo: function () { return '{}'; },        /* the Android interpreter is off in the browser */
  interpSet: function () {}, interpTest: function () {}, interpForget: function () {}
};
