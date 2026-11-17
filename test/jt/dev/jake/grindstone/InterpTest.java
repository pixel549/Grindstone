package dev.jake.grindstone;

import org.json.JSONArray;
import org.json.JSONObject;

/** InterpreterCore against test/mock_llm.py: good answers are used, everything else throws (and so is ignored). */
public class InterpTest {
    static int checks = 0, fails = 0;

    static void check(String what, boolean ok) {
        checks++;
        if (!ok) fails++;
        System.out.println((ok ? "  ok   " : "  FAIL ") + what);
    }

    public static void main(String[] a) throws Exception {
        String base = "http://127.0.0.1:" + a[0] + "/v1";
        JSONArray qs = new JSONArray().put(new JSONObject().put("id", 12).put("name", "Weights / cable session")).put(new JSONObject().put("id", 13).put("name", "Swim session"));
        JSONArray rs = new JSONArray().put(new JSONObject().put("k", "a").put("text", "smashed legs at the gym"))
                .put(new JSONObject().put("k", "b").put("text", "played guitar")).put(new JSONObject().put("k", "c").put("text", "did 20 laps"));
        JSONObject r = InterpreterCore.resolve(base, "good-key", "real", rs, qs, 3000);
        check("real: gym -> weights, laps -> swim, guitar unplaced: " + r, r.optLong("a") == 12 && r.optLong("c") == 13 && !r.has("b"));
        r = InterpreterCore.resolve(base, "good-key", "chatty", rs, qs, 3000);
        check("chatty reply in code fences: only valid keys and ids kept: " + r, r.length() == 1 && r.optLong("a") == 12);
        String[][] bad = {{"bad-key", "real", "401"}, {"good-key", "garbage", "not JSON"}, {"good-key", "empty", "empty"}, {"good-key", "slow", "timeout"}};
        for (String[] b : bad) {
            String err = null;
            try { InterpreterCore.resolve(base, b[0], b[1], rs, qs, 1500); } catch (Exception e) { err = e.getMessage(); }
            check(b[2] + " throws (caller leaves it for Jake): " + err, err != null);
        }
        String err = null;
        try { InterpreterCore.resolve("http://example.com/v1", "k", "m", rs, qs, 1000); } catch (Exception e) { err = e.getMessage(); }
        check("plain http refused: " + err, "needs https".equals(err));
        check("gpt-oss gets low reasoning", InterpreterCore.body("openai/gpt-oss-20b", "s", "u").contains("reasoning_effort"));
        check("others don't", !InterpreterCore.body("mistral-small-latest", "s", "u").contains("reasoning_effort"));
        // 2.26: one connection for any provider, and any question (the Oracle's too)
        check("gemini gets low reasoning too", InterpreterCore.body("gemini-3.8-flash", "s", "u").contains("reasoning_effort"));
        check("max tokens passed through", InterpreterCore.body("x", "s", "u", 1800).contains("\"max_tokens\":1800"));
        check("Gemini gets room to think inside its cap", InterpreterCore.body("gemini-3.8-flash", "s", "u", 900).contains("\"max_tokens\":2948"));
        check("Claude's API is told apart by its address", InterpreterCore.anthropic("https://api.anthropic.com/v1") && !InterpreterCore.anthropic("https://api.groq.com/openai/v1"));
        String e1 = InterpreterCore.chat(base, "good-key", "echo", "sys", "pick three trials", 3000, 1800);
        check("an OpenAI-style ask returns the text: " + e1, "user=pick three trials;max=1800".equals(e1));
        String m1 = InterpreterCore.messages(base, "good-key", "claude-haiku-5-5", "be brief", "hello", 3000, 60);
        check("Claude's Messages API: system, the message and max tokens go, the text comes back: " + m1, "sys=be brief;user=hello;max=60".equals(m1));
        String m2 = null;
        try { InterpreterCore.messages(base, "bad-key", "claude-haiku-5-5", "s", "u", 3000, 60); } catch (Exception e) { m2 = e.getMessage(); }
        check("a bad Claude key says so: " + m2, m2 != null && m2.contains("401") && m2.contains("invalid x-api-key"));
        String m3 = null;
        try { InterpreterCore.messages(base, "good-key", "empty", "s", "u", 3000, 60); } catch (Exception e) { m3 = e.getMessage(); }
        check("an empty Claude reply throws: " + m3, "empty reply".equals(m3));
        String m4 = null;
        try { InterpreterCore.messages("http://example.com/v1", "k", "m", "s", "u", 1000, 60); } catch (Exception e) { m4 = e.getMessage(); }
        check("plain http refused for Claude too: " + m4, "needs https".equals(m4));
        System.out.println(checks + " checks, " + fails + " failed");
        if (fails > 0) System.exit(1);
    }
}
