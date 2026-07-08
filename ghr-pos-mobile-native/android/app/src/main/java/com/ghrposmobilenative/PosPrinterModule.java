package vn.ghr.posmobile;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.content.pm.PackageManager;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;

public class PosPrinterModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "PosPrinter";
    private static final String PREFS_NAME = "ghr_pos_printer_native";
    private static final String KEY_PRINTER_MODE = "printer_mode";
    private static final String KEY_USB_DEVICE = "usb_device";
    private static final String KEY_LAN_HOST = "lan_host";
    private static final String KEY_LAN_PORT = "lan_port";
    private static final String PRINTER_MODE_USB = "usb";
    private static final String PRINTER_MODE_LAN = "lan";
    private static final String ACTION_USB_PERMISSION = "vn.ghr.posmobile.USB_PERMISSION";
    private static final int DEFAULT_LAN_PORT = 9100;
    private static final byte[][] CASH_DRAWER_KICK_COMMANDS = new byte[][] {
            new byte[] { 0x1B, 0x40 },
            new byte[] { 0x1B, 0x70, 0x00, 0x32, (byte) 0xFA },
            new byte[] { 0x1B, 0x70, 0x01, 0x32, (byte) 0xFA },
            new byte[] { 0x1B, 0x70, 0x30, 0x32, (byte) 0xFA },
            new byte[] { 0x1B, 0x70, 0x31, 0x32, (byte) 0xFA }
    };

    private final ReactApplicationContext reactContext;
    private final SharedPreferences prefs;
    private final UsbManager usbManager;
    private final PendingIntent permissionIntent;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Promise pendingUsbPromise;
    private MediaPlayer alertPlayer;
    private MediaPlayer qrPaymentPlayer;
    private boolean alertSoundPlaying = false;
    private int alertSoundCount = 0;

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            if (pendingUsbPromise != null) {
                if (granted && device != null) {
                    saveSelectedDevice(device);
                    pendingUsbPromise.resolve(buildPrinterConfig());
                } else {
                    pendingUsbPromise.reject("USB_PERMISSION_DENIED", "Người dùng chưa cấp quyền máy in USB.");
                }
                pendingUsbPromise = null;
            }
        }
    };

    public PosPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.usbManager = (UsbManager) reactContext.getSystemService(Context.USB_SERVICE);
        int pendingIntentFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
        this.permissionIntent = PendingIntent.getBroadcast(
                reactContext,
                0,
                new Intent(ACTION_USB_PERMISSION),
                pendingIntentFlags
        );

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            reactContext.registerReceiver(usbReceiver, filter);
        }
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void getPrinterConfig(Promise promise) {
        promise.resolve(buildPrinterConfig());
    }

    @ReactMethod
    public void setPrinterMode(String mode, Promise promise) {
        String safeMode = PRINTER_MODE_LAN.equals(normalizeMode(mode)) ? PRINTER_MODE_LAN : PRINTER_MODE_USB;
        prefs.edit().putString(KEY_PRINTER_MODE, safeMode).apply();
        promise.resolve(buildPrinterConfig());
    }

    @ReactMethod
    public void saveLanPrinter(String host, double port, Promise promise) {
        prefs.edit()
                .putString(KEY_LAN_HOST, safeText(host))
                .putInt(KEY_LAN_PORT, sanitizePort((int) port))
                .apply();
        promise.resolve(buildPrinterConfig());
    }

    @ReactMethod
    public void listUsbPrinters(Promise promise) {
        WritableArray items = Arguments.createArray();
        for (UsbDevice device : getUsbDevices()) {
            items.pushMap(buildUsbDeviceMap(device));
        }
        promise.resolve(items);
    }

    @ReactMethod
    public void selectUsbPrinter(double vendorId, double productId, Promise promise) {
        UsbDevice device = findUsbDevice((int) vendorId, (int) productId);
        if (device == null) {
            promise.reject("USB_NOT_FOUND", "Không tìm thấy máy in USB.");
            return;
        }
        saveSelectedDevice(device);
        promise.resolve(buildPrinterConfig());
    }

    @ReactMethod
    public void requestUsbPermission(double vendorId, double productId, Promise promise) {
        UsbDevice device = findUsbDevice((int) vendorId, (int) productId);
        if (device == null) {
            promise.reject("USB_NOT_FOUND", "Không tìm thấy máy in USB.");
            return;
        }
        if (usbManager != null && usbManager.hasPermission(device)) {
            saveSelectedDevice(device);
            promise.resolve(buildPrinterConfig());
            return;
        }

        pendingUsbPromise = promise;
        if (usbManager != null) {
            usbManager.requestPermission(device, permissionIntent);
        } else {
            pendingUsbPromise = null;
            promise.reject("USB_UNAVAILABLE", "Thiết bị này không hỗ trợ USB printer.");
        }
    }

    @ReactMethod
    public void printTestBill(Promise promise) {
        String time = new SimpleDateFormat("HH:mm dd/MM/yyyy", new Locale("vi", "VN")).format(new Date());
        String text =
                "@@CENTER:GANH HANG RONG\n" +
                "@@CENTER:TEST MAY IN\n" +
                "@@BIG:TEST-XPRINTER\n" +
                "------------------------------------------\n" +
                "Nguon: POS mobile\n" +
                "Gio: " + time + "\n" +
                "------------------------------------------\n" +
                "1 x Dong test tieng Viet co dau\n" +
                "------------------------------------------\n" +
                "@@CENTER:Cam on quy khach!";
        try {
            printReceiptPayload(text, "", "");
            promise.resolve(buildPrinterConfig());
        } catch (Exception error) {
            promise.reject("PRINT_TEST_FAILED", safeText(error.getMessage()));
        }
    }

    @ReactMethod
    public void printReceipt(ReadableMap payload, Promise promise) {
        String text = payload.hasKey("text") ? payload.getString("text") : "";
        String qrUrl = payload.hasKey("qrUrl") ? payload.getString("qrUrl") : "";
        String sourceType = payload.hasKey("sourceType") ? payload.getString("sourceType") : "";
        String footerText = payload.hasKey("footerText") ? payload.getString("footerText") : "";
        String footerQrUrl = payload.hasKey("footerQrUrl") ? payload.getString("footerQrUrl") : "";

        try {
            printReceiptPayload(text, qrUrl, sourceType, footerText, footerQrUrl);
            promise.resolve(buildPrinterConfig());
        } catch (Exception error) {
            promise.reject("PRINT_FAILED", safeText(error.getMessage()));
        }
    }

    @ReactMethod
    public void openCashDrawer(Promise promise) {
        try {
            for (byte[] command : CASH_DRAWER_KICK_COMMANDS) {
                writeRawPrinterBytes(command);
                try {
                    Thread.sleep(80);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
            }
            promise.resolve(buildPrinterConfig());
        } catch (Exception error) {
            promise.reject("CASH_DRAWER_FAILED", safeText(error.getMessage()));
        }
    }

    @ReactMethod
    public void playNewOrderAlert(Promise promise) {
        mainHandler.post(() -> {
            if (alertSoundPlaying) {
                promise.resolve(false);
                return;
            }
            alertSoundPlaying = true;
            alertSoundCount = 0;
            playNextAlertSound();
            promise.resolve(true);
        });
    }

    @ReactMethod
    public void playQrPaymentAlert(Promise promise) {
        mainHandler.post(() -> {
            stopNewOrderAlert();
            if (qrPaymentPlayer != null && qrPaymentPlayer.isPlaying()) {
                promise.resolve(false);
                return;
            }

            try {
                releaseQrPaymentPlayer();
                qrPaymentPlayer = MediaPlayer.create(reactContext, R.raw.qr_payment);
                if (qrPaymentPlayer == null) {
                    promise.reject("QR_PAYMENT_ALERT_FAILED", "Không mở được âm báo thanh toán QR.");
                    return;
                }
                qrPaymentPlayer.setOnCompletionListener(player -> releaseQrPaymentPlayer());
                qrPaymentPlayer.setOnErrorListener((player, what, extra) -> {
                    releaseQrPaymentPlayer();
                    return true;
                });
                qrPaymentPlayer.start();
                promise.resolve(true);
            } catch (Exception error) {
                releaseQrPaymentPlayer();
                promise.reject("QR_PAYMENT_ALERT_FAILED", safeText(error.getMessage()));
            }
        });
    }

    @ReactMethod
    public void startPrintStationService(String branchUuid, String branchName, String deviceId, Promise promise) {
        String safeBranchUuid = safeText(branchUuid);
        if (safeBranchUuid.isEmpty()) {
            promise.reject("PRINT_STATION_BRANCH_REQUIRED", "Chưa xác định chi nhánh cho trạm in.");
            return;
        }

        prefs.edit()
                .putBoolean(PosPrintStationKeepAliveService.KEY_STATION_ENABLED, true)
                .putString(PosPrintStationKeepAliveService.KEY_STATION_BRANCH_UUID, safeBranchUuid)
                .putString(PosPrintStationKeepAliveService.KEY_STATION_BRANCH_NAME, safeText(branchName))
                .putString(PosPrintStationKeepAliveService.KEY_STATION_DEVICE_ID, safeText(deviceId))
                .apply();

        try {
            if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    reactContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                Activity activity = getCurrentActivity();
                if (activity != null) {
                    activity.requestPermissions(
                            new String[] { Manifest.permission.POST_NOTIFICATIONS },
                            30605
                    );
                }
            }
            Intent serviceIntent = new Intent(reactContext, PosPrintStationKeepAliveService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(serviceIntent);
            } else {
                reactContext.startService(serviceIntent);
            }
            promise.resolve(buildPrinterConfig());
        } catch (Exception error) {
            promise.reject("PRINT_STATION_START_FAILED", safeText(error.getMessage()));
        }
    }

    @ReactMethod
    public void stopPrintStationService(Promise promise) {
        prefs.edit()
                .putBoolean(PosPrintStationKeepAliveService.KEY_STATION_ENABLED, false)
                .apply();
        try {
            reactContext.stopService(new Intent(reactContext, PosPrintStationKeepAliveService.class));
            promise.resolve(buildPrinterConfig());
        } catch (Exception error) {
            promise.reject("PRINT_STATION_STOP_FAILED", safeText(error.getMessage()));
        }
    }

    private void playNextAlertSound() {
        if (!alertSoundPlaying) return;
        if (alertSoundCount >= 3) {
            stopNewOrderAlert();
            return;
        }

        try {
            releaseAlertPlayer();
            alertPlayer = MediaPlayer.create(reactContext, R.raw.new_order);
            if (alertPlayer == null) {
                stopNewOrderAlert();
                return;
            }

            alertSoundCount += 1;
            alertPlayer.setOnCompletionListener(player -> {
                releaseAlertPlayer();
                mainHandler.postDelayed(this::playNextAlertSound, 180);
            });
            alertPlayer.setOnErrorListener((player, what, extra) -> {
                stopNewOrderAlert();
                return true;
            });
            alertPlayer.start();
        } catch (Exception ignored) {
            stopNewOrderAlert();
        }
    }

    private void stopNewOrderAlert() {
        alertSoundPlaying = false;
        alertSoundCount = 0;
        mainHandler.removeCallbacksAndMessages(null);
        releaseAlertPlayer();
    }

    private void releaseAlertPlayer() {
        try {
            if (alertPlayer != null) {
                alertPlayer.setOnCompletionListener(null);
                alertPlayer.setOnErrorListener(null);
                if (alertPlayer.isPlaying()) alertPlayer.stop();
                alertPlayer.release();
            }
        } catch (Exception ignored) {
        } finally {
            alertPlayer = null;
        }
    }

    private void releaseQrPaymentPlayer() {
        try {
            if (qrPaymentPlayer != null) {
                qrPaymentPlayer.setOnCompletionListener(null);
                qrPaymentPlayer.setOnErrorListener(null);
                if (qrPaymentPlayer.isPlaying()) qrPaymentPlayer.stop();
                qrPaymentPlayer.release();
            }
        } catch (Exception ignored) {
        } finally {
            qrPaymentPlayer = null;
        }
    }

    @Override
    public void invalidate() {
        stopNewOrderAlert();
        releaseQrPaymentPlayer();
        super.invalidate();
    }

    private WritableMap buildPrinterConfig() {
        WritableMap map = Arguments.createMap();
        String mode = getPrinterMode();
        UsbDevice selected = getSelectedDevice();
        boolean usbPermission = selected != null && usbManager != null && usbManager.hasPermission(selected);

        map.putString("mode", mode);
        map.putString("lanHost", prefs.getString(KEY_LAN_HOST, ""));
        map.putInt("lanPort", getLanPort());
        map.putBoolean("usbConnected", selected != null);
        map.putBoolean("usbPermission", usbPermission);
        map.putString("usbLabel", selected != null ? buildUsbLabel(selected) : "");
        map.putBoolean(
                "printStationEnabled",
                prefs.getBoolean(PosPrintStationKeepAliveService.KEY_STATION_ENABLED, false)
        );
        map.putString(
                "printStationBranchUuid",
                prefs.getString(PosPrintStationKeepAliveService.KEY_STATION_BRANCH_UUID, "")
        );
        return map;
    }

    private WritableMap buildUsbDeviceMap(UsbDevice device) {
        WritableMap map = Arguments.createMap();
        String selectedKey = prefs.getString(KEY_USB_DEVICE, "");
        String deviceKey = buildDeviceKey(device);
        map.putInt("vendorId", device.getVendorId());
        map.putInt("productId", device.getProductId());
        map.putString("deviceName", safeText(device.getDeviceName()));
        map.putString("label", buildUsbLabel(device));
        map.putBoolean("selected", deviceKey.equals(selectedKey));
        map.putBoolean("hasPermission", usbManager != null && usbManager.hasPermission(device));
        return map;
    }

    private List<UsbDevice> getUsbDevices() {
        List<UsbDevice> items = new ArrayList<>();
        if (usbManager == null) return items;
        HashMap<String, UsbDevice> devices = usbManager.getDeviceList();
        if (devices == null || devices.isEmpty()) return items;
        items.addAll(devices.values());
        return items;
    }

    private UsbDevice findUsbDevice(int vendorId, int productId) {
        for (UsbDevice device : getUsbDevices()) {
            if (device.getVendorId() == vendorId && device.getProductId() == productId) {
                return device;
            }
        }
        return null;
    }

    private void saveSelectedDevice(UsbDevice device) {
        prefs.edit().putString(KEY_USB_DEVICE, buildDeviceKey(device)).apply();
    }

    private UsbDevice getSelectedDevice() {
        List<UsbDevice> devices = getUsbDevices();
        if (devices.isEmpty()) return null;

        String saved = prefs.getString(KEY_USB_DEVICE, "");
        for (UsbDevice device : devices) {
            if (buildDeviceKey(device).equals(saved)) return device;
        }
        return devices.get(0);
    }

    private String buildDeviceKey(UsbDevice device) {
        return device.getVendorId() + ":" + device.getProductId();
    }

    private String buildUsbLabel(UsbDevice device) {
        return "USB " + device.getVendorId() + ":" + device.getProductId();
    }

    private String getPrinterMode() {
        return normalizeMode(prefs.getString(KEY_PRINTER_MODE, PRINTER_MODE_USB));
    }

    private String normalizeMode(String mode) {
        return PRINTER_MODE_LAN.equals(safeText(mode).toLowerCase(Locale.ROOT)) ? PRINTER_MODE_LAN : PRINTER_MODE_USB;
    }

    private int sanitizePort(int port) {
        return port > 0 ? port : DEFAULT_LAN_PORT;
    }

    private int getLanPort() {
        return sanitizePort(prefs.getInt(KEY_LAN_PORT, DEFAULT_LAN_PORT));
    }

    private void printReceiptPayload(
            String text,
            String qrUrl,
            String sourceType,
            String footerText,
            String footerQrUrl
    ) throws Exception {
        if (PRINTER_MODE_LAN.equals(getPrinterMode())) {
            printReceiptTextViaLan(text, qrUrl, sourceType, footerText, footerQrUrl);
            return;
        }
        printReceiptTextViaUsb(text, qrUrl, sourceType, footerText, footerQrUrl);
    }

    private void printReceiptPayload(String text, String qrUrl, String sourceType) throws Exception {
        printReceiptPayload(text, qrUrl, sourceType, "", "");
    }

    private void printReceiptTextViaLan(
            String text,
            String qrUrl,
            String sourceType,
            String footerText,
            String footerQrUrl
    ) throws Exception {
        String host = safeText(prefs.getString(KEY_LAN_HOST, ""));
        int port = getLanPort();
        if (host.isEmpty()) {
            throw new Exception("Chưa nhập IP máy in LAN/WiFi.");
        }

        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(5000);
            OutputStream outputStream = socket.getOutputStream();
            outputStream.write(buildEscPosRaster(text, qrUrl, sourceType, footerText, footerQrUrl));
            outputStream.flush();
        }
    }

    private void writeRawPrinterBytes(byte[] data) throws Exception {
        if (PRINTER_MODE_LAN.equals(getPrinterMode())) {
            writeRawPrinterBytesViaLan(data);
            return;
        }
        writeRawPrinterBytesViaUsb(data);
    }

    private void writeRawPrinterBytesViaLan(byte[] data) throws Exception {
        String host = safeText(prefs.getString(KEY_LAN_HOST, ""));
        int port = getLanPort();
        if (host.isEmpty()) {
            throw new Exception("Chưa nhập IP máy in LAN/WiFi.");
        }

        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(5000);
            OutputStream outputStream = socket.getOutputStream();
            outputStream.write(data);
            outputStream.flush();
        }
    }

    private void writeRawPrinterBytesViaUsb(byte[] data) throws Exception {
        UsbDevice device = getSelectedDevice();
        if (device == null) {
            throw new Exception("Chưa thấy máy in USB.");
        }
        if (usbManager == null || !usbManager.hasPermission(device)) {
            throw new Exception("Máy in USB chưa được cấp quyền.");
        }

        UsbInterface usbInterface = null;
        UsbEndpoint outEndpoint = null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface candidate = device.getInterface(i);
            for (int j = 0; j < candidate.getEndpointCount(); j++) {
                UsbEndpoint endpoint = candidate.getEndpoint(j);
                if (endpoint.getDirection() == android.hardware.usb.UsbConstants.USB_DIR_OUT) {
                    usbInterface = candidate;
                    outEndpoint = endpoint;
                    break;
                }
            }
            if (outEndpoint != null) break;
        }

        if (usbInterface == null || outEndpoint == null) {
            throw new Exception("Không tìm thấy cổng in USB.");
        }

        UsbDeviceConnection connection = usbManager.openDevice(device);
        if (connection == null) {
            throw new Exception("Không mở được kết nối máy in USB.");
        }

        try {
            if (!connection.claimInterface(usbInterface, true)) {
                throw new Exception("Không nhận được quyền cổng USB.");
            }

            int sent = connection.bulkTransfer(outEndpoint, data, data.length, 5000);
            if (sent <= 0) {
                throw new Exception("Máy in không nhận lệnh mở két.");
            }
        } finally {
            try {
                connection.releaseInterface(usbInterface);
            } catch (Exception ignored) {
            }
            connection.close();
        }
    }

    private void printReceiptTextViaUsb(
            String text,
            String qrUrl,
            String sourceType,
            String footerText,
            String footerQrUrl
    ) throws Exception {
        UsbDevice device = getSelectedDevice();
        if (device == null) {
            throw new Exception("Chưa thấy máy in USB.");
        }
        if (usbManager == null || !usbManager.hasPermission(device)) {
            throw new Exception("Máy in USB chưa được cấp quyền.");
        }

        UsbInterface usbInterface = null;
        UsbEndpoint outEndpoint = null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface candidate = device.getInterface(i);
            for (int j = 0; j < candidate.getEndpointCount(); j++) {
                UsbEndpoint endpoint = candidate.getEndpoint(j);
                if (endpoint.getDirection() == android.hardware.usb.UsbConstants.USB_DIR_OUT) {
                    usbInterface = candidate;
                    outEndpoint = endpoint;
                    break;
                }
            }
            if (outEndpoint != null) break;
        }

        if (usbInterface == null || outEndpoint == null) {
            throw new Exception("Không tìm thấy cổng in USB.");
        }

        UsbDeviceConnection connection = usbManager.openDevice(device);
        if (connection == null) {
            throw new Exception("Không mở được kết nối máy in USB.");
        }

        try {
            if (!connection.claimInterface(usbInterface, true)) {
                throw new Exception("Không nhận được quyền cổng USB.");
            }

            byte[] data = buildEscPosRaster(text, qrUrl, sourceType, footerText, footerQrUrl);
            int offset = 0;
            while (offset < data.length) {
                int chunkSize = Math.min(4096, data.length - offset);
                int sent = connection.bulkTransfer(outEndpoint, data, offset, chunkSize, 5000);
                if (sent <= 0) {
                    throw new Exception("Máy in không nhận dữ liệu.");
                }
                offset += sent;
            }
        } finally {
            try {
                connection.releaseInterface(usbInterface);
            } catch (Exception ignored) {
            }
            connection.close();
        }
    }

    private byte[] buildEscPosRaster(
            String text,
            String qrUrl,
            String sourceType,
            String footerText,
            String footerQrUrl
    ) {
        return EscPosRasterPrinter.buildReceiptRaster(
                text,
                qrUrl,
                sourceType,
                footerText,
                footerQrUrl
        );
    }

    private String safeText(String value) {
        return String.valueOf(value == null ? "" : value).trim();
    }
}
