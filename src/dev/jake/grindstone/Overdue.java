package dev.jake.grindstone;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 2.25: "it's been too long" reminders, the rule on its own so it can be tested off the phone (test/Overdue*.java).
 * The same rule as core.js remindState; keep them the same. Days are "YYYY-MM-DD" strings (they sort as dates), null for none.
 */
final class Overdue {
    private Overdue() {}

    static long days(String a, String b) { return ChronoUnit.DAYS.between(LocalDate.parse(a), LocalDate.parse(b)); }

    static String later(String a, String b) {
        if (a == null || a.isEmpty()) return b == null || b.isEmpty() ? null : b;
        if (b == null || b.isEmpty()) return a;
        return b.compareTo(a) > 0 ? b : a;
    }

    /**
     * today; done: the last day it was done (null: never); from: when the reminder was turned on; d: remind once it's
     * gone this many days undone; rep: then every rep days (0: once); ping, snz: the last note it was in, snoozed until.
     * Returns the days since it was last done if it should be in today's note, else -1.
     */
    static long due(String today, String done, String from, int d, int rep, String ping, String snz) {
        String last = done != null && !done.isEmpty() ? done : from;
        long gap = Math.max(0, days(last, today));
        if (gap < d) return -1;
        if (snz != null && today.compareTo(snz) < 0) return -1;
        boolean pinged = ping != null && ping.compareTo(last) > 0 && ping.compareTo(from) >= 0
                && !(snz != null && ping.compareTo(snz) < 0 && today.compareTo(snz) >= 0);
        if (!pinged) return gap;
        if (rep > 0 && days(ping, today) >= rep) return gap;
        return -1;
    }

    /** Can the note go out at this minute of the day? Not before `fromHour`, not after 9:30 pm, and not within half an hour of a shift. */
    static boolean safeNow(int minute, int fromHour, int shiftFirst, int shiftLast) {
        if (minute < fromHour * 60 || minute > 21 * 60 + 30) return false;
        if (shiftFirst >= 0 && shiftLast >= 0 && minute >= shiftFirst - 30 && minute <= shiftLast + 30) return false;
        return true;
    }
}
