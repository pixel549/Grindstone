package dev.jake.grindstone;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The hearth widget: a looping close-up of the hero in the house (frames rendered by the app or by WidgetCam),
 * the hero's name and level, and three omens: what's gone longest untended, or what's been going well.
 * (Class name kept from the old quest-list widget so a widget already on the home screen becomes this one.)
 */
public class QuestWidget extends AppWidgetProvider {
    /** 2.9: shelved. The receiver is disabled in the manifest; this stops the filming and the loop alarm too. */
    static final boolean ENABLED = false;
    static final int[][] CHIP = {
        {R.id.w_c1, R.id.w_c1_l, R.id.w_c1_v}, {R.id.w_c2, R.id.w_c2_l, R.id.w_c2_v}, {R.id.w_c3, R.id.w_c3_l, R.id.w_c3_v}};

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        WidgetStore.prefs(c).edit().putLong("applied", 0).apply(); // fresh hosts need the frames again
        updateAll(c);
        WidgetCam.maybeRequest(c, WidgetCam.STALE_TICK);
    }

    @Override
    public void onEnabled(Context c) { Ticker.ensureScheduled(c); }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle opts) {
        WidgetStore.prefs(c).edit().putLong("applied", 0).apply();
        updateAll(c);
    }

    static boolean placed(Context c) {
        int[] ids = AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, QuestWidget.class));
        return ids != null && ids.length > 0;
    }

    /** A full redraw even if the clip hasn't changed: rebuilds the flipper, which restarts a loop that has stalled. */
    static void kick(Context c) {
        WidgetStore.prefs(c).edit().putLong("applied", 0).apply();
        updateAll(c);
    }

    /**
     * Refreshes every Grindstone widget. Frames are only re-sent when there's a new clip; otherwise just the words change.
     * Returns null if all went well (or there's no widget), else what the launcher objected to.
     */
    static String updateAll(Context c) {
        Ticker.scheduleMidnight(c);
        QuestListWidget.updateList(c);
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, QuestWidget.class));
        if (ids == null || ids.length == 0) return null;
        SharedPreferences p = WidgetStore.prefs(c);
        long ver = p.getLong("ver", 0);
        try {
            if (ver != 0 && ver == p.getLong("applied", -1)) {
                m.partiallyUpdateAppWidget(ids, build(c, false));
            } else {
                // Two identical layouts, used turn about. A different layout makes the launcher build the views afresh
                // rather than patch the old ones, so a flipper that stopped (they pause on screen-off) starts again.
                boolean alt = !p.getBoolean("alt", false);
                p.edit().putBoolean("alt", alt).apply();
                m.updateAppWidget(ids, build(c, true));
                p.edit().putLong("applied", ver).apply();
            }
            return null;
        } catch (Throwable e) {
            // a launcher hiccup is not worth crashing over; next update tries again
            p.edit().putLong("applied", 0).apply();
            return String.valueOf(e);
        }
    }

    private static RemoteViews build(Context c, boolean full) {
        String pkg = c.getPackageName();
        RemoteViews rv = new RemoteViews(pkg, WidgetStore.prefs(c).getBoolean("alt", false) ? R.layout.widget_hearth_b : R.layout.widget_hearth);
        Intent openI = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("goto", "hearth:");
        rv.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 11, openI, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Intent todayI = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("goto", "quests:today");
        rv.setOnClickPendingIntent(R.id.w_chips, PendingIntent.getActivity(c, 12, todayI, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        if (full) {
            SharedPreferences p = WidgetStore.prefs(c);
            long ver = p.getLong("ver", 0);
            int n = p.getInt("n", 0);
            rv.removeAllViews(R.id.w_flip);
            if (ver != 0 && n > 1) {
                for (int i = 0; i < n; i++) {
                    RemoteViews f = new RemoteViews(pkg, R.layout.w_frame);
                    f.setImageViewUri(R.id.w_f, WidgetStore.frameUri(ver, i));
                    rv.addView(R.id.w_flip, f);
                }
                rv.setInt(R.id.w_flip, "setFlipInterval", p.getInt("interval", 110));
                rv.setViewVisibility(R.id.w_empty, View.GONE);
            } else {
                rv.setViewVisibility(R.id.w_empty, View.VISIBLE);
            }
        }

        String raw = Store.load(c);
        if (raw.isEmpty()) {
            rv.setTextViewText(R.id.w_name, "GRINDSTONE");
            rv.setTextViewText(R.id.w_mode, "");
            for (int[] ch : CHIP) rv.setViewVisibility(ch[0], View.INVISIBLE);
            return rv;
        }
        try {
            JSONObject s = new JSONObject(raw);
            JSONObject hero = s.optJSONObject("hero");
            String name = hero != null ? hero.optString("name", "") : "";
            int level = Math.max(1, s.optInt("level", 1)), xp = s.optInt("xp", 0), need = Game.need(level);
            rv.setTextViewText(R.id.w_name, (name.isEmpty() ? "" : name.toUpperCase() + "  ·  ") + "LV " + level);
            rv.setProgressBar(R.id.w_xp, need, Math.min(need, xp), false);
            JSONObject om = Omens.compute(s, Game.today());
            boolean slack = "slack".equals(om.optString("mode"));
            rv.setTextViewText(R.id.w_mode, slack ? "NEEDS TENDING" : "THRIVING");
            rv.setTextColor(R.id.w_mode, slack ? 0xFFC0414C : 0xFFC8B27A);
            JSONArray items = om.optJSONArray("items");
            for (int i = 0; i < CHIP.length; i++) {
                JSONObject it = items != null ? items.optJSONObject(i) : null;
                if (it == null) { rv.setViewVisibility(CHIP[i][0], View.INVISIBLE); continue; }
                rv.setViewVisibility(CHIP[i][0], View.VISIBLE);
                rv.setTextViewText(CHIP[i][1], it.optString("icon") + "  " + it.optString("label"));
                rv.setTextViewText(CHIP[i][2], it.optString("value"));
                String tone = it.optString("tone");
                int col = "bad".equals(tone) ? 0xFFC0414C : "warn".equals(tone) ? 0xFFC98A3A : "good".equals(tone) ? 0xFFE9D7A6 : 0xFFECE4CF;
                rv.setTextColor(CHIP[i][2], col);
            }
        } catch (Exception e) {
            rv.setTextViewText(R.id.w_mode, "");
        }
        return rv;
    }
}
