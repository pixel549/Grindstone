package dev.jake.grindstone;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/** The widget's animation frames: JPEGs in files/wframes/<version>/, served to the launcher by FrameProvider. */
final class WidgetStore {
    private WidgetStore() {}

    static final String AUTHORITY = "dev.jake.grindstone.frames";
    static final int MAX_FRAMES = 32, MAX_BYTES = 350_000;

    static File root(Context c) { return new File(c.getFilesDir(), "wframes"); }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("widget", Context.MODE_PRIVATE); }

    static Uri frameUri(long ver, int i) {
        return Uri.parse("content://" + AUTHORITY + "/" + ver + "/" + String.format(java.util.Locale.ROOT, "f%02d.jpg", i));
    }

    /** {frames: [base64 jpeg], interval: ms, sig, spot} from the page. Returns false (and keeps the old clip) on anything odd. */
    static boolean save(Context c, String json) { return "ok".equals(saveWhy(c, json)); }

    /** As save, but says what went wrong. The result is also kept so the app can show it. */
    static synchronized String saveWhy(Context c, String json) {
        String why = store(c, json);
        prefs(c).edit().putString("last", why).putLong("lastAt", System.currentTimeMillis()).apply();
        return why;
    }

    private static String store(Context c, String json) {
        try {
            JSONObject o = new JSONObject(json);
            JSONArray fr = o.getJSONArray("frames");
            int n = fr.length();
            if (n < 2 || n > MAX_FRAMES) return "bad frame count (" + n + ")";
            int interval = Math.max(60, Math.min(250, o.optInt("interval", 110)));
            long ver = System.currentTimeMillis();
            File dir = new File(root(c), String.valueOf(ver));
            if (!dir.mkdirs()) return "could not make the frame folder";
            for (int i = 0; i < n; i++) {
                byte[] b = Base64.decode(fr.getString(i), Base64.DEFAULT);
                if (b.length < 100 || b.length > MAX_BYTES || (b[0] & 0xFF) != 0xFF || (b[1] & 0xFF) != 0xD8) { deleteDir(dir); return "frame " + i + " is not a usable picture (" + b.length + " bytes)"; }
                FileOutputStream out = new FileOutputStream(new File(dir, String.format(java.util.Locale.ROOT, "f%02d.jpg", i)));
                try { out.write(b); } finally { out.close(); }
            }
            long old = prefs(c).getLong("ver", 0);
            prefs(c).edit().putLong("ver", ver).putInt("n", n).putInt("interval", interval)
                    .putString("sig", o.optString("sig", "")).putLong("at", ver).putString("spot", o.optString("spot", "")).commit();
            // keep the previous clip a little longer: the launcher may still be reading it
            File[] all = root(c).listFiles();
            if (all != null) for (File f : all) {
                String nm = f.getName();
                if (!nm.equals(String.valueOf(ver)) && !nm.equals(String.valueOf(old))) deleteDir(f);
            }
            String shown = QuestWidget.updateAll(c);
            return shown == null ? "ok" : "saved, but the home screen refused it: " + shown;
        } catch (Throwable e) {
            return "error: " + e;
        }
    }

    static long age(Context c) {
        long at = prefs(c).getLong("at", 0);
        return at == 0 ? Long.MAX_VALUE : System.currentTimeMillis() - at;
    }

    private static void deleteDir(File d) {
        File[] fs = d.listFiles();
        if (fs != null) for (File f : fs) f.delete();
        d.delete();
    }
}
