package dev.jake.grindstone;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.List;

/**
 * Hands the widget's frames to the launcher (which runs in another process). Read-only, and it serves nothing
 * but files/wframes/<digits>/fNN.jpg.
 */
public class FrameProvider extends ContentProvider {
    @Override
    public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (mode == null || !mode.startsWith("r") || mode.contains("w")) throw new FileNotFoundException("read only");
        List<String> seg = uri.getPathSegments();
        if (seg.size() != 2 || !seg.get(0).matches("\\d{1,15}") || !seg.get(1).matches("f\\d{2}\\.jpg")) throw new FileNotFoundException(uri.toString());
        File f = new File(new File(WidgetStore.root(getContext()), seg.get(0)), seg.get(1));
        if (!f.isFile()) throw new FileNotFoundException(uri.toString());
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) { return "image/jpeg"; }

    @Override
    public Cursor query(Uri uri, String[] p, String s, String[] a, String o) { return null; }

    @Override
    public Uri insert(Uri uri, ContentValues v) { return null; }

    @Override
    public int delete(Uri uri, String s, String[] a) { return 0; }

    @Override
    public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
