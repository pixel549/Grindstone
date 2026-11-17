package dev.jake.grindstone;

import android.app.Presentation;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Renders a fresh widget clip while the app is closed. A WebView runs the 3D page on a private, invisible
 * virtual display (nothing appears on screen), hands back the frames, and is torn down. Best effort: if
 * anything about it fails, the widget keeps its last clip and the app refreshes it next time it's opened.
 */
final class WidgetCam {
    static final int JOB_ID = 4712, W = 540, H = 240;
    static final long STALE_TICK = 45 * 60 * 1000L, STALE_HERALD = 10 * 60 * 1000L, TIMEOUT = 45 * 1000L;

    private final Context ctx;
    private final JobParameters params;
    private final Finisher finisher;
    private final Handler h = new Handler(Looper.getMainLooper());
    private ImageReader reader;
    private VirtualDisplay display;
    private Presentation pres;
    private WebView web;
    private boolean finished;

    interface Finisher { void finish(JobParameters p); }

    private WidgetCam(Context c, JobParameters p, Finisher f) { ctx = c; params = p; finisher = f; }

    /** Queue a background render if a hearth widget is placed, the app isn't open, and the clip is older than maxAge. */
    static void maybeRequest(Context c, long maxAge) {
        try {
            if (!QuestWidget.ENABLED || !QuestWidget.placed(c) || MainActivity.live != null) return;
            if (WidgetStore.age(c) < maxAge) return;
            if (Store.load(c).isEmpty()) return;
            JobScheduler js = c.getSystemService(JobScheduler.class);
            if (js == null || js.getPendingJob(JOB_ID) != null) return;
            js.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(c, WidgetCamJob.class))
                    .setRequiresBatteryNotLow(true)
                    .setOverrideDeadline(20 * 60 * 1000L)
                    .build());
        } catch (Exception e) {
            // no render this time
        }
    }

    static void start(Context c, JobParameters p, Finisher f) { new WidgetCam(c, p, f).run(); }

    private void run() {
        try {
            reader = ImageReader.newInstance(W, H, PixelFormat.RGBA_8888, 2);
            reader.setOnImageAvailableListener(new ImageReader.OnImageAvailableListener() {
                @Override
                public void onImageAvailable(ImageReader r) {
                    Image im = r.acquireLatestImage(); // nobody looks at these; just keep the queue moving
                    if (im != null) im.close();
                }
            }, h);
            DisplayManager dm = ctx.getSystemService(DisplayManager.class);
            display = dm.createVirtualDisplay("grindstone-widget", W, H, 160, reader.getSurface(), 0); // private to us
            pres = new Presentation(ctx, display.getDisplay());
            web = new WebView(pres.getContext());
            WebSettings ws = web.getSettings();
            ws.setJavaScriptEnabled(true);
            ws.setDomStorageEnabled(true);
            web.addJavascriptInterface(new Bridge(), "Native");
            web.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }

                @Override
                public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                    Uri u = r.getUrl();
                    return Assets.HOST.equals(u.getHost()) ? Assets.respond(ctx, u.getPath()) : null;
                }

                @Override
                public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                    web = null; // already dead; don't touch it again
                    finish();
                    return true; // don't take the app down with it
                }
            });
            pres.setContentView(web, new ViewGroup.LayoutParams(W, H));
            pres.show();
            web.loadUrl(Assets.ORIGIN + "widgetcam.html");
            h.postDelayed(new Runnable() { @Override public void run() { finish(); } }, TIMEOUT);
        } catch (Throwable t) {
            finish();
        }
    }

    private void finish() {
        if (finished) return;
        finished = true;
        h.removeCallbacksAndMessages(null);
        try { if (web != null) { web.stopLoading(); web.destroy(); } } catch (Throwable t) { /* ignore */ }
        try { if (pres != null) pres.dismiss(); } catch (Throwable t) { /* ignore */ }
        try { if (display != null) display.release(); } catch (Throwable t) { /* ignore */ }
        try { if (reader != null) reader.close(); } catch (Throwable t) { /* ignore */ }
        web = null; pres = null; display = null; reader = null;
        finisher.finish(params);
    }

    /** What widgetcam.html can call. */
    final class Bridge {
        @JavascriptInterface
        public String load() { return Store.load(ctx); }

        @JavascriptInterface
        public boolean frames(String json) { return WidgetStore.save(ctx, json); }

        @JavascriptInterface
        public void done() { h.post(new Runnable() { @Override public void run() { finish(); } }); }

        @JavascriptInterface
        public void log(String m) { android.util.Log.i("GrindstoneCam", String.valueOf(m)); }
    }
}
