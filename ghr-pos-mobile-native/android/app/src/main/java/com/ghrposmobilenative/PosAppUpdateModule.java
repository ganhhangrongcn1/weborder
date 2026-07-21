package vn.ghr.posmobile;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class PosAppUpdateModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "PosAppUpdate";
    private static final String PROGRESS_EVENT = "PosAppUpdateProgress";
    private static final String ALLOWED_DOWNLOAD_HOST = "qjaklysckgzdfjthzkzu.supabase.co";
    private static final long MAX_APK_SIZE_BYTES = 157286400L;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final int MAX_REDIRECTS = 4;

    private final ReactApplicationContext reactContext;
    private final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final AtomicBoolean downloading = new AtomicBoolean(false);

    public PosAppUpdateModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void getCurrentVersion(Promise promise) {
        WritableMap result = Arguments.createMap();
        result.putInt("versionCode", BuildConfig.VERSION_CODE);
        result.putString("versionName", BuildConfig.VERSION_NAME);
        result.putString("packageName", reactContext.getPackageName());
        promise.resolve(result);
    }

    @ReactMethod
    public void canRequestPackageInstalls(Promise promise) {
        promise.resolve(canInstallPackages());
    }

    @ReactMethod
    public void openInstallPermissionSettings(Promise promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(true);
            return;
        }

        try {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + reactContext.getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception error) {
            promise.reject("UPDATE_PERMISSION_SETTINGS_FAILED", "Không mở được phần cấp quyền cài ứng dụng.", error);
        }
    }

    @ReactMethod
    public void downloadAndInstall(
            String downloadUrl,
            String expectedSha256,
            double expectedSizeBytes,
            Promise promise
    ) {
        if (!canInstallPackages()) {
            promise.reject("UPDATE_INSTALL_PERMISSION_REQUIRED", "POS chưa được cấp quyền cài bản cập nhật.");
            return;
        }
        if (!downloading.compareAndSet(false, true)) {
            promise.reject("UPDATE_ALREADY_DOWNLOADING", "Bản cập nhật đang được tải.");
            return;
        }

        final String safeSha256 = safeText(expectedSha256).toLowerCase(Locale.US);
        final long safeExpectedSize = Math.max(0L, (long) expectedSizeBytes);
        if (!safeSha256.matches("^[a-f0-9]{64}$")) {
            downloading.set(false);
            promise.reject("UPDATE_INVALID_SHA256", "Bản phát hành chưa có mã SHA-256 hợp lệ.");
            return;
        }
        if (safeExpectedSize <= 0L || safeExpectedSize > MAX_APK_SIZE_BYTES) {
            downloading.set(false);
            promise.reject("UPDATE_INVALID_SIZE", "Dung lượng APK trong cấu hình không hợp lệ.");
            return;
        }

        downloadExecutor.execute(() -> {
            File temporaryFile = null;
            try {
                URL url = validateDownloadUrl(downloadUrl);
                File updateDirectory = new File(reactContext.getCacheDir(), "app-updates");
                if (!updateDirectory.exists() && !updateDirectory.mkdirs()) {
                    throw new IllegalStateException("Không tạo được thư mục lưu bản cập nhật.");
                }

                temporaryFile = new File(updateDirectory, "GHR-POS-update.apk.download");
                File apkFile = new File(updateDirectory, "GHR-POS-update.apk");
                deleteQuietly(temporaryFile);
                deleteQuietly(apkFile);

                DownloadResult result = downloadApk(url, temporaryFile, safeExpectedSize);
                String downloadedSha256 = toHex(result.digest);
                if (result.bytesWritten != safeExpectedSize) {
                    throw new IllegalStateException("Dung lượng APK tải về không khớp bản phát hành.");
                }
                if (!safeSha256.equals(downloadedSha256)) {
                    throw new IllegalStateException("Mã SHA-256 của APK không khớp. Đã hủy cài đặt.");
                }
                if (!temporaryFile.renameTo(apkFile)) {
                    throw new IllegalStateException("Không hoàn tất được file APK đã tải.");
                }

                emitProgress(result.bytesWritten, safeExpectedSize, "verified");
                File finalApkFile = apkFile;
                mainHandler.post(() -> {
                    try {
                        launchInstaller(finalApkFile);
                        WritableMap response = Arguments.createMap();
                        response.putBoolean("ok", true);
                        response.putDouble("sizeBytes", finalApkFile.length());
                        response.putString("sha256", safeSha256);
                        promise.resolve(response);
                    } catch (Exception error) {
                        promise.reject("UPDATE_INSTALLER_FAILED", "Không mở được trình cài đặt Android.", error);
                    } finally {
                        downloading.set(false);
                    }
                });
            } catch (Exception error) {
                deleteQuietly(temporaryFile);
                downloading.set(false);
                emitProgress(0L, safeExpectedSize, "failed");
                String message = safeText(error.getMessage());
                promise.reject(
                        "UPDATE_DOWNLOAD_FAILED",
                        message.isEmpty() ? "Tải bản cập nhật thất bại." : message,
                        error
                );
            }
        });
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required by NativeEventEmitter.
    }

    @ReactMethod
    public void removeListeners(double count) {
        // Required by NativeEventEmitter.
    }

    @Override
    public void invalidate() {
        downloadExecutor.shutdownNow();
        super.invalidate();
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        PackageManager packageManager = reactContext.getPackageManager();
        return packageManager != null && packageManager.canRequestPackageInstalls();
    }

    private URL validateDownloadUrl(String value) throws Exception {
        URL url = new URL(safeText(value));
        if (!"https".equalsIgnoreCase(url.getProtocol())) {
            throw new IllegalArgumentException("APK phải được tải qua HTTPS.");
        }
        if (!ALLOWED_DOWNLOAD_HOST.equalsIgnoreCase(url.getHost())) {
            throw new IllegalArgumentException("Đường dẫn APK không thuộc Supabase của Gánh Hàng Rong.");
        }
        if (!url.getPath().startsWith("/storage/v1/object/public/app-downloads/")) {
            throw new IllegalArgumentException("Đường dẫn APK không thuộc bucket phát hành POS.");
        }
        return url;
    }

    private DownloadResult downloadApk(URL initialUrl, File target, long expectedSize) throws Exception {
        URL currentUrl = initialUrl;
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
            HttpURLConnection connection = (HttpURLConnection) currentUrl.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(60000);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
            connection.setRequestProperty("User-Agent", "GHR-POS-Updater/" + BuildConfig.VERSION_NAME);

            int responseCode = connection.getResponseCode();
            if (responseCode >= 300 && responseCode < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                currentUrl = validateDownloadUrl(new URL(currentUrl, location).toString());
                continue;
            }
            if (responseCode != HttpURLConnection.HTTP_OK) {
                connection.disconnect();
                throw new IllegalStateException("Máy chủ trả về lỗi HTTP " + responseCode + ".");
            }

            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_APK_SIZE_BYTES || (contentLength > 0L && contentLength != expectedSize)) {
                connection.disconnect();
                throw new IllegalStateException("Dung lượng APK từ máy chủ không khớp bản phát hành.");
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long totalRead = 0L;
            long lastProgressAt = 0L;
            byte[] buffer = new byte[BUFFER_SIZE];
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(target)) {
                int count;
                while ((count = input.read(buffer)) != -1) {
                    totalRead += count;
                    if (totalRead > MAX_APK_SIZE_BYTES) {
                        throw new IllegalStateException("APK vượt quá giới hạn 150 MB.");
                    }
                    output.write(buffer, 0, count);
                    digest.update(buffer, 0, count);

                    long now = System.currentTimeMillis();
                    if (now - lastProgressAt >= 250L) {
                        emitProgress(totalRead, expectedSize, "downloading");
                        lastProgressAt = now;
                    }
                }
                output.flush();
            } finally {
                connection.disconnect();
            }

            emitProgress(totalRead, expectedSize, "downloaded");
            return new DownloadResult(totalRead, digest.digest());
        }
        throw new IllegalStateException("Đường dẫn APK chuyển hướng quá nhiều lần.");
    }

    private void launchInstaller(File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
                reactContext,
                reactContext.getPackageName() + ".fileprovider",
                apkFile
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(intent);
    }

    private void emitProgress(long bytesDownloaded, long totalBytes, String state) {
        WritableMap payload = Arguments.createMap();
        payload.putDouble("bytesDownloaded", bytesDownloaded);
        payload.putDouble("totalBytes", totalBytes);
        payload.putDouble("progress", totalBytes > 0L ? Math.min(1D, (double) bytesDownloaded / totalBytes) : 0D);
        payload.putString("state", state);
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(PROGRESS_EVENT, payload);
    }

    private static String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private static String toHex(byte[] value) {
        StringBuilder result = new StringBuilder();
        for (byte item : value) result.append(String.format(Locale.US, "%02x", item));
        return result.toString();
    }

    private static void deleteQuietly(File file) {
        if (file != null && file.exists()) file.delete();
    }

    private static final class DownloadResult {
        final long bytesWritten;
        final byte[] digest;

        DownloadResult(long bytesWritten, byte[] digest) {
            this.bytesWritten = bytesWritten;
            this.digest = digest;
        }
    }
}
