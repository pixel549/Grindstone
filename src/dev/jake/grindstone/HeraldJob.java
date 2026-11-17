package dev.jake.grindstone;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Runs when the phone's calendar changes (e.g. Google syncs down a deed Claude logged), then re-arms itself. */
public class HeraldJob extends JobService {
    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Herald.onCalendarChanged(getApplicationContext());
                } finally {
                    // Re-arming with the same id replaces this run (per JobInfo docs); only finish by hand if we didn't.
                    if (!Herald.scheduleJob(getApplicationContext())) jobFinished(params, false);
                }
            }
        }, "herald").start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }
}
