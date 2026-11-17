package dev.jake.grindstone;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Handler;
import android.os.Looper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.function.Consumer;

import org.json.JSONObject;

/** The daily delve from the phone's side. When the app is shut it starts the solo run, at the fallback time or when
 *  it notices you've left home, by leaving a "pending" note in the save. The page plays the run out next time it opens. */
public class Delve {
    static final String ACTION = "dev.jake.grindstone.DELVE";
    static final String FINE = "android.permission.ACCESS_FINE_LOCATION";
    static final String COARSE = "android.permission.ACCESS_COARSE_LOCATION";
    static final String BG = "android.permission.ACCESS_BACKGROUND_LOCATION";
    private static final String CHANNEL = "delve";

    static boolean granted(Context c, String p) { return c.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED; }

    /** Where home is lives in its own prefs file, out of the save and out of backups. */
    static android.content.SharedPreferences homePrefs(Context c) { return c.getSharedPreferences("away", Context.MODE_PRIVATE); }
    static void setHome(Context c, double lat, double lng) { homePrefs(c).edit().putString("lat", Double.toString(lat)).putString("lng", Double.toString(lng)).apply(); }
    static void forgetHome(Context c) { homePrefs(c).edit().clear().apply(); }

    private static PendingIntent pi(Context c, int flags) {
        Intent i = new Intent(c, Ticker.class).setAction(ACTION);
        return PendingIntent.getBroadcast(c, 77, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static JSONObject delve(JSONObject s) { return s == null ? null : s.optJSONObject("delve"); }

    /** An alarm at the next fallback time (8 pm unless changed). */
    static void schedule(Context c) {
        try {
            String at = "20:00";
            String raw = Store.load(c);
            if (!raw.isEmpty()) { JSONObject d = delve(new JSONObject(raw)); if (d != null) at = d.optString("autoAt", at); }
            String[] p = at.split(":");
            LocalTime t = LocalTime.of(Integer.parseInt(p[0]), Integer.parseInt(p[1]));
            LocalDateTime when = LocalDate.now().atTime(t);
            if (!when.isAfter(LocalDateTime.now())) when = when.plusDays(1);
            long ms = when.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() + 30_000L;
            AlarmManager am = c.getSystemService(AlarmManager.class);
            if (am != null) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi(c, PendingIntent.FLAG_UPDATE_CURRENT));
        } catch (Exception e) {
            // a missed alarm just means the next tick or app open catches it
        }
    }

    /** Is the fallback time already past today, with no run taken? (Catches a missed alarm on the next tick.) */
    static boolean overdue(Context c) {
        try {
            String raw = Store.load(c);
            if (raw.isEmpty()) return false;
            JSONObject d = delve(new JSONObject(raw));
            if (d == null || Game.today().equals(Game.str(d, "day")) || d.optJSONObject("pending") != null) return false;
            String[] p = d.optString("autoAt", "20:00").split(":");
            return !LocalTime.now().isBefore(LocalTime.of(Integer.parseInt(p[0]), Integer.parseInt(p[1])));
        } catch (Exception e) {
            return false;
        }
    }

    /** Starts today's run without you, if there's still one to take. The open app handles its own. */
    static boolean begin(Context c, String why) {
        if (MainActivity.live != null) return false;
        String hero = "Your hero", where = "the dungeon";
        try {
            synchronized (Store.LOCK) {
                String raw = Store.load(c);
                if (raw.isEmpty()) return false;
                JSONObject s = new JSONObject(raw);
                JSONObject d = delve(s);
                if (d == null) return false;
                String today = Game.today();
                if (today.equals(Game.str(d, "day")) || d.optJSONObject("pending") != null) return false;
                // 2.22: one new dungeon a day; after a clear the next one opens tomorrow (dates compare as text: yyyy-MM-dd)
                String opens = Game.str(d, "opens");
                if (opens != null && !opens.isEmpty() && today.compareTo(opens) < 0) return false;
                JSONObject p = new JSONObject();
                p.put("t", System.currentTimeMillis());
                p.put("day", today);
                JSONObject eq = s.optJSONObject("eq");
                p.put("eq", eq == null ? new JSONObject() : new JSONObject(eq.toString()));
                p.put("answers", new JSONObject());
                p.put("manual", false);
                p.put("why", why);
                d.put("pending", p);
                d.put("day", today);
                Store.save(c, s.toString());
                JSONObject h = s.optJSONObject("hero");
                if (h != null && !h.optString("name", "").isEmpty()) hero = h.optString("name");
                if (!d.optString("curName", "").isEmpty()) where = d.optString("curName");
            }
        } catch (Exception e) {
            return false;
        }
        notifyStart(c, hero, where, why);
        QuestWidget.updateAll(c);
        return true;
    }

    private static void notifyStart(Context c, String hero, String where, String why) {
        try {
            if (!granted(c, "android.permission.POST_NOTIFICATIONS")) return;
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm == null) return;
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "The delve", NotificationManager.IMPORTANCE_DEFAULT));
            Intent openI = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("goto", "delve:run");
            PendingIntent open = PendingIntent.getActivity(c, 7, openI, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            String body = ("away".equals(why) ? "You've left home, so " + hero + " has gone into " : hero + " got sick of waiting and went into ") + where + " alone. Open Grindstone to see how he fared.";
            Notification n = new Notification.Builder(c, CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat)
                    .setColor(0xFFC8B27A)
                    .setContentTitle(hero + " has set out")
                    .setContentText(body)
                    .setStyle(new Notification.BigTextStyle().bigText(body))
                    .setContentIntent(open)
                    .setAutoCancel(true)
                    .build();
            nm.notify(7, n);
        } catch (Exception e) {
            // the run still happened; the page will show it
        }
    }

    /** Every couple of hours, if the away check is on: out of the home radius means he goes. Finishes pr when done. */
    static void checkAway(final Context c, final BroadcastReceiver.PendingResult pr) {
        boolean async = false;
        try {
            if (MainActivity.live != null || !granted(c, FINE) || !granted(c, BG)) return;
            String raw = Store.load(c);
            if (raw.isEmpty()) return;
            JSONObject d = delve(new JSONObject(raw));
            if (d == null || Game.today().equals(Game.str(d, "day")) || d.optJSONObject("pending") != null) return;
            JSONObject away = d.optJSONObject("away");
            if (away == null || !away.optBoolean("on", false)) return;
            android.content.SharedPreferences hp = homePrefs(c);
            if (!hp.contains("lat")) return;
            final double hLat = Double.parseDouble(hp.getString("lat", "0")), hLng = Double.parseDouble(hp.getString("lng", "0"));
            final double r = Math.max(100, away.optDouble("r", 300));
            int hour = LocalTime.now().getHour();
            if (hour < 6 || hour >= 22) return;
            LocationManager lm = c.getSystemService(LocationManager.class);
            if (lm == null) return;
            Location best = lastKnown(lm);
            if (best != null && System.currentTimeMillis() - best.getTime() < 45 * 60_000L) {
                if (dist(hLat, hLng, best.getLatitude(), best.getLongitude()) > r + best.getAccuracy()) begin(c, "away");
                return;
            }
            String prov = lm.getAllProviders().contains("fused") ? "fused" : LocationManager.NETWORK_PROVIDER;
            final Handler h = new Handler(Looper.getMainLooper());
            final boolean[] done = { false };
            final Runnable finish = new Runnable() { @Override public void run() { if (!done[0]) { done[0] = true; if (pr != null) pr.finish(); } } };
            lm.getCurrentLocation(prov, null, c.getMainExecutor(), new Consumer<Location>() {
                @Override
                public void accept(Location l) {
                    try {
                        if (l != null && dist(hLat, hLng, l.getLatitude(), l.getLongitude()) > r + l.getAccuracy()) begin(c, "away");
                    } finally { finish.run(); }
                }
            });
            h.postDelayed(finish, 25_000L);
            async = true;
        } catch (Exception e) {
            // no fix this time; there's always the fallback
        } finally {
            if (!async && pr != null) pr.finish();
        }
    }

    static Location lastKnown(LocationManager lm) {
        Location best = null;
        List<String> ps = lm.getAllProviders();
        for (String p : new String[]{ "fused", LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER }) {
            if (!ps.contains(p)) continue;
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (SecurityException e) {
                return null;
            }
        }
        return best;
    }

    /** One fix for the page ("set home here"). */
    static void here(Context c, final Consumer<Location> out) {
        try {
            LocationManager lm = c.getSystemService(LocationManager.class);
            if (lm == null || !granted(c, FINE)) { out.accept(null); return; }
            Location best = lastKnown(lm);
            if (best != null && System.currentTimeMillis() - best.getTime() < 5 * 60_000L && best.getAccuracy() < 80) { out.accept(best); return; }
            String prov = lm.getAllProviders().contains("fused") ? "fused" : LocationManager.GPS_PROVIDER;
            final boolean[] done = { false };
            final Location fb = best;
            lm.getCurrentLocation(prov, null, c.getMainExecutor(), new Consumer<Location>() {
                @Override
                public void accept(Location l) { if (!done[0]) { done[0] = true; out.accept(l != null ? l : fb); } }
            });
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() { if (!done[0]) { done[0] = true; out.accept(fb); } }
            }, 20_000L);
        } catch (Exception e) {
            out.accept(null);
        }
    }

    static double dist(double a1, double o1, double a2, double o2) {
        double R = 6371000, dA = Math.toRadians(a2 - a1), dO = Math.toRadians(o2 - o1);
        double h = Math.sin(dA / 2) * Math.sin(dA / 2) + Math.cos(Math.toRadians(a1)) * Math.cos(Math.toRadians(a2)) * Math.sin(dO / 2) * Math.sin(dO / 2);
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }
}
