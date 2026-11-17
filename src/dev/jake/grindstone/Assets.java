package dev.jake.grindstone;

import android.content.Context;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/** Serves the APK's assets under https://grindstone.local/ so the page (and the 3D models) load like a normal site. */
final class Assets {
    private Assets() {}

    static final String HOST = "grindstone.local";
    static final String ORIGIN = "https://" + HOST + "/";

    static WebResourceResponse respond(Context c, String path) {
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        path = path.substring(1);
        Map<String, String> h = new HashMap<String, String>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-cache");
        if (path.contains("..")) return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", h, new ByteArrayInputStream(new byte[0]));
        try {
            String m = mime(path);
            return new WebResourceResponse(m, m.startsWith("text/") || m.endsWith("javascript") ? "utf-8" : null, 200, "OK", h, c.getAssets().open(path));
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", h, new ByteArrayInputStream(new byte[0]));
        }
    }

    static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".glb")) return "model/gltf-binary";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "text/plain";
    }
}
