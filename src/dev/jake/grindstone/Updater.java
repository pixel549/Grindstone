package dev.jake.grindstone;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

/** 2.27.2: checks GitHub's latest release and installs a newer APK the user confirms. Sideloaded apps can't update themselves otherwise. */
final class Updater {
    static final String RELEASES = "https://api.github.com/repos/pixel549/Grindstone/releases/latest";
    static final String AUTHORITY = "dev.jake.grindstone.update";
    static final String FILE = "update.apk";

    /** Blocking: call from a background thread. Returns {"latest":"2.27.2","url":"...","newer":true,"msg":"..."}. */
    static JSONObject check(String current) {
        JSONObject out = new JSONObject();
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(RELEASES).openConnection();
            c.setConnectTimeout(10000); c.setReadTimeout(10000);
            c.setRequestProperty("Accept", "application/vnd.github+json");
            if (c.getResponseCode() != 200) throw new Exception("GitHub said " + c.getResponseCode());
            JSONObject rel = new JSONObject(read(c.getInputStream()));
            String tag = rel.optString("tag_name", "").replaceFirst("^v", "");
            String url = "";
            JSONArray assets = rel.optJSONArray("assets");
            for (int i = 0; assets != null && i < assets.length(); i++) {
                JSONObject a = assets.getJSONObject(i);
                if (a.optString("name", "").endsWith(".apk")) { url = a.optString("browser_download_url", ""); break; }
            }
            boolean newer = !tag.isEmpty() && !url.isEmpty() && compare(tag, current) > 0;
            out.put("latest", tag).put("url", url).put("newer", newer)
               .put("msg", newer ? "Downloads from GitHub, then Android asks you to confirm." : "You have the latest.");
        } catch (Exception e) {
            return result("", "", false, "Couldn't check: " + e.getMessage());
        }
        return out;
    }

    private static JSONObject result(String latest, String url, boolean newer, String msg) {
        JSONObject o = new JSONObject();
        try { o.put("latest", latest).put("url", url).put("newer", newer).put("msg", msg); } catch (Exception e) { /* keys are fixed; can't fail */ }
        return o;
    }

    /** Dotted numeric compare: 2.27.10 > 2.27.9. Returns <0, 0 or >0. */
    static int compare(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? num(x[i]) : 0, q = i < y.length ? num(y[i]) : 0;
            if (p != q) return p < q ? -1 : 1;
        }
        return 0;
    }

    private static int num(String s) {
        try { return Integer.parseInt(s.replaceAll("\\D", "")); } catch (NumberFormatException e) { return 0; }
    }

    /** Blocking: downloads the APK into the app's cache, where UpdateProvider serves it. Returns null, or an error message. */
    static String download(Context ctx, String url) {
        if (url == null || !url.startsWith("https://github.com/pixel549/Grindstone/releases/download/")) return "That isn't a Grindstone release.";
        try {
            File dir = new File(ctx.getCacheDir(), "update");
            if (!dir.isDirectory() && !dir.mkdirs()) return "Couldn't make the download folder.";
            File f = new File(dir, FILE);
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setInstanceFollowRedirects(true);
            if (c.getResponseCode() != 200) return "Download failed (" + c.getResponseCode() + ").";
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(f)) {
                byte[] buf = new byte[65536]; int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            return null;
        } catch (Exception e) {
            return "Download failed: " + e.getMessage();
        }
    }

    /** Must run on the UI thread. Returns null if the install prompt opened, else a reason it can't. */
    static String install(Context ctx) {
        if (!ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            return "Allow installs from Grindstone once, then tap Install again.";
        }
        Uri uri = Uri.parse("content://" + AUTHORITY + "/" + FILE);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try { ctx.startActivity(i); return null; } catch (Exception e) { return "Couldn't open the installer: " + e.getMessage(); }
    }

    private static String read(InputStream in) throws Exception {
        StringBuilder sb = new StringBuilder();
        byte[] buf = new byte[8192]; int n;
        while ((n = in.read(buf)) > 0) sb.append(new String(buf, 0, n, "UTF-8"));
        in.close();
        return sb.toString();
    }
}
