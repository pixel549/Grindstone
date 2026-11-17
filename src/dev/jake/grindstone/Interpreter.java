package dev.jake.grindstone;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Android side of the interpreter: settings live in their own prefs file (kept out of backups, like the
 * Oracle's key). Every failure is swallowed and remembered, and after one the interpreter rests for half an
 * hour, so a dead or rate-limited key can never get in the herald's way.
 */
final class Interpreter {
    private Interpreter() {}

    static final String GROQ = "https://api.groq.com/openai/v1", GROQ_MODEL = "openai/gpt-oss-20b";
    static final long REST = 30 * 60 * 1000L;

    static final String CLAUDE = "https://api.anthropic.com/v1", CLAUDE_MODEL = "claude-haiku-5-5";

    /**
     * 2.26: one AI connection for everything (the interpreter, the Oracle's weeklies). Before, the Oracle had its own
     * Claude key; if that's all there is, it becomes the connection, once.
     */
    static SharedPreferences prefs(Context c) {
        SharedPreferences p = c.getSharedPreferences("interp", Context.MODE_PRIVATE);
        if (!p.getBoolean("merged", false)) {
            String ok = c.getSharedPreferences("oracle", Context.MODE_PRIVATE).getString("key", "");
            SharedPreferences.Editor e = p.edit().putBoolean("merged", true);
            if (p.getString("key", "").isEmpty() && !ok.isEmpty()) e.putString("provider", "claude").putString("base", CLAUDE).putString("model", CLAUDE_MODEL).putString("key", ok);
            e.apply();
        }
        return p;
    }

    /** Ask the connection anything: the reply's text, or throws. Not rested on failure (the asker says what went wrong). */
    static String ask(Context c, String system, String user, int maxTokens) throws Exception {
        if (!configured(c)) throw new Exception("No AI connected");
        SharedPreferences p = prefs(c);
        String r = InterpreterCore.chat(p.getString("base", GROQ), p.getString("key", ""), p.getString("model", GROQ_MODEL), system, user, 90000, maxTokens);
        p.edit().putLong("okAt", System.currentTimeMillis()).apply();
        return r;
    }

    static boolean configured(Context c) {
        SharedPreferences p = prefs(c);
        return !p.getString("key", "").isEmpty() && !p.getString("base", "").isEmpty() && !p.getString("model", "").isEmpty();
    }

    static boolean ready(Context c) { return configured(c) && System.currentTimeMillis() > prefs(c).getLong("restUntil", 0); }

    static JSONObject info(Context c) {
        SharedPreferences p = prefs(c);
        JSONObject o = new JSONObject();
        try {
            o.put("on", configured(c));
            o.put("provider", p.getString("provider", "groq"));
            o.put("base", p.getString("base", GROQ));
            o.put("model", p.getString("model", GROQ_MODEL));
            o.put("err", p.getString("err", ""));
            o.put("errAt", p.getLong("errAt", 0));
            o.put("okAt", p.getLong("okAt", 0));
            o.put("resting", System.currentTimeMillis() < p.getLong("restUntil", 0));
        } catch (Exception e) { /* empty info */ }
        return o;
    }

    static void set(Context c, JSONObject o) {
        SharedPreferences.Editor e = prefs(c).edit();
        e.putString("provider", o.optString("provider", "groq"));
        e.putString("base", o.optString("base", GROQ).trim());
        e.putString("model", o.optString("model", GROQ_MODEL).trim());
        String key = o.optString("key", "").trim();
        if (!key.isEmpty()) e.putString("key", key);
        e.putLong("restUntil", 0).putString("err", "").apply();
    }

    static void forget(Context c) {
        prefs(c).edit().clear().putBoolean("merged", true).apply();
        c.getSharedPreferences("oracle", Context.MODE_PRIVATE).edit().clear().apply();
    }

    /** k -> quest id for the reports it could place; null if it couldn't run (not set up, resting, or failed). */
    static JSONObject resolve(Context c, JSONArray reports, JSONArray quests) {
        if (!ready(c) || reports.length() == 0) return null;
        SharedPreferences p = prefs(c);
        try {
            JSONObject r = InterpreterCore.resolve(p.getString("base", GROQ), p.getString("key", ""), p.getString("model", GROQ_MODEL), reports, quests, 25000);
            p.edit().putLong("okAt", System.currentTimeMillis()).putString("err", "").apply();
            return r;
        } catch (Throwable t) {
            p.edit().putString("err", String.valueOf(t.getMessage())).putLong("errAt", System.currentTimeMillis())
                    .putLong("restUntil", System.currentTimeMillis() + REST).apply();
            return null;
        }
    }

    /** One tiny request to check the key and model. Returns "" on success, else the reason. */
    static String test(Context c) {
        if (!configured(c)) return "No key saved.";
        SharedPreferences p = prefs(c);
        try {
            JSONArray qs = new JSONArray().put(new JSONObject().put("id", 1).put("name", "Swim")).put(new JSONObject().put("id", 2).put("name", "Mow the lawn"));
            JSONArray rs = new JSONArray().put(new JSONObject().put("k", "a").put("text", "did 20 laps at the pool"));
            JSONObject r = InterpreterCore.resolve(p.getString("base", GROQ), p.getString("key", ""), p.getString("model", GROQ_MODEL), rs, qs, 25000);
            p.edit().putLong("okAt", System.currentTimeMillis()).putString("err", "").putLong("restUntil", 0).apply();
            return r.optLong("a", -1) == 1 ? "" : "It answered, but matched the test wrongly. Try a bigger model.";
        } catch (Throwable t) {
            String m = String.valueOf(t.getMessage());
            p.edit().putString("err", m).putLong("errAt", System.currentTimeMillis()).apply();
            return m;
        }
    }

    /** The quests worth offering it: everything live. */
    static JSONArray questList(JSONObject s) {
        JSONArray out = new JSONArray();
        JSONArray qs = s.optJSONArray("quests");
        if (qs != null) for (int i = 0; i < qs.length(); i++) {
            JSONObject q = qs.optJSONObject(i);
            if (q == null || q.optBoolean("archived", false)) continue;
            try { out.put(new JSONObject().put("id", q.optLong("id")).put("name", q.optString("name"))); } catch (Exception e) { /* skip */ }
        }
        return out;
    }
}
