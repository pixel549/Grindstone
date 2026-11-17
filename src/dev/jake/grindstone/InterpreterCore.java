package dev.jake.grindstone;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

/**
 * The interpreter: asks any OpenAI-compatible chat endpoint (Groq by default) which quest each unplaced deed
 * belongs to. Pure Java so the desktop test can run it against a fake server. Throws on any failure;
 * callers treat that as "leave it for Jake to assign".
 */
final class InterpreterCore {
    private InterpreterCore() {}

    static final String SYSTEM = "You match short reports of things a person has done to their list of quests (habits and chores in a life-tracking app).\n"
            + "Reply with JSON only, no prose: {\"matches\":[{\"k\":\"<report key>\",\"q\":<quest id or null>}]}\n"
            + "Pick a quest only when the report clearly describes doing that quest (e.g. \"smashed legs at the gym\" -> a weights session). "
            + "If nothing fits, or it's only a plan, use null. Never invent quest ids.";

    static String userPrompt(JSONArray reports, JSONArray quests) {
        StringBuilder b = new StringBuilder("Quests:\n");
        for (int i = 0; i < quests.length(); i++) {
            JSONObject q = quests.optJSONObject(i);
            if (q != null) b.append(q.optLong("id")).append(": ").append(q.optString("name")).append('\n');
        }
        b.append("\nReports:\n");
        for (int i = 0; i < reports.length(); i++) {
            JSONObject u = reports.optJSONObject(i);
            if (u != null) b.append(u.optString("k")).append(": \"").append(u.optString("text").replace('"', '\'')).append("\"\n");
        }
        return b.toString();
    }

    static String body(String model, String system, String user) throws Exception { return body(model, system, user, 900); }

    static String body(String model, String system, String user, int maxTokens) throws Exception {
        JSONObject o = new JSONObject();
        o.put("model", model);
        o.put("temperature", 0);
        // Gemini counts its thinking inside max_tokens (a hard cap on both), so it gets room to think as well as answer
        o.put("max_tokens", model.startsWith("gemini") ? maxTokens + 2048 : maxTokens);
        if (model.contains("gpt-oss") || model.startsWith("gemini")) o.put("reasoning_effort", "low"); // only models that take it
        JSONArray m = new JSONArray();
        m.put(new JSONObject().put("role", "system").put("content", system));
        m.put(new JSONObject().put("role", "user").put("content", user));
        o.put("messages", m);
        return o.toString();
    }

    static boolean anthropic(String base) { return base != null && base.contains("api.anthropic.com"); }

    static String chat(String base, String key, String model, String system, String user, int timeoutMs) throws Exception { return chat(base, key, model, system, user, timeoutMs, 900); }

    /** 2.26: Claude through its own Messages API (the one paid choice); everything else is OpenAI-style. */
    static String messages(String base, String key, String model, String system, String user, int timeoutMs, int maxTokens) throws Exception {
        String url = base.replaceAll("/+$", "") + "/messages";
        if (!url.startsWith("https://") && !url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) throw new Exception("needs https");
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        try {
            con.setConnectTimeout(Math.min(timeoutMs, 10000));
            con.setReadTimeout(timeoutMs);
            con.setRequestMethod("POST");
            con.setDoOutput(true);
            con.setRequestProperty("content-type", "application/json");
            con.setRequestProperty("x-api-key", key);
            con.setRequestProperty("anthropic-version", "2023-06-01");
            JSONObject o = new JSONObject().put("model", model).put("max_tokens", maxTokens).put("system", system)
                    .put("messages", new JSONArray().put(new JSONObject().put("role", "user").put("content", user)));
            byte[] out = o.toString().getBytes("UTF-8");
            OutputStream os = con.getOutputStream();
            try { os.write(out); } finally { os.close(); }
            int code = con.getResponseCode();
            String text = read(code >= 400 ? con.getErrorStream() : con.getInputStream());
            if (code >= 400) {
                String msg = text;
                try { msg = new JSONObject(text).getJSONObject("error").optString("message", text); } catch (Exception e) { /* raw */ }
                throw new Exception("HTTP " + code + ": " + (msg.length() > 160 ? msg.substring(0, 160) : msg));
            }
            JSONArray parts = new JSONObject(text).getJSONArray("content");
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < parts.length(); i++) { JSONObject pt = parts.optJSONObject(i); if (pt != null && "text".equals(pt.optString("type"))) b.append(pt.optString("text")); }
            if (b.toString().trim().isEmpty()) throw new Exception("empty reply");
            return b.toString();
        } finally {
            con.disconnect();
        }
    }

    /** POSTs to {base}/chat/completions (or Claude's /messages) and returns the assistant's text. */
    static String chat(String base, String key, String model, String system, String user, int timeoutMs, int maxTokens) throws Exception {
        if (anthropic(base)) return messages(base, key, model, system, user, timeoutMs, maxTokens);
        String url = base.replaceAll("/+$", "") + "/chat/completions";
        if (!url.startsWith("https://") && !url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) throw new Exception("needs https");
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        try {
            con.setConnectTimeout(Math.min(timeoutMs, 10000));
            con.setReadTimeout(timeoutMs);
            con.setRequestMethod("POST");
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json");
            con.setRequestProperty("Authorization", "Bearer " + key);
            byte[] out = body(model, system, user, maxTokens).getBytes("UTF-8");
            OutputStream os = con.getOutputStream();
            try { os.write(out); } finally { os.close(); }
            int code = con.getResponseCode();
            String text = read(code >= 400 ? con.getErrorStream() : con.getInputStream());
            if (code >= 400) {
                String msg = text;
                try { msg = new JSONObject(text).getJSONObject("error").optString("message", text); } catch (Exception e) { /* raw */ }
                throw new Exception("HTTP " + code + ": " + (msg.length() > 160 ? msg.substring(0, 160) : msg));
            }
            JSONObject res = new JSONObject(text);
            String content = res.getJSONArray("choices").getJSONObject(0).getJSONObject("message").optString("content", "");
            if (content.trim().isEmpty()) throw new Exception("empty reply");
            return content;
        } finally {
            con.disconnect();
        }
    }

    /** Pulls {"matches":[...]} out of a reply (tolerates code fences and chatter). Returns k -> quest id, valid ids only. */
    static JSONObject parse(String reply, JSONArray reports, JSONArray quests) throws Exception {
        int a = reply.indexOf('{'), b = reply.lastIndexOf('}');
        if (a < 0 || b <= a) throw new Exception("no JSON in reply");
        JSONObject o = new JSONObject(reply.substring(a, b + 1));
        JSONArray m = o.getJSONArray("matches");
        Set<Long> ids = new HashSet<Long>();
        for (int i = 0; i < quests.length(); i++) ids.add(quests.getJSONObject(i).optLong("id"));
        Set<String> keys = new HashSet<String>();
        for (int i = 0; i < reports.length(); i++) keys.add(reports.getJSONObject(i).optString("k"));
        JSONObject out = new JSONObject();
        for (int i = 0; i < m.length(); i++) {
            JSONObject x = m.optJSONObject(i);
            if (x == null) continue;
            String k = x.optString("k");
            if (!keys.contains(k) || x.isNull("q") || !x.has("q")) continue;
            long q;
            try { q = Long.parseLong(String.valueOf(x.get("q")).trim()); } catch (Exception e) { continue; }
            if (ids.contains(q)) out.put(k, q);
        }
        return out;
    }

    static JSONObject resolve(String base, String key, String model, JSONArray reports, JSONArray quests, int timeoutMs) throws Exception {
        if (reports.length() == 0 || quests.length() == 0) return new JSONObject();
        return parse(chat(base, key, model, SYSTEM, userPrompt(reports, quests), timeoutMs), reports, quests);
    }

    static String read(InputStream is) throws Exception {
        if (is == null) return "";
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        try { while ((n = is.read(buf)) > 0 && bo.size() < 200_000) bo.write(buf, 0, n); } finally { is.close(); }
        return bo.toString("UTF-8");
    }
}
