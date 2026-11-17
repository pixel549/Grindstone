package dev.jake.grindstone;
import java.nio.file.*; import java.util.*; import org.json.*;
public class CrossCheck {
  public static void main(String[] a) throws Exception {
    JSONArray sc = new JSONArray(new String(Files.readAllBytes(Paths.get("scenarios.json")), "UTF-8"));
    int fails = 0, checks = 0;
    for (int i = 0; i < sc.length(); i++) {
      JSONObject c = sc.getJSONObject(i);
      // round-trip through a string like the widget does
      JSONObject s = new JSONObject(c.getJSONObject("initial").toString());
      JSONArray ops = c.getJSONArray("ops");
      JSONObject widget = c.getJSONObject("widget");
      Set<String> seen = new HashSet<>();
      for (int k = 0; k < ops.length(); k++) {
        JSONObject op = ops.getJSONObject(k);
        String d = op.getString("d");
        if (seen.add(d)) {
          List<JSONObject> wl = Game.widgetList(s, d);
          StringBuilder got = new StringBuilder("[");
          for (int j = 0; j < wl.size(); j++) { if (j > 0) got.append(','); got.append(wl.get(j).getLong("id")); }
          got.append(']');
          checks++;
          if (!got.toString().equals(widget.getJSONArray(d).toString())) { fails++; System.out.println("seed " + c.get("seed") + " widget " + d + " java=" + got + " js=" + widget.getJSONArray(d)); }
        }
        JSONObject r = Game.complete(s, op.getLong("id"), d, op.getLong("t"));
        checks++;
        if ((r != null) != op.getBoolean("ok") || (r != null && r.getInt("levels") != op.getInt("levels"))) { fails++; System.out.println("seed " + c.get("seed") + " op " + k + " mismatch"); }
        s = new JSONObject(s.toString());
      }
      JSONObject f = c.getJSONObject("final");
      for (String key : new String[]{"level","xp","gold","chests","streak","bestStreak","total","lastActive","lastTraining"}) {
        checks++;
        if (!String.valueOf(s.opt(key)).equals(String.valueOf(f.opt(key)))) { fails++; System.out.println("seed " + c.get("seed") + " " + key + " java=" + s.opt(key) + " js=" + f.opt(key)); }
      }
      for (String k : new String[]{"STR","END","VIT","DIS","INT"}) { checks++; if (s.getJSONObject("stats").optInt(k) != f.getJSONObject("stats").optInt(k)) { fails++; System.out.println("stat " + k); } }
      JSONArray qj = s.getJSONArray("quests"), qs = f.getJSONArray("quests");
      for (int k = 0; k < qs.length(); k++) for (String key : new String[]{"doneOn","count","countOn"}) {
        checks++;
        if (!String.valueOf(qj.getJSONObject(k).opt(key)).equals(String.valueOf(qs.getJSONObject(k).opt(key)))) { fails++; System.out.println("seed " + c.get("seed") + " quest " + k + " " + key); }
      }
      JSONArray lj = s.getJSONArray("log"), ls = f.getJSONArray("log");
      checks++;
      if (lj.length() != ls.length()) { fails++; System.out.println("log len"); }
      for (int k = 0; k < Math.min(lj.length(), ls.length()); k++) for (String key : new String[]{"t","d","q","n","x","g","s"}) {
        checks++;
        if (!String.valueOf(lj.getJSONObject(k).opt(key)).equals(String.valueOf(ls.getJSONObject(k).opt(key)))) { fails++; System.out.println("log " + k + " " + key); break; }
      }
    }
    System.out.println(fails == 0 ? "MATCH: " + checks + " checks, 0 mismatches" : "FAIL: " + fails + " of " + checks);
  }
}
