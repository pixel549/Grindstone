package dev.jake.grindstone;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The widget's three stats, worked out without the app running. A copy of widgetOmens/homeState in core.js:
 * keep them in step (test/omens.js + OmensCheck.java compare the two on random saves).
 */
final class Omens {
    private Omens() {}

    static final String[] KEYS = {"lawn", "birds", "aviary", "fridge", "dishes", "laundry", "gym", "study"};
    static final int[][] TH = {{14, 28}, {1, 2}, {8, 15}, {8, 14}, {2, 4}, {8, 14}, {4, 8}, {3, 7}};
    static final String[] NAME = {"Lawn", "Bird feeding", "Aviary", "Fridge", "Dishes", "Laundry", "Home gym", "Study"};
    static final String[] ICON = {"🌿", "🦜", "🧽", "🛒", "🍽️", "🧺", "🏋️", "📚"};

    static long daysBetween(String a, String b) { return ChronoUnit.DAYS.between(LocalDate.parse(a), LocalDate.parse(b)); }

    private static String later(String best, String d) { return d != null && (best == null || d.compareTo(best) > 0) ? d : best; }

    private static String questDate(JSONObject q) {
        if ("habit".equals(q.optString("type", "daily"))) return q.optInt("count", 0) > 0 ? Game.str(q, "countOn") : null;
        return Game.str(q, "doneOn");
    }

    static String featureLast(JSONObject s, String k) {
        String best = null;
        JSONArray qs = s.optJSONArray("quests");
        if (qs != null) for (int i = 0; i < qs.length(); i++) {
            JSONObject q = qs.optJSONObject(i);
            if (q != null && k.equals(Game.str(q, "home"))) best = later(best, questDate(q));
        }
        JSONArray log = s.optJSONArray("log");
        if (log != null) for (int i = 0; i < log.length(); i++) {
            JSONObject e = log.optJSONObject(i);
            if (e == null || e.isNull("q") || !e.has("q")) continue;
            JSONObject q = Game.findQ(s, e.optLong("q"));
            if (q != null && k.equals(Game.str(q, "home"))) { best = later(best, Game.str(e, "d")); break; }
        }
        return best;
    }

    static String lastIntDate(JSONObject s) {
        String best = null;
        JSONArray log = s.optJSONArray("log");
        if (log != null) for (int i = 0; i < log.length(); i++) {
            JSONObject e = log.optJSONObject(i);
            if (e != null && e.has("q") && !e.isNull("q") && "INT".equals(e.optString("s"))) { best = Game.str(e, "d"); break; }
        }
        JSONArray qs = s.optJSONArray("quests");
        if (qs != null) for (int i = 0; i < qs.length(); i++) {
            JSONObject q = qs.optJSONObject(i);
            if (q != null && "INT".equals(q.optString("stat"))) best = later(best, questDate(q));
        }
        return best;
    }

    static final class Feat {
        int i, state;
        long days;
        boolean known, auto;
        double ratio;
    }

    static int stateFor(int idx, long days) { return days >= TH[idx][1] ? 2 : days >= TH[idx][0] ? 1 : 0; }

    /** The tracked features, in KEYS order (untracked ones left out). */
    static List<Feat> feats(JSONObject s, String t) {
        List<Feat> out = new ArrayList<Feat>();
        String base = Game.str(s, "created");
        if (base == null) base = t;
        JSONObject seeds = s.optJSONObject("homeSeed");
        JSONArray qs = s.optJSONArray("quests");
        for (int i = 0; i < KEYS.length; i++) {
            String k = KEYS[i];
            String seed = seeds == null ? null : Game.str(seeds, k);
            String last, eff;
            boolean auto = i >= 6;
            if (!auto) {
                boolean linked = false;
                if (qs != null) for (int j = 0; j < qs.length(); j++) {
                    JSONObject q = qs.optJSONObject(j);
                    if (q != null && k.equals(Game.str(q, "home")) && !q.optBoolean("archived", false)) { linked = true; break; }
                }
                if (!linked) continue;
                last = featureLast(s, k);
                eff = last;
                if (seed != null && (eff == null || seed.compareTo(eff) > 0)) eff = seed;
                if (eff == null) eff = base;
            } else {
                last = i == 6 ? Game.str(s, "lastTraining") : lastIntDate(s);
                eff = last != null ? last : seed != null ? seed : base;
            }
            Feat f = new Feat();
            f.i = i;
            f.auto = auto;
            f.days = Math.max(0, daysBetween(eff, t));
            f.state = stateFor(i, "lawn".equals(k) ? lawnDays(f.days, t) : f.days);
            f.known = last != null || seed != null;
            f.ratio = f.days / (double) TH[i][1];
            out.add(f);
        }
        return out;
    }

    /** As core.js lawnDays: grass grows fastest in spring, slower the rest of the year (southern seasons). */
    static long lawnDays(long days, String t) {
        int m = Integer.parseInt(t.substring(5, 7));
        double g = m >= 9 && m <= 11 ? 1 : m == 12 || m <= 2 ? 0.85 : m <= 5 ? 0.8 : 0.65;
        return (long) Math.floor(days * g);
    }

    static String shortName(String n) {
        if (n == null) n = "";
        return n.length() > 22 ? n.substring(0, 21).trim() + "…" : n;
    }

    private static JSONObject item(String icon, String label, String value, String tone) throws JSONException {
        JSONObject o = new JSONObject();
        o.put("icon", icon);
        o.put("label", label);
        o.put("value", value);
        o.put("tone", tone);
        return o;
    }

    static JSONObject compute(JSONObject s, String t) throws JSONException {
        List<Feat> feats = feats(s, t);
        int building = 0;
        boolean afflicted = false;
        for (Feat f : feats) if (f.state >= 1) { building++; if (f.state == 2) afflicted = true; }
        JSONObject out = new JSONObject();
        JSONArray items = new JSONArray();
        if (afflicted || building >= 2) {
            List<Feat> sorted = new ArrayList<Feat>(feats);
            Collections.sort(sorted, new Comparator<Feat>() {
                @Override
                public int compare(Feat a, Feat b) {
                    int c = Double.compare(b.ratio, a.ratio);
                    if (c != 0) return c;
                    c = Long.compare(b.days, a.days);
                    return c != 0 ? c : Integer.compare(a.i, b.i);
                }
            });
            for (int i = 0; i < Math.min(3, sorted.size()); i++) {
                Feat f = sorted.get(i);
                items.put(item(ICON[f.i], NAME[f.i], f.days + (f.days == 1 ? " day" : " days"), f.state == 2 ? "bad" : f.state == 1 ? "warn" : "ok"));
            }
            out.put("mode", "slack");
            out.put("items", items);
            return out;
        }
        List<JSONObject> list = new ArrayList<JSONObject>();
        int streak = Game.shownStreak(s, t);
        if (streak >= 3) list.add(item("🔥", "Streak", streak + " days", "good"));
        String week = Game.addDays(t, -6);
        final Map<String, long[]> by = new HashMap<String, long[]>(); // n, last
        final Map<String, String[]> meta = new HashMap<String, String[]>();
        List<String> order = new ArrayList<String>();
        JSONArray log = s.optJSONArray("log");
        if (log != null) for (int i = 0; i < log.length(); i++) {
            JSONObject e = log.optJSONObject(i);
            if (e == null || !e.has("q") || e.isNull("q") || isTruthy(e, "r")) continue;
            String d = Game.str(e, "d");
            if (d == null || d.isEmpty() || d.compareTo(week) < 0 || d.compareTo(t) > 0) continue;
            String k = keyOf(e.opt("q"));
            if (!by.containsKey(k)) {
                by.put(k, new long[]{0, e.optLong("t", 0)});
                meta.put(k, new String[]{e.optString("n", ""), e.optString("i", "")});
                order.add(k);
            }
            by.get(k)[0]++;
        }
        List<String> top = new ArrayList<String>();
        for (String k : order) if (by.get(k)[0] >= 2) top.add(k);
        Collections.sort(top, new Comparator<String>() {
            @Override
            public int compare(String a, String b) {
                int c = Long.compare(by.get(b)[0], by.get(a)[0]);
                return c != 0 ? c : Long.compare(by.get(b)[1], by.get(a)[1]);
            }
        });
        for (String k : top) {
            String icon = meta.get(k)[1];
            list.add(item(icon.isEmpty() ? "⚔" : icon, shortName(meta.get(k)[0]), "×" + by.get(k)[0] + " this week", "good"));
        }
        for (Feat f : feats) if (f.known && f.days == 0 && !f.auto) list.add(item(ICON[f.i], NAME[f.i], "tended today", "good"));
        int level = s.optInt("level", 1);
        if (list.size() < 3) list.add(item("✦", "Level " + level, s.optInt("xp", 0) + "/" + Game.need(level) + " XP", "good"));
        if (list.size() < 3) list.add(item("◈", "Gold", String.valueOf(s.optInt("gold", 0)), "good"));
        if (list.size() < 3) list.add(item("⚔", "Deeds done", String.valueOf(s.optInt("total", 0)), "good"));
        for (int i = 0; i < 3 && i < list.size(); i++) items.put(list.get(i));
        out.put("mode", "well");
        out.put("items", items);
        return out;
    }

    private static boolean isTruthy(JSONObject e, String k) {
        Object v = e.opt(k);
        if (v == null || v == JSONObject.NULL) return false;
        if (v instanceof Boolean) return (Boolean) v;
        if (v instanceof Number) return ((Number) v).doubleValue() != 0;
        if (v instanceof String) return !((String) v).isEmpty();
        return true;
    }

    private static String keyOf(Object q) {
        if (q instanceof Number) {
            double d = ((Number) q).doubleValue();
            if (d == Math.rint(d)) return String.valueOf((long) d);
        }
        return String.valueOf(q);
    }
}
