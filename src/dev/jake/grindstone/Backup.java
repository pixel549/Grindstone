package dev.jake.grindstone;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Backups that outlive the app: the save as a .json in Downloads/Grindstone, which Android leaves alone when the app
 * is uninstalled. Written through MediaStore, so no storage permission is needed. Keeps the newest KEEP files.
 */
final class Backup {
    private Backup() {}
    static final String DIR = Environment.DIRECTORY_DOWNLOADS + "/Grindstone";
    static final int KEEP = 6;

    /** Returns "ok: <name>" or "error: ...". */
    static String write(Context c, String json, String name) {
        if (json == null || json.length() < 20) return "error: nothing to save";
        if (name == null || !name.matches("[A-Za-z0-9._-]{1,60}\\.json")) return "error: bad name";
        ContentResolver cr = c.getContentResolver();
        Uri col = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri uri = null;
        try {
            // same day twice: replace that day's file, not pile up copies
            for (long id : mine(c, name)) cr.delete(ContentUris.withAppendedId(col, id), null, null);
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, DIR);
            v.put(MediaStore.MediaColumns.IS_PENDING, 1);
            uri = cr.insert(col, v);
            if (uri == null) return "error: the phone would not make the file";
            try (OutputStream os = cr.openOutputStream(uri)) {
                if (os == null) throw new java.io.IOException("no stream");
                os.write(json.getBytes(StandardCharsets.UTF_8));
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            cr.update(uri, done, null, null);
            prune(c);
            return "ok: Downloads/Grindstone/" + name;
        } catch (Throwable e) {
            if (uri != null) try { cr.delete(uri, null, null); } catch (Throwable ignored) { /* nothing to tidy */ }
            return "error: " + e;
        }
    }

    /** Ids of this app's own backup files (newest first), or only those called `name`. */
    private static List<Long> mine(Context c, String name) {
        List<Long> out = new ArrayList<Long>();
        Uri col = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        String sel = MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?" + (name != null ? " AND " + MediaStore.MediaColumns.DISPLAY_NAME + "=?" : "");
        String[] args = name != null ? new String[]{DIR + "%", name} : new String[]{DIR + "%"};
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(col, new String[]{MediaStore.MediaColumns._ID}, sel, args, MediaStore.MediaColumns.DATE_ADDED + " DESC");
            while (cur != null && cur.moveToNext()) out.add(cur.getLong(0));
        } catch (Throwable e) {
            // nothing we can list; nothing to prune
        } finally {
            if (cur != null) cur.close();
        }
        return out;
    }

    private static void prune(Context c) {
        List<Long> ids = mine(c, null);
        Uri col = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        for (int i = KEEP; i < ids.size(); i++) {
            try { c.getContentResolver().delete(ContentUris.withAppendedId(col, ids.get(i)), null, null); } catch (Throwable e) { /* leave it */ }
        }
    }

    /** The text of a file the user picked (capped, so a wrong pick can't swamp the page). */
    static String read(Context c, Uri uri) {
        try (InputStream is = c.getContentResolver().openInputStream(uri)) {
            if (is == null) return null;
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n, total = 0;
            while ((n = is.read(buf)) > 0) { total += n; if (total > 8_000_000) return null; bo.write(buf, 0, n); }
            return new String(bo.toByteArray(), StandardCharsets.UTF_8);
        } catch (Throwable e) {
            return null;
        }
    }
}
