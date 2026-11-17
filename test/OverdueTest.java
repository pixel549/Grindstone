package dev.jake.grindstone;
public class OverdueTest {
    static int fails = 0;
    static void ok(boolean c, String m) { System.out.println((c ? "PASS " : "FAIL ") + m); if (!c) fails++; }
    public static void main(String[] a) {
        // same cases as test/remind_logic.js
        ok(Overdue.due("2026-11-17", "2026-11-15", "2026-11-01", 3, 0, null, null) == -1, "2 days undone, remind at 3: not yet");
        ok(Overdue.due("2026-11-18", "2026-11-15", "2026-11-01", 3, 0, null, null) == 3, "3 days undone: due, gap 3");
        ok(Overdue.due("2026-11-19", "2026-11-15", "2026-11-01", 3, 0, "2026-11-18", null) == -1, "once: already in yesterday's note");
        ok(Overdue.due("2026-11-20", "2026-11-15", "2026-11-01", 3, 2, "2026-11-18", null) == 5, "every 2 days: again two days later");
        ok(Overdue.due("2026-11-19", "2026-11-15", "2026-11-01", 3, 2, "2026-11-18", null) == -1, "every 2 days: not the next day");
        ok(Overdue.due("2026-11-19", "2026-11-15", "2026-11-01", 3, 0, "2026-11-18", "2026-11-21") == -1, "snoozed");
        ok(Overdue.due("2026-11-21", "2026-11-15", "2026-11-01", 3, 0, "2026-11-18", "2026-11-21") == 6, "snooze over: back in the note, even if once");
        ok(Overdue.due("2026-11-22", "2026-11-15", "2026-11-01", 3, 0, "2026-11-21", "2026-11-21") == -1, "and once more is once");
        ok(Overdue.due("2026-11-22", "2026-11-20", "2026-11-01", 3, 0, "2026-11-18", null) == -1, "done since: the clock restarts");
        ok(Overdue.due("2026-11-23", "2026-11-20", "2026-11-01", 3, 0, "2026-11-18", null) == 3, "and the old note doesn't count");
        ok(Overdue.due("2026-11-20", null, "2026-11-17", 3, 0, null, null) == 3, "never done: counts from when it was turned on");
        ok(Overdue.due("2026-11-20", null, "2026-11-17", 3, 0, "2026-11-10", null) == 3, "an old note from before it was turned on doesn't count");
        ok(Overdue.safeNow(9 * 60, 9, -1, -1) && !Overdue.safeNow(8 * 60 + 59, 9, -1, -1) && !Overdue.safeNow(21 * 60 + 31, 9, -1, -1), "from 9 am to 9:30 pm");
        ok(!Overdue.safeNow(10 * 60, 9, 6 * 60, 11 * 60) && !Overdue.safeNow(11 * 60 + 30, 9, 6 * 60, 11 * 60) && Overdue.safeNow(11 * 60 + 31, 9, 6 * 60, 11 * 60), "not during a shift, or half an hour either side");
        ok(Overdue.safeNow(9 * 60, 9, 13 * 60, 22 * 60), "a 1 pm start leaves the morning free");
        System.out.println(fails == 0 ? "ALL PASSED" : fails + " FAILED");
        System.exit(fails == 0 ? 0 : 1);
    }
}
