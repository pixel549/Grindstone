package dev.jake.grindstone;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Runs WidgetCam on the main thread (WebViews must live there) and finishes when it's done or gives up. */
public class WidgetCamJob extends JobService {
    @Override
    public boolean onStartJob(JobParameters params) {
        if (MainActivity.live != null) return false; // the app is open and will refresh the clip itself
        WidgetCam.start(this, params, new WidgetCam.Finisher() {
            @Override
            public void finish(JobParameters p) { jobFinished(p, false); }
        });
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) { return false; }
}
