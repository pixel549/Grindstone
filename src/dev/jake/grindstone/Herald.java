package dev.jake.grindstone;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * The herald: reads the "Grindstone" calendar on the phone (which Google syncs down from Claude's entries)
 * and ticks the matching quests off. Runs when the calendar changes (a content-triggered job), every couple of
 * hours from the Ticker, and whenever the app opens.
 */
final class Herald {
    private Herald() {}

    static final String READ = "android.permission.READ_CALENDAR", WRITE = "android.permission.WRITE_CALENDAR";
    static final String DEFAULT_NAME = "Grindstone";
    static final int JOB_ID = 4711;
    private static final String CHANNEL = "herald";
    private static final long HOUR = 3600 * 1000L;

    static boolean permitted(Context c) { return c.checkSelfPermission(READ) == PackageManager.PERMISSION_GRANTED; }
    static boolean canWrite(Context c) { return c.checkSelfPermission(WRITE) == PackageManager.PERMISSION_GRANTED; }

    /** Calendars on the phone: [{id, name, account, sync, visible}] */
    static JSONArray calendars(Context c) {
        JSONArray out = new JSONArray();
        if (!permitted(c)) return out;
        String[] proj = {CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, CalendarContract.Calendars.ACCOUNT_NAME,
                CalendarContract.Calendars.SYNC_EVENTS, CalendarContract.Calendars.VISIBLE};
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, proj, null, null, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME);
            while (cur != null && cur.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("id", cur.getLong(0));
                o.put("name", cur.getString(1) == null ? "" : cur.getString(1));
                o.put("account", cur.getString(2) == null ? "" : cur.getString(2));
                o.put("sync", cur.getInt(3) != 0);
                o.put("visible", cur.getInt(4) != 0);
                out.put(o);
            }
        } catch (Exception e) {
            // no provider, or permission pulled mid-query
        } finally {
            if (cur != null) cur.close();
        }
        return out;
    }

    static long findByName(Context c, String name) {
        JSONArray cals = calendars(c);
        for (int i = 0; i < cals.length(); i++) {
            JSONObject o = cals.optJSONObject(i);
            if (o != null && name.equalsIgnoreCase(o.optString("name").trim())) return o.optLong("id");
        }
        return -1;
    }

    /** New Google calendars often arrive with sync switched off; this flips it on (apps may write SYNC_EVENTS). */
    static boolean enableSync(Context c, long id) {
        if (!canWrite(c)) return false;
        try {
            ContentValues v = new ContentValues();
            v.put(CalendarContract.Calendars.SYNC_EVENTS, 1);
            return c.getContentResolver().update(Uri.withAppendedPath(CalendarContract.Calendars.CONTENT_URI, String.valueOf(id)), v, null, null) > 0;
        } catch (Exception e) {
            return false;
        }
    }

    static List<HeraldCore.Ev> events(Context c, long cal, long from, long to) {
        List<HeraldCore.Ev> out = new ArrayList<HeraldCore.Ev>();
        String[] proj = {CalendarContract.Events.TITLE, CalendarContract.Events.DTSTART, CalendarContract.Events.RRULE, CalendarContract.Events.DESCRIPTION};
        String sel = CalendarContract.Events.CALENDAR_ID + "=? AND " + CalendarContract.Events.DTSTART + ">=? AND "
                + CalendarContract.Events.DTSTART + "<=? AND " + CalendarContract.Events.DELETED + "=0";
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(CalendarContract.Events.CONTENT_URI, proj, sel,
                    new String[]{String.valueOf(cal), String.valueOf(from), String.valueOf(to)}, CalendarContract.Events.DTSTART + " ASC");
            while (cur != null && cur.moveToNext()) {
                String title = cur.getString(0);
                long start = cur.getLong(1);
                if (title == null || title.trim().isEmpty() || cur.getString(2) != null) continue; // repeating events aren't deeds
                String desc = cur.getString(3);
                if (desc != null && desc.startsWith(LOGGED)) continue; // written by the app itself (2.9): already counted
                // keyed on time + title, not the row id: a calendar resync gives events new ids but not new times
                out.add(new HeraldCore.Ev(start + "|" + title.trim(), title, start));
            }
        } catch (Exception e) {
            // ignore; next pass will try again
        } finally {
            if (cur != null) cur.close();
        }
        return out;
    }

    /** Shifts from the roster calendar: [{t: title, s: start ms, e: end ms, a: all day}] between two times. Repeats included. */
    static JSONArray roster(Context c, long cal, long from, long to) { return roster(c, cal, from, to, 400); }

    static JSONArray roster(Context c, long cal, long from, long to, int max) {
        JSONArray out = new JSONArray();
        if (!permitted(c)) return out;
        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        android.content.ContentUris.appendId(b, from);
        android.content.ContentUris.appendId(b, to);
        String[] proj = {CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN, CalendarContract.Instances.END, CalendarContract.Instances.ALL_DAY};
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(b.build(), proj, CalendarContract.Instances.CALENDAR_ID + "=?", new String[]{String.valueOf(cal)}, CalendarContract.Instances.BEGIN + " ASC");
            while (cur != null && cur.moveToNext() && out.length() < max) {
                JSONObject o = new JSONObject();
                o.put("t", cur.getString(0) == null ? "" : cur.getString(0));
                o.put("s", cur.getLong(1));
                o.put("e", cur.getLong(2));
                o.put("a", cur.getInt(3) != 0);
                out.put(o);
            }
        } catch (Exception e) {
            // no provider, or permission pulled mid-query
        } finally {
            if (cur != null) cur.close();
        }
        return out;
    }

    /** Marks an event the app wrote itself, so the herald never reads it back as a second deed. */
    static final String LOGGED = "Logged in Grindstone";

    /** 2.9: a deed ticked in the app, written to the calendar so other things that read it can see. Returns the event id, or -1. */
    static long write(Context c, long cal, String title, long start) {
        if (!canWrite(c) || cal < 0 || title == null || title.trim().isEmpty()) return -1;
        try {
            android.content.ContentValues v = new android.content.ContentValues();
            v.put(CalendarContract.Events.CALENDAR_ID, cal);
            v.put(CalendarContract.Events.TITLE, title.trim());
            v.put(CalendarContract.Events.DTSTART, start);
            v.put(CalendarContract.Events.DTEND, start + 15 * 60 * 1000L);
            v.put(CalendarContract.Events.EVENT_TIMEZONE, java.util.TimeZone.getDefault().getID());
            v.put(CalendarContract.Events.DESCRIPTION, LOGGED);
            v.put(CalendarContract.Events.HAS_ALARM, 0);
            Uri u = c.getContentResolver().insert(CalendarContract.Events.CONTENT_URI, v);
            return u == null ? -1 : android.content.ContentUris.parseId(u);
        } catch (Exception e) {
            return -1;
        }
    }

    /** Takes back an event the app wrote (an undo). Only ever its own. */
    static boolean unwrite(Context c, long id) {
        if (!canWrite(c) || id < 0) return false;
        try {
            Uri u = android.content.ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id);
            return c.getContentResolver().delete(u, CalendarContract.Events.DESCRIPTION + " LIKE ?", new String[]{LOGGED + "%"}) > 0;
        } catch (Exception e) {
            return false;
        }
    }

    static boolean isOn(Context c) {
        try {
            String raw = Store.load(c);
            if (raw.isEmpty()) return false;
            JSONObject h = new JSONObject(raw).optJSONObject("herald");
            return h != null && h.optBoolean("on", false);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Reads the calendar and credits new deeds. live = the app is open and asking (it shows its own toast).
     * Returns the HeraldCore summary, or null if nothing changed.
     */
    static JSONObject sync(Context c, boolean live) {
        if (!permitted(c)) return null;
        JSONObject r = null;
        boolean notify = false;
        synchronized (Store.LOCK) {
            try {
                String raw = Store.load(c);
                if (raw.isEmpty()) return null;
                JSONObject s = new JSONObject(raw);
                JSONObject h = s.optJSONObject("herald");
                if (h == null || !h.optBoolean("on", false)) return null;
                boolean dirty = false;
                long cal = h.optLong("cal", -1);
                if (cal < 0) {
                    cal = findByName(c, DEFAULT_NAME);
                    if (cal < 0) return null;
                    h.put("cal", cal);
                    h.put("calName", DEFAULT_NAME);
                    dirty = true;
                }
                long now = System.currentTimeMillis();
                long since = h.optLong("since", now);
                long from = Math.max(since - 12 * HOUR, now - 72 * HOUR), to = now + 3 * HOUR;
                r = HeraldCore.apply(s, events(c, cal, from, to), now, Game.today(), live);
                if (r != null || dirty) Store.save(c, s.toString());
                notify = h.optBoolean("notify", true);
            } catch (Exception e) {
                return null;
            }
        }
        if (r != null && !live && r.optInt("unclaimed") > 0) interpretPending(c, r);
        if (r != null) {
            QuestWidget.updateAll(c);
            if (!live) {
                if (notify) notifyNews(c, r);
                WidgetCam.maybeRequest(c, WidgetCam.STALE_HERALD);
            }
        }
        return r;
    }

    /**
     * App closed: let the interpreter (if set up) try to place what the matcher couldn't. Each report is only
     * tried once; whatever it can't place stays on Today for Jake. Folds its credits into r for the notification.
     */
    static void interpretPending(Context c, JSONObject r) {
        if (!Interpreter.ready(c)) return;
        JSONArray reports = new JSONArray(), quests;
        try {
            synchronized (Store.LOCK) {
                JSONObject s = new JSONObject(Store.load(c));
                JSONArray un = s.getJSONObject("herald").optJSONArray("unclaimed");
                if (un == null) return;
                long now = System.currentTimeMillis();
                for (int i = 0; i < un.length() && reports.length() < 8; i++) {
                    JSONObject u = un.getJSONObject(i);
                    if (u.has("tried")) continue;
                    u.put("tried", now);
                    reports.put(new JSONObject().put("k", u.optString("k")).put("text", u.optString("text")));
                }
                if (reports.length() == 0) return;
                quests = Interpreter.questList(s);
                Store.save(c, s.toString());
            }
            JSONObject map = Interpreter.resolve(c, reports, quests); // network, outside the lock
            if (map == null || map.length() == 0) return;
            synchronized (Store.LOCK) {
                JSONObject s = new JSONObject(Store.load(c));
                JSONArray done = r.optJSONArray("done");
                if (done == null) { done = new JSONArray(); r.put("done", done); }
                int placed = 0;
                java.util.Iterator<String> it = map.keys();
                while (it.hasNext()) {
                    String k = it.next();
                    JSONObject d = HeraldCore.claim(s, k, map.getLong(k), true, Game.today(), System.currentTimeMillis());
                    if (d == null) continue;
                    placed++;
                    done.put(d);
                    r.put("xp", r.optInt("xp") + d.optInt("xp"));
                    r.put("gold", r.optInt("gold") + d.optInt("gold"));
                    r.put("levels", r.optInt("levels") + d.optInt("levels"));
                    r.put("level", d.optInt("level"));
                }
                r.put("unclaimed", Math.max(0, r.optInt("unclaimed") - placed));
                // the queued news item for this pass should say the same
                JSONObject h = s.getJSONObject("herald");
                JSONArray news = h.optJSONArray("news");
                if (news != null && news.length() > 0) {
                    JSONObject last = news.getJSONObject(news.length() - 1);
                    for (String f : new String[]{"done", "xp", "gold", "levels", "level", "unclaimed"}) last.put(f, r.get(f));
                }
                Store.save(c, s.toString());
            }
        } catch (Exception e) {
            // the reports simply wait on Today
        }
    }

    private static void notifyNews(Context c, JSONObject r) {
        try {
            if (c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return;
            String line = HeraldCore.summary(r);
            int un = r.optInt("unclaimed");
            if (line.isEmpty() && un == 0) return;
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm == null) return;
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Herald (deeds from Claude)", NotificationManager.IMPORTANCE_LOW));
            String title = r.optInt("levels") > 0 ? "Level risen: " + r.optInt("level") + ". A coffer awaits."
                    : line.isEmpty() ? "From your calendar" : "+" + r.optInt("xp") + " XP · +" + r.optInt("gold") + " gold";
            String text = line.isEmpty() ? "" : line;
            if (un > 0) text += (text.isEmpty() ? "" : "\n") + un + (un == 1 ? " report needs" : " reports need") + " a quest. Tap to assign.";
            Intent openI = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent open = PendingIntent.getActivity(c, 5, openI, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification n = new Notification.Builder(c, CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat)
                    .setColor(0xFFC8B27A)
                    .setContentTitle(title)
                    .setContentText(text.replace('\n', ' '))
                    .setStyle(new Notification.BigTextStyle().bigText(text))
                    .setContentIntent(open)
                    .setAutoCancel(true)
                    .build();
            nm.notify(2, n);
        } catch (Exception e) {
            // never worth crashing over
        }
    }

    /** One-shot job that fires when anything in the calendar provider changes. HeraldJob re-arms it after each run. */
    static boolean scheduleJob(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js == null) return false;
        if (!permitted(c) || !isOn(c)) { js.cancel(JOB_ID); return false; }
        try {
            JobInfo ji = new JobInfo.Builder(JOB_ID, new ComponentName(c, HeraldJob.class))
                    .addTriggerContentUri(new JobInfo.TriggerContentUri(CalendarContract.CONTENT_URI, JobInfo.TriggerContentUri.FLAG_NOTIFY_FOR_DESCENDANTS))
                    .setTriggerContentUpdateDelay(4000)
                    .setTriggerContentMaxDelay(60000)
                    .build();
            return js.schedule(ji) == JobScheduler.RESULT_SUCCESS;
        } catch (Exception e) {
            return false; // the 2-hourly tick still covers us
        }
    }

    static void cancelJob(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js != null) js.cancel(JOB_ID);
    }

    /** From the job or the tick: if the app is open, let it pull (so its in-memory state can't clobber ours). */
    static void onCalendarChanged(Context c) {
        MainActivity a = MainActivity.live;
        if (a != null) a.heraldPoll();
        else sync(c, false);
    }
}
