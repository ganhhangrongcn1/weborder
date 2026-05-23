package vn.ghr.posprinter;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.StrictMode;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
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
    private static final String KEY_PRINTER_MODE = "printer_mode";
    private static final String KEY_LAN_HOST = "lan_host";
    private static final String KEY_LAN_PORT = "lan_port";
    private static final String PRINTER_MODE_USB = "usb";
    private static final String PRINTER_MODE_LAN = "lan";
    private static final String DEFAULT_WEB_URL = "https://ganhhangrong.vn/kitchen";
    private static final String ACTION_USB_PERMISSION = "vn.ghr.posprinter.USB_PERMISSION";
    private static final int RECEIPT_WIDTH_DOTS_80MM = 576;
    private static final int DEFAULT_LAN_PORT = 9100;

    private WebView webView;
    private TextView statusText;
    private TextView printerText;
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
                updatePrinterStatus();
                if (!pendingPrintText.isEmpty()) {
                    String text = pendingPrintText;
                    pendingPrintText = "";
                    printReceiptText(text);
                }
            } else {
                status("Chưa cấp quyền máy in USB.");
                updatePrinterStatus();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        StrictMode.setThreadPolicy(new StrictMode.ThreadPolicy.Builder().permitAll().build());
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
        updatePrinterStatus();
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
        root.setBackgroundColor(Color.rgb(248, 250, 252));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(12), dp(10), dp(12), dp(10));
        header.setBackgroundColor(Color.WHITE);

        ImageView logo = new ImageView(this);
        logo.setImageResource(getResources().getIdentifier("logo_icon", "drawable", getPackageName()));
        logo.setScaleType(ImageView.ScaleType.CENTER_CROP);
        logo.setBackground(makeRoundRect(Color.rgb(255, 205, 0), 12, 0, Color.TRANSPARENT));
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(48), dp(48));
        header.addView(logo, logoParams);

        LinearLayout brand = new LinearLayout(this);
        brand.setOrientation(LinearLayout.VERTICAL);
        brand.setPadding(dp(10), 0, dp(8), 0);

        TextView title = new TextView(this);
        title.setText("Gánh Hàng Rong");
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setTextSize(17);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        brand.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("POS Printer · Xprinter 80mm");
        subtitle.setTextColor(Color.rgb(71, 85, 105));
        subtitle.setTextSize(12);
        subtitle.setTypeface(Typeface.DEFAULT_BOLD);
        brand.addView(subtitle);

        header.addView(brand, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button reloadButton = makeTopButton("Tải lại");
        reloadButton.setOnClickListener(view -> loadKitchenUrl());
        header.addView(reloadButton);

        Button testButton = makePrimaryButton("In test");
        testButton.setOnClickListener(view -> printTestBill());
        header.addView(testButton);

        Button settingsButton = makeTopButton("Cài đặt");
        settingsButton.setOnClickListener(view -> showSettingsDialog());
        header.addView(settingsButton);

        root.addView(header);

        LinearLayout statusBar = new LinearLayout(this);
        statusBar.setOrientation(LinearLayout.HORIZONTAL);
        statusBar.setGravity(Gravity.CENTER_VERTICAL);
        statusBar.setPadding(dp(12), dp(8), dp(12), dp(8));
        statusBar.setBackgroundColor(Color.rgb(241, 245, 249));

        printerText = new TextView(this);
        printerText.setTextColor(Color.rgb(15, 118, 110));
        printerText.setTextSize(13);
        printerText.setTypeface(Typeface.DEFAULT_BOLD);
        statusBar.addView(printerText, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        statusText = new TextView(this);
        statusText.setText("Đang khởi động POS...");
        statusText.setTextColor(Color.rgb(71, 85, 105));
        statusText.setTextSize(12);
        statusText.setGravity(Gravity.RIGHT);
        statusBar.addView(statusText, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        root.addView(statusBar);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
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
        button.setBackground(makeRoundRect(Color.rgb(255, 255, 255), 8, 1, Color.rgb(203, 213, 225)));
        button.setPadding(dp(10), 0, dp(10), 0);
        return button;
    }

    private Button makePrimaryButton(String label) {
        Button button = makeTopButton(label);
        button.setTextColor(Color.WHITE);
        button.setBackground(makeRoundRect(Color.rgb(20, 184, 166), 8, 1, Color.rgb(15, 118, 110)));
        return button;
    }

    private GradientDrawable makeRoundRect(int color, int radiusDp, int strokeWidthDp, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        if (strokeWidthDp > 0) drawable.setStroke(dp(strokeWidthDp), strokeColor);
        return drawable;
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " GHRPOS/1.0");
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://") || url.startsWith("https://")) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request != null && request.isForMainFrame()) {
                    status("Không tải được Kitchen. Kiểm tra WebView hoặc mạng.");
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && request != null && request.isForMainFrame()) {
                    status("Kitchen trả lỗi " + errorResponse.getStatusCode() + ".");
                }
            }
        });
        webView.addJavascriptInterface(new PrinterBridge(), "GhrPrinter");
    }

    private void loadKitchenUrl() {
        String url = prefs.getString(KEY_WEB_URL, DEFAULT_WEB_URL);
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        status("Đang mở Kitchen");
        webView.loadUrl(url);
    }

    private void showSettingsDialog() {
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(10), dp(18), 0);

        TextView urlLabel = new TextView(this);
        urlLabel.setText("Link web Kitchen online");
        urlLabel.setTextColor(Color.rgb(15, 23, 42));
        urlLabel.setTypeface(Typeface.DEFAULT_BOLD);
        content.addView(urlLabel);

        EditText urlInput = new EditText(this);
        urlInput.setSingleLine(true);
        urlInput.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        urlInput.setText(prefs.getString(KEY_WEB_URL, DEFAULT_WEB_URL));
        content.addView(urlInput);

        TextView printerLabel = new TextView(this);
        printerLabel.setText("\nMáy in: Xprinter 80mm");
        printerLabel.setTextColor(Color.rgb(51, 65, 85));
        content.addView(printerLabel);

        TextView modeLabel = new TextView(this);
        modeLabel.setText("\nKiểu kết nối");
        modeLabel.setTextColor(Color.rgb(15, 23, 42));
        modeLabel.setTypeface(Typeface.DEFAULT_BOLD);
        content.addView(modeLabel);

        LinearLayout modeRow = new LinearLayout(this);
        modeRow.setOrientation(LinearLayout.HORIZONTAL);
        modeRow.setGravity(Gravity.CENTER_VERTICAL);

        Button usbModeButton = new Button(this);
        usbModeButton.setText("USB");
        usbModeButton.setAllCaps(false);
        modeRow.addView(usbModeButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button lanModeButton = new Button(this);
        lanModeButton.setText("LAN/WiFi");
        lanModeButton.setAllCaps(false);
        modeRow.addView(lanModeButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        content.addView(modeRow);

        LinearLayout usbPanel = new LinearLayout(this);
        usbPanel.setOrientation(LinearLayout.VERTICAL);
        usbPanel.setPadding(0, dp(10), 0, 0);

        Button choosePrinterButton = new Button(this);
        choosePrinterButton.setText("Chọn máy in USB");
        choosePrinterButton.setAllCaps(false);
        choosePrinterButton.setOnClickListener(view -> showUsbDevicePicker());
        usbPanel.addView(choosePrinterButton);
        content.addView(usbPanel);

        LinearLayout lanPanel = new LinearLayout(this);
        lanPanel.setOrientation(LinearLayout.VERTICAL);
        lanPanel.setPadding(0, dp(10), 0, 0);

        TextView lanLabel = new TextView(this);
        lanLabel.setText("IP máy in LAN/WiFi");
        lanLabel.setTextColor(Color.rgb(15, 23, 42));
        lanLabel.setTypeface(Typeface.DEFAULT_BOLD);
        lanPanel.addView(lanLabel);

        EditText lanHostInput = new EditText(this);
        lanHostInput.setSingleLine(true);
        lanHostInput.setInputType(InputType.TYPE_CLASS_PHONE);
        lanHostInput.setHint("Ví dụ: 192.168.1.88");
        lanHostInput.setText(prefs.getString(KEY_LAN_HOST, ""));
        lanPanel.addView(lanHostInput);

        TextView portLabel = new TextView(this);
        portLabel.setText("Port máy in");
        portLabel.setTextColor(Color.rgb(15, 23, 42));
        portLabel.setTypeface(Typeface.DEFAULT_BOLD);
        lanPanel.addView(portLabel);

        EditText lanPortInput = new EditText(this);
        lanPortInput.setSingleLine(true);
        lanPortInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        lanPortInput.setText(String.valueOf(getLanPort()));
        lanPanel.addView(lanPortInput);
        content.addView(lanPanel);

        final String[] selectedMode = {getPrinterMode()};
        Runnable refreshMode = () -> {
            boolean lanMode = PRINTER_MODE_LAN.equals(selectedMode[0]);
            usbModeButton.setBackground(makeRoundRect(lanMode ? Color.WHITE : Color.rgb(20, 184, 166), 8, 1, Color.rgb(15, 118, 110)));
            usbModeButton.setTextColor(lanMode ? Color.rgb(15, 23, 42) : Color.WHITE);
            lanModeButton.setBackground(makeRoundRect(lanMode ? Color.rgb(20, 184, 166) : Color.WHITE, 8, 1, Color.rgb(15, 118, 110)));
            lanModeButton.setTextColor(lanMode ? Color.WHITE : Color.rgb(15, 23, 42));
            usbPanel.setVisibility(lanMode ? View.GONE : View.VISIBLE);
            lanPanel.setVisibility(lanMode ? View.VISIBLE : View.GONE);
        };
        usbModeButton.setOnClickListener(view -> {
            selectedMode[0] = PRINTER_MODE_USB;
            refreshMode.run();
        });
        lanModeButton.setOnClickListener(view -> {
            selectedMode[0] = PRINTER_MODE_LAN;
            refreshMode.run();
        });
        refreshMode.run();

        new AlertDialog.Builder(this)
                .setTitle("Cài đặt POS")
                .setView(content)
                .setPositiveButton("Lưu", (dialog, which) -> {
                    prefs.edit()
                            .putString(KEY_WEB_URL, urlInput.getText().toString().trim())
                            .putString(KEY_PRINTER_MODE, selectedMode[0])
                            .putString(KEY_LAN_HOST, lanHostInput.getText().toString().trim())
                            .putInt(KEY_LAN_PORT, parsePort(lanPortInput.getText().toString()))
                            .apply();
                    updatePrinterStatus();
                    loadKitchenUrl();
                })
                .setNegativeButton("Đóng", null)
                .show();
    }

    private void showUsbDevicePicker() {
        HashMap<String, UsbDevice> devices = usbManager.getDeviceList();
        if (devices.isEmpty()) {
            toast("Chưa thấy máy in USB. Kiểm tra dây USB/OTG.");
            updatePrinterStatus();
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
            updatePrinterStatus();
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

    private String getPrinterMode() {
        String mode = prefs.getString(KEY_PRINTER_MODE, PRINTER_MODE_USB);
        return PRINTER_MODE_LAN.equals(mode) ? PRINTER_MODE_LAN : PRINTER_MODE_USB;
    }

    private int parsePort(String value) {
        try {
            int port = Integer.parseInt(String.valueOf(value == null ? "" : value).trim());
            return port > 0 && port <= 65535 ? port : DEFAULT_LAN_PORT;
        } catch (Exception error) {
            return DEFAULT_LAN_PORT;
        }
    }

    private int getLanPort() {
        return prefs.getInt(KEY_LAN_PORT, DEFAULT_LAN_PORT);
    }

    private void updatePrinterStatus() {
        if (printerText == null) return;

        if (PRINTER_MODE_LAN.equals(getPrinterMode())) {
            String host = prefs.getString(KEY_LAN_HOST, "").trim();
            if (host.isEmpty()) {
                printerText.setText("Máy in LAN/WiFi: chưa nhập IP");
                printerText.setTextColor(Color.rgb(194, 65, 12));
                return;
            }

            printerText.setText("Máy in LAN/WiFi: " + host + ":" + getLanPort());
            printerText.setTextColor(Color.rgb(15, 118, 110));
            return;
        }

        UsbDevice device = getSelectedDevice();

        if (device == null) {
            printerText.setText("Máy in: chưa kết nối USB");
            printerText.setTextColor(Color.rgb(185, 28, 28));
            return;
        }

        boolean hasPermission = usbManager.hasPermission(device);
        printerText.setText(hasPermission
                ? "Máy in: Xprinter USB sẵn sàng"
                : "Máy in: cần cấp quyền USB");
        printerText.setTextColor(hasPermission ? Color.rgb(15, 118, 110) : Color.rgb(194, 65, 12));
    }

    private void printTestBill() {
        String time = new SimpleDateFormat("HH:mm dd/MM/yyyy", new Locale("vi", "VN")).format(new Date());
        printReceiptText(
                "GÁNH HÀNG RONG\n" +
                "Bill test Xprinter\n" +
                "Giờ: " + time + "\n" +
                "--------------------------------\n" +
                "1 x Dòng test tiếng Việt có dấu\n" +
                "TỔNG                         0\n" +
                "--------------------------------\n" +
                "Cảm ơn quý khách!"
        );
    }

    private boolean printReceiptText(String text) {
        if (PRINTER_MODE_LAN.equals(getPrinterMode())) {
            return printReceiptTextViaLan(text);
        }

        return printReceiptTextViaUsb(text);
    }

    private boolean printReceiptTextViaLan(String text) {
        String host = prefs.getString(KEY_LAN_HOST, "").trim();
        int port = getLanPort();
        if (host.isEmpty()) {
            status("Chưa nhập IP máy in LAN/WiFi.");
            updatePrinterStatus();
            return false;
        }

        try (Socket socket = new Socket()) {
            status("Đang kết nối máy in LAN/WiFi...");
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(5000);

            OutputStream outputStream = socket.getOutputStream();
            outputStream.write(buildEscPosRaster(text));
            outputStream.flush();

            status("Đã gửi bill tới Xprinter LAN/WiFi.");
            updatePrinterStatus();
            return true;
        } catch (Exception error) {
            status("Không kết nối được máy in LAN/WiFi.");
            updatePrinterStatus();
            return false;
        }
    }

    private boolean printReceiptTextViaUsb(String text) {
        UsbDevice device = getSelectedDevice();
        if (device == null) {
            status("Chưa thấy máy in USB.");
            updatePrinterStatus();
            return false;
        }

        if (!usbManager.hasPermission(device)) {
            pendingPrintText = text;
            status("Đang xin quyền USB.");
            usbManager.requestPermission(device, permissionIntent);
            updatePrinterStatus();
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
            updatePrinterStatus();
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
                        ? "{\"ok\":true,\"message\":\"Đã gửi bill tới Xprinter.\"}"
                        : "{\"ok\":false,\"message\":\"Chưa in được bill. Kiểm tra máy in.\"}";
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
                    ? "{\"ok\":true,\"message\":\"Đã gửi bill test tới Xprinter.\"}"
                    : "{\"ok\":false,\"message\":\"Chưa in được bill test.\"}";
        }
    }
}
