package vn.ghr.posmobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import com.facebook.react.HeadlessJsTaskService;

public class PosPrintStationKeepAliveService extends Service {
    static final String PREFS_NAME = "ghr_pos_printer_native";
    static final String KEY_STATION_ENABLED = "station_enabled";
    static final String KEY_STATION_BRANCH_UUID = "station_branch_uuid";
    static final String KEY_STATION_BRANCH_NAME = "station_branch_name";
    static final String KEY_STATION_DEVICE_ID = "station_device_id";

    private static final String CHANNEL_ID = "ghr_native_print_station";
    private static final int NOTIFICATION_ID = 30605;
    private static final long POLL_INTERVAL_MS = 30000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;

    private final Runnable pollRunnable = new Runnable() {
        @Override
        public void run() {
            if (!isStationEnabled()) {
                stopSelf();
                return;
            }
            startHeadlessPoll();
            handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isStationEnabled()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildNotification());
        handler.removeCallbacks(pollRunnable);
        handler.post(pollRunnable);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(pollRunnable);
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startHeadlessPoll() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String branchUuid = prefs.getString(KEY_STATION_BRANCH_UUID, "").trim();
        String deviceId = prefs.getString(KEY_STATION_DEVICE_ID, "").trim();
        if (branchUuid.isEmpty()) return;

        Intent taskIntent = new Intent(this, PosPrintStationHeadlessService.class);
        taskIntent.putExtra("branch_uuid", branchUuid);
        taskIntent.putExtra("device_id", deviceId);
        startService(taskIntent);
        HeadlessJsTaskService.acquireWakeLockNow(this);
    }

    private boolean isStationEnabled() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        return prefs.getBoolean(KEY_STATION_ENABLED, false)
                && !prefs.getString(KEY_STATION_BRANCH_UUID, "").trim().isEmpty();
    }

    private Notification buildNotification() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String branchName = prefs.getString(KEY_STATION_BRANCH_NAME, "").trim();
        String detail = branchName.isEmpty()
                ? "Đang nhận lệnh in của chi nhánh đăng nhập."
                : "Đang nhận lệnh in: " + branchName;

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent, flags);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        return builder
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle("GHR POS - Trạm in đang hoạt động")
                .setContentText(detail)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Trạm in GHR POS",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Giữ trạm in hoạt động khi POS chạy nền hoặc tắt màn hình.");
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager == null) return;
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GHR:NativePrintStation");
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
