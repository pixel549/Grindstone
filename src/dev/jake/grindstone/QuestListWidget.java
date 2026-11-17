package dev.jake.grindstone;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;
import android.widget.Toast;

import java.util.List;

import org.json.JSONException;
import org.json.JSONObject;

public class QuestListWidget extends AppWidgetProvider {
    static final String ACTION_COMPLETE = "dev.jake.grindstone.LIST_COMPLETE";
    static final String ACTION_REFRESH = "dev.jake.grindstone.LIST_REFRESH";
    static final String EXTRA_QID = "qid";

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { QuestWidget.updateAll(c); }

    @Override
    public void onEnabled(Context c) { Ticker.ensureScheduled(c); }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle opts) { QuestWidget.updateAll(c); }

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (ACTION_COMPLETE.equals(a)) {
            long qid = i.getLongExtra(EXTRA_QID, -1);
            if (qid >= 0) completeFromWidget(c, qid);
            return;
        }
        if (ACTION_REFRESH.equals(a)) { QuestWidget.updateAll(c); return; }
        super.onReceive(c, i);
    }

    static void completeFromWidget(Context c, long qid) {
        String msg = null;
        synchronized (Store.LOCK) {
            String raw = Store.load(c);
            if (raw.isEmpty()) return;
            try {
                JSONObject s = new JSONObject(raw);
                JSONObject r = Game.complete(s, qid, Game.today(), System.currentTimeMillis());
                if (r != null) {
                    Store.save(c, s.toString());
                    if (r.getInt("levels") > 0) {
                        msg = "LEVEL RISEN: " + r.getInt("level") + ". A coffer awaits.";
                    } else {
                        msg = "+" + r.getInt("xp") + " XP  ·  +" + r.getInt("gold") + " gold  ·  " + Game.statName(r.getString("stat"));
                    }
                }
            } catch (JSONException e) {
                msg = null;
            }
        }
        QuestWidget.updateAll(c);
        Ticker.checkRemind(c, true);   // the reminder note, if it's up, shows what's still left
        if (msg != null) Toast.makeText(c.getApplicationContext(), msg, Toast.LENGTH_SHORT).show();
    }

    static void updateList(Context c) {
        Ticker.scheduleMidnight(c);
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, QuestListWidget.class));
        if (ids == null || ids.length == 0) return;
        m.updateAppWidget(ids, build(c));
    }

    private static RemoteViews build(Context c) {
        String pkg = c.getPackageName();
        RemoteViews rv = new RemoteViews(pkg, R.layout.widget);

        Intent openI = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent open = PendingIntent.getActivity(c, 0, openI, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.w_header, open);
        rv.setOnClickPendingIntent(R.id.w_empty, open);

        JSONObject s = null;
        try {
            String raw = Store.load(c);
            if (!raw.isEmpty()) s = new JSONObject(raw);
        } catch (JSONException e) {
            s = null;
        }

        RemoteViews.RemoteCollectionItems.Builder items = new RemoteViews.RemoteCollectionItems.Builder()
                .setHasStableIds(true)
                .setViewTypeCount(1);

        if (s == null) {
            rv.setTextViewText(R.id.w_name, "Grindstone");
            rv.setTextViewText(R.id.w_title, "Tap to forge your hero");
            rv.setTextViewText(R.id.w_level, "LV 1");
            rv.setProgressBar(R.id.w_xp, 100, 0, false);
            rv.setTextViewText(R.id.w_meta, "");
            rv.setTextViewText(R.id.w_empty, "Open Grindstone to begin.");
        } else {
            String t = Game.today();
            int level = Math.max(1, s.optInt("level", 1)), xp = s.optInt("xp", 0), need = Game.need(level);
            JSONObject hero = s.optJSONObject("hero");
            String name = hero != null ? hero.optString("name", "Hero") : "Hero";
            String title = hero != null ? hero.optString("title", "") : "";
            rv.setTextViewText(R.id.w_name, name);
            rv.setTextViewText(R.id.w_title, title);
            rv.setTextViewText(R.id.w_level, "LV " + level);
            rv.setProgressBar(R.id.w_xp, need, Math.min(xp, need), false);
            int chests = s.optInt("chests", 0);
            StringBuilder meta = new StringBuilder();
            meta.append(xp).append('/').append(need).append(" XP     ◈ ").append(s.optInt("gold", 0)).append("     ✦ ").append(Game.shownStreak(s, t));
            if (chests > 0) meta.append("     ◆ ").append(chests).append(chests == 1 ? " coffer" : " coffers");
            rv.setTextViewText(R.id.w_meta, meta.toString());

            List<JSONObject> list = Game.widgetList(s, t);
            for (JSONObject q : list) {
                RemoteViews it = new RemoteViews(pkg, R.layout.widget_item);
                String stat = q.optString("stat", "DIS");
                it.setTextViewText(R.id.wi_icon, q.optString("icon", "•"));
                it.setTextViewText(R.id.wi_name, q.optString("name", ""));
                String tag = "+" + Game.XP[Game.diffIdx(q)];
                if ("habit".equals(q.optString("type")) && q.optInt("cap", 0) > 0) {
                    tag = Game.habitCount(q, t) + "/" + q.optInt("cap") + "   " + tag;
                }
                it.setTextViewText(R.id.wi_xp, tag);
                it.setInt(R.id.wi_bar, "setBackgroundColor", Game.statColor(stat));
                it.setInt(R.id.wi_check, "setColorFilter", Game.statColor(stat));
                Intent fill = new Intent();
                fill.putExtra(EXTRA_QID, q.optLong("id"));
                it.setOnClickFillInIntent(R.id.wi_root, fill);
                items.addItem(q.optLong("id"), it);
            }
            rv.setTextViewText(R.id.w_empty, "All deeds done today. Rest.");
        }

        rv.setRemoteAdapter(R.id.w_list, items.build());
        rv.setEmptyView(R.id.w_list, R.id.w_empty);
        Intent tmpl = new Intent(c, QuestListWidget.class).setAction(ACTION_COMPLETE);
        PendingIntent pt = PendingIntent.getBroadcast(c, 1, tmpl, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        rv.setPendingIntentTemplate(R.id.w_list, pt);
        return rv;
    }
}
