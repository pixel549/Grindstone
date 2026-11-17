package dev.jake.grindstone;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String NOTIF = "android.permission.POST_NOTIFICATIONS";
    private WebView web;
    /** Set while the app is on screen, so the herald asks the page to pull instead of writing under it. */
    static volatile MainActivity live;
    private static final int REQ_CAL = 8;
    private static final int REQ_LOC = 9;
    private static final int REQ_BG = 10;
    private static final int REQ_PICK = 11;
    private String pickCb;
    static final String HOST = Assets.HOST;
    static final String ORIGIN = Assets.ORIGIN;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.setStatusBarColor(0xFF0F0C0A);
        w.setNavigationBarColor(0xFF0A0908);

        // Chrome's remote DevTools (chrome://inspect) can attach only while the phone itself has USB debugging on,
        // which takes Developer options and a cable to a computer you've allowed; off otherwise.
        try {
            if (android.provider.Settings.Global.getInt(getContentResolver(), android.provider.Settings.Global.ADB_ENABLED, 0) == 1)
                WebView.setWebContentsDebuggingEnabled(true);
        } catch (Exception ignored) { }
        web = new WebView(this);
        web.setBackgroundColor(0xFF0A0908);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                return Assets.respond(MainActivity.this, u.getPath());
            }
        });
        web.loadUrl(ORIGIN + "index.html");
        setContentView(web);

        Ticker.ensureScheduled(this);
        Delve.schedule(this);
        Herald.scheduleJob(this);
        routeIntent(getIntent());
        askForNotificationsOnce();
    }

    private void askForNotificationsOnce() {
        if (Build.VERSION.SDK_INT < 33 || checkSelfPermission(NOTIF) == PackageManager.PERMISSION_GRANTED) return;
        SharedPreferences p = Store.prefs(this);
        if (p.getBoolean("askedNotif", false)) return;
        p.edit().putBoolean("askedNotif", true).apply();
        requestPermissions(new String[]{NOTIF}, 7);
    }

    @Override
    protected void onResume() {
        super.onResume();
        live = this;
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("window.onResume && window.onResume()", null);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        live = null;
        if (web != null) web.onPause(); // stops the home-base animation while you're away
        QuestWidget.kick(getApplicationContext()); // he is off to the home screen: show the latest and restart the loop
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.handleBack && window.handleBack()) ? 1 : 0", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (!"1".equals(v)) finish();
            }
        });
    }

    void callback(final String fn, final String cb, final String arg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() { if (web != null) web.evaluateJavascript("window." + fn + " && window." + fn + "(" + JSONObject.quote(cb) + "," + arg + ")", null); }
        });
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        routeIntent(i);
    }

    /** The widget asks for a particular screen (e.g. the Hearth). */
    private void routeIntent(Intent i) {
        final String to = i == null ? null : i.getStringExtra("goto");
        if (to == null || web == null) return;
        i.removeExtra("goto");
        web.postDelayed(new Runnable() {
            @Override
            public void run() { if (web != null) web.evaluateJavascript("window.gotoFromWidget && window.gotoFromWidget(" + JSONObject.quote(to) + ")", null); }
        }, 350);
    }

    /** The calendar changed while we're open: the page saves, then calls Native.heraldSync() itself. */
    void heraldPoll() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() { if (web != null) web.evaluateJavascript("window.heraldPoll && window.heraldPoll()", null); }
        });
    }

    /** Exposed to the page as window.Native */
    final class Bridge {
        /** The delve's away check: what's been granted. */
        @JavascriptInterface
        public String awayInfo() {
            try {
                return new JSONObject().put("fine", Delve.granted(MainActivity.this, Delve.FINE)).put("bg", Delve.granted(MainActivity.this, Delve.BG)).toString();
            } catch (Exception e) { return "{}"; }
        }

        /** Asks for location (precise first, then "all the time", which Android sends to the settings page). Answers via window.onAwayPerm. */
        @JavascriptInterface
        public void askLocation() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!Delve.granted(MainActivity.this, Delve.FINE)) {
                        SharedPreferences p = Store.prefs(MainActivity.this);
                        if (p.getBoolean("askedLoc", false) && !shouldShowRequestPermissionRationale(Delve.FINE)) {
                            startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
                            return;
                        }
                        p.edit().putBoolean("askedLoc", true).apply();
                        requestPermissions(new String[]{ Delve.FINE, Delve.COARSE }, REQ_LOC);
                    } else if (!Delve.granted(MainActivity.this, Delve.BG)) {
                        requestPermissions(new String[]{ Delve.BG }, REQ_BG);
                    } else awayAnswer();
                }
            });
        }

        /** "Set home here": takes one fix, keeps it in its own prefs file (never in the save), callback(cb, {acc}) or null. */
        @JavascriptInterface
        public void hereNow(final String cb) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Delve.here(MainActivity.this, new java.util.function.Consumer<android.location.Location>() {
                        @Override
                        public void accept(android.location.Location l) {
                            String arg = "null";
                            try { if (l != null) { Delve.setHome(MainActivity.this, l.getLatitude(), l.getLongitude()); arg = new JSONObject().put("acc", l.getAccuracy()).toString(); } } catch (Exception e) { arg = "null"; }
                            callback("__here", cb, arg);
                        }
                    });
                }
            });
        }

        @JavascriptInterface
        public void forgetHome() { Delve.forgetHome(MainActivity.this); }

        /** The fallback time changed: move the alarm. */
        @JavascriptInterface
        public void delveArm() { Delve.schedule(MainActivity.this); }

        @JavascriptInterface
        public String load() { return Store.load(MainActivity.this); }

        @JavascriptInterface
        public void save(String json) {
            Store.save(MainActivity.this, json);
            QuestWidget.updateAll(getApplicationContext());
        }

        @JavascriptInterface
        public void haptic(final int kind) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    int c = kind == 2 ? HapticFeedbackConstants.LONG_PRESS
                            : kind == 1 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.KEYBOARD_TAP;
                    web.performHapticFeedback(c);
                }
            });
        }

        @JavascriptInterface
        public void share(final String text, final String subject) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, text);
                    i.putExtra(Intent.EXTRA_SUBJECT, subject);
                    i.putExtra(Intent.EXTRA_TITLE, subject);
                    startActivity(Intent.createChooser(i, "Save your Grindstone backup"));
                }
            });
        }

        // ----- 2.9: deeds written to the calendar; whether the phone is on silent -----
        @JavascriptInterface
        public String heraldWrite(String calId, String title, String startMs) {
            try { return String.valueOf(Herald.write(MainActivity.this, Long.parseLong(calId), title, Long.parseLong(startMs))); } catch (Exception e) { return "-1"; }
        }

        @JavascriptInterface
        public boolean heraldUnwrite(String id) {
            try { return Herald.unwrite(MainActivity.this, Long.parseLong(id)); } catch (Exception e) { return false; }
        }

        /** True when the ringer is on silent or vibrate: the app keeps quiet too. */
        @JavascriptInterface
        public boolean quiet() {
            try {
                android.media.AudioManager am = (android.media.AudioManager) getSystemService(AUDIO_SERVICE);
                return am != null && am.getRingerMode() != android.media.AudioManager.RINGER_MODE_NORMAL;
            } catch (Exception e) {
                return false;
            }
        }

        // ----- 2.8: the work roster, backups that outlive the app -----
        /** Shifts on a calendar from yesterday to a fortnight out. */
        /** 2.14: today's forecast from open-meteo.com (no key, no account), for picking the day's plan. Uses the home fix
         *  if one is set, rounded to about a kilometre; otherwise Albany. Answers window[cb](json) or stays silent. */
        @JavascriptInterface
        public void weather(final String cb) {
            if (cb == null || !cb.matches("[A-Za-z_]+")) return;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    java.net.HttpURLConnection c = null;
                    try {
                        double lat = -35.02, lng = 117.88; boolean home = false;
                        android.content.SharedPreferences p = Delve.homePrefs(MainActivity.this);
                        String a = p.getString("lat", null), b = p.getString("lng", null);
                        if (a != null && b != null) { lat = Math.round(Double.parseDouble(a) * 100) / 100.0; lng = Math.round(Double.parseDouble(b) * 100) / 100.0; home = true; }
                        java.net.URL u = new java.net.URL("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lng
                            + "&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=2");
                        c = (java.net.HttpURLConnection) u.openConnection();
                        c.setConnectTimeout(8000); c.setReadTimeout(8000);
                        if (c.getResponseCode() != 200) return;
                        java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(c.getInputStream(), "UTF-8"));
                        StringBuilder sb = new StringBuilder(); String line;
                        while ((line = r.readLine()) != null && sb.length() < 20000) sb.append(line);
                        r.close();
                        final String js = "window." + cb + " && window." + cb + "(" + new JSONObject(sb.toString()).put("home", home).toString() + ")";
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() { if (web != null) web.evaluateJavascript(js, null); }
                        });
                    } catch (Exception e) {
                        // no network, or a bad answer: the plan does without the weather
                    } finally {
                        if (c != null) c.disconnect();
                    }
                }
            }).start();
        }

        /** 2.25: the overdue note's own record: { ping: {quest id: day}, snz: {quest id: snoozed until} } (Ticker.checkOverdue). */
        @JavascriptInterface
        public String remindMarks() {
            try {
                JSONObject o = new JSONObject();
                o.put("ping", Ticker.marks(MainActivity.this, "rmPing"));
                o.put("snz", Ticker.marks(MainActivity.this, "rmSnz"));
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        /** 2.25: the app's own overdue list has been looked at: the note can go. */
        @JavascriptInterface
        public void overdueSeen() {
            android.app.NotificationManager nm = getSystemService(android.app.NotificationManager.class);
            if (nm != null) nm.cancel(Ticker.OVERDUE_ID);
        }

        @JavascriptInterface
        public String rosterEvents(String calId) {
            try {
                long now = System.currentTimeMillis(), day = 24L * 3600 * 1000;
                return Herald.roster(MainActivity.this, Long.parseLong(calId), now - 45 * day, now + 15 * day).toString();   // 2.27: six weeks back, for the long-day rule
            } catch (Exception e) {
                return "[]";
            }
        }

        /** 2.26: the next year of events in the calendars people are picked from (comma-separated ids), for names. */
        @JavascriptInterface
        public String peopleEvents(String ids) {
            JSONArray all = new JSONArray();
            try {
                long now = System.currentTimeMillis(), day = 24L * 3600 * 1000;
                for (String id : String.valueOf(ids).split(",")) {
                    if (id.trim().isEmpty()) continue;
                    JSONArray a = Herald.roster(MainActivity.this, Long.parseLong(id.trim()), now - 2 * day, now + 400 * day, 1500);
                    for (int i = 0; i < a.length() && all.length() < 3000; i++) all.put(a.get(i));
                }
            } catch (Exception e) {
                // a calendar that's gone, or no permission: whatever was read
            }
            return all.toString();
        }

        @JavascriptInterface
        public String backupWrite(String json, String name) { return Backup.write(MainActivity.this, json, name); }

        /** Opens the phone's file picker; the chosen file's text comes back to window[cb](text or null). */
        @JavascriptInterface
        public void backupPick(final String cb) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        pickCb = cb != null && cb.matches("[A-Za-z_][A-Za-z0-9_]{0,40}") ? cb : null;
                        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType("*/*");
                        startActivityForResult(i, REQ_PICK);
                    } catch (Exception e) {
                        // no picker on this phone; the paste box still works
                    }
                }
            });
        }

        // ----- the herald: deeds from the Grindstone calendar -----
        @JavascriptInterface
        public String heraldInfo() {
            try {
                JSONObject o = new JSONObject();
                o.put("perm", Herald.permitted(MainActivity.this));
                o.put("write", Herald.canWrite(MainActivity.this));
                o.put("cals", Herald.calendars(MainActivity.this));
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void askCalendar() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Herald.permitted(MainActivity.this) && Herald.canWrite(MainActivity.this)) {
                        web.evaluateJavascript("window.onHeraldPerm && window.onHeraldPerm(true)", null);
                        return;
                    }
                    SharedPreferences p = Store.prefs(MainActivity.this);
                    if (p.getBoolean("askedCal", false) && !shouldShowRequestPermissionRationale(Herald.READ)) {
                        // Denied for good: the system won't ask again, so open the app's settings page.
                        startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
                        return;
                    }
                    p.edit().putBoolean("askedCal", true).apply();
                    requestPermissions(new String[]{Herald.READ, Herald.WRITE}, REQ_CAL);
                }
            });
        }

        /** Called by the page after it has saved; returns what was credited, or "{}". */
        @JavascriptInterface
        public String heraldSync() {
            JSONObject r = Herald.sync(MainActivity.this, true);
            return r == null ? "{}" : r.toString();
        }

        @JavascriptInterface
        public void heraldArm() { Herald.scheduleJob(MainActivity.this); }

        @JavascriptInterface
        public boolean heraldEnableSync(String id) {
            try { return Herald.enableSync(MainActivity.this, Long.parseLong(id)); } catch (Exception e) { return false; }
        }

        // ----- the widget's clip -----
        @JavascriptInterface
        public boolean widgetFrames(String json) { return WidgetStore.save(MainActivity.this, json); }

        @JavascriptInterface
        public String widgetFramesWhy(String json) { return WidgetStore.saveWhy(MainActivity.this, json); }

        @JavascriptInterface
        public String widgetInfo() {
            try {
                JSONObject o = new JSONObject();
                o.put("placed", QuestWidget.placed(MainActivity.this));
                long age = WidgetStore.age(MainActivity.this);
                o.put("age", age == Long.MAX_VALUE ? -1 : age);
                o.put("sig", WidgetStore.prefs(MainActivity.this).getString("sig", ""));
                o.put("n", WidgetStore.prefs(MainActivity.this).getInt("n", 0));
                o.put("last", WidgetStore.prefs(MainActivity.this).getString("last", ""));
                long lastAt = WidgetStore.prefs(MainActivity.this).getLong("lastAt", 0);
                o.put("lastAge", lastAt == 0 ? -1 : System.currentTimeMillis() - lastAt);
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        // ----- the interpreter (optional; any OpenAI-compatible key) -----
        @JavascriptInterface
        public String interpInfo() { return Interpreter.info(MainActivity.this).toString(); }

        @JavascriptInterface
        public void interpSet(String json) {
            try { Interpreter.set(MainActivity.this, new JSONObject(json)); } catch (Exception e) { /* ignore bad input */ }
        }

        @JavascriptInterface
        public void interpForget() { Interpreter.forget(MainActivity.this); }

        @JavascriptInterface
        public void interpTest(final String cb) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    final String why = Interpreter.test(MainActivity.this);
                    callback("__interpTested", cb, JSONObject.quote(why));
                }
            }, "interp-test").start();
        }

        /** {reports:[{k,text}], quests:[{id,name}]} -> window.__interpDone(cb, {k: questId} or null). Never blocks the page. */
        @JavascriptInterface
        public void interpret(final String json, final String cb) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String out = "null";
                    try {
                        JSONObject o = new JSONObject(json);
                        JSONObject m = Interpreter.resolve(MainActivity.this, o.getJSONArray("reports"), o.getJSONArray("quests"));
                        if (m != null) out = m.toString();
                    } catch (Exception e) { /* out stays null */ }
                    callback("__interpDone", cb, out);
                }
            }, "interp").start();
        }

        @JavascriptInterface
        public void copy(String text) {
            android.content.ClipboardManager cm = getSystemService(android.content.ClipboardManager.class);
            if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("Grindstone", text));
        }

        @JavascriptInterface
        public boolean canNotify() {
            return Build.VERSION.SDK_INT < 33 || checkSelfPermission(NOTIF) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void askNotify() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT < 33) return;
                    if (shouldShowRequestPermissionRationale(NOTIF) || !Store.prefs(MainActivity.this).getBoolean("askedNotif", false)) {
                        Store.prefs(MainActivity.this).edit().putBoolean("askedNotif", true).apply();
                        requestPermissions(new String[]{NOTIF}, 7);
                    } else {
                        // Permanently denied: send them to the app's notification settings instead.
                        Intent i = new Intent("android.settings.APP_NOTIFICATION_SETTINGS");
                        i.putExtra("android.provider.extra.APP_PACKAGE", getPackageName());
                        startActivity(i);
                    }
                }
            });
        }

        // ----- the Oracle: Claude API, called from Java so the key never touches the page -----
        private SharedPreferences oraclePrefs() { return getSharedPreferences("oracle", MODE_PRIVATE); }

        @JavascriptInterface
        public boolean hasOracleKey() { return Interpreter.configured(MainActivity.this); }   // 2.26: any connected model will do

        /** 2.26: ask the AI connection (whichever provider) and hand the reply to window.__aiDone(cb, ok, text). */
        @JavascriptInterface
        public void aiAsk(final String system, final String user, final int maxTokens, final String cb) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    boolean ok = false;
                    String out;
                    try { out = Interpreter.ask(MainActivity.this, system, user, Math.max(64, Math.min(4000, maxTokens))); ok = true; }
                    catch (Throwable t) { out = String.valueOf(t.getMessage()); }
                    callback("__aiDone", cb, ok + "," + JSONObject.quote(out));
                }
            }, "ai-ask").start();
        }

        @JavascriptInterface
        public void setOracleKey(String key) { oraclePrefs().edit().putString("key", key == null ? "" : key.trim()).apply(); }

        @JavascriptInterface
        public void oracle(final String body, final String cb) {
            final String key = oraclePrefs().getString("key", "");
            new Thread(new Runnable() {
                @Override
                public void run() {
                    int code = -1;
                    String out;
                    HttpURLConnection c = null;
                    try {
                        c = (HttpURLConnection) new URL("https://api.anthropic.com/v1/messages").openConnection();
                        c.setRequestMethod("POST");
                        c.setConnectTimeout(15000);
                        c.setReadTimeout(90000);
                        c.setDoOutput(true);
                        c.setRequestProperty("content-type", "application/json");
                        c.setRequestProperty("x-api-key", key);
                        c.setRequestProperty("anthropic-version", "2023-06-01");
                        byte[] b = body.getBytes("UTF-8");
                        c.setFixedLengthStreamingMode(b.length);
                        OutputStream os = c.getOutputStream();
                        os.write(b);
                        os.close();
                        code = c.getResponseCode();
                        InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
                        out = readAll(is);
                    } catch (Exception e) {
                        out = "{\"error\":{\"message\":" + JSONObject.quote("Couldn't reach the Oracle: " + e.getMessage()) + "}}";
                    } finally {
                        if (c != null) c.disconnect();
                    }
                    final String js = "window.__oracleDone(" + JSONObject.quote(cb) + "," + code + "," + JSONObject.quote(out) + ")";
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() { web.evaluateJavascript(js, null); }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (PackageManager.NameNotFoundException e) {
                return "?";
            }
        }
    }

    static String readAll(InputStream is) throws java.io.IOException {
        if (is == null) return "";
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
        is.close();
        return bo.toString("UTF-8");
    }

    void awayAnswer() {
        if (web != null) web.evaluateJavascript("window.onAwayPerm && window.onAwayPerm(" + Delve.granted(this, Delve.FINE) + "," + Delve.granted(this, Delve.BG) + ")", null);
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != REQ_PICK || pickCb == null) return;
        final String cb = pickCb;
        pickCb = null;
        final android.net.Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        new Thread(new Runnable() {
            @Override
            public void run() {
                final String text = uri == null ? null : Backup.read(MainActivity.this, uri);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() { if (web != null) web.evaluateJavascript("window." + cb + " && window." + cb + "(" + (text == null ? "null" : JSONObject.quote(text)) + ")", null); }
                });
            }
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == REQ_LOC) {
            // Precise granted: now "all the time" (Android shows its own page for it).
            if (Delve.granted(this, Delve.FINE) && !Delve.granted(this, Delve.BG)) { requestPermissions(new String[]{ Delve.BG }, REQ_BG); return; }
            awayAnswer();
            return;
        }
        if (code == REQ_BG) { awayAnswer(); return; }
        if (code == REQ_CAL) {
            boolean ok = Herald.permitted(this);
            if (ok) Herald.scheduleJob(this);
            if (web != null) web.evaluateJavascript("window.onHeraldPerm && window.onHeraldPerm(" + ok + ")", null);
            return;
        }
        if (web != null) web.evaluateJavascript("window.onResume && window.onResume()", null);
    }
}
