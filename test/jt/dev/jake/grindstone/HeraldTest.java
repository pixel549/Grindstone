package dev.jake.grindstone;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/** Desktop test for the herald's matching and crediting. Run: java ... HeraldTest test/herald_state.json */
public class HeraldTest {
    static int fails = 0, checks = 0;

    static void expect(String deed, String quest) throws Exception {
        JSONObject s = new JSONObject(new String(Files.readAllBytes(Paths.get(PATH)), "UTF-8"));
        JSONObject q = HeraldCore.match(s, (String) HeraldCore.parse(deed)[0]);
        String got = q == null ? null : q.optString("name");
        checks++;
        boolean ok = quest == null ? got == null : quest.equals(got);
        if (!ok) fails++;
        System.out.println((ok ? "  ok   " : "  FAIL ") + String.format("%-34s -> %s", deed, got) + (ok ? "" : "   (wanted " + quest + ")"));
    }

    static String PATH;

    public static void main(String[] a) throws Exception {
        PATH = a[0];
        System.out.println("matching:");
        expect("Swim", "Swim session");
        expect("Swam 300m in 5:40", "Swim session");
        expect("Log my meals ×2", "Log my meals");
        expect("Drank water", "Drink 2L of water");
        expect("Fed the birds", "Feed & water Ruby and Kermit");
        expect("Mowed the lawn", "Mow the lawn");
        expect("Washing up", "Dishes done");
        expect("Laundry", "Do a load of washing");
        expect("Did a load of washing", "Do a load of washing");
        expect("Reviewed emails", "Review my emails");
        expect("Gym session", "Weights / cable session");
        expect("Studied for Cert IV", "Cert IV study block");
        expect("Groceries", "Grocery shop");
        expect("Beach run", "Run or beach session");
        expect("⚔ Grindstone: Stretching", "Stretch & mobility");
        expect("Breakfast logged", "Log my meals");
        expect("Dinner at the college", "Log my meals");
        expect("Vegie meal", "Proper vegie-heavy meal");
        expect("Cleaned the aviary", "Clean the aviary");
        expect("An hour on the reno", "An hour on the reno");
        expect("Read for 20 minutes", "Read for 20 minutes");
        expect("Played guitar for 30 min", null);
        expect("Session", null);
        expect("Walked the dog", null);

        System.out.println("parsing:");
        Object[] p = HeraldCore.parse("Log my meals ×2"); check("×2", p[0].equals("Log my meals") && (Integer) p[1] == 2);
        p = HeraldCore.parse("3x Water"); check("3x lead", p[0].equals("Water") && (Integer) p[1] == 3);
        p = HeraldCore.parse("Water x 3"); check("x 3 trail", p[0].equals("Water") && (Integer) p[1] == 3);
        p = HeraldCore.parse("Max 5"); check("no false count", p[0].equals("Max 5") && (Integer) p[1] == 1);
        p = HeraldCore.parse("Water (4)"); check("(4)", p[0].equals("Water") && (Integer) p[1] == 4);
        p = HeraldCore.parse("Water ×99"); check("count capped", (Integer) p[1] == 10);
        check("split", HeraldCore.split("Swim; Dishes\nWater").size() == 3);

        System.out.println("crediting:");
        JSONObject s = new JSONObject(new String(Files.readAllBytes(Paths.get(PATH)), "UTF-8"));
        long now = 1_794_000_000_000L;
        List<HeraldCore.Ev> evs = new ArrayList<HeraldCore.Ev>();
        evs.add(new HeraldCore.Ev(now - 9000 + "|Swim", "Swim", now - 9000));
        evs.add(new HeraldCore.Ev(now - 8000 + "|Log my meals ×2", "Log my meals ×2", now - 8000));
        evs.add(new HeraldCore.Ev(now - 7000 + "|Fed the birds; Dishes; Played guitar", "Fed the birds; Dishes; Played guitar", now - 7000));
        evs.add(new HeraldCore.Ev(now - 6000 + "|Breakfast logged ×2", "Breakfast logged ×2", now - 6000));
        int xp0 = s.optInt("xp"), total0 = s.optInt("total");
        JSONObject r = HeraldCore.apply(s, evs, now, "2026-11-07", false);
        System.out.println("  summary: " + HeraldCore.summary(r) + "  | xp " + r.optInt("xp") + " gold " + r.optInt("gold") + " unclaimed " + r.optInt("unclaimed"));
        check("5 deeds matched", r.getJSONArray("done").length() == 5);
        check("meals capped at 3", countFor(r, "Log my meals") == 3);
        check("one unclaimed", r.optInt("unclaimed") == 1 && s.getJSONObject("herald").getJSONArray("unclaimed").length() == 1);
        check("unclaimed text", s.getJSONObject("herald").getJSONArray("unclaimed").getJSONObject(0).optString("text").equals("Played guitar"));
        check("total went up by 6", s.optInt("total") == total0 + 6);
        check("log entries marked h", s.getJSONArray("log").getJSONObject(0).optInt("h") == 1);
        check("news queued", s.getJSONObject("herald").getJSONArray("news").length() == 1);
        check("same events again → nothing", HeraldCore.apply(s, evs, now + 1000, "2026-11-07", false) == null);
        List<HeraldCore.Ev> more = new ArrayList<HeraldCore.Ev>();
        more.add(new HeraldCore.Ev(now + 5000 + "|Swim session", "Swim session", now + 5000));
        JSONObject r2 = HeraldCore.apply(s, more, now + 6000, "2026-11-07", true);
        check("second swim same day: matched but capped", r2 != null && r2.optInt("already") == 1 && r2.optInt("xp") == 0);
        check("live run doesn't queue news", s.getJSONObject("herald").getJSONArray("news").length() == 1);
        // seen list stays bounded
        List<HeraldCore.Ev> lots = new ArrayList<HeraldCore.Ev>();
        for (int i = 0; i < 600; i++) lots.add(new HeraldCore.Ev("x" + i, "Walked the dog", now + i));
        HeraldCore.apply(s, lots, now + 9000, "2026-11-07", true);
        check("seen capped", s.getJSONObject("herald").getJSONArray("seen").length() == HeraldCore.SEEN_MAX);
        check("unclaimed capped", s.getJSONObject("herald").getJSONArray("unclaimed").length() == HeraldCore.UNCLAIMED_MAX);

        System.out.println(checks + " checks, " + fails + " failed");
        if (fails > 0) System.exit(1);
    }

    static int countFor(JSONObject r, String name) throws Exception {
        JSONArray d = r.getJSONArray("done");
        int n = 0;
        for (int i = 0; i < d.length(); i++) if (d.getJSONObject(i).optString("n").equals(name)) n += d.getJSONObject(i).optInt("c");
        return n;
    }

    static void check(String what, boolean ok) {
        checks++;
        if (!ok) fails++;
        System.out.println((ok ? "  ok   " : "  FAIL ") + what);
    }
}
