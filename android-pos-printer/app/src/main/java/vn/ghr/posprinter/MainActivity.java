package vn.ghr.posprinter;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String PREFS_NAME = "ghr_pos_printer";
    private static final String KEY_WEB_URL = "web_url";
    private static final String KEY_USB_DEVICE = "usb_device";
    private static final String DEFAULT_WEB_URL = "https://your-domain.com/admin/kitchen";
    private static final String ACTION_USB_PERMISSION = "vn.ghr.posprinter.USB_PERMISSION";
    private static final int RECEIPT_WIDTH_DOTS_80MM = 576;

    private WebView webView;
    private TextView statusText;
    private SharedPreferences prefs;
    private UsbManager usbManager;
    private PendingIntent permissionIntent;
    private String pendingPrintText = "";

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            if (granted && device != null) {
                saveSelectedDevice(device);
                status("Đã cấp quyền máy in USB.");
                if (!pendingPrintText.isEmpty()) {
                    String text = pendingPrintText;
                    pendingPrintText = "";
                    printReceiptText(text);
                }
            } else {
                status("Chưa cấp quyền máy in USB.");
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        usbManager = (UsbManager) getSystemService(USB_SERVICE);
        permissionIntent = PendingIntent.getBroadcast(
                this,
                0,
                new Intent(ACTION_USB_PERMISSION),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(usbReceiver, new IntentFilter(ACTION_USB_PERMISSION), RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(usbReceiver, new IntentFilter(ACTION_USB_PERMISSION));
        }

        setContentView(buildLayout());
        setupWebView();
        loadKitchenUrl();
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(usbReceiver);
        super.onDestroy();
    }

    private View buildLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(10), dp(8), dp(10), dp(8));
        bar.setBackgroundColor(Color.rgb(15, 118, 110));

        TextView title = new TextView(this);
        title.setText("GHR POS Printer");
        title.setTextColor(Color.WHITE);
        title.setTextSize(16);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        bar.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button reloadButton = makeTopButton("Tải lại");
        reloadButton.setOnClickListener(view -> loadKitchenUrl());
        bar.addView(reloadButton);

        Button testButton = makeTopButton("In test");
        testButton.setOnClickListener(view -> printTestBill());
        bar.addView(testButton);

        Button settingsButton = makeTopButton("Cài đặt");
        settingsButton.setOnClickListener(view -> showSettingsDialog());
        bar.addView(settingsButton);

        root.addView(bar);

        statusText = new TextView(this);
        statusText.setText("Máy in: Xprinter USB | Khổ giấy: 80mm");
        statusText.setTextColor(Color.rgb(51, 65, 85));
        statusText.setTextSize(13);
        statusText.setPadding(dp(10), dp(6), dp(10), dp(6));
        root.addView(statusText);

        webView = new WebView(this);
        root.addView(webView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1
        ));

        return root;
    }

    private Button makeTopButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(12);
        button.setAllCaps(false);
        button.setTextColor(Color.rgb(15, 23, 42));
        return button;
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://") || url.startsWith("https://")) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                return true;
            }
        });
        webView.addJavascriptInterface(new PrinterBridge(), "GhrPrinter");
    }

    private void loadKitchenUrl() {
        String url = prefs.getString(KEY_WEB_URL, DEFAULT_WEB_URL);
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        status("Đang mở Kitchen: " + url);
        webView.loadUrl(url);
    }

    private void showSettingsDialog() {
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(10), dp(18), 0);

        TextView urlLabel = new TextView(this);
        urlLabel.setText("Link web Kitchen online");
        urlLabel.setTextColor(Color.rgb(15, 23, 42));
        content.addView(urlLabel);

        EditText urlInput = new EditText(this);
        urlInput.setSingleLine(true);
        urlInput.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        urlInput.setText(prefs.getString(KEY_WEB_URL, DEFAULT_WEB_URL));
        content.addView(urlInput);

        TextView printerLabel = new TextView(this);
        printerLabel.setText("\nMáy in: Xprinter USB\nKhổ giấy: 80mm");
        printerLabel.setTextColor(Color.rgb(51, 65, 85));
        content.addView(printerLabel);

        Button choosePrinterButton = new Button(this);
        choosePrinterButton.setText("Chọn máy in USB");
        choosePrinterButton.setAllCaps(false);
        choosePrinterButton.setOnClickListener(view -> showUsbDevicePicker());
        content.addView(choosePrinterButton);

        new AlertDialog.Builder(this)
                .setTitle("Cài đặt POS")
                .setView(content)
                .setPositiveButton("Lưu", (dialog, which) -> {
                    prefs.edit().putString(KEY_WEB_URL, urlInput.getText().toString().trim()).apply();
                    loadKitchenUrl();
                })
                .setNegativeButton("Đóng", null)
                .show();
    }

    private void showUsbDevicePicker() {
        HashMap<String, UsbDevice> devices = usbManager.getDeviceList();
        if (devices.isEmpty()) {
            toast("Chưa thấy máy in USB. Kiểm tra dây USB/OTG.");
            return;
        }

        List<UsbDevice> deviceList = new ArrayList<>(devices.values());
        String[] labels = new String[deviceList.size()];
        for (int i = 0; i < deviceList.size(); i++) {
            UsbDevice device = deviceList.get(i);
            labels[i] = "USB " + device.getVendorId() + ":" + device.getProductId();
        }

        new AlertDialog.Builder(this)
                .setTitle("Chọn máy in USB")
                .setItems(labels, (dialog, which) -> requestPrinterPermission(deviceList.get(which)))
                .show();
    }

    private void requestPrinterPermission(UsbDevice device) {
        if (usbManager.hasPermission(device)) {
            saveSelectedDevice(device);
            status("Đã chọn máy in USB.");
            return;
        }
        usbManager.requestPermission(device, permissionIntent);
    }

    private void saveSelectedDevice(UsbDevice device) {
        prefs.edit().putString(KEY_USB_DEVICE, device.getVendorId() + ":" + device.getProductId()).apply();
    }

    private UsbDevice getSelectedDevice() {
        HashMap<String, UsbDevice> devices = usbManager.getDeviceList();
        if (devices.isEmpty()) return null;

        String saved = prefs.getString(KEY_USB_DEVICE, "");
        for (UsbDevice device : devices.values()) {
            String key = device.getVendorId() + ":" + device.getProductId();
            if (key.equals(saved)) return device;
        }

        return new ArrayList<>(devices.values()).get(0);
    }

    private void printTestBill() {
        String time = new SimpleDateFormat("HH:mm dd/MM/yyyy", new Locale("vi", "VN")).format(new Date());
        printReceiptText(
                "GÁNH HÀNG RONG\n" +
                "Bill test Xprinter USB\n" +
                "Giờ: " + time + "\n" +
                "--------------------------------\n" +
                "1 x Dòng test tiếng Việt có dấu\n" +
                "TỔNG                         0\n" +
                "--------------------------------\n" +
                "Cảm ơn quý khách!"
        );
    }

    private boolean printReceiptText(String text) {
        UsbDevice device = getSelectedDevice();
        if (device == null) {
            status("Chưa thấy máy in USB.");
            return false;
        }

        if (!usbManager.hasPermission(device)) {
            pendingPrintText = text;
            usbManager.requestPermission(device, permissionIntent);
            return false;
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
            status("Không tìm thấy cổng in USB.");
            return false;
        }

        UsbDeviceConnection connection = usbManager.openDevice(device);
        if (connection == null) {
            status("Không mở được kết nối máy in.");
            return false;
        }

        try {
            if (!connection.claimInterface(usbInterface, true)) {
                status("Không nhận được quyền cổng USB.");
                return false;
            }

            byte[] data = buildEscPosRaster(text);
            int offset = 0;
            while (offset < data.length) {
                int chunkSize = Math.min(4096, data.length - offset);
                int sent = connection.bulkTransfer(outEndpoint, data, offset, chunkSize, 5000);
                if (sent <= 0) {
                    status("Máy in không nhận dữ liệu.");
                    return false;
                }
                offset += sent;
            }

            status("Đã gửi bill tới Xprinter USB.");
            return true;
        } finally {
            try {
                connection.releaseInterface(usbInterface);
            } catch (Exception ignored) {
            }
            connection.close();
        }
    }

    private byte[] buildEscPosRaster(String text) {
        Bitmap bitmap = renderTextBitmap(text, RECEIPT_WIDTH_DOTS_80MM);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write(0x1B);
        output.write(0x40);
        output.write(0x1D);
        output.write(0x76);
        output.write(0x30);
        output.write(0x00);

        int widthBytes = (bitmap.getWidth() + 7) / 8;
        int height = bitmap.getHeight();
        output.write(widthBytes & 0xFF);
        output.write((widthBytes >> 8) & 0xFF);
        output.write(height & 0xFF);
        output.write((height >> 8) & 0xFF);

        for (int y = 0; y < height; y++) {
            for (int xByte = 0; xByte < widthBytes; xByte++) {
                int value = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int x = xByte * 8 + bit;
                    if (x < bitmap.getWidth()) {
                        int pixel = bitmap.getPixel(x, y);
                        int red = Color.red(pixel);
                        int green = Color.green(pixel);
                        int blue = Color.blue(pixel);
                        if ((red + green + blue) / 3 < 160) {
                            value |= 1 << (7 - bit);
                        }
                    }
                }
                output.write(value);
            }
        }

        output.write("\n\n\n".getBytes(StandardCharsets.US_ASCII), 0, 3);
        output.write(0x1D);
        output.write(0x56);
        output.write(0x42);
        output.write(0x00);
        return output.toByteArray();
    }

    private Bitmap renderTextBitmap(String text, int width) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        paint.setTextSize(24);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));

        int padding = 16;
        int lineHeight = 34;
        List<String> lines = wrapLines(text, paint, width - padding * 2);
        int height = Math.max(160, padding * 2 + lines.size() * lineHeight);

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);

        int y = padding + 24;
        for (String line : lines) {
            canvas.drawText(line, padding, y, paint);
            y += lineHeight;
        }

        return bitmap;
    }

    private List<String> wrapLines(String text, Paint paint, int maxWidth) {
        List<String> result = new ArrayList<>();
        String[] rawLines = text.split("\\n", -1);
        for (String rawLine : rawLines) {
            String line = rawLine.trim();
            if (line.isEmpty()) {
                result.add("");
                continue;
            }

            String[] words = line.split("\\s+");
            String current = "";
            for (String word : words) {
                String next = current.isEmpty() ? word : current + " " + word;
                if (paint.measureText(next) <= maxWidth) {
                    current = next;
                } else {
                    if (!current.isEmpty()) result.add(current);
                    current = word;
                }
            }
            if (!current.isEmpty()) result.add(current);
        }
        return result;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void status(String message) {
        runOnUiThread(() -> statusText.setText(message));
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    public class PrinterBridge {
        @JavascriptInterface
        public String printCustomerBill(String payload) {
            try {
                JSONObject object = new JSONObject(payload);
                String text = object.optString("text", "");
                if (text.trim().isEmpty()) {
                    return "{\"ok\":false,\"message\":\"Bill chưa có nội dung để in.\"}";
                }
                boolean ok = printReceiptText(text);
                return ok
                        ? "{\"ok\":true,\"message\":\"Đã gửi bill tới Xprinter USB.\"}"
                        : "{\"ok\":false,\"message\":\"Chưa in được bill. Kiểm tra máy in USB.\"}";
            } catch (Exception error) {
                return "{\"ok\":false,\"message\":\"Dữ liệu bill không hợp lệ.\"}";
            }
        }

        @JavascriptInterface
        public String printTestBill(String payload) {
            boolean ok = printReceiptText(
                    "GÁNH HÀNG RONG\n" +
                    "Bill test từ web Kitchen\n" +
                    "--------------------------------\n" +
                    "Nếu dòng này rõ dấu là máy in ổn.\n" +
                    "Cảm ơn quý khách!"
            );
            return ok
                    ? "{\"ok\":true,\"message\":\"Đã gửi bill test tới Xprinter USB.\"}"
                    : "{\"ok\":false,\"message\":\"Chưa in được bill test.\"}";
        }
    }
}
