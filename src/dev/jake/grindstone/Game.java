package dev.jake.grindstone;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Mirror of the rules in assets/core.js that the widget needs. Keep in sync. */
final class Game {
    static final int[] XP = {5, 10, 20, 35, 60};
    static final int[] GOLD = {6, 12, 24, 40, 70};   // 2.25: the game's since 2.22 (core.js DIFF); keep them the same
    static final int LOG_MAX = 300;

    private Game() {}

    static int need(int level) { return 80 + 36 * (level - 1); }   // 2.25: core.js need() since 2.23

    static String today() { return LocalDate.now().toString(); }

    static String addDays(String d, int n) { return LocalDate.parse(d).plusDays(n).toString(); }

    static int dayIdx(String d) { return LocalDate.parse(d).getDayOfWeek().getValue() - 1; }

    /** org.json's optString turns JSON null into "null"; this doesn't. */
    static String str(JSONObject o, String k) { return o.isNull(k) ? null : o.optString(k, null); }

    static int diffIdx(JSONObject q) {
        int d = q.optInt("diff", 2);
        if (d == 0) d = 2;
        return Math.max(1, Math.min(5, d)) - 1;
    }

    static boolean isTraining(String stat) { return "STR".equals(stat) || "END".equals(stat); }

    static String statName(String k) {
        switch (k) {
            case "STR": return "Strength";
            case "END": return "Endurance";
            case "VIT": return "Vitality";
            case "INT": return "Intellect";
            default: return "Discipline";
        }
    }

    static int statColor(String k) {
        switch (k) {
            case "STR": return 0xFFC0705A;
            case "END": return 0xFF6F9AB0;
            case "VIT": return 0xFF8AA866;
            case "INT": return 0xFF9A8AC8;
            default: return 0xFFC2A465;
        }
    }

    static int habitCount(JSONObject q, String t) { return t.equals(str(q, "countOn")) ? q.optInt("count", 0) : 0; }

    /** 2.27: put away (hidden or on hold) until away.back, the day it returns. */
    static boolean away(JSONObject q, String today) {
        JSONObject a = q == null ? null : q.optJSONObject("away");
        String back = a == null ? "" : a.optString("back", "");
        return !back.isEmpty() && today.compareTo(back) < 0;
    }

    static boolean dueOn(JSONObject q, String t) {
        // 2.16: a daily that comes round every few days is off the list until it's due again (mirrors core.js)
        String done = str(q, "doneOn");
        if ("daily".equals(str(q, "type")) && q.optInt("rest", 0) > 1 && done != null && done.length() == 10) {
            long n = Omens.daysBetween(done, t);
            if (n > 0 && n < q.optInt("rest", 0)) return false;
        }
        JSONArray days = q.optJSONArray("days");
        if (days == null || days.length() != 7) return true;
        return days.optInt(dayIdx(t), 1) != 0;
    }

    static boolean canComplete(JSONObject q, String t) {
        if (q == null || q.optBoolean("archived", false)) return false;
        String type = q.optString("type", "daily");
        if ("habit".equals(type)) {
            int cap = q.optInt("cap", 0);
            return cap <= 0 || habitCount(q, t) < cap;
        }
        if ("todo".equals(type)) return str(q, "doneOn") == null;
        return !t.equals(str(q, "doneOn"));
    }

    static JSONObject findQ(JSONObject s, long id) {
        JSONArray qs = s.optJSONArray("quests");
        if (qs == null) return null;
        for (int i = 0; i < qs.length(); i++) {
            JSONObject q = qs.optJSONObject(i);
            if (q != null && q.optLong("id", -1) == id) return q;
        }
        return null;
    }

    /** Quests the widget should offer right now: dailies due today, open to-dos, habits under their cap. */
    static List<JSONObject> widgetList(JSONObject s, String t) {
        List<JSONObject> dailies = new ArrayList<>(), todos = new ArrayList<>(), habits = new ArrayList<>();
        JSONArray qs = s.optJSONArray("quests");
        if (qs == null) return dailies;
        for (int i = 0; i < qs.length(); i++) {
            JSONObject q = qs.optJSONObject(i);
            if (q == null || !canComplete(q, t)) continue;
            String type = q.optString("type", "daily");
            if ("habit".equals(type)) habits.add(q);
            else if ("todo".equals(type)) todos.add(q);
            else if (dueOn(q, t)) dailies.add(q);
        }
        dailies.addAll(todos);
        dailies.addAll(habits);
        return dailies;
    }

    static int shownStreak(JSONObject s, String t) {
        String la = str(s, "lastActive");
        return (t.equals(la) || addDays(t, -1).equals(la)) ? s.optInt("streak", 0) : 0;
    }

    /** Same as G.complete in core.js. Returns null if the quest can't be completed. */
    static JSONObject complete(JSONObject s, long id, String t, long now) throws JSONException {
        JSONObject q = findQ(s, id);
        if (!canComplete(q, t)) return null;
        if ("habit".equals(q.optString("type", "daily"))) {
            if (!t.equals(str(q, "countOn"))) { q.put("count", 0); q.put("countOn", t); }
            q.put("count", q.optInt("count", 0) + 1);
        } else {
            q.put("doneOn", t);
        }
        int di = diffIdx(q), xp = XP[di], gold = GOLD[di];
        String stat = q.optString("stat", "DIS");

        s.put("xp", s.optInt("xp", 0) + xp);
        s.put("gold", s.optInt("gold", 0) + gold);
        JSONObject stats = s.optJSONObject("stats");
        if (stats == null) { stats = new JSONObject(); s.put("stats", stats); }
        stats.put(stat, stats.optInt(stat, 0) + xp);
        s.put("total", s.optInt("total", 0) + 1);
        if (isTraining(stat)) s.put("lastTraining", t);

        String la = str(s, "lastActive");
        if (!t.equals(la)) {
            int streak = s.optInt("streak", 0);
            s.put("streak", addDays(t, -1).equals(la) ? streak + 1 : 1);
            s.put("lastActive", t);
        }
        if (s.optInt("streak", 0) > s.optInt("bestStreak", 0)) s.put("bestStreak", s.optInt("streak", 0));

        int level = Math.max(1, s.optInt("level", 1)), cur = s.optInt("xp", 0), chests = s.optInt("chests", 0), levels = 0;
        while (cur >= need(level)) { cur -= need(level); level++; chests++; levels++; }
        s.put("level", level);
        s.put("xp", cur);
        s.put("chests", chests);

        JSONObject e = new JSONObject();
        e.put("t", now);
        e.put("d", t);
        e.put("q", id);
        e.put("n", q.optString("name", ""));
        e.put("i", q.optString("icon", ""));
        e.put("x", xp);
        e.put("g", gold);
        e.put("s", stat);
        e.put("k", Long.toString(now, 36) + Integer.toString((int) (Math.random() * 60466176), 36));
        e.put("nat", 1);   // 2.25: the app settles the rest (the town's cut, the days) next time it opens: core.js settleNative
        // and the last time it was done, now, so the overdue note (Ticker.checkOverdue) knows before the app opens
        JSONObject ql = s.optJSONObject("qlast");
        if (ql == null) { ql = new JSONObject(); s.put("qlast", ql); }
        String qk = Long.toString(id);
        if (t.compareTo(ql.optString(qk, "")) > 0) ql.put(qk, t);
        JSONArray log = s.optJSONArray("log");
        JSONArray nl = new JSONArray();
        nl.put(e);
        if (log != null) for (int i = 0; i < log.length() && nl.length() < LOG_MAX; i++) nl.put(log.get(i));
        s.put("log", nl);

        JSONObject r = new JSONObject();
        r.put("xp", xp);
        r.put("gold", gold);
        r.put("stat", stat);
        r.put("levels", levels);
        r.put("level", level);
        return r;
    }
}
