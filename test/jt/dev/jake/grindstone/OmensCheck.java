package dev.jake.grindstone;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.file.Files;
import java.nio.file.Paths;

public class OmensCheck {
    public static void main(String[] a) throws Exception {
        JSONArray all = new JSONArray(new String(Files.readAllBytes(Paths.get(a[0])), "UTF-8"));
        int bad = 0;
        for (int i = 0; i < all.length(); i++) {
            JSONObject c = all.getJSONObject(i);
            JSONObject want = c.getJSONObject("out"), got = Omens.compute(c.getJSONObject("s"), c.getString("t"));
            boolean ok = want.getString("mode").equals(got.getString("mode"));
            JSONArray w = want.getJSONArray("items"), g = got.getJSONArray("items");
            ok = ok && w.length() == g.length();
            for (int j = 0; ok && j < w.length(); j++)
                for (String k : new String[]{"icon", "label", "value", "tone"})
                    if (!w.getJSONObject(j).getString(k).equals(g.getJSONObject(j).getString(k))) ok = false;
            if (!ok) { bad++; if (bad <= 5) System.out.println("MISMATCH #" + i + "\n  js:   " + want + "\n  java: " + got); }
        }
        System.out.println(all.length() + " saves, " + bad + " mismatches");
        if (bad > 0) System.exit(1);
    }
}
