package vn.ghr.posprinter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class PrintStationKeepAliveService extends Service {
    private static final String CHANNEL_ID = "ghr_print_station";
    private static final int NOTIFICATION_ID = 30604;

    private PowerManager.WakeLock wakeLock;
    private PrintStationEngine printStationEngine;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireWakeLock();
        printStationEngine = new PrintStationEngine(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        if (printStationEngine == null) printStationEngine = new PrintStationEngine(this);
        printStationEngine.start();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (printStationEngine != null) {
            printStationEngine.stop();
            printStationEngine = null;
        }
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        return builder
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle("GHR Print Station \u0111ang b\u1eadt")
                .setContentText("C\u00f3 th\u1ec3 m\u1edf iPOS, l\u1ec7nh in t\u1eeb iPad v\u1eabn \u0111\u01b0\u1ee3c gi\u1eef k\u1ebft n\u1ed1i.")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "GHR Print Station",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Gi\u1eef tr\u1ea1m in bill ch\u1ea1y khi chuy\u1ec3n sang app kh\u00e1c.");

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager == null) return;
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GHR:PrintStation");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
        } catch (Exception ignored) {
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {
        }
    }
}
