package dev.jake.grindstone;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import org.json.JSONObject;

/** Midnight widget refresh, a periodic tick, and the "you haven't trained" nudge. */
public class Ticker extends BroadcastReceiver {
    static final String ACTION_TICK = "dev.jake.grindstone.TICK";
    static final String ACTION_MIDNIGHT = "dev.jake.grindstone.MIDNIGHT";
    /** Restarts the widget's loop. Not a wake-up alarm: if the phone is asleep it waits, and fires as the screen comes back on. */
    static final String ACTION_KICK = "dev.jake.grindstone.KICK";
    /** 2.25: snooze everything in the overdue note, for EXTRA_DAYS days. */
    static final String ACTION_SNOOZE = "dev.jake.grindstone.OVERDUE_SNOOZE";
    static final String EXTRA_DAYS = "days", EXTRA_IDS = "ids";
    static final int OVERDUE_ID = 11;
    private static final String CHANNEL = "nudge";

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (ACTION_KICK.equals(a)) { QuestWidget.kick(c); return; }
        if (ACTION_SNOOZE.equals(a)) { snooze(c, i.getLongArrayExtra(EXTRA_IDS), i.getIntExtra(EXTRA_DAYS, 1)); return; }
        if (Delve.ACTION.equals(a)) {           // the fallback time: he goes alone if nobody sent him
            Delve.begin(c, "fallback");
            Delve.schedule(c);
            return;
        }
        boolean boot = Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a);
        if (boot) ensureScheduled(c, true);
        if (boot || ACTION_TICK.equals(a)) {
            Herald.scheduleJob(c);         // content-trigger jobs don't survive reboots, so re-arm
            Herald.onCalendarChanged(c);   // and catch anything the job missed
            WidgetCam.maybeRequest(c, WidgetCam.STALE_TICK);
        }
        if (boot || ACTION_TICK.equals(a)) QuestWidget.kick(c); else QuestWidget.updateAll(c);
        if (boot || ACTION_TICK.equals(a)) {
            checkNudge(c);
            checkRemind(c, false);
            checkOverdue(c);
            Delve.schedule(c);
            if (Delve.overdue(c)) Delve.begin(c, "fallback");   // the alarm was missed
            else Delve.checkAway(c, goAsync());                  // left home? (finishes the broadcast itself)
        }
    }

    private static PendingIntent pi(Context c, String action, int flags) {
        Intent i = new Intent(c, Ticker.class).setAction(action);
        return PendingIntent.getBroadcast(c, action.hashCode(), i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static void ensureScheduled(Context c) { ensureScheduled(c, false); }

    static void ensureScheduled(Context c, boolean force) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am != null && (force || pi(c, ACTION_TICK, PendingIntent.FLAG_NO_CREATE) == null)) {
            am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + 20 * 60 * 1000L,
                    2 * AlarmManager.INTERVAL_HOUR, pi(c, ACTION_TICK, PendingIntent.FLAG_UPDATE_CURRENT));
        }
        if (!QuestWidget.ENABLED && am != null) am.cancel(pi(c, ACTION_KICK, PendingIntent.FLAG_UPDATE_CURRENT));
        if (QuestWidget.ENABLED && am != null && (force || pi(c, ACTION_KICK, PendingIntent.FLAG_NO_CREATE) == null)) {
            am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + 10 * 60 * 1000L,
                    AlarmManager.INTERVAL_FIFTEEN_MINUTES, pi(c, ACTION_KICK, PendingIntent.FLAG_UPDATE_CURRENT));
        }
        scheduleMidnight(c);
    }

    static void scheduleMidnight(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        long at = LocalDate.now().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli() + 60 * 1000L;
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi(c, ACTION_MIDNIGHT, PendingIntent.FLAG_UPDATE_CURRENT));
    }

    /**
     * 2.8: once a day, from the hour set in the app, a note of the dailies still open, with a button for each of the
     * first three. The buttons tick them off the same way the list widget does, and the note redraws with what's left.
     * `again` redraws it after a tick (no sound, and it goes away when nothing is left).
     */
    static void checkRemind(Context c, boolean again) {
        try {
            String raw = Store.load(c);
            if (raw.isEmpty()) return;
            JSONObject s = new JSONObject(raw);
            JSONObject set = s.optJSONObject("settings");
            if (set == null || !set.optBoolean("remind", true)) return;
            String today = Game.today();
            SharedPreferences p = Store.prefs(c);
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm == null) return;
            if (!again) {
                int hour = LocalTime.now().getHour();
                if (hour < set.optInt("remindHour", 18) || hour >= 23) return;
                if (today.equals(p.getString("remindedOn", ""))) return;
            } else if (!today.equals(p.getString("remindedOn", ""))) return;

            // dailies due today and still open (not habits or to-dos: this is the "before bed" list)
            java.util.List<JSONObject> left = new java.util.ArrayList<JSONObject>();
            org.json.JSONArray qs = s.optJSONArray("quests");
            for (int i = 0; qs != null && i < qs.length(); i++) {
                JSONObject q = qs.optJSONObject(i);
                if (q == null || !"daily".equals(q.optString("type", "daily"))) continue;
                if (Game.canComplete(q, today) && Game.dueOn(q, today) && !Game.away(q, today)) left.add(q);
            }
            if (left.isEmpty()) { nm.cancel(9); if (!again) p.edit().putString("remindedOn", today).apply(); return; }
            if (c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return;
            nm.createNotificationChannel(new NotificationChannel("remind", "What's left today", NotificationManager.IMPORTANCE_LOW));

            StringBuilder names = new StringBuilder();
            for (int i = 0; i < left.size(); i++) { if (i > 0) names.append(" · "); names.append(left.get(i).optString("name", "")); }
            Intent openI = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent open = PendingIntent.getActivity(c, 5, openI, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder nb = new Notification.Builder(c, "remind")
                    .setSmallIcon(R.drawable.ic_stat)
                    .setColor(0xFFC8B27A)
                    .setContentTitle(left.size() + (left.size() == 1 ? " daily left" : " dailies left"))
                    .setContentText(names)
                    .setStyle(new Notification.BigTextStyle().bigText(names))
                    .setContentIntent(open)
                    .setOnlyAlertOnce(true)
                    .setAutoCancel(false);
            for (int i = 0; i < left.size() && i < 3; i++) {
                JSONObject q = left.get(i);
                Intent done = new Intent(c, QuestListWidget.class).setAction(QuestListWidget.ACTION_COMPLETE).putExtra(QuestListWidget.EXTRA_QID, q.optLong("id", -1));
                PendingIntent pd = PendingIntent.getBroadcast(c, 100 + i, done, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                String nm1 = q.optString("name", "Done");
                nb.addAction(new Notification.Action.Builder(null, "✓ " + (nm1.length() > 18 ? nm1.substring(0, 17) + "…" : nm1), pd).build());
            }
            nm.notify(9, nb.build());
            if (!again) p.edit().putString("remindedOn", today).apply();
        } catch (Exception e) {
            // a reminder is never worth crashing over
        }
    }

    // ---------- 2.25: "it's been too long" ----------
    // The phone's own record of the note: which quests were in it on which day, and the snoozes from its buttons.
    // Kept here, not in the save, so a tap on the note can't be lost under the open app's next save. The app reads
    // them (Native.remindMarks) and the later date wins (core.js remindState).
    static JSONObject marks(Context c, String key) {
        try { return new JSONObject(Store.prefs(c).getString(key, "{}")); } catch (Exception e) { return new JSONObject(); }
    }
    static void putMark(Context c, String key, long id, String day) {
        try {
            JSONObject m = marks(c, key), keep = new JSONObject();
            m.put(Long.toString(id), day);
            String cut = Game.addDays(Game.today(), -60);
            java.util.Iterator<String> it = m.keys();
            while (it.hasNext()) { String k = it.next(); String v = m.optString(k, ""); if (v.compareTo(cut) >= 0) keep.put(k, v); }
            Store.prefs(c).edit().putString(key, keep.toString()).apply();
        } catch (Exception e) { /* fine */ }
    }

    /**
     * Once a day: one note listing every reminder quest that's gone too long undone ("Overdue: training 4d, mow lawn 9d").
     * Not before the hour set in the app (9 am unless changed), not after 9:30 pm, and never within half an hour of a
     * rostered shift: it waits for the next tick after. Tap: the app's overdue list. Buttons: snooze it all 1 or 3 days.
     */
    static void checkOverdue(Context c) {
        try {
            String raw = Store.load(c);
            if (raw.isEmpty()) return;
            JSONObject s = new JSONObject(raw);
            JSONObject set = s.optJSONObject("settings");
            if (set != null && !set.optBoolean("overdue", true)) return;
            String today = Game.today();
            SharedPreferences p = Store.prefs(c);
            if (today.equals(p.getString("overdueOn", ""))) return;
            LocalTime now = LocalTime.now();
            int first = -1, last = -1;
            JSONObject ro = s.optJSONObject("roster"), rd = ro == null ? null : ro.optJSONObject("days");
            JSONObject day = rd == null ? null : rd.optJSONObject(today);
            if (day != null && day.optInt("mins", 0) > 0 && set != null && !set.isNull("rosterCal")) { first = day.optInt("first", -1); last = day.optInt("last", -1); }
            if (!Overdue.safeNow(now.getHour() * 60 + now.getMinute(), set == null ? 9 : set.optInt("overdueHour", 9), first, last)) return;

            JSONObject ql = s.optJSONObject("qlast"), pings = marks(c, "rmPing"), snzs = marks(c, "rmSnz");
            org.json.JSONArray qs = s.optJSONArray("quests");
            java.util.List<Object[]> due = new java.util.ArrayList<Object[]>();
            for (int i = 0; qs != null && i < qs.length(); i++) {
                JSONObject q = qs.optJSONObject(i);
                JSONObject r = q == null ? null : q.optJSONObject("remind");
                if (r == null || q.optBoolean("archived", false) || Game.away(q, today)) continue;   // 2.27: put away
                if ("todo".equals(q.optString("type")) && !q.isNull("doneOn") && !q.optString("doneOn", "").isEmpty()) continue;
                String id = Long.toString(q.optLong("id"));
                String done = ql == null ? null : ql.optString(id, null);
                String from = r.optString("from", today);
                String ping = Overdue.later(r.isNull("ping") ? null : r.optString("ping", null), pings.optString(id, null));
                String snz = Overdue.later(r.isNull("snz") ? null : r.optString("snz", null), snzs.optString(id, null));
                long gap = Overdue.due(today, done, from, r.optInt("d", 3), r.optInt("rep", 0), ping, snz);
                if (gap >= 0) due.add(new Object[] { q, gap });
            }
            if (due.isEmpty()) return;
            if (c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return;
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm == null) return;
            java.util.Collections.sort(due, new java.util.Comparator<Object[]>() {
                public int compare(Object[] a, Object[] b) { return Long.compare((Long) b[1], (Long) a[1]); }
            });
            StringBuilder head = new StringBuilder("Overdue: "), body = new StringBuilder();
            long[] ids = new long[due.size()];
            for (int i = 0; i < due.size(); i++) {
                JSONObject q = (JSONObject) due.get(i)[0];
                long gap = (Long) due.get(i)[1];
                ids[i] = q.optLong("id");
                if (i > 0) { head.append(", "); body.append("\n"); }
                head.append(q.optString("name", "")).append(' ').append(gap).append('d');
                body.append(q.optString("icon", "•")).append(' ').append(q.optString("name", "")).append(": ").append(gap).append(gap == 1 ? " day" : " days");
            }
            nm.createNotificationChannel(new NotificationChannel("overdue", "It's been too long", NotificationManager.IMPORTANCE_DEFAULT));
            Intent openI = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("goto", "overdue");
            PendingIntent open = PendingIntent.getActivity(c, 7, openI, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder nb = new Notification.Builder(c, "overdue")
                    .setSmallIcon(R.drawable.ic_stat)
                    .setColor(0xFFC8B27A)
                    .setContentTitle(head.toString())
                    .setContentText(due.size() == 1 ? "Tap to see it, or snooze it." : due.size() + " things. Tap to see them, or snooze them.")
                    .setStyle(new Notification.BigTextStyle().setBigContentTitle(head.toString()).bigText(body.toString()))
                    .setContentIntent(open)
                    .setAutoCancel(true);
            for (int k = 0; k < 2; k++) {
                int n = k == 0 ? 1 : 3;
                Intent si = new Intent(c, Ticker.class).setAction(ACTION_SNOOZE).putExtra(EXTRA_DAYS, n).putExtra(EXTRA_IDS, ids);
                PendingIntent ps = PendingIntent.getBroadcast(c, 200 + n, si, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                nb.addAction(new Notification.Action.Builder(null, n == 1 ? "Snooze 1 day" : "Snooze 3 days", ps).build());
            }
            nm.notify(OVERDUE_ID, nb.build());
            for (long id : ids) putMark(c, "rmPing", id, today);
            p.edit().putString("overdueOn", today).apply();
        } catch (Exception e) {
            // a reminder is never worth crashing over
        }
    }

    static void snooze(Context c, long[] ids, int days) {
        if (ids != null) {
            String until = Game.addDays(Game.today(), Math.max(1, Math.min(14, days)));
            for (long id : ids) putMark(c, "rmSnz", id, until);
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(OVERDUE_ID);
        if (ids != null) android.widget.Toast.makeText(c.getApplicationContext(), "Snoozed for " + days + (days == 1 ? " day." : " days."), android.widget.Toast.LENGTH_SHORT).show();
    }

    static void checkNudge(Context c) {
        try {
            String raw = Store.load(c);
            if (raw.isEmpty()) return;
            JSONObject s = new JSONObject(raw);
            JSONObject set = s.optJSONObject("settings");
            if (set != null && !set.optBoolean("nudge", true)) return;
            int days = set != null ? set.optInt("nudgeDays", 3) : 3;

            int hour = LocalTime.now().getHour();
            if (hour < 10 || hour >= 20) return;

            String today = Game.today();
            SharedPreferences p = Store.prefs(c);
            if (today.equals(p.getString("nudgedOn", ""))) return;

            String last = Game.str(s, "lastTraining");
            if (last == null) last = Game.str(s, "created");
            if (last == null) return;
            // 2.27: training on hold (an injury): quiet until it's back, then count from then
            String quiet = Game.str(s, "trainQuiet");
            if (quiet != null) { if (today.compareTo(quiet) < 0) return; if (quiet.compareTo(last) > 0) last = quiet; }
            long gap = ChronoUnit.DAYS.between(LocalDate.parse(last), LocalDate.parse(today));
            if (gap < days) return;

            if (c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return;
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm == null) return;
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Training nudges", NotificationManager.IMPORTANCE_DEFAULT));

            Intent openI = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent open = PendingIntent.getActivity(c, 3, openI, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            String[] lines = {
                "The weights miss you.",
                "Been a few days.",
                "The pool is still there.",
            };
            Notification n = new Notification.Builder(c, CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat)
                    .setColor(0xFFC8B27A)
                    .setContentTitle(lines[(int) (gap % lines.length)])
                    .setContentText(gap + " days since you last trained. A swim, a lift or a run, even a short one.")
                    .setStyle(new Notification.BigTextStyle().bigText(gap + " days since you last trained. A swim, a lift or a run, even a short one."))
                    .setContentIntent(open)
                    .setAutoCancel(true)
                    .build();
            nm.notify(1, n);
            p.edit().putString("nudgedOn", today).apply();
        } catch (Exception e) {
            // A nudge is never worth crashing over.
        }
    }
}
