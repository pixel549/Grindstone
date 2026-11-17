package dev.jake.grindstone;

import android.content.Context;
import android.content.SharedPreferences;

/** The whole save is one JSON string. The previous save is kept as a safety net. */
final class Store {
    static final Object LOCK = new Object();

    private Store() {}

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("grindstone", Context.MODE_PRIVATE);
    }

    static String load(Context c) {
        synchronized (LOCK) {
            return prefs(c).getString("state", "");
        }
    }

    static void save(Context c, String json) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            String old = p.getString("state", null);
            SharedPreferences.Editor e = p.edit();
            if (old != null && !old.isEmpty()) e.putString("state_prev", old);
            e.putString("state", json);
            e.commit();
        }
    }
}
