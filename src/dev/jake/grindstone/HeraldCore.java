package dev.jake.grindstone;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The herald's brain: turns "deeds" written to the Grindstone calendar (by Claude, or by hand) into completed quests.
 * No Android in here, so it runs in the desktop test too.
 *
 * An event title holds one or more deeds separated by ";" or new lines. A deed may end in "x3" / "×3" / "(3)"
 * or start with "3x" for repeats. Each deed is matched to a quest by name, by the quest's learned aliases,
 * and then by word overlap. Anything that doesn't match lands in herald.unclaimed for Jake to assign in the app.
 */
final class HeraldCore {
    private HeraldCore() {}

    static final class Ev {
        final String key, title;
        final long start;
        Ev(String key, String title, long start) { this.key = key; this.title = title; this.start = start; }
    }

    static final int SEEN_MAX = 400, UNCLAIMED_MAX = 25, NEWS_MAX = 12, COUNT_MAX = 10;

    private static final Set<String> STOP = new HashSet<String>(Arrays.asList(
            "the", "a", "an", "and", "my", "of", "to", "at", "in", "on", "for", "with", "did", "done", "do", "some", "session",
            "today", "just", "i", "me", "x", "min", "mins", "minute", "hour", "hours", "finish", "complete", "went", "got", "had",
            "this", "morning", "afternoon", "evening", "tonight", "quick", "proper", "full"));
    private static final Map<String, String> SYN = new HashMap<String, String>();
    static {
        String[][] p = {
            {"swam", "swim"}, {"ran", "run"}, {"jog", "run"}, {"fed", "feed"}, {"drank", "drink"}, {"veggie", "vegie"}, {"veg", "vegie"},
            {"vegetable", "vegie"}, {"gym", "weight"}, {"lift", "weight"}, {"laundry", "wash"}, {"clothe", "wash"}, {"parrot", "bird"},
            {"e-mail", "email"}, {"inbox", "email"}, {"tae", "cert"}, {"wrote", "write"}, {"cleaned", "clean"},
        };
        for (String[] a : p) SYN.put(a[0], a[1]);
    }
    private static final Pattern TRAIL = Pattern.compile("^(.*?)(?:\\s+x\\s*(\\d{1,2})|\\s*×\\s*(\\d{1,2})|\\s*\\((\\d{1,2})\\))\\s*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern LEAD = Pattern.compile("^(\\d{1,2})\\s*[x×]\\s+(.*)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PREFIX = Pattern.compile("^(?:[⚔✓✔☑️\\-•*\\s]+|(?:grindstone|deed|done)\\s*[:\\-–]\\s*)+", Pattern.CASE_INSENSITIVE);

    static String norm(String s) {
        if (s == null) return "";
        return s.toLowerCase().replace("&", " and ").replaceAll("[^a-z0-9]+", " ").trim();
    }

    static String stem(String w) {
        int n = w.length();
        if (n > 4 && w.endsWith("ies")) return w.substring(0, n - 3) + "y";
        if (n > 4 && w.endsWith("ied")) return w.substring(0, n - 3) + "y";
        if (n > 5 && w.endsWith("ing")) w = w.substring(0, n - 3);
        else if (n > 4 && w.endsWith("ed")) w = w.substring(0, n - 2);
        else if (n > 4 && (w.endsWith("shes") || w.endsWith("ches") || w.endsWith("xes") || w.endsWith("sses"))) w = w.substring(0, n - 2);
        else if (n > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.substring(0, n - 1);
        n = w.length();
        if (n > 3 && w.charAt(n - 1) == w.charAt(n - 2) && "bdgmnprt".indexOf(w.charAt(n - 1)) >= 0) w = w.substring(0, n - 1);
        return w;
    }

    static List<String> toks(String s) {
        List<String> out = new ArrayList<String>();
        for (String w : norm(s).split(" ")) {
            if (w.isEmpty()) continue;
            String x = SYN.containsKey(w) ? SYN.get(w) : w;
            x = stem(x);
            if (SYN.containsKey(x)) x = SYN.get(x);
            if (!x.isEmpty() && !STOP.contains(x) && !STOP.contains(w)) out.add(x);
        }
        return out;
    }

    /** 1.0 = same words; ~0.85 = the deed contains the quest name; ~0.75 = the deed is a short form of it; below 0.6 = no. */
    static double score(String deed, String cand) {
        String dn = norm(deed), cn = norm(cand);
        if (dn.isEmpty() || cn.isEmpty()) return 0;
        if (dn.equals(cn)) return 1.0;
        Set<String> ds = new HashSet<String>(toks(deed)), cs = new HashSet<String>(toks(cand));
        if (ds.isEmpty() || cs.isEmpty()) return 0;
        if (ds.equals(cs)) return 0.95;
        if (ds.containsAll(cs)) return 0.85;
        if (cs.containsAll(ds)) return 0.7 + 0.1 * ds.size() / cs.size();
        int inter = 0;
        for (String w : ds) if (cs.contains(w)) inter++;
        return 0.6 * inter / (double) (ds.size() + cs.size() - inter);
    }

    /** The best quest for a deed, or null if nothing fits clearly. */
    static JSONObject match(JSONObject s, String deed) {
        JSONArray qs = s.optJSONArray("quests");
        if (qs == null) return null;
        JSONObject best = null;
        double b1 = 0, b2 = 0;
        for (int i = 0; i < qs.length(); i++) {
            JSONObject q = qs.optJSONObject(i);
            if (q == null || q.optBoolean("archived", false)) continue;
            double sc = score(deed, q.optString("name", ""));
            JSONArray al = q.optJSONArray("aliases");
            if (al != null) for (int j = 0; j < al.length(); j++) sc = Math.max(sc, score(deed, al.optString(j, "")));
            if (sc > b1) { b2 = b1; b1 = sc; best = q; } else if (sc > b2) b2 = sc;
        }
        if (b1 < 0.66) return null;
        if (b1 < 0.95 && b1 - b2 < 0.05) return null; // two quests fit about equally: ask instead of guessing
        return best;
    }

    /** "Log my meals ×2" → ["Log my meals", 2] */
    static Object[] parse(String raw) {
        String d = raw == null ? "" : raw.trim();
        d = PREFIX.matcher(d).replaceFirst("").trim();
        int n = 1;
        Matcher m = TRAIL.matcher(d);
        if (m.matches() && m.group(1).trim().length() > 0) {
            d = m.group(1).trim();
            n = Integer.parseInt(m.group(2) != null ? m.group(2) : m.group(3) != null ? m.group(3) : m.group(4));
        } else {
            Matcher l = LEAD.matcher(d);
            if (l.matches()) { n = Integer.parseInt(l.group(1)); d = l.group(2).trim(); }
        }
        n = Math.max(1, Math.min(COUNT_MAX, n));
        return new Object[]{d.length() > 80 ? d.substring(0, 80) : d, n};
    }

    static List<String> split(String title) {
        List<String> out = new ArrayList<String>();
        if (title == null) return out;
        for (String p : title.split("[;\\n]+")) if (!p.trim().isEmpty()) out.add(p.trim());
        return out;
    }

    static JSONObject herald(JSONObject s) throws JSONException {
        JSONObject h = s.optJSONObject("herald");
        if (h == null) { h = new JSONObject(); s.put("herald", h); }
        return h;
    }

    /**
     * Credits every unseen event. Returns null when nothing new was seen, else a summary:
     * { changed, done: [{q, n, c, want}], xp, gold, levels, level, unclaimed }.
     * live = the app is open and will announce it itself; otherwise the summary is queued in herald.news.
     */
    static JSONObject apply(JSONObject s, List<Ev> evs, long now, String today, boolean live) throws JSONException {
        JSONObject h = herald(s);
        JSONArray seenA = h.optJSONArray("seen");
        LinkedHashSet<String> seen = new LinkedHashSet<String>();
        if (seenA != null) for (int i = 0; i < seenA.length(); i++) seen.add(seenA.optString(i));
        JSONArray unclaimed = h.optJSONArray("unclaimed");
        if (unclaimed == null) unclaimed = new JSONArray();

        JSONArray done = new JSONArray();
        int xp = 0, gold = 0, levels = 0, level = s.optInt("level", 1), newUnclaimed = 0, already = 0;
        boolean changed = false;
        long stamp = now;
        for (Ev ev : evs) {
            if (seen.contains(ev.key)) continue;
            seen.add(ev.key);
            changed = true;
            List<String> deeds = split(ev.title);
            for (int di = 0; di < deeds.size(); di++) {
                Object[] p = parse(deeds.get(di));
                String text = (String) p[0];
                int want = (Integer) p[1];
                if (norm(text).isEmpty()) continue;
                JSONObject q = match(s, text);
                if (q == null) {
                    JSONObject u = new JSONObject();
                    u.put("k", ev.key + "#" + di);
                    u.put("text", text);
                    u.put("n", want);
                    u.put("t", ev.start);
                    unclaimed.put(u);
                    newUnclaimed++;
                    continue;
                }
                long id = q.optLong("id");
                int got = 0;
                for (int c = 0; c < want; c++) {
                    JSONObject r = Game.complete(s, id, today, stamp++);
                    if (r == null) break;
                    JSONArray log = s.optJSONArray("log");
                    if (log != null && log.length() > 0) log.getJSONObject(0).put("h", 1);
                    xp += r.getInt("xp");
                    gold += r.getInt("gold");
                    levels += r.getInt("levels");
                    level = r.getInt("level");
                    got++;
                }
                if (got == 0) already++;
                JSONObject d = new JSONObject();
                d.put("q", id);
                d.put("n", q.optString("name", ""));
                d.put("i", q.optString("icon", ""));
                d.put("c", got);
                d.put("want", want);
                done.put(d);
            }
        }
        if (!changed) return null;

        JSONArray sa = new JSONArray();
        List<String> keep = new ArrayList<String>(seen);
        for (int i = Math.max(0, keep.size() - SEEN_MAX); i < keep.size(); i++) sa.put(keep.get(i));
        h.put("seen", sa);
        JSONArray ua = new JSONArray();
        for (int i = Math.max(0, unclaimed.length() - UNCLAIMED_MAX); i < unclaimed.length(); i++) ua.put(unclaimed.get(i));
        h.put("unclaimed", ua);
        h.put("last", now);

        JSONObject r = new JSONObject();
        r.put("changed", true);
        r.put("done", done);
        r.put("xp", xp);
        r.put("gold", gold);
        r.put("levels", levels);
        r.put("level", level);
        r.put("unclaimed", newUnclaimed);
        r.put("already", already);
        if (!live && (done.length() > 0 || newUnclaimed > 0)) {
            JSONArray news = h.optJSONArray("news");
            JSONArray nn = new JSONArray();
            if (news != null) for (int i = Math.max(0, news.length() - (NEWS_MAX - 1)); i < news.length(); i++) nn.put(news.get(i));
            JSONObject item = new JSONObject(r.toString());
            item.put("t", now);
            nn.put(item);
            h.put("news", nn);
        }
        return r;
    }

    /** Learn a wording for a quest (lower-case, max 16 kept). */
    static void addAlias(JSONObject q, String text) throws JSONException {
        String a = text == null ? "" : text.toLowerCase().trim();
        if (a.length() > 60) a = a.substring(0, 60);
        if (a.isEmpty()) return;
        JSONArray al = q.optJSONArray("aliases");
        if (al == null) { al = new JSONArray(); q.put("aliases", al); }
        for (int i = 0; i < al.length(); i++) if (a.equals(al.optString(i))) return;
        al.put(a);
        if (al.length() > 16) {
            JSONArray nl = new JSONArray();
            for (int i = al.length() - 16; i < al.length(); i++) nl.put(al.get(i));
            q.put("aliases", nl);
        }
    }

    /** Same as G.heraldClaim: credit an unplaced report to a quest (n times), optionally learning the wording. */
    static JSONObject claim(JSONObject s, String k, long qid, boolean learn, String today, long now) throws JSONException {
        JSONObject h = herald(s);
        JSONArray un = h.optJSONArray("unclaimed");
        if (un == null) return null;
        JSONObject u = null;
        JSONArray rest = new JSONArray();
        for (int i = 0; i < un.length(); i++) {
            JSONObject x = un.optJSONObject(i);
            if (x != null && u == null && k.equals(x.optString("k"))) u = x; else if (x != null) rest.put(x);
        }
        JSONObject q = Game.findQ(s, qid);
        if (u == null || q == null) return null;
        h.put("unclaimed", rest);
        if (learn) addAlias(q, u.optString("text"));
        int want = Math.max(1, u.optInt("n", 1)), got = 0, xp = 0, gold = 0, levels = 0, level = s.optInt("level", 1);
        for (int c = 0; c < want; c++) {
            JSONObject r = Game.complete(s, qid, today, now + c);
            if (r == null) break;
            JSONArray log = s.optJSONArray("log");
            if (log != null && log.length() > 0) log.getJSONObject(0).put("h", 1);
            xp += r.getInt("xp"); gold += r.getInt("gold"); levels += r.getInt("levels"); level = r.getInt("level");
            got++;
        }
        JSONObject d = new JSONObject();
        d.put("q", qid); d.put("n", q.optString("name", "")); d.put("i", q.optString("icon", ""));
        d.put("c", got); d.put("want", want); d.put("xp", xp); d.put("gold", gold); d.put("levels", levels); d.put("level", level);
        return d;
    }

    /** Short line for a notification or toast: "Swim session · Log my meals ×2" (same quest merged) */
    static String summary(JSONObject r) {
        Map<String, Integer> by = new java.util.LinkedHashMap<String, Integer>();
        JSONArray d = r.optJSONArray("done");
        if (d != null) for (int i = 0; i < d.length(); i++) {
            JSONObject o = d.optJSONObject(i);
            if (o == null || o.optInt("c") == 0) continue;
            String n = o.optString("n");
            by.put(n, (by.containsKey(n) ? by.get(n) : 0) + o.optInt("c"));
        }
        StringBuilder b = new StringBuilder();
        for (Map.Entry<String, Integer> e : by.entrySet()) {
            if (b.length() > 0) b.append(" · ");
            b.append(e.getKey());
            if (e.getValue() > 1) b.append(" ×").append(e.getValue());
        }
        return b.toString();
    }
}
