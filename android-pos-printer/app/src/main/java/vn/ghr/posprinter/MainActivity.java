package vn.ghr.posprinter;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
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
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;

import org.json.JSONArray;
import org.json.JSONObject;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {
    private static final String PREFS_NAME = "ghr_pos_printer";
    private static final String KEY_AUTH_EMAIL = "auth_email";
    private static final String KEY_ACCESS_TOKEN = "access_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_AUTH_USER_ID = "auth_user_id";
    private static final String KEY_PROFILE_ID = "profile_id";
    private static final String KEY_PROFILE_NAME = "profile_name";
    private static final String KEY_PROFILE_ROLE = "profile_role";
    private static final String KEY_BRANCH_UUID = "branch_uuid";
    private static final String KEY_BRANCH_NAME = "branch_name";
    private static final String KEY_BRANCH_ALIAS = "branch_alias";
    private static final String KEY_DEVICE_ID = "device_id";
    private static final String KEY_STATION_ENABLED = "station_enabled";
    private static final String KEY_USB_DEVICE = "usb_device";
    private static final String KEY_PRINTER_MODE = "printer_mode";
    private static final String KEY_LAN_HOST = "lan_host";
    private static final String KEY_LAN_PORT = "lan_port";

    private static final String PRINTER_MODE_USB = "usb";
    private static final String PRINTER_MODE_LAN = "lan";
    private static final String PROFILE_TABLE = "profiles";
    private static final String PRINTER_KEY = BuildConfig.DEFAULT_PRINTER_KEY;
    private static final String JOB_TYPE = BuildConfig.DEFAULT_PRINT_JOB_TYPE;
    private static final String PRINT_JOB_SELECT = "id,order_code,source_type,payload,retry_count";
    private static final String SUPABASE_URL = BuildConfig.SUPABASE_URL;
    private static final String SUPABASE_ANON_KEY = BuildConfig.SUPABASE_ANON_KEY;
    private static final String LOYALTY_QR_URL = BuildConfig.LOYALTY_QR_URL;
    private static final String SOURCE_TYPE_POS_PAYMENT_QR = "pos_payment_qr";
    private static final String SOURCE_TYPE_POS_SHIFT_CLOSE = "pos_shift_close";
    private static final String DEFAULT_RECEIPT_FOOTER_TEXT =
            "------------------------------------------\n" +
            "@@CENTER:QuÃ©t QR tÃ­ch Ä‘iá»ƒm ngay\n" +
            "@@QR\n" +
            "@@CENTER:ÄÆ¡n tá»« Grab, ShopeeFood, Xanh Ngon\n" +
            "@@CENTER:Ä‘á»u Ä‘Æ°á»£c tÃ­ch Ä‘iá»ƒm táº¡i GÃ¡nh HÃ ng Rong\n" +
            "@@CENTER:QuÃ©t Ä‘á»ƒ xem Ä‘Æ¡n vÃ  dÃ¹ng Ä‘iá»ƒm\n" +
            "@@CENTER:Hotline: 0933 799 061\n" +
            "@@CENTER:Cáº£m Æ¡n quÃ½ khÃ¡ch!";
    private static final String ACTION_USB_PERMISSION = "vn.ghr.posprinter.USB_PERMISSION";
    private static final int RECEIPT_WIDTH_DOTS_80MM = 576;
    private static final int BIG_TEXT_SIZE = 84;
    private static final int BIG_TEXT_MIN_SIZE = 42;
    private static final int BIG_LINE_HEIGHT = 100;
    private static final int DEFAULT_LAN_PORT = 9100;
    private static final int REALTIME_HEARTBEAT_MS = 25000;
    private static final int REALTIME_RECONNECT_MS = 8000;
    private static final int REALTIME_LOG_THROTTLE_MS = 120000;
    private static final int PRINT_POLL_INTERVAL_MS = 30000;
    private static final int MAX_JOBS_PER_POLL = 3;
    private static final long AUTO_PRINT_WINDOW_MS = TimeUnit.MINUTES.toMillis(5);
    private static final String AUTO_PRINT_EXPIRED_MESSAGE = "Lá»‡nh in quÃ¡ 5 phÃºt. Báº¥m In láº¡i náº¿u cáº§n.";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final OkHttpClient realtimeClient = new OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(20, TimeUnit.SECONDS)
            .build();
    private SharedPreferences prefs;
    private UsbManager usbManager;
    private PendingIntent permissionIntent;

    private EditText emailInput;
    private EditText passwordInput;
    private EditText lanHostInput;
    private EditText lanPortInput;
    private TextView statusText;
    private TextView printerText;
    private TextView stationText;
    private TextView shiftText;
    private TextView logText;
    private Button stationButton;
    private Button usbModeButton;
    private Button lanModeButton;
    private LinearLayout loginPanel;
    private LinearLayout loggedInPanel;
    private LinearLayout usbPanel;
    private LinearLayout lanPanel;
    private LinearLayout productListPanel;
    private LinearLayout cartListPanel;
    private TextView accountSummaryText;
    private TextView menuStatusText;
    private TextView cartSummaryText;
    private TextView paymentStateText;
    private EditText openingCashInput;
    private EditText openingNoteInput;
    private EditText pagerNumberInput;
    private EditText customerNameInput;
    private EditText orderNoteInput;
    private Button createOrderButton;

    private String selectedMode = PRINTER_MODE_USB;
    private String pendingPrintText = "";
    private String pendingPrintQrUrl = "";
    private JSONArray posProducts = new JSONArray();
    private JSONArray posCart = new JSONArray();
    private final PosDraftState posDraftState = new PosDraftState();
    private boolean stationRunning = false;
    private boolean polling = false;
    private boolean realtimeConnecting = false;
    private boolean realtimeJoined = false;
    private boolean alertSoundPlaying = false;
    private int alertSoundCount = 0;
    private int realtimeRef = 1;
    private long lastRealtimeIssueLogAt = 0;
    private Bitmap fixedQrBitmap;
    private byte[] fixedFooterRasterBytes;
    private MediaPlayer alertPlayer;
    private WebSocket realtimeSocket;

    private final Runnable realtimeHeartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            if (!stationRunning || realtimeSocket == null) return;
            sendRealtimeEvent("phoenix", "heartbeat", new JSONObject());
            handler.postDelayed(this, REALTIME_HEARTBEAT_MS);
        }
    };

    private final Runnable realtimeReconnectRunnable = new Runnable() {
        @Override
        public void run() {
            if (stationRunning && realtimeSocket == null) startRealtime();
        }
    };

    private final Runnable printPollingRunnable = new Runnable() {
        @Override
        public void run() {
            if (!stationRunning) return;
            pollOnceAsync();
            handler.postDelayed(this, PRINT_POLL_INTERVAL_MS);
        }
    };

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            if (granted && device != null) {
                saveSelectedDevice(device);
                status("ÄÃ£ cáº¥p quyá»n mÃ¡y in USB.");
                updatePrinterStatus();
                if (!pendingPrintText.isEmpty()) {
                    String text = pendingPrintText;
                    String qrUrl = pendingPrintQrUrl;
                    pendingPrintText = "";
                    pendingPrintQrUrl = "";
                    printReceiptPayload(text, qrUrl, "");
                }
            } else {
                status("ChÆ°a cáº¥p quyá»n mÃ¡y in USB.");
                updatePrinterStatus();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        ensureDeviceId();
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
        loadSettingsToInputs();
        updateModeUi();
        updatePrinterStatus();
        updateStationUi();
        log("Má»Ÿ GHR Print Station.");
        refreshActiveShiftAsync();
        updateCartUi();
        if (!prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()) {
            refreshPosMenuAsync();
        }

        if (prefs.getBoolean(KEY_STATION_ENABLED, false)) {
            startStation();
        }
    }

    @Override
    protected void onDestroy() {
        stationRunning = false;
        handler.removeCallbacks(printPollingRunnable);
        handler.removeCallbacks(realtimeReconnectRunnable);
        stopNewOrderAlert();
        closeRealtime();
        unregisterReceiver(usbReceiver);
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }

    private View buildLayout() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(Color.rgb(248, 250, 252));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(14), dp(14), dp(14), dp(18));
        scrollView.addView(root, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT,
                ScrollView.LayoutParams.WRAP_CONTENT
        ));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(0, 0, 0, dp(14));

        ImageView logo = new ImageView(this);
        logo.setImageResource(getResources().getIdentifier("logo_icon", "drawable", getPackageName()));
        logo.setScaleType(ImageView.ScaleType.CENTER_CROP);
        logo.setBackground(makeRoundRect(Color.rgb(255, 205, 0), 10, 0, Color.TRANSPARENT));
        header.addView(logo, new LinearLayout.LayoutParams(dp(52), dp(52)));

        LinearLayout brand = new LinearLayout(this);
        brand.setOrientation(LinearLayout.VERTICAL);
        brand.setPadding(dp(12), 0, 0, 0);

        TextView title = new TextView(this);
        title.setText(cleanVietnamese("GÃ¡nh HÃ ng Rong"));
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        brand.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText(cleanVietnamese("Tráº¡m in bill khÃ¡ch Â· Xprinter 80mm"));
        subtitle.setTextColor(Color.rgb(71, 85, 105));
        subtitle.setTextSize(13);
        subtitle.setTypeface(Typeface.DEFAULT_BOLD);
        brand.addView(subtitle);

        header.addView(brand, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        root.addView(header);

        stationText = makeInfoText("Tráº¡m in Ä‘ang táº¯t", Color.rgb(185, 28, 28));
        root.addView(stationText, fullWidthParams());

        statusText = makeInfoText("Sáºµn sÃ ng.", Color.rgb(71, 85, 105));
        root.addView(statusText, fullWidthParams());

        printerText = makeInfoText("", Color.rgb(15, 118, 110));
        root.addView(printerText, fullWidthParams());

        root.addView(buildAuthSection());
        root.addView(buildPosShiftSection());
        root.addView(buildNativePosOrderSection());

        root.addView(makeSectionTitle("Káº¿t ná»‘i mÃ¡y in"));
        LinearLayout modeRow = new LinearLayout(this);
        modeRow.setOrientation(LinearLayout.HORIZONTAL);
        modeRow.setGravity(Gravity.CENTER_VERTICAL);

        usbModeButton = makeButton("USB", false);
        usbModeButton.setOnClickListener(view -> {
            selectedMode = PRINTER_MODE_USB;
            updateModeUi();
        });
        modeRow.addView(usbModeButton, new LinearLayout.LayoutParams(0, dp(48), 1));

        lanModeButton = makeButton("LAN/WiFi", false);
        lanModeButton.setOnClickListener(view -> {
            selectedMode = PRINTER_MODE_LAN;
            updateModeUi();
        });
        LinearLayout.LayoutParams lanModeParams = new LinearLayout.LayoutParams(0, dp(48), 1);
        lanModeParams.setMargins(dp(8), 0, 0, 0);
        modeRow.addView(lanModeButton, lanModeParams);
        root.addView(modeRow, fullWidthParams());

        usbPanel = new LinearLayout(this);
        usbPanel.setOrientation(LinearLayout.VERTICAL);
        Button chooseUsbButton = makeButton("Chá»n mÃ¡y in USB", false);
        chooseUsbButton.setOnClickListener(view -> showUsbDevicePicker());
        usbPanel.addView(chooseUsbButton, fullWidthParams());
        root.addView(usbPanel);

        lanPanel = new LinearLayout(this);
        lanPanel.setOrientation(LinearLayout.VERTICAL);
        lanHostInput = makeInput("IP mÃ¡y in, vÃ­ dá»¥ 192.168.1.88");
        lanHostInput.setInputType(InputType.TYPE_CLASS_PHONE);
        lanPanel.addView(lanHostInput, fullWidthParams());
        lanPortInput = makeInput("Port mÃ¡y in");
        lanPortInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        lanPanel.addView(lanPortInput, fullWidthParams());
        root.addView(lanPanel);

        LinearLayout actionRow = new LinearLayout(this);
        actionRow.setOrientation(LinearLayout.VERTICAL);

        Button saveButton = makeButton("LÆ°u cÃ i Ä‘áº·t", false);
        saveButton.setOnClickListener(view -> saveSettingsFromInputs());
        actionRow.addView(saveButton, tallButtonParams());

        stationButton = makeButton("Báº­t tráº¡m in", true);
        stationButton.setOnClickListener(view -> {
            if (stationRunning) {
                stopStation();
            } else {
                saveSettingsFromInputs();
                startStation();
            }
        });
        actionRow.addView(stationButton, tallButtonParams());
        root.addView(actionRow, fullWidthParams());

        LinearLayout printRow = new LinearLayout(this);
        printRow.setOrientation(LinearLayout.VERTICAL);

        Button checkButton = makeButton("Kiá»ƒm tra lá»‡nh in", false);
        checkButton.setOnClickListener(view -> {
            saveSettingsFromInputs();
            pollOnceAsync();
        });
        printRow.addView(checkButton, tallButtonParams());

        Button testButton = makeButton("In test", false);
        testButton.setOnClickListener(view -> {
            saveSettingsFromInputs();
            printTestBill();
        });
        printRow.addView(testButton, tallButtonParams());
        root.addView(printRow, fullWidthParams());

        root.addView(makeSectionTitle("Nháº­t kÃ½"));
        logText = new TextView(this);
        logText.setTextColor(Color.rgb(51, 65, 85));
        logText.setTextSize(13);
        logText.setPadding(dp(12), dp(10), dp(12), dp(10));
        logText.setBackground(makeRoundRect(Color.WHITE, 8, 1, Color.rgb(226, 232, 240)));
        root.addView(logText, fullWidthParams());

        return scrollView;
    }

    private View buildAuthSection() {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);

        loginPanel = new LinearLayout(this);
        loginPanel.setOrientation(LinearLayout.VERTICAL);
        loginPanel.addView(makeSectionTitle("TÃ i khoáº£n chi nhÃ¡nh"));

        emailInput = makeInput("Email tÃ i khoáº£n báº¿p/chi nhÃ¡nh");
        emailInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        loginPanel.addView(emailInput, fullWidthParams());

        passwordInput = makeInput("Máº­t kháº©u");
        passwordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        loginPanel.addView(passwordInput, fullWidthParams());

        Button loginButton = makeButton("ÄÄƒng nháº­p chi nhÃ¡nh", true);
        loginButton.setOnClickListener(view -> loginAsync());
        loginPanel.addView(loginButton, tallButtonParams());
        wrapper.addView(loginPanel);

        loggedInPanel = new LinearLayout(this);
        loggedInPanel.setOrientation(LinearLayout.VERTICAL);
        loggedInPanel.addView(makeSectionTitle("TÃ i khoáº£n Ä‘ang dÃ¹ng"));

        accountSummaryText = makeInfoText("", Color.rgb(15, 118, 110));
        loggedInPanel.addView(accountSummaryText, fullWidthParams());

        Button logoutButton = makeButton("ÄÄƒng xuáº¥t", false);
        logoutButton.setOnClickListener(view -> logout());
        loggedInPanel.addView(logoutButton, tallButtonParams());
        wrapper.addView(loggedInPanel);

        return wrapper;
    }

    private View buildPosShiftSection() {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.addView(makeSectionTitle("Ca POS"));

        shiftText = makeInfoText("Chưa tải ca POS.", Color.rgb(71, 85, 105));
        wrapper.addView(shiftText, fullWidthParams());

        openingCashInput = makeInput("Tiền đầu ca");
        openingCashInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        wrapper.addView(openingCashInput, fullWidthParams());

        openingNoteInput = makeInput("Ghi chú mở ca");
        openingNoteInput.setInputType(InputType.TYPE_CLASS_TEXT);
        wrapper.addView(openingNoteInput, fullWidthParams());

        Button openShiftButton = makeButton("Mở ca POS", true);
        openShiftButton.setOnClickListener(view -> openPosShiftAsync());
        wrapper.addView(openShiftButton, tallButtonParams());

        Button refreshShiftButton = makeButton("Tải lại ca POS", false);
        refreshShiftButton.setOnClickListener(view -> refreshActiveShiftAsync());
        wrapper.addView(refreshShiftButton, tallButtonParams());

        return wrapper;
    }

    @Deprecated
    private View buildNativePosOrderSectionLegacy() {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.addView(makeSectionTitle("Món bán nhanh"));

        menuStatusText = makeInfoText("Chưa tải menu POS.", Color.rgb(71, 85, 105));
        wrapper.addView(menuStatusText, fullWidthParams());

        Button refreshMenuButton = makeButton("Tải menu POS", false);
        refreshMenuButton.setOnClickListener(view -> refreshPosMenuAsync());
        wrapper.addView(refreshMenuButton, tallButtonParams());

        productListPanel = new LinearLayout(this);
        productListPanel.setOrientation(LinearLayout.VERTICAL);
        wrapper.addView(productListPanel, fullWidthParams());

        wrapper.addView(makeSectionTitle("Bill hiện tại"));
        cartSummaryText = makeInfoText("Chưa có món.", Color.rgb(71, 85, 105));
        wrapper.addView(cartSummaryText, fullWidthParams());

        cartListPanel = new LinearLayout(this);
        cartListPanel.setOrientation(LinearLayout.VERTICAL);
        wrapper.addView(cartListPanel, fullWidthParams());

        Button clearCartButton = makeButton("Xóa bill", false);
        clearCartButton.setOnClickListener(view -> {
            posCart = new JSONArray();
            updateCartUi();
        });
        wrapper.addView(clearCartButton, tallButtonParams());

        Button cashPaymentButton = makeButton("Thanh toán tiền mặt", true);
        cashPaymentButton.setOnClickListener(view -> showCashPaymentDialog());
        wrapper.addView(cashPaymentButton, tallButtonParams());

        return wrapper;
    }

    @Deprecated
    private View buildNativePosOrderSectionLegacyV2() {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.addView(makeSectionTitle("Món bán nhanh"));

        menuStatusText = makeInfoText("Chưa tải menu POS.", Color.rgb(71, 85, 105));
        wrapper.addView(menuStatusText, fullWidthParams());

        Button refreshMenuButton = makeButton("Tải menu POS", false);
        refreshMenuButton.setOnClickListener(view -> refreshPosMenuAsync());
        wrapper.addView(refreshMenuButton, tallButtonParams());

        productListPanel = new LinearLayout(this);
        productListPanel.setOrientation(LinearLayout.VERTICAL);
        wrapper.addView(productListPanel, fullWidthParams());

        wrapper.addView(makeSectionTitle("Bill hiện tại"));

        pagerNumberInput = makeInput("Thẻ rung");
        pagerNumberInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        wrapper.addView(pagerNumberInput, fullWidthParams());

        customerNameInput = makeInput("Tên khách (không bắt buộc)");
        customerNameInput.setInputType(InputType.TYPE_CLASS_TEXT);
        wrapper.addView(customerNameInput, fullWidthParams());

        orderNoteInput = makeInput("Ghi chú đơn (không bắt buộc)");
        orderNoteInput.setInputType(InputType.TYPE_CLASS_TEXT);
        wrapper.addView(orderNoteInput, fullWidthParams());

        cartSummaryText = makeInfoText("Chưa có món.", Color.rgb(71, 85, 105));
        wrapper.addView(cartSummaryText, fullWidthParams());

        cartListPanel = new LinearLayout(this);
        cartListPanel.setOrientation(LinearLayout.VERTICAL);
        wrapper.addView(cartListPanel, fullWidthParams());

        paymentStateText = makeInfoText("Chưa xác nhận thanh toán.", Color.rgb(71, 85, 105));
        wrapper.addView(paymentStateText, fullWidthParams());

        Button clearCartButton = makeButton("Xóa bill", false);
        clearCartButton.setOnClickListener(view -> {
            posCart = new JSONArray();
            clearConfirmedPayment();
            updateCartUi();
        });
        wrapper.addView(clearCartButton, tallButtonParams());

        Button cashPaymentButton = makeButton("Xác nhận tiền mặt", true);
        cashPaymentButton.setOnClickListener(view -> showCashPaymentDialogLegacyV2());
        wrapper.addView(cashPaymentButton, tallButtonParams());

        createOrderButton = makeButton("Tạo đơn + in bill", false);
        createOrderButton.setOnClickListener(view -> showCreateOrderConfirmDialog());
        wrapper.addView(createOrderButton, tallButtonParams());

        updatePaymentStateUi();
        return wrapper;
    }

    private View buildNativePosOrderSection() {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);

        PosOrderSection.Refs refs = PosOrderSection.build(this, wrapper, new PosOrderSection.Listener() {
            @Override
            public void onRefreshMenu() {
                refreshPosMenuAsync();
            }

            @Override
            public void onClearCart() {
                posCart = new JSONArray();
                clearConfirmedPayment();
                updateCartUi();
            }

            @Override
            public void onCashPayment() {
                showCashPaymentDialog();
            }

            @Override
            public void onCreateOrder() {
                showCreateOrderConfirmDialog();
            }
        });

        menuStatusText = refs.menuStatusText;
        productListPanel = refs.productListPanel;
        pagerNumberInput = refs.pagerNumberInput;
        customerNameInput = refs.customerNameInput;
        orderNoteInput = refs.orderNoteInput;
        cartSummaryText = refs.cartSummaryText;
        cartListPanel = refs.cartListPanel;
        paymentStateText = refs.paymentStateText;
        createOrderButton = refs.createOrderButton;

        updatePaymentStateUi();
        return wrapper;
    }

    @Deprecated
    private void showCashPaymentDialogLegacyV2() {
        String validationError = validateOrderDraftBeforePayment();
        if (!validationError.isEmpty()) {
            toast(validationError);
            return;
        }

        int total = getCartTotal(posCart);
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(4), dp(8), dp(4), 0);

        TextView totalText = makeInfoText("Tổng cần thu: " + formatMoney(total), Color.rgb(15, 118, 110));
        panel.addView(totalText, fullWidthParams());

        EditText cashInput = makeInput("Tiền khách đưa");
        cashInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        cashInput.setText(String.valueOf(Math.max(total, posDraftState.getConfirmedCashReceived())));
        panel.addView(cashInput, fullWidthParams());

        LinearLayout suggestionRow = new LinearLayout(this);
        suggestionRow.setOrientation(LinearLayout.HORIZONTAL);
        int[] suggestions = new int[]{50000, 100000, 200000, 500000};
        for (int i = 0; i < suggestions.length; i++) {
            int value = suggestions[i];
            Button button = makeButton(formatMoney(value), false);
            button.setOnClickListener(view -> cashInput.setText(String.valueOf(value)));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(52), 1f);
            if (i < suggestions.length - 1) params.setMargins(0, 0, dp(6), 0);
            suggestionRow.addView(button, params);
        }
        panel.addView(suggestionRow, fullWidthParams());

        TextView changeText = makeInfoText("Tiền thối: 0đ", Color.rgb(71, 85, 105));
        panel.addView(changeText, fullWidthParams());

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(cleanVietnamese("Thanh toán tiền mặt"))
                .setView(panel)
                .setNegativeButton(cleanVietnamese("Hủy"), null)
                .setPositiveButton(cleanVietnamese("Xác nhận"), null)
                .create();

        dialog.setOnShowListener(item -> dialog.getButton(DialogInterface.BUTTON_POSITIVE).setOnClickListener(view -> {
            int received = parseMoney(cashInput.getText().toString());
            int change = received - total;
            changeText.setText(cleanVietnamese("Tiền thối: " + formatMoney(Math.max(0, change))));
            if (received < total) {
                changeText.setTextColor(Color.rgb(185, 28, 28));
                toast("Tiền khách đưa chưa đủ.");
                return;
            }
            confirmCashPayment(received);
            dialog.dismiss();
        }));

        dialog.show();
    }

    private void showCashPaymentDialog() {
        String validationError = validateOrderDraftBeforePayment();
        if (!validationError.isEmpty()) {
            toast(validationError);
            return;
        }
        PosCashPaymentDialog.show(this, getCartTotal(posCart), posDraftState.getConfirmedCashReceived(), this::confirmCashPayment);
    }

    private void showCreateOrderConfirmDialog() {
        String validationError = validateDraftBeforeCreateOrder();
        if (!validationError.isEmpty()) {
            toast(validationError);
            return;
        }

        String summary = "Thẻ rung: " + getPagerNumber()
                + "\nTổng cần thu: " + formatMoney(getCartTotal(posCart))
                + "\nTiền khách đưa: " + formatMoney(posDraftState.getConfirmedCashReceived())
                + "\nTiền thối: " + formatMoney(Math.max(0, posDraftState.getConfirmedChangeAmount()))
                + "\n\nXác nhận tạo đơn POS và in bill?";
        PosCreateOrderConfirmDialog.show(this, cleanVietnamese(summary), this::createCashOrderAsync);
    }

    private void confirmCashPayment(int receivedAmount) {
        posDraftState.confirmCashPayment(receivedAmount, getCartTotal(posCart), buildBillPaymentKey(), buildIsoUtcNow());
        updatePaymentStateUi();
        toast("Đã xác nhận thanh toán tiền mặt.");
    }

    private void createCashOrderAsync() {
        final JSONArray cartSnapshot;
        try {
            cartSnapshot = new JSONArray(posCart.toString());
        } catch (Exception error) {
            toast("Không đọc được bill hiện tại.");
            return;
        }

        String validationError = validateDraftBeforeCreateOrder();
        if (!validationError.isEmpty()) {
            toast(validationError);
            return;
        }

        int total = getCartTotal(cartSnapshot);
        log("Đang tạo đơn POS tiền mặt...");
        new Thread(() -> {
            try {
                JSONObject activeShift = readActiveShift();
                if (activeShift == null) {
                    runOnUiThread(() -> toast("Chưa mở ca POS. Vui lòng mở ca trước."));
                    updateShiftUi(null, "Chưa có ca POS đang mở.");
                    return;
                }

                String orderCode = buildPosOrderCode();
                String displayOrderCode = buildShortDisplayOrderCode(orderCode);
                String createdAt = posDraftState.getConfirmedPaidAt().isEmpty() ? buildIsoUtcNow() : posDraftState.getConfirmedPaidAt();
                String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
                String branchName = getBranchLabel();
                String cashierName = firstText(
                        prefs.getString(KEY_PROFILE_NAME, ""),
                        prefs.getString(KEY_AUTH_EMAIL, ""),
                        "Thu ngân"
                );
                String shiftId = activeShift.optString("id", "");
                String pagerNumber = getPagerNumber();
                String customerName = getCustomerNameOrFallback(pagerNumber);
                String orderNote = getOrderNote();

                JSONObject metadata = new JSONObject();
                metadata.put("source", "pos");
                metadata.put("channel", "pos");
                metadata.put("orderSource", "pos");
                metadata.put("orderType", "takeaway");
                metadata.put("walkIn", customerNameInput == null || customerNameInput.getText().toString().trim().isEmpty());
                metadata.put("displayOrderCode", displayOrderCode);
                metadata.put("pagerNumber", pagerNumber);
                metadata.put("pager_number", pagerNumber);
                metadata.put("pagerStatus", "assigned");
                metadata.put("paymentMethod", posDraftState.getConfirmedPaymentMethod());
                metadata.put("paymentStatus", "paid");
                metadata.put("paymentAmount", total);
                metadata.put("paymentReference", posDraftState.getConfirmedPaymentReference());
                metadata.put("cashReceived", posDraftState.getConfirmedCashReceived());
                metadata.put("changeAmount", posDraftState.getConfirmedChangeAmount());
                metadata.put("paidAt", createdAt);
                metadata.put("posShiftId", shiftId);
                metadata.put("pos_shift_id", shiftId);
                metadata.put("cashierName", cashierName);
                metadata.put("branchUuid", branchUuid);
                metadata.put("branchName", branchName);
                metadata.put("customerPhone", JSONObject.NULL);
                metadata.put("customerPhoneKey", "walkin:" + orderCode);
                metadata.put("orderNote", orderNote);
                metadata.put("items", cartSnapshot);

                JSONObject orderBody = new JSONObject();
                orderBody.put("id", orderCode);
                orderBody.put("order_code", orderCode);
                orderBody.put("customer_phone", JSONObject.NULL);
                orderBody.put("customer_name", customerName);
                orderBody.put("fulfillment_type", "pickup");
                orderBody.put("payment_method", posDraftState.getConfirmedPaymentMethod());
                orderBody.put("status", "pending_zalo");
                orderBody.put("subtotal", total);
                orderBody.put("shipping_fee", 0);
                orderBody.put("original_shipping_fee", 0);
                orderBody.put("shipping_support_discount", 0);
                orderBody.put("promo_discount", 0);
                orderBody.put("promo_code", "");
                orderBody.put("points_discount", 0);
                orderBody.put("points_earned", 0);
                orderBody.put("total_amount", total);
                orderBody.put("branch_uuid", branchUuid.isEmpty() ? JSONObject.NULL : branchUuid);
                orderBody.put("branch_name", branchName);
                orderBody.put("pickup_branch_uuid", branchUuid.isEmpty() ? JSONObject.NULL : branchUuid);
                orderBody.put("pickup_branch_name", branchName);
                orderBody.put("pickup_time_text", "Lấy tại quầy");
                orderBody.put("delivery_address", "Khách nhận tại quầy");
                orderBody.put("pos_shift_id", shiftId.isEmpty() ? JSONObject.NULL : shiftId);
                orderBody.put("metadata", metadata);

                httpRequest(
                        "POST",
                        SUPABASE_URL + "/rest/v1/orders?select=id,order_code,total_amount,created_at",
                        orderBody.toString(),
                        true
                );

                JSONArray itemRows = buildCashOrderItemRows(orderCode, cartSnapshot);
                if (itemRows.length() > 0) {
                    httpRequest("POST", SUPABASE_URL + "/rest/v1/order_items", itemRows.toString(), false);
                }

                String receiptText = buildCashReceiptText(
                        orderCode,
                        displayOrderCode,
                        cartSnapshot,
                        total,
                        posDraftState.getConfirmedCashReceived(),
                        posDraftState.getConfirmedChangeAmount(),
                        cashierName,
                        branchName,
                        pagerNumber,
                        customerName,
                        orderNote
                );
                boolean printed = printReceiptPayload(receiptText, LOYALTY_QR_URL, "");

                runOnUiThread(() -> {
                    posCart = new JSONArray();
                    clearConfirmedPayment();
                    if (pagerNumberInput != null) pagerNumberInput.setText("");
                    if (customerNameInput != null) customerNameInput.setText("");
                    if (orderNoteInput != null) orderNoteInput.setText("");
                    updateCartUi();
                    toast(printed ? "Đã tạo đơn và in bill." : "Đã tạo đơn, nhưng chưa in được bill.");
                });
                log((printed ? "Đã tạo đơn POS và in bill: " : "Đã tạo đơn POS, cần kiểm tra máy in: ") + orderCode);
            } catch (Exception error) {
                log("Không tạo được đơn POS tiền mặt: " + shortError(error));
            }
        }).start();
    }

    private String validateOrderDraftBeforePayment() {
        if (prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()) return "Vui lòng đăng nhập chi nhánh trước khi thanh toán.";
        if (posDraftState.getCachedActiveShift() == null) return "Vui lòng mở ca POS trước khi thanh toán.";
        if (posCart.length() == 0 || getCartTotal(posCart) <= 0) return "Chưa có món trong bill.";
        if (getPagerNumber().isEmpty()) return "Vui lòng nhập thẻ rung trước khi thanh toán.";
        return "";
    }

    private String validateDraftBeforeCreateOrder() {
        String paymentError = validateOrderDraftBeforePayment();
        if (!paymentError.isEmpty()) return paymentError;
        if (!posDraftState.hasConfirmedPayment()) return "Vui lòng xác nhận thanh toán trước khi tạo đơn.";
        if (!posDraftState.matchesBillKey(buildBillPaymentKey())) return "Bill đã thay đổi sau khi xác nhận tiền. Vui lòng xác nhận lại thanh toán.";
        return "";
    }

    private void clearConfirmedPayment() {
        posDraftState.clearConfirmedPayment();
        updatePaymentStateUi();
    }

    private void syncConfirmedPaymentWithCurrentBill() {
        if (!posDraftState.hasConfirmedPayment()) return;
        if (!posDraftState.matchesBillKey(buildBillPaymentKey())) {
            clearConfirmedPayment();
        }
    }

    private void updatePaymentStateUi() {
        if (paymentStateText == null) return;
        if (!posDraftState.hasConfirmedPayment()) {
            paymentStateText.setText(cleanVietnamese("Chưa xác nhận thanh toán."));
            paymentStateText.setTextColor(Color.rgb(71, 85, 105));
            if (createOrderButton != null) createOrderButton.setEnabled(false);
            return;
        }

        String method = posDraftState.getConfirmedPaymentMethod();
        String message = "Đã xác nhận " + ("cash".equals(method) ? "tiền mặt" : method)
                + "\nKhách đưa: " + formatMoney(posDraftState.getConfirmedCashReceived())
                + "\nTiền thối: " + formatMoney(posDraftState.getConfirmedChangeAmount());
        paymentStateText.setText(cleanVietnamese(message));
        paymentStateText.setTextColor(Color.rgb(15, 118, 110));
        if (createOrderButton != null) createOrderButton.setEnabled(true);
    }

    private String buildBillPaymentKey() {
        return getPagerNumber() + "|" + getCartTotal(posCart) + "|" + posCart.toString();
    }

    private String getPagerNumber() {
        return pagerNumberInput == null ? "" : String.valueOf(pagerNumberInput.getText()).trim();
    }

    private String getCustomerNameOrFallback(String pagerNumber) {
        String typedName = customerNameInput == null ? "" : String.valueOf(customerNameInput.getText()).trim();
        return typedName.isEmpty() ? "Khách thẻ " + pagerNumber : typedName;
    }

    private String getOrderNote() {
        return orderNoteInput == null ? "" : String.valueOf(orderNoteInput.getText()).trim();
    }

    private String buildIsoUtcNow() {
        return PosOrderHelper.buildIsoUtcNow();
    }

    private void loadSettingsToInputs() {
        emailInput.setText(prefs.getString(KEY_AUTH_EMAIL, ""));
        passwordInput.setText("");
        selectedMode = getPrinterMode();
        lanHostInput.setText(prefs.getString(KEY_LAN_HOST, ""));
        lanPortInput.setText(String.valueOf(getLanPort()));
    }

    private void saveSettingsFromInputs() {
        prefs.edit()
                .putString(KEY_AUTH_EMAIL, emailInput.getText().toString().trim())
                .putString(KEY_PRINTER_MODE, selectedMode)
                .putString(KEY_LAN_HOST, lanHostInput.getText().toString().trim())
                .putInt(KEY_LAN_PORT, parsePort(lanPortInput.getText().toString()))
                .apply();
        updatePrinterStatus();
        log("ÄÃ£ lÆ°u cÃ i Ä‘áº·t.");
    }

    private void loginAsync() {
        saveSettingsFromInputs();
        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();
        if (email.isEmpty() || password.isEmpty()) {
            status("Vui lÃ²ng nháº­p email vÃ  máº­t kháº©u.");
            return;
        }

        log("Äang Ä‘Äƒng nháº­p tÃ i khoáº£n chi nhÃ¡nh...");
        new Thread(() -> {
            try {
                JSONObject auth = signInWithPassword(email, password);
                JSONObject user = auth.optJSONObject("user");
                String accessToken = auth.optString("access_token", "");
                String refreshToken = auth.optString("refresh_token", "");
                String authUserId = user == null ? "" : user.optString("id", "");
                String authEmail = user == null ? email : user.optString("email", email);
                JSONObject authUserMetadata = user == null ? null : user.optJSONObject("user_metadata");

                if (accessToken.isEmpty() || authUserId.isEmpty()) {
                    throw new Exception("Supabase chÆ°a tráº£ session há»£p lá»‡.");
                }

                JSONObject profile = readProfile(accessToken, authUserId, authEmail);
                applyProfileSession(accessToken, refreshToken, authUserId, authEmail, profile, authUserMetadata);
                runOnUiThread(() -> passwordInput.setText(""));
                log("ÄÄƒng nháº­p thÃ nh cÃ´ng: " + getBranchLabel() + ".");
                refreshActiveShiftAsync();
                refreshPosMenuAsync();
            } catch (Exception error) {
                clearAuthSession(false);
                log("ÄÄƒng nháº­p tháº¥t báº¡i: " + normalizeAuthError(error));
            }
        }).start();
    }

    private JSONObject signInWithPassword(String email, String password) throws Exception {
        JSONObject body = new JSONObject();
        body.put("email", email);
        body.put("password", password);
        String url = SUPABASE_URL + "/auth/v1/token?grant_type=password";
        return new JSONObject(httpRequest("POST", url, body.toString(), false, ""));
    }

    private JSONObject refreshAccessToken() throws Exception {
        String refreshToken = prefs.getString(KEY_REFRESH_TOKEN, "").trim();
        if (refreshToken.isEmpty()) throw new Exception("ChÆ°a cÃ³ refresh token.");

        JSONObject body = new JSONObject();
        body.put("refresh_token", refreshToken);
        String url = SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token";
        JSONObject auth = new JSONObject(httpRequest("POST", url, body.toString(), false, ""));
        String accessToken = auth.optString("access_token", "");
        String nextRefreshToken = auth.optString("refresh_token", refreshToken);
        if (accessToken.isEmpty()) throw new Exception("KhÃ´ng lÃ m má»›i Ä‘Æ°á»£c phiÃªn Ä‘Äƒng nháº­p.");

        prefs.edit()
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, nextRefreshToken)
                .apply();
        return auth;
    }

    private JSONObject readProfile(String accessToken, String authUserId, String email) throws Exception {
        String select = "*";
        String urlByUser = SUPABASE_URL + "/rest/v1/" + PROFILE_TABLE
                + "?select=" + select
                + "&auth_user_id=eq." + enc(authUserId)
                + "&limit=1";
        JSONArray byUser = new JSONArray(httpRequest("GET", urlByUser, null, false, accessToken));
        if (byUser.length() > 0) return byUser.getJSONObject(0);

        String urlByEmail = SUPABASE_URL + "/rest/v1/" + PROFILE_TABLE
                + "?select=" + select
                + "&email=ilike." + enc(email)
                + "&limit=1";
        JSONArray byEmail = new JSONArray(httpRequest("GET", urlByEmail, null, false, accessToken));
        if (byEmail.length() > 0) return byEmail.getJSONObject(0);

        throw new Exception("TÃ i khoáº£n nÃ y chÆ°a cÃ³ há»“ sÆ¡ trong báº£ng profiles.");
    }

    private void applyProfileSession(String accessToken, String refreshToken, String authUserId, String authEmail, JSONObject profile, JSONObject authUserMetadata) throws Exception {
        String role = profile.optString("role", "").trim().toLowerCase(Locale.US);
        String status = profile.optString("status", "").trim().toLowerCase(Locale.US);
        if (!"active".equals(status)) {
            throw new Exception("TÃ i khoáº£n chi nhÃ¡nh chÆ°a active.");
        }
        if (!("admin".equals(role) || "staff".equals(role) || "kitchen".equals(role))) {
            throw new Exception("TÃ i khoáº£n nÃ y chÆ°a cÃ³ quyá»n báº¿p.");
        }

        JSONObject metadata = profile.optJSONObject("metadata");
        if (metadata == null) metadata = new JSONObject();

        JSONObject branchInfo = resolveBranchInfo(accessToken, profile, metadata, authUserMetadata);
        String branchUuid = branchInfo.optString("branchUuid", "");
        if (branchUuid.isEmpty()) {
            throw new Exception("KhÃ´ng tÃ¬m tháº¥y branch_uuid cho tÃ i khoáº£n nÃ y.");
        }
        String branchName = branchInfo.optString("branchName", "");
        String branchAlias = branchInfo.optString("branchAlias", "");
        String profileName = firstText(profile.optString("name", ""), authEmail);

        prefs.edit()
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, refreshToken)
                .putString(KEY_AUTH_USER_ID, authUserId)
                .putString(KEY_PROFILE_ID, profile.optString("id", ""))
                .putString(KEY_AUTH_EMAIL, authEmail)
                .putString(KEY_PROFILE_NAME, profileName)
                .putString(KEY_PROFILE_ROLE, role)
                .putString(KEY_BRANCH_UUID, branchUuid)
                .putString(KEY_BRANCH_NAME, branchName)
                .putString(KEY_BRANCH_ALIAS, branchAlias)
                .apply();
        runOnUiThread(() -> {
            emailInput.setText(authEmail);
            updateStationUi();
        });
    }

    private JSONObject resolveBranchInfo(String accessToken, JSONObject profile, JSONObject metadata, JSONObject authUserMetadata) throws Exception {
        if (authUserMetadata == null) authUserMetadata = new JSONObject();

        String directUuid = firstText(
                profile.optString("branch_uuid", ""),
                profile.optString("branchUuid", ""),
                metadata.optString("branch_uuid", ""),
                metadata.optString("branchUuid", ""),
                authUserMetadata.optString("branch_uuid", ""),
                authUserMetadata.optString("branchUuid", "")
        );
        String directName = firstText(
                profile.optString("branch_name", ""),
                profile.optString("branchName", ""),
                metadata.optString("branch_name", ""),
                metadata.optString("branchName", ""),
                authUserMetadata.optString("branch_name", ""),
                authUserMetadata.optString("branchName", "")
        );
        String directAlias = firstText(
                profile.optString("branch_alias", ""),
                profile.optString("branchAlias", ""),
                metadata.optString("branch_alias", ""),
                metadata.optString("branchAlias", ""),
                authUserMetadata.optString("branch_alias", ""),
                authUserMetadata.optString("branchAlias", "")
        );
        if (!directUuid.isEmpty()) {
            return buildBranchInfo(directUuid, directName, directAlias);
        }

        JSONObject branch = findBranchForProfile(accessToken, profile, metadata, authUserMetadata);
        if (branch != null) {
            JSONObject data = branch.optJSONObject("data");
            if (data == null) data = new JSONObject();
            String branchUuid = firstText(
                    branch.optString("branch_uuid", ""),
                    branch.optString("branchUuid", ""),
                    data.optString("branch_uuid", ""),
                    data.optString("branchUuid", ""),
                    data.optString("uuid", "")
            );
            String branchName = firstText(branch.optString("name", ""), data.optString("name", ""), directName);
            String branchAlias = firstText(branch.optString("slug", ""), branch.optString("branch_code", ""), directAlias);
            if (!branchUuid.isEmpty()) return buildBranchInfo(branchUuid, branchName, branchAlias);
        }

        throw new Exception("Profile chÆ°a cÃ³ branch_uuid. Vui lÃ²ng gÃ¡n chi nhÃ¡nh cho tÃ i khoáº£n nÃ y trong Admin/Supabase.");
    }

    private JSONObject buildBranchInfo(String branchUuid, String branchName, String branchAlias) throws Exception {
        JSONObject result = new JSONObject();
        result.put("branchUuid", branchUuid);
        result.put("branchName", branchName);
        result.put("branchAlias", branchAlias);
        return result;
    }

    private JSONObject findBranchForProfile(String accessToken, JSONObject profile, JSONObject metadata, JSONObject authUserMetadata) {
        String branchId = firstText(
                profile.optString("branch_id", ""),
                profile.optString("branchId", ""),
                metadata.optString("branch_id", ""),
                metadata.optString("branchId", ""),
                authUserMetadata.optString("branch_id", ""),
                authUserMetadata.optString("branchId", "")
        );
        String branchCode = firstText(
                profile.optString("branch_code", ""),
                profile.optString("branchCode", ""),
                metadata.optString("branch_code", ""),
                metadata.optString("branchCode", ""),
                authUserMetadata.optString("branch_code", ""),
                authUserMetadata.optString("branchCode", "")
        );
        String branchSlug = firstText(
                profile.optString("branch_slug", ""),
                profile.optString("branchSlug", ""),
                metadata.optString("branch_slug", ""),
                metadata.optString("branchSlug", ""),
                metadata.optString("slug", ""),
                authUserMetadata.optString("branch_slug", ""),
                authUserMetadata.optString("branchSlug", ""),
                authUserMetadata.optString("slug", "")
        );
        String branchName = firstText(
                profile.optString("branch_name", ""),
                profile.optString("branchName", ""),
                metadata.optString("branch_name", ""),
                metadata.optString("branchName", ""),
                authUserMetadata.optString("branch_name", ""),
                authUserMetadata.optString("branchName", "")
        );

        JSONObject byId = readBranchByField(accessToken, "id", branchId, false);
        if (byId != null) return byId;
        JSONObject byCode = readBranchByField(accessToken, "branch_code", branchCode, false);
        if (byCode != null) return byCode;
        JSONObject bySlug = readBranchByField(accessToken, "slug", branchSlug, false);
        if (bySlug != null) return bySlug;
        return readBranchByField(accessToken, "name", branchName, true);
    }

    private JSONObject readBranchByField(String accessToken, String field, String value, boolean ilike) {
        String cleanValue = String.valueOf(value == null ? "" : value).trim();
        if (cleanValue.isEmpty()) return null;
        try {
            String operator = ilike ? "ilike" : "eq";
            String url = SUPABASE_URL + "/rest/v1/branches"
                    + "?select=id,name,slug,branch_code,branch_uuid,data"
                    + "&" + field + "=" + operator + "." + enc(cleanValue)
                    + "&limit=1";
            JSONArray rows = new JSONArray(httpRequest("GET", url, null, false, accessToken));
            return rows.length() > 0 ? rows.getJSONObject(0) : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private void logout() {
        stopStation();
        clearAuthSession(true);
        log("ÄÃ£ Ä‘Äƒng xuáº¥t tÃ i khoáº£n chi nhÃ¡nh.");
    }

    private void clearAuthSession(boolean clearEmail) {
        stationRunning = false;
        SharedPreferences.Editor editor = prefs.edit()
                .remove(KEY_ACCESS_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_AUTH_USER_ID)
                .remove(KEY_PROFILE_ID)
                .remove(KEY_PROFILE_NAME)
                .remove(KEY_PROFILE_ROLE)
                .remove(KEY_BRANCH_UUID)
                .remove(KEY_BRANCH_NAME)
                .remove(KEY_BRANCH_ALIAS)
                .putBoolean(KEY_STATION_ENABLED, false);
        if (clearEmail) editor.remove(KEY_AUTH_EMAIL);
        editor.apply();
        runOnUiThread(() -> {
            if (clearEmail && emailInput != null) emailInput.setText("");
            if (passwordInput != null) passwordInput.setText("");
            updateStationUi();
            updateShiftUi(null, "Chưa đăng nhập chi nhánh.");
        });
    }

    private void refreshActiveShiftAsync() {
        if (shiftText == null) return;
        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        String accessToken = prefs.getString(KEY_ACCESS_TOKEN, "").trim();
        if (branchUuid.isEmpty() || accessToken.isEmpty()) {
            updateShiftUi(null, "Chưa đăng nhập chi nhánh.");
            return;
        }

        updateShiftUi(null, "Đang tải ca POS...");
        new Thread(() -> {
            try {
                JSONObject shift = readActiveShift();
                updateShiftUi(shift, shift == null ? "Chưa có ca POS đang mở." : "");
            } catch (Exception error) {
                updateShiftUi(null, "Không tải được ca POS: " + shortError(error));
            }
        }).start();
    }

    private void openPosShiftAsync() {
        saveSettingsFromInputs();
        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        String authUserId = prefs.getString(KEY_AUTH_USER_ID, "").trim();
        if (branchUuid.isEmpty() || authUserId.isEmpty()) {
            status("Vui lòng đăng nhập chi nhánh trước khi mở ca POS.");
            return;
        }

        int openingCash = parseMoney(openingCashInput == null ? "" : openingCashInput.getText().toString());
        String openingNote = openingNoteInput == null ? "" : openingNoteInput.getText().toString().trim();
        updateShiftUi(null, "Đang mở ca POS...");

        new Thread(() -> {
            try {
                JSONObject existingShift = readActiveShift();
                if (existingShift != null) {
                    updateShiftUi(existingShift, "Đã khôi phục ca POS đang mở.");
                    return;
                }

                JSONObject body = new JSONObject();
                body.put("branch_uuid", branchUuid);
                body.put("branch_name", prefs.getString(KEY_BRANCH_NAME, ""));
                body.put("register_key", "main");
                body.put("status", "open");
                body.put("cashier_name", firstText(
                        prefs.getString(KEY_PROFILE_NAME, ""),
                        prefs.getString(KEY_AUTH_EMAIL, ""),
                        "Thu ngân"
                ));
                String profileId = prefs.getString(KEY_PROFILE_ID, "").trim();
                if (profileId.isEmpty()) {
                    body.put("opened_by_profile_id", JSONObject.NULL);
                } else {
                    body.put("opened_by_profile_id", profileId);
                }
                body.put("opened_by_auth_user_id", authUserId);
                body.put("opening_cash", Math.max(0, openingCash));
                body.put("opening_note", openingNote);

                JSONArray rows = new JSONArray(httpRequest(
                        "POST",
                        SUPABASE_URL + "/rest/v1/pos_shifts?select=id,branch_uuid,branch_name,register_key,status,cashier_name,opening_cash,opening_note,opened_at",
                        body.toString(),
                        true
                ));
                JSONObject shift = rows.length() > 0 ? rows.getJSONObject(0) : readActiveShift();
                updateShiftUi(shift, shift == null ? "Đã gửi yêu cầu mở ca POS." : "Đã mở ca POS.");
            } catch (Exception error) {
                updateShiftUi(null, "Không mở được ca POS: " + shortError(error));
            }
        }).start();
    }

    private JSONObject readActiveShift() throws Exception {
        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        if (branchUuid.isEmpty()) return null;

        String url = SUPABASE_URL + "/rest/v1/pos_shifts"
                + "?select=id,branch_uuid,branch_name,register_key,status,cashier_name,opening_cash,opening_note,opened_at"
                + "&branch_uuid=eq." + enc(branchUuid)
                + "&register_key=eq.main"
                + "&status=eq.open"
                + "&order=opened_at.desc"
                + "&limit=1";
        JSONArray rows = new JSONArray(httpRequest("GET", url, null, false));
        return rows.length() > 0 ? rows.getJSONObject(0) : null;
    }

    private void updateShiftUi(JSONObject shift, String message) {
        runOnUiThread(() -> {
            if (shiftText == null) return;
            if (shift == null) {
                posDraftState.setCachedActiveShift(null);
                shiftText.setText(cleanVietnamese(String.valueOf(message == null ? "" : message)));
                shiftText.setTextColor(Color.rgb(71, 85, 105));
                return;
            }

            posDraftState.setCachedActiveShift(shift);
            String openedAt = formatShiftDateTime(shift.optString("opened_at", ""));
            String cashierName = firstText(shift.optString("cashier_name", ""), "Thu ngân");
            String text = "Ca đang mở"
                    + "\nThu ngân: " + cashierName
                    + "\nTiền đầu ca: " + formatMoney(shift.optInt("opening_cash", 0))
                    + (openedAt.isEmpty() ? "" : "\nMở lúc: " + openedAt);
            if (message != null && !message.trim().isEmpty()) {
                text = message.trim() + "\n" + text;
            }
            shiftText.setText(cleanVietnamese(text));
            shiftText.setTextColor(Color.rgb(15, 118, 110));
        });
    }

    private void refreshPosMenuAsync() {
        if (menuStatusText == null) return;
        if (prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()) {
            updateMenuUi("Vui lòng đăng nhập chi nhánh trước khi tải menu.", null);
            return;
        }

        updateMenuUi("Đang tải menu POS...", null);
        new Thread(() -> {
            try {
                String url = SUPABASE_URL + "/rest/v1/products"
                        + "?select=id,name,price,category_id,badge,visible,active,sort_order"
                        + "&active=eq.true"
                        + "&visible=eq.true"
                        + "&order=sort_order.asc"
                        + "&limit=80";
                JSONArray rows = new JSONArray(httpRequest("GET", url, null, false));
                posProducts = rows;
                updateMenuUi(rows.length() == 0 ? "Chưa có món đang bán." : "Đã tải " + rows.length() + " món.", rows);
            } catch (Exception error) {
                updateMenuUi("Không tải được menu POS: " + shortError(error), null);
            }
        }).start();
    }

    private void updateMenuUi(String message, JSONArray products) {
        runOnUiThread(() -> {
            if (menuStatusText != null) {
                menuStatusText.setText(cleanVietnamese(message));
                menuStatusText.setTextColor(products == null || products.length() == 0 ? Color.rgb(71, 85, 105) : Color.rgb(15, 118, 110));
            }
            renderProductButtons(products == null ? posProducts : products);
        });
    }

    private void renderProductButtons(JSONArray products) {
        if (productListPanel == null) return;
        productListPanel.removeAllViews();

        int count = Math.min(products == null ? 0 : products.length(), 30);
        for (int i = 0; i < count; i++) {
            JSONObject product = products.optJSONObject(i);
            if (product == null) continue;

            String name = cleanVietnamese(product.optString("name", "Món"));
            int price = Math.max(0, (int) Math.round(product.optDouble("price", 0)));
            String category = cleanVietnamese(firstText(product.optString("category_id", ""), product.optString("badge", "")));
            String label = name + "\n" + formatMoney(price) + (category.isEmpty() ? "" : " · " + category);
            Button button = makeButton(label, false);
            button.setGravity(Gravity.CENTER_VERTICAL);
            button.setOnClickListener(view -> addProductToCart(product));
            productListPanel.addView(button, tallButtonParams());
        }
    }

    private void addProductToCart(JSONObject product) {
        if (product == null) return;
        String productId = product.optString("id", "");
        if (productId.trim().isEmpty()) return;

        for (int i = 0; i < posCart.length(); i++) {
            JSONObject item = posCart.optJSONObject(i);
            if (item != null && productId.equals(item.optString("id", ""))) {
                try {
                    item.put("quantity", item.optInt("quantity", 1) + 1);
                } catch (Exception ignored) {
                }
                updateCartUi();
                return;
            }
        }

        JSONObject item = new JSONObject();
        try {
            item.put("id", productId);
            item.put("name", cleanVietnamese(product.optString("name", "Món")));
            item.put("price", Math.max(0, (int) Math.round(product.optDouble("price", 0))));
            item.put("quantity", 1);
            posCart.put(item);
        } catch (Exception ignored) {
        }
        updateCartUi();
    }

    private void changeCartQuantity(String productId, int delta) {
        JSONArray nextCart = new JSONArray();
        for (int i = 0; i < posCart.length(); i++) {
            JSONObject item = posCart.optJSONObject(i);
            if (item == null) continue;
            if (productId.equals(item.optString("id", ""))) {
                int nextQuantity = item.optInt("quantity", 1) + delta;
                if (nextQuantity <= 0) continue;
                try {
                    item.put("quantity", nextQuantity);
                } catch (Exception ignored) {
                }
            }
            nextCart.put(item);
        }
        posCart = nextCart;
        updateCartUi();
    }

    private void updateCartUi() {
        runOnUiThread(() -> {
            if (cartListPanel == null || cartSummaryText == null) return;
            cartListPanel.removeAllViews();

            int total = 0;
            int itemCount = 0;
            for (int i = 0; i < posCart.length(); i++) {
                JSONObject item = posCart.optJSONObject(i);
                if (item == null) continue;
                int quantity = Math.max(1, item.optInt("quantity", 1));
                int price = Math.max(0, item.optInt("price", 0));
                total += quantity * price;
                itemCount += quantity;

                LinearLayout row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER_VERTICAL);

                TextView name = makeInfoText(
                        quantity + " x " + cleanVietnamese(item.optString("name", "Món")) + "\n" + formatMoney(quantity * price),
                        Color.rgb(15, 23, 42)
                );
                row.addView(name, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

                Button minusButton = makeButton("-", false);
                minusButton.setOnClickListener(view -> changeCartQuantity(item.optString("id", ""), -1));
                row.addView(minusButton, new LinearLayout.LayoutParams(dp(56), dp(58)));

                Button plusButton = makeButton("+", true);
                plusButton.setOnClickListener(view -> changeCartQuantity(item.optString("id", ""), 1));
                LinearLayout.LayoutParams plusParams = new LinearLayout.LayoutParams(dp(56), dp(58));
                plusParams.setMargins(dp(6), 0, 0, 0);
                row.addView(plusButton, plusParams);

                cartListPanel.addView(row, fullWidthParams());
            }

            cartSummaryText.setText(cleanVietnamese(
                    itemCount == 0
                            ? "Chưa có món."
                            : "Tổng: " + formatMoney(total) + "\nSố món: " + itemCount
            ));
            cartSummaryText.setTextColor(itemCount == 0 ? Color.rgb(71, 85, 105) : Color.rgb(15, 118, 110));
            syncConfirmedPaymentWithCurrentBill();
            updatePaymentStateUi();
        });
    }

    @Deprecated
    private void showCashPaymentDialogLegacy() {
        if (prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()) {
            toast("Vui lòng đăng nhập chi nhánh trước khi thanh toán.");
            return;
        }
        int total = getCartTotal(posCart);
        if (total <= 0 || posCart.length() == 0) {
            toast("Bill hiện tại chưa có món.");
            return;
        }

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(4), dp(8), dp(4), 0);

        TextView totalText = makeInfoText("Tổng cần thu: " + formatMoney(total), Color.rgb(15, 118, 110));
        panel.addView(totalText, fullWidthParams());

        EditText cashInput = makeInput("Tiền khách đưa");
        cashInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        cashInput.setText(String.valueOf(total));
        panel.addView(cashInput, fullWidthParams());

        TextView changeText = makeInfoText("Tiền thối: 0đ", Color.rgb(71, 85, 105));
        panel.addView(changeText, fullWidthParams());

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(cleanVietnamese("Thanh toán tiền mặt"))
                .setView(panel)
                .setNegativeButton(cleanVietnamese("Hủy"), null)
                .setPositiveButton(cleanVietnamese("Tiếp tục"), null)
                .create();

        dialog.setOnShowListener(item -> dialog.getButton(DialogInterface.BUTTON_POSITIVE).setOnClickListener(view -> {
            int received = parseMoney(cashInput.getText().toString());
            int change = received - total;
            changeText.setText(cleanVietnamese("Tiền thối: " + formatMoney(Math.max(0, change))));
            if (received < total) {
                changeText.setTextColor(Color.rgb(185, 28, 28));
                toast("Tiền khách đưa chưa đủ.");
                return;
            }
            dialog.dismiss();
            showCreateCashOrderConfirmLegacy(received);
        }));

        dialog.show();
    }

    @Deprecated
    private void showCreateCashOrderConfirmLegacy(int receivedAmount) {
        int total = getCartTotal(posCart);
        if (total <= 0 || posCart.length() == 0) {
            toast("Bill hiện tại chưa có món.");
            return;
        }

        String summary = "Tổng cần thu: " + formatMoney(total)
                + "\nTiền khách đưa: " + formatMoney(receivedAmount)
                + "\nTiền thối: " + formatMoney(Math.max(0, receivedAmount - total))
                + "\n\nXác nhận tạo đơn POS và in bill?";

        new AlertDialog.Builder(this)
                .setTitle(cleanVietnamese("Xác nhận tạo đơn"))
                .setMessage(cleanVietnamese(summary))
                .setNegativeButton(cleanVietnamese("Quay lại"), null)
                .setPositiveButton(cleanVietnamese("Tạo đơn + in bill"), (dialog, which) -> createCashOrderAsyncLegacy(receivedAmount))
                .show();
    }

    @Deprecated
    private void createCashOrderAsyncLegacy(int receivedAmount) {
        final JSONArray cartSnapshot;
        try {
            cartSnapshot = new JSONArray(posCart.toString());
        } catch (Exception error) {
            toast("Không đọc được bill hiện tại.");
            return;
        }

        int total = getCartTotal(cartSnapshot);
        if (total <= 0 || cartSnapshot.length() == 0) {
            toast("Bill hiện tại chưa có món.");
            return;
        }
        if (receivedAmount < total) {
            toast("Tiền khách đưa chưa đủ.");
            return;
        }

        log("Đang tạo đơn POS tiền mặt...");
        new Thread(() -> {
            try {
                JSONObject activeShift = readActiveShift();
                if (activeShift == null) {
                    runOnUiThread(() -> toast("Chưa mở ca POS. Vui lòng mở ca trước."));
                    updateShiftUi(null, "Chưa có ca POS đang mở.");
                    return;
                }

                String orderCode = buildPosOrderCode();
                String displayOrderCode = buildShortDisplayOrderCode(orderCode);
                String createdAt = PosOrderHelper.buildIsoUtcNow();
                String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
                String branchName = getBranchLabel();
                String cashierName = firstText(
                        prefs.getString(KEY_PROFILE_NAME, ""),
                        prefs.getString(KEY_AUTH_EMAIL, ""),
                        "Thu ngân"
                );
                String shiftId = activeShift.optString("id", "");
                int changeAmount = Math.max(0, receivedAmount - total);

                JSONObject metadata = new JSONObject();
                metadata.put("source", "pos");
                metadata.put("channel", "pos");
                metadata.put("orderSource", "pos");
                metadata.put("orderType", "takeaway");
                metadata.put("walkIn", true);
                metadata.put("displayOrderCode", displayOrderCode);
                metadata.put("paymentMethod", "cash");
                metadata.put("paymentStatus", "paid");
                metadata.put("paymentAmount", total);
                metadata.put("cashReceived", receivedAmount);
                metadata.put("changeAmount", changeAmount);
                metadata.put("paidAt", createdAt);
                metadata.put("posShiftId", shiftId);
                metadata.put("pos_shift_id", shiftId);
                metadata.put("cashierName", cashierName);
                metadata.put("branchUuid", branchUuid);
                metadata.put("branchName", branchName);
                metadata.put("items", cartSnapshot);

                JSONObject orderBody = new JSONObject();
                orderBody.put("id", orderCode);
                orderBody.put("order_code", orderCode);
                orderBody.put("customer_phone", JSONObject.NULL);
                orderBody.put("customer_name", "Khách POS");
                orderBody.put("fulfillment_type", "pickup");
                orderBody.put("payment_method", "cash");
                orderBody.put("status", "pending_zalo");
                orderBody.put("subtotal", total);
                orderBody.put("shipping_fee", 0);
                orderBody.put("original_shipping_fee", 0);
                orderBody.put("shipping_support_discount", 0);
                orderBody.put("promo_discount", 0);
                orderBody.put("promo_code", "");
                orderBody.put("points_discount", 0);
                orderBody.put("points_earned", 0);
                orderBody.put("total_amount", total);
                orderBody.put("branch_uuid", branchUuid.isEmpty() ? JSONObject.NULL : branchUuid);
                orderBody.put("branch_name", branchName);
                orderBody.put("pickup_branch_uuid", branchUuid.isEmpty() ? JSONObject.NULL : branchUuid);
                orderBody.put("pickup_branch_name", branchName);
                orderBody.put("pickup_time_text", "Lấy tại quầy");
                orderBody.put("delivery_address", "Khách nhận tại quầy");
                orderBody.put("pos_shift_id", shiftId.isEmpty() ? JSONObject.NULL : shiftId);
                orderBody.put("metadata", metadata);

                httpRequest(
                        "POST",
                        SUPABASE_URL + "/rest/v1/orders?select=id,order_code,total_amount,created_at",
                        orderBody.toString(),
                        true
                );

                JSONArray itemRows = buildCashOrderItemRows(orderCode, cartSnapshot);
                if (itemRows.length() > 0) {
                    httpRequest(
                            "POST",
                            SUPABASE_URL + "/rest/v1/order_items",
                            itemRows.toString(),
                            false
                    );
                }

                String receiptText = buildCashReceiptText(orderCode, displayOrderCode, cartSnapshot, total, receivedAmount, changeAmount, cashierName, branchName);
                boolean printed = printReceiptPayload(receiptText, LOYALTY_QR_URL, "");

                runOnUiThread(() -> {
                    posCart = new JSONArray();
                    updateCartUi();
                    toast(printed ? "Đã tạo đơn và in bill." : "Đã tạo đơn, nhưng chưa in được bill.");
                });
                log((printed ? "Đã tạo đơn POS và in bill: " : "Đã tạo đơn POS, cần kiểm tra máy in: ") + orderCode);
            } catch (Exception error) {
                log("Không tạo được đơn POS tiền mặt: " + shortError(error));
            }
        }).start();
    }

    private JSONArray buildCashOrderItemRows(String orderCode, JSONArray cartSnapshot) throws Exception {
        return PosOrderHelper.buildCashOrderItemRows(orderCode, cartSnapshot);
    }

    private String buildCashReceiptText(
            String orderCode,
            String displayOrderCode,
            JSONArray cartSnapshot,
            int total,
            int receivedAmount,
            int changeAmount,
            String cashierName,
            String branchName
    ) {
        return buildCashReceiptText(
                orderCode,
                displayOrderCode,
                cartSnapshot,
                total,
                receivedAmount,
                changeAmount,
                cashierName,
                branchName,
                "",
                "",
                ""
        );
    }

    private String buildCashReceiptText(
            String orderCode,
            String displayOrderCode,
            JSONArray cartSnapshot,
            int total,
            int receivedAmount,
            int changeAmount,
            String cashierName,
            String branchName,
            String pagerNumber,
            String customerName,
            String orderNote
    ) {
        return PosOrderHelper.buildCashReceiptText(
                orderCode,
                displayOrderCode,
                cartSnapshot,
                total,
                receivedAmount,
                changeAmount,
                cashierName,
                branchName,
                pagerNumber,
                customerName,
                orderNote
        );
    }

    private int getCartTotal(JSONArray cart) {
        return PosOrderHelper.getCartTotal(cart);
    }

    private String buildPosOrderCode() {
        return PosOrderHelper.buildPosOrderCode();
    }

    private String buildShortDisplayOrderCode(String orderCode) {
        return PosOrderHelper.buildShortDisplayOrderCode(orderCode);
    }

    private void startStation() {
        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        if (branchUuid.isEmpty()) {
            status("Báº¡n cáº§n Ä‘Äƒng nháº­p tÃ i khoáº£n chi nhÃ¡nh trÆ°á»›c.");
            return;
        }
        if (prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()) {
            status("PhiÃªn Ä‘Äƒng nháº­p chÆ°a sáºµn sÃ ng. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.");
            return;
        }

        stationRunning = true;
        prefs.edit().putBoolean(KEY_STATION_ENABLED, true).apply();
        startKeepAliveService();
        updateStationUi();
        pollOnceAsync();
        schedulePrintPolling();
        log("ÄÃ£ báº­t tráº¡m in cho chi nhÃ¡nh " + getBranchLabel() + ".");
    }

    private void stopStation() {
        stationRunning = false;
        prefs.edit().putBoolean(KEY_STATION_ENABLED, false).apply();
        handler.removeCallbacks(printPollingRunnable);
        handler.removeCallbacks(realtimeReconnectRunnable);
        closeRealtime();
        stopKeepAliveService();
        updateStationUi();
        log("ÄÃ£ táº¯t tráº¡m in.");
    }

    private void startKeepAliveService() {
        try {
            Intent intent = new Intent(this, PrintStationKeepAliveService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
        } catch (Exception error) {
            log("Khong bat duoc che do giu app song: " + shortError(error));
        }
    }

    private void stopKeepAliveService() {
        try {
            stopService(new Intent(this, PrintStationKeepAliveService.class));
        } catch (Exception ignored) {
        }
    }

    private void updateStationUi() {
        if (stationText == null || stationButton == null) return;
        boolean loggedIn = !prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()
                && !prefs.getString(KEY_BRANCH_UUID, "").trim().isEmpty();

        if (loginPanel != null) loginPanel.setVisibility(loggedIn ? View.GONE : View.VISIBLE);
        if (loggedInPanel != null) loggedInPanel.setVisibility(loggedIn ? View.VISIBLE : View.GONE);
        if (accountSummaryText != null && loggedIn) {
            String email = prefs.getString(KEY_AUTH_EMAIL, "").trim();
            String branch = getBranchLabel();
            accountSummaryText.setText(cleanVietnamese((email.isEmpty() ? "ÄÃ£ Ä‘Äƒng nháº­p" : email) + "\nChi nhÃ¡nh: " + branch));
        }

        if (stationRunning) {
            stationText.setText(cleanVietnamese("Tráº¡m in Ä‘ang báº­t Â· " + getBranchLabel()));
            stationText.setTextColor(Color.rgb(15, 118, 110));
            stationButton.setText(cleanVietnamese("Táº¯t tráº¡m in"));
            stationButton.setBackground(makeRoundRect(Color.rgb(239, 68, 68), 8, 1, Color.rgb(185, 28, 28)));
        } else {
            stationText.setText(cleanVietnamese(loggedIn ? "ÄÃ£ Ä‘Äƒng nháº­p Â· " + getBranchLabel() : "ChÆ°a Ä‘Äƒng nháº­p chi nhÃ¡nh"));
            stationText.setTextColor(loggedIn ? Color.rgb(15, 118, 110) : Color.rgb(185, 28, 28));
            stationButton.setText(cleanVietnamese("Báº­t tráº¡m in"));
            stationButton.setBackground(makeRoundRect(Color.rgb(20, 184, 166), 8, 1, Color.rgb(15, 118, 110)));
        }
    }

    private void pollOnceAsync() {
        if (polling) return;
        polling = true;
        new Thread(() -> {
            try {
                processPendingJobs();
            } catch (Exception error) {
                log("Lá»—i láº¥y lá»‡nh in: " + shortError(error));
            } finally {
                polling = false;
            }
        }).start();
    }

    private void schedulePrintPolling() {
        handler.removeCallbacks(printPollingRunnable);
        if (stationRunning) {
            handler.postDelayed(printPollingRunnable, PRINT_POLL_INTERVAL_MS);
        }
    }

    private void processPendingJobs() throws Exception {
        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        if (branchUuid.isEmpty()) {
            status("ChÆ°a nháº­p branch_uuid.");
            return;
        }

        status("Äang kiá»ƒm tra lá»‡nh in...");
        expireOldPendingJobs(branchUuid);
        String cutoffIso = autoPrintCutoffIso();
        String url = SUPABASE_URL + "/rest/v1/print_jobs"
                + "?select=" + PRINT_JOB_SELECT
                + "&status=eq.pending"
                + "&job_type=eq." + enc(JOB_TYPE)
                + "&printer_key=eq." + enc(PRINTER_KEY)
                + "&branch_uuid=eq." + enc(branchUuid)
                + "&created_at=gte." + enc(cutoffIso)
                + "&order=created_at.asc"
                + "&limit=" + MAX_JOBS_PER_POLL;

        JSONArray jobs = new JSONArray(httpRequest("GET", url, null, false));
        if (jobs.length() == 0) {
            status("ChÆ°a cÃ³ lá»‡nh in má»›i.");
            return;
        }

        for (int i = 0; i < jobs.length(); i++) {
            JSONObject job = jobs.getJSONObject(i);
            JSONObject claimedJob = claimJob(job);
            if (claimedJob == null) continue;
            printClaimedJob(claimedJob);
        }
    }

    private JSONObject claimJob(JSONObject job) throws Exception {
        String jobId = job.optString("id", "");
        if (jobId.isEmpty()) return null;

        JSONObject body = new JSONObject();
        body.put("status", "printing");
        body.put("claimed_by_device", getAppDeviceId());
        body.put("claimed_at", nowIso());
        body.put("updated_at", nowIso());

        String url = SUPABASE_URL + "/rest/v1/print_jobs"
                + "?id=eq." + enc(jobId)
                + "&branch_uuid=eq." + enc(prefs.getString(KEY_BRANCH_UUID, "").trim())
                + "&job_type=eq." + enc(JOB_TYPE)
                + "&printer_key=eq." + enc(PRINTER_KEY)
                + "&status=eq.pending"
                + "&created_at=gte." + enc(autoPrintCutoffIso())
                + "&select=" + PRINT_JOB_SELECT;
        JSONArray result = new JSONArray(httpRequest("PATCH", url, body.toString(), true));
        if (result.length() == 0) return null;

        String code = result.getJSONObject(0).optString("order_code", "");
        log("ÄÃ£ nháº­n lá»‡nh in " + (code.isEmpty() ? jobId : code) + ".");
        return result.getJSONObject(0);
    }

    private void printClaimedJob(JSONObject job) {
        String jobId = job.optString("id", "");
        String orderCode = job.optString("order_code", "");
        int retryCount = job.optInt("retry_count", 0);

        try {
            JSONObject payload = job.optJSONObject("payload");
            String text = payload == null ? "" : payload.optString("text", "");
            String loyaltyUrl = payload == null ? "" : payload.optString("loyaltyUrl", "");
            String sourceType = job.optString("source_type", "");
            if (text.trim().isEmpty()) {
                throw new Exception("Bill chÆ°a cÃ³ ná»™i dung Ä‘á»ƒ in.");
            }

            playNewOrderAlert();
            boolean ok = printReceiptPayload(text, loyaltyUrl, sourceType);
            if (!ok) throw new Exception("MÃ¡y in chÆ°a nháº­n bill.");

            markJobPrinted(jobId);
            log("In xong bill " + (orderCode.isEmpty() ? jobId : orderCode) + ".");
        } catch (Exception error) {
            markJobFailed(jobId, retryCount + 1, shortError(error));
            log("In lá»—i " + (orderCode.isEmpty() ? jobId : orderCode) + ": " + shortError(error));
        }
    }

    private void markJobPrinted(String jobId) throws Exception {
        JSONObject body = new JSONObject();
        body.put("status", "printed");
        body.put("printed_at", nowIso());
        body.put("failed_at", JSONObject.NULL);
        body.put("error_message", JSONObject.NULL);
        body.put("updated_at", nowIso());
        httpRequest("PATCH", SUPABASE_URL + "/rest/v1/print_jobs?id=eq." + enc(jobId), body.toString(), false);
    }

    private void markJobFailed(String jobId, int retryCount, String message) {
        try {
            JSONObject body = new JSONObject();
            body.put("status", "failed");
            body.put("failed_at", nowIso());
            body.put("error_message", message);
            body.put("retry_count", retryCount);
            body.put("updated_at", nowIso());
            httpRequest("PATCH", SUPABASE_URL + "/rest/v1/print_jobs?id=eq." + enc(jobId), body.toString(), false);
        } catch (Exception ignored) {
        }
    }

    private void expireOldPendingJobs(String branchUuid) {
        try {
            JSONObject body = new JSONObject();
            body.put("status", "failed");
            body.put("failed_at", nowIso());
            body.put("error_message", AUTO_PRINT_EXPIRED_MESSAGE);
            body.put("updated_at", nowIso());

            String url = SUPABASE_URL + "/rest/v1/print_jobs"
                    + "?status=eq.pending"
                    + "&job_type=eq." + enc(JOB_TYPE)
                    + "&printer_key=eq." + enc(PRINTER_KEY)
                    + "&branch_uuid=eq." + enc(branchUuid)
                    + "&created_at=lt." + enc(autoPrintCutoffIso());
            httpRequest("PATCH", url, body.toString(), false);
        } catch (Exception error) {
            log("Dá»n lá»‡nh in cÅ© lá»—i: " + shortError(error));
        }
    }

    private void startRealtime() {
        if (realtimeConnecting || realtimeSocket != null) return;

        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        String token = prefs.getString(KEY_ACCESS_TOKEN, "").trim();
        if (branchUuid.isEmpty() || token.isEmpty()) return;

        realtimeConnecting = true;
        realtimeJoined = false;
        try {
            String realtimeUrl = SUPABASE_URL.replace("https://", "wss://").replace("http://", "ws://")
                    + "/realtime/v1/websocket?apikey=" + enc(SUPABASE_ANON_KEY)
                    + "&vsn=1.0.0";
            Request request = new Request.Builder()
                    .url(realtimeUrl)
                    .addHeader("apikey", SUPABASE_ANON_KEY)
                    .addHeader("Authorization", "Bearer " + token)
                    .build();

            realtimeSocket = realtimeClient.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(WebSocket webSocket, Response response) {
                    realtimeConnecting = false;
                    sendRealtimeJoin();
                    handler.removeCallbacks(realtimeHeartbeatRunnable);
                    handler.postDelayed(realtimeHeartbeatRunnable, REALTIME_HEARTBEAT_MS);
                }

                @Override
                public void onMessage(WebSocket webSocket, String text) {
                    handleRealtimeMessage(text);
                }

                @Override
                public void onClosed(WebSocket webSocket, int code, String reason) {
                    realtimeConnecting = false;
                    realtimeJoined = false;
                    realtimeSocket = null;
                    handler.removeCallbacks(realtimeHeartbeatRunnable);
                    if (stationRunning) scheduleRealtimeReconnect();
                }

                @Override
                public void onFailure(WebSocket webSocket, Throwable throwable, Response response) {
                    realtimeConnecting = false;
                    realtimeJoined = false;
                    realtimeSocket = null;
                    handler.removeCallbacks(realtimeHeartbeatRunnable);
                    logRealtimeIssue("Realtime tam ngat, app se tu ket noi lai.");
                    if (stationRunning) scheduleRealtimeReconnect();
                }
            });
        } catch (Exception error) {
            realtimeConnecting = false;
            logRealtimeIssue("Khong mo duoc realtime: " + shortError(error));
            scheduleRealtimeReconnect();
        }
    }

    private void scheduleRealtimeReconnect() {
        handler.removeCallbacks(realtimeReconnectRunnable);
        handler.postDelayed(realtimeReconnectRunnable, REALTIME_RECONNECT_MS);
    }

    private void closeRealtime() {
        handler.removeCallbacks(realtimeHeartbeatRunnable);
        handler.removeCallbacks(realtimeReconnectRunnable);
        realtimeConnecting = false;
        realtimeJoined = false;
        if (realtimeSocket != null) {
            realtimeSocket.close(1000, "station stopped");
            realtimeSocket = null;
        }
    }

    private void sendRealtimeJoin() {
        try {
            String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
            JSONObject change = new JSONObject();
            change.put("event", "INSERT");
            change.put("schema", "public");
            change.put("table", "print_jobs");
            change.put("filter", "branch_uuid=eq." + branchUuid);

            JSONArray changes = new JSONArray();
            changes.put(change);

            JSONObject config = new JSONObject();
            config.put("broadcast", new JSONObject().put("self", false));
            config.put("presence", new JSONObject().put("key", ""));
            config.put("postgres_changes", changes);

            JSONObject payload = new JSONObject();
            payload.put("config", config);
            payload.put("access_token", prefs.getString(KEY_ACCESS_TOKEN, ""));

            sendRealtimeEvent("realtime:public:print_jobs", "phx_join", payload);
        } catch (Exception error) {
            log("KhÃ´ng Ä‘Äƒng kÃ½ realtime Ä‘Æ°á»£c: " + shortError(error));
        }
    }

    private void sendRealtimeEvent(String topic, String event, JSONObject payload) {
        try {
            WebSocket socket = realtimeSocket;
            if (socket == null) return;
            JSONObject message = new JSONObject();
            message.put("topic", topic);
            message.put("event", event);
            message.put("payload", payload == null ? new JSONObject() : payload);
            message.put("ref", nextRealtimeRef());
            socket.send(message.toString());
        } catch (Exception ignored) {
        }
    }

    private synchronized String nextRealtimeRef() {
        realtimeRef += 1;
        return String.valueOf(realtimeRef);
    }

    private void handleRealtimeMessage(String text) {
        try {
            JSONObject message = new JSONObject(text);
            String event = message.optString("event", "");
            if ("phx_reply".equals(event) && !realtimeJoined) {
                realtimeJoined = true;
                log("Realtime Ä‘Ã£ sáºµn sÃ ng, cÃ³ bill má»›i sáº½ in ngay.");
                return;
            }
            if ("postgres_changes".equals(event)) {
                log("CÃ³ lá»‡nh in má»›i tá»« realtime.");
                pollOnceAsync();
            }
        } catch (Exception ignored) {
        }
    }

    private String httpRequest(String method, String urlString, String body, boolean returnRepresentation) throws Exception {
        return httpRequest(method, urlString, body, returnRepresentation, prefs.getString(KEY_ACCESS_TOKEN, ""));
    }

    private String httpRequest(String method, String urlString, String body, boolean returnRepresentation, String bearerToken) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestProperty("apikey", SUPABASE_ANON_KEY);
        String token = String.valueOf(bearerToken == null ? "" : bearerToken).trim();
        if (token.isEmpty()) token = SUPABASE_ANON_KEY;
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        if (returnRepresentation) {
            connection.setRequestProperty("Prefer", "return=representation");
        }

        if (body != null) {
            connection.setDoOutput(true);
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(bytes);
            }
        }

        int code = connection.getResponseCode();
        InputStream stream = code >= 200 && code < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
        String response = readStream(stream);
        connection.disconnect();

        if (code == 401 && bearerToken != null && !bearerToken.trim().isEmpty()) {
            JSONObject refreshed = refreshAccessToken();
            return httpRequest(method, urlString, body, returnRepresentation, refreshed.optString("access_token", ""));
        }

        if (code < 200 || code >= 300) {
            throw new Exception("Supabase HTTP " + code + " " + response);
        }

        return response == null || response.trim().isEmpty() ? "[]" : response;
    }

    private String readStream(InputStream stream) throws Exception {
        if (stream == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            builder.append(line);
        }
        return builder.toString();
    }

    private void showUsbDevicePicker() {
        HashMap<String, UsbDevice> devices = usbManager.getDeviceList();
        if (devices.isEmpty()) {
            toast("ChÆ°a tháº¥y mÃ¡y in USB. Kiá»ƒm tra dÃ¢y USB/OTG.");
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
                .setTitle("Chá»n mÃ¡y in USB")
                .setItems(labels, (dialog, which) -> requestPrinterPermission(deviceList.get(which)))
                .show();
    }

    private void requestPrinterPermission(UsbDevice device) {
        if (usbManager.hasPermission(device)) {
            saveSelectedDevice(device);
            status("ÄÃ£ chá»n mÃ¡y in USB.");
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

    private void updateModeUi() {
        boolean lanMode = PRINTER_MODE_LAN.equals(selectedMode);
        usbModeButton.setBackground(makeRoundRect(lanMode ? Color.WHITE : Color.rgb(20, 184, 166), 8, 1, Color.rgb(15, 118, 110)));
        usbModeButton.setTextColor(lanMode ? Color.rgb(15, 23, 42) : Color.WHITE);
        lanModeButton.setBackground(makeRoundRect(lanMode ? Color.rgb(20, 184, 166) : Color.WHITE, 8, 1, Color.rgb(15, 118, 110)));
        lanModeButton.setTextColor(lanMode ? Color.WHITE : Color.rgb(15, 23, 42));
        usbPanel.setVisibility(lanMode ? View.GONE : View.VISIBLE);
        lanPanel.setVisibility(lanMode ? View.VISIBLE : View.GONE);
    }

    private void updatePrinterStatus() {
        if (printerText == null) return;

        if (PRINTER_MODE_LAN.equals(getPrinterMode())) {
            String host = prefs.getString(KEY_LAN_HOST, "").trim();
            if (host.isEmpty()) {
                printerText.setText(cleanVietnamese("MÃ¡y in LAN/WiFi: chÆ°a nháº­p IP"));
                printerText.setTextColor(Color.rgb(194, 65, 12));
                return;
            }

            printerText.setText(cleanVietnamese("MÃ¡y in LAN/WiFi: " + host + ":" + getLanPort()));
            printerText.setTextColor(Color.rgb(15, 118, 110));
            return;
        }

        UsbDevice device = getSelectedDevice();
        if (device == null) {
            printerText.setText(cleanVietnamese("MÃ¡y in USB: chÆ°a káº¿t ná»‘i"));
            printerText.setTextColor(Color.rgb(185, 28, 28));
            return;
        }

        boolean hasPermission = usbManager.hasPermission(device);
        printerText.setText(cleanVietnamese(hasPermission ? "MÃ¡y in USB: sáºµn sÃ ng" : "MÃ¡y in USB: cáº§n cáº¥p quyá»n"));
        printerText.setTextColor(hasPermission ? Color.rgb(15, 118, 110) : Color.rgb(194, 65, 12));
    }

    private void printTestBill() {
        String time = new SimpleDateFormat("HH:mm dd/MM/yyyy", new Locale("vi", "VN")).format(new Date());
        printReceiptPayload(
                "@@CENTER:GÃNH HÃ€NG RONG\n" +
                "@@CENTER:MÃƒ ÄÆ N\n" +
                "@@BIG:TEST-XPRINTER\n" +
                "------------------------------------------\n" +
                "Nguá»“n: Báº¿p\n" +
                "Giá»: " + time + "\n" +
                "------------------------------------------\n" +
                "1 x DÃ²ng test tiáº¿ng Viá»‡t cÃ³ dáº¥u\n" +
                "------------------------------------------\n" +
                "@@CENTER:QuÃ©t QR tÃ­ch Ä‘iá»ƒm ngay\n" +
                "@@QR\n" +
                "@@CENTER:Hotline: 0933 799 061\n" +
                "@@CENTER:Cáº£m Æ¡n quÃ½ khÃ¡ch!",
                "https://ganhhangrong.vn/orders",
                ""
        );
    }

    private boolean printReceiptText(String text) {
        return printReceiptPayload(text, "", "");
    }

    private boolean printReceiptPayload(String text, String qrUrl, String sourceType) {
        if (PRINTER_MODE_LAN.equals(getPrinterMode())) {
            return printReceiptTextViaLan(text, qrUrl, sourceType);
        }
        return printReceiptTextViaUsb(text, qrUrl, sourceType);
    }

    private boolean printReceiptTextViaLan(String text, String qrUrl, String sourceType) {
        String host = prefs.getString(KEY_LAN_HOST, "").trim();
        int port = getLanPort();
        if (host.isEmpty()) {
            status("ChÆ°a nháº­p IP mÃ¡y in LAN/WiFi.");
            updatePrinterStatus();
            return false;
        }

        try (Socket socket = new Socket()) {
            status("Äang káº¿t ná»‘i mÃ¡y in LAN/WiFi...");
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(5000);

            OutputStream outputStream = socket.getOutputStream();
            outputStream.write(buildEscPosRaster(text, qrUrl, sourceType));
            outputStream.flush();

            status("ÄÃ£ gá»­i bill tá»›i Xprinter LAN/WiFi.");
            updatePrinterStatus();
            return true;
        } catch (Exception error) {
            status("KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c mÃ¡y in LAN/WiFi.");
            updatePrinterStatus();
            return false;
        }
    }

    private boolean printReceiptTextViaUsb(String text, String qrUrl, String sourceType) {
        UsbDevice device = getSelectedDevice();
        if (device == null) {
            status("ChÆ°a tháº¥y mÃ¡y in USB.");
            updatePrinterStatus();
            return false;
        }

        if (!usbManager.hasPermission(device)) {
            pendingPrintText = text;
            pendingPrintQrUrl = qrUrl;
            status("Äang xin quyá»n USB.");
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
            status("KhÃ´ng tÃ¬m tháº¥y cá»•ng in USB.");
            return false;
        }

        UsbDeviceConnection connection = usbManager.openDevice(device);
        if (connection == null) {
            status("KhÃ´ng má»Ÿ Ä‘Æ°á»£c káº¿t ná»‘i mÃ¡y in.");
            return false;
        }

        try {
            if (!connection.claimInterface(usbInterface, true)) {
                status("KhÃ´ng nháº­n Ä‘Æ°á»£c quyá»n cá»•ng USB.");
                return false;
            }

            byte[] data = buildEscPosRaster(text, qrUrl, sourceType);
            int offset = 0;
            while (offset < data.length) {
                int chunkSize = Math.min(4096, data.length - offset);
                int sent = connection.bulkTransfer(outEndpoint, data, offset, chunkSize, 5000);
                if (sent <= 0) {
                    status("MÃ¡y in khÃ´ng nháº­n dá»¯ liá»‡u.");
                    return false;
                }
                offset += sent;
            }

            status("ÄÃ£ gá»­i bill tá»›i Xprinter USB.");
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

    private byte[] buildEscPosRaster(String text, String qrUrl, String sourceType) {
        return EscPosRasterPrinter.buildReceiptRaster(
                text,
                qrUrl,
                sourceType,
                DEFAULT_RECEIPT_FOOTER_TEXT,
                LOYALTY_QR_URL
        );
    }

    private boolean shouldSkipFixedFooter(String sourceType) {
        String value = String.valueOf(sourceType == null ? "" : sourceType).trim();
        return SOURCE_TYPE_POS_PAYMENT_QR.equals(value) || SOURCE_TYPE_POS_SHIFT_CLOSE.equals(value);
    }

    private void writeRasterBitmap(ByteArrayOutputStream output, Bitmap bitmap) {
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
    }

    private synchronized byte[] getFixedFooterRasterBytes(String footerText) {
        if (fixedFooterRasterBytes == null) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            writeRasterBitmap(output, renderTextBitmap(footerText, RECEIPT_WIDTH_DOTS_80MM, LOYALTY_QR_URL));
            fixedFooterRasterBytes = output.toByteArray();
        }
        return fixedFooterRasterBytes;
    }

    private ReceiptRasterParts splitReceiptFooter(String text) {
        String value = String.valueOf(text == null ? "" : text);
        int qrIndex = value.indexOf("@@QR");
        if (qrIndex < 0) return new ReceiptRasterParts(value, "");

        int qrLineBreak = value.lastIndexOf('\n', Math.max(0, qrIndex - 1));
        if (qrLineBreak < 0) return new ReceiptRasterParts(value, "");

        int titleLineBreak = value.lastIndexOf('\n', Math.max(0, qrLineBreak - 1));
        if (titleLineBreak < 0) return new ReceiptRasterParts(value, "");

        int footerStart = value.lastIndexOf('\n', Math.max(0, titleLineBreak - 1));
        if (footerStart < 0) footerStart = titleLineBreak;

        String bodyText = value.substring(0, footerStart).trim();
        String footerText = value.substring(footerStart + 1).trim();
        return new ReceiptRasterParts(bodyText, footerText);
    }

    private static class ReceiptRasterParts {
        final String bodyText;
        final String footerText;

        ReceiptRasterParts(String bodyText, String footerText) {
            this.bodyText = bodyText == null ? "" : bodyText;
            this.footerText = footerText == null ? "" : footerText;
        }
    }

    private Bitmap renderTextBitmap(String text, int width, String qrUrl) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        paint.setTextSize(24);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
        int padding = 16;
        Bitmap qrBitmap = createQrBitmap(qrUrl, dp(176));
        List<String> lines = expandReceiptLines(text, paint, width - padding * 2);
        int height = Math.max(160, padding * 2 + estimateReceiptHeight(lines, qrBitmap));

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);

        int y = padding;
        for (String line : lines) {
            if ("@@QR".equals(line) && qrBitmap != null) {
                int left = (width - qrBitmap.getWidth()) / 2;
                canvas.drawBitmap(qrBitmap, left, y + 6, null);
                y += qrBitmap.getHeight() + 20;
                continue;
            }
            y = drawReceiptLine(canvas, paint, line, padding, y, width);
        }

        return bitmap;
    }

    private int estimateReceiptHeight(List<String> lines, Bitmap qrBitmap) {
        int height = 0;
        for (String line : lines) {
            if ("@@QR".equals(line) && qrBitmap != null) {
                height += qrBitmap.getHeight() + 20;
            } else if (line.startsWith("@@BIG:")) {
                height += BIG_LINE_HEIGHT;
            } else {
                height += 34;
            }
        }
        return height;
    }

    private int drawReceiptLine(Canvas canvas, Paint paint, String line, int padding, int y, int width) {
        boolean big = line.startsWith("@@BIG:");
        boolean center = line.startsWith("@@CENTER:");
        String text = line;
        if (big) text = line.substring(6);
        if (center) text = line.substring(9);
        if ("@@QR".equals(line)) return y;

        paint.setTextSize(big ? BIG_TEXT_SIZE : 24);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, big ? Typeface.BOLD : Typeface.NORMAL));
        if (big) fitTextToWidth(paint, text, width - padding * 2, BIG_TEXT_SIZE, BIG_TEXT_MIN_SIZE);
        Paint.FontMetrics metrics = paint.getFontMetrics();
        int baseline = y + Math.round(-metrics.ascent);

        if (big || center) {
            float x = (width - paint.measureText(text)) / 2f;
            canvas.drawText(text, Math.max(padding, x), baseline, paint);
        } else {
            canvas.drawText(text, padding, baseline, paint);
        }

        return y + (big ? BIG_LINE_HEIGHT : 34);
    }

    private void fitTextToWidth(Paint paint, String text, int maxWidth, int maxTextSize, int minTextSize) {
        paint.setTextSize(maxTextSize);
        while (paint.measureText(text) > maxWidth && paint.getTextSize() > minTextSize) {
            paint.setTextSize(paint.getTextSize() - 2);
        }
    }

    private List<String> expandReceiptLines(String text, Paint paint, int maxWidth) {
        List<String> result = new ArrayList<>();
        String[] rawLines = text.split("\\n", -1);
        for (String rawLine : rawLines) {
            String line = rawLine.trim();
            if (line.isEmpty()) {
                result.add("");
                continue;
            }
            if (line.startsWith("@@BIG:") || line.startsWith("@@CENTER:") || "@@QR".equals(line)) {
                result.add(line);
                continue;
            }
            result.addAll(wrapLines(line, paint, maxWidth));
        }
        return result;
    }

    private Bitmap createQrBitmap(String qrUrl, int size) {
        String value = String.valueOf(qrUrl == null ? "" : qrUrl).trim();
        if (value.isEmpty()) return null;
        try {
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.MARGIN, 1);
            BitMatrix matrix = new MultiFormatWriter().encode(value, BarcodeFormat.QR_CODE, size, size, hints);
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            for (int y = 0; y < size; y++) {
                for (int x = 0; x < size; x++) {
                    bitmap.setPixel(x, y, matrix.get(x, y) ? Color.BLACK : Color.WHITE);
                }
            }
            return bitmap;
        } catch (Exception ignored) {
            return null;
        }
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

    private Button makeButton(String label, boolean primary) {
        Button button = new Button(this);
        button.setText(cleanVietnamese(label));
        button.setAllCaps(false);
        button.setTextSize(16);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setMinHeight(dp(58));
        button.setGravity(Gravity.CENTER);
        button.setTextColor(primary ? Color.WHITE : Color.rgb(15, 23, 42));
        button.setBackground(makeRoundRect(
                primary ? Color.rgb(20, 184, 166) : Color.WHITE,
                8,
                1,
                primary ? Color.rgb(15, 118, 110) : Color.rgb(203, 213, 225)
        ));
        return button;
    }

    private EditText makeInput(String hint) {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint(cleanVietnamese(hint));
        input.setTextSize(18);
        input.setMinHeight(dp(62));
        input.setPadding(dp(14), 0, dp(14), 0);
        input.setBackground(makeRoundRect(Color.WHITE, 8, 1, Color.rgb(203, 213, 225)));
        return input;
    }

    private TextView makeSectionTitle(String text) {
        TextView title = new TextView(this);
        title.setText(cleanVietnamese(text));
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setTextSize(15);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, dp(18), 0, dp(8));
        return title;
    }

    private TextView makeInfoText(String text, int color) {
        TextView view = new TextView(this);
        view.setText(cleanVietnamese(text));
        view.setTextColor(color);
        view.setTextSize(13);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setPadding(dp(12), dp(8), dp(12), dp(8));
        view.setBackground(makeRoundRect(Color.WHITE, 8, 1, Color.rgb(226, 232, 240)));
        return view;
    }

    private LinearLayout.LayoutParams fullWidthParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(8));
        return params;
    }

    private LinearLayout.LayoutParams tallButtonParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(58)
        );
        params.setMargins(0, 0, 0, dp(8));
        return params;
    }

    private GradientDrawable makeRoundRect(int color, int radiusDp, int strokeWidthDp, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        if (strokeWidthDp > 0) drawable.setStroke(dp(strokeWidthDp), strokeColor);
        return drawable;
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

    private int parseMoney(String value) {
        try {
            String digits = String.valueOf(value == null ? "" : value).replaceAll("[^0-9]", "");
            if (digits.isEmpty()) return 0;
            return Math.max(0, Integer.parseInt(digits));
        } catch (Exception error) {
            return 0;
        }
    }

    private String formatMoney(int amount) {
        return String.format(new Locale("vi", "VN"), "%,dđ", Math.max(0, amount));
    }

    private String formatShiftDateTime(String value) {
        try {
            if (value == null || value.trim().isEmpty()) return "";
            String normalized = value.trim();
            if (normalized.endsWith("Z")) normalized = normalized.replace("Z", "+0000");
            normalized = normalized.replaceAll("([+-]\\d{2}):(\\d{2})$", "$1$2");
            Date date = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US).parse(normalized);
            if (date == null) return "";
            return new SimpleDateFormat("HH:mm dd/MM/yyyy", new Locale("vi", "VN")).format(date);
        } catch (Exception error) {
            return value == null ? "" : value;
        }
    }

    private int getLanPort() {
        return prefs.getInt(KEY_LAN_PORT, DEFAULT_LAN_PORT);
    }

    private String getBranchLabel() {
        String name = prefs.getString(KEY_BRANCH_NAME, "").trim();
        if (!name.isEmpty()) return cleanVietnamese(name);
        String alias = prefs.getString(KEY_BRANCH_ALIAS, "").trim();
        if (!alias.isEmpty()) return cleanVietnamese(alias);
        String uuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        return uuid.length() > 8 ? uuid.substring(0, 8) + "..." : uuid;
    }

    private String firstText(String... values) {
        for (String value : values) {
            String text = String.valueOf(value == null ? "" : value).trim();
            if (!text.isEmpty()) return text;
        }
        return "";
    }

    private String cleanVietnamese(String value) {
        String text = String.valueOf(value == null ? "" : value);
        for (int i = 0; i < 3 && looksMojibake(text); i++) {
            String decoded = new String(text.getBytes(Charset.forName("Windows-1252")), StandardCharsets.UTF_8);
            if (decoded.equals(text)) break;
            text = decoded;
        }
        return text;
    }

    private boolean looksMojibake(String value) {
        if (value == null || value.isEmpty()) return false;
        return value.contains("Ã")
                || value.contains("Â")
                || value.contains("Ä")
                || value.contains("Æ")
                || value.contains("áº")
                || value.contains("á»");
    }

    private String normalizeAuthError(Exception error) {
        String raw = cleanVietnamese(String.valueOf(error == null ? "" : error.getMessage())).trim();
        String lower = raw.toLowerCase(Locale.US);
        if (lower.contains("invalid login credentials")) return "Email hoáº·c máº­t kháº©u chÆ°a Ä‘Ãºng.";
        if (lower.contains("email not confirmed")) return "Email nÃ y chÆ°a Ä‘Æ°á»£c xÃ¡c nháº­n trong Supabase Auth.";
        if (lower.contains("timeout")) return "Káº¿t ná»‘i Supabase Ä‘ang cháº­m. Báº¡n thá»­ láº¡i sau vÃ i giÃ¢y.";
        if (lower.contains("network") || lower.contains("failed to connect")) return "KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c Supabase. Kiá»ƒm tra máº¡ng POS.";
        return raw.isEmpty() ? "ÄÄƒng nháº­p tháº¥t báº¡i." : raw;
    }

    private void ensureDeviceId() {
        if (prefs.getString(KEY_DEVICE_ID, "").isEmpty()) {
            prefs.edit().putString(KEY_DEVICE_ID, "ghr-pos-" + java.util.UUID.randomUUID()).apply();
        }
    }

    private String getAppDeviceId() {
        return prefs.getString(KEY_DEVICE_ID, "ghr-pos");
    }

    private String nowIso() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(new Date());
    }

    private String autoPrintCutoffIso() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US)
                .format(new Date(System.currentTimeMillis() - AUTO_PRINT_WINDOW_MS));
    }

    private String enc(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private String shortError(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return "KhÃ´ng rÃµ lá»—i";
        return message.length() > 180 ? message.substring(0, 180) : message;
    }

    private static class OperatorGuidance {
        final String title;
        final String action;

        OperatorGuidance(String title, String action) {
            this.title = title == null ? "" : title.trim();
            this.action = action == null ? "" : action.trim();
        }
    }

    private String normalizeLogKey(String value) {
        return String.valueOf(value == null ? "" : value)
                .trim()
                .toLowerCase(Locale.US);
    }

    private OperatorGuidance resolveOperatorGuidance(String rawMessage) {
        String normalized = normalizeLogKey(rawMessage);

        if (normalized.contains("refresh_token_not_found")
| normalized.contains("invalid refresh token")
| normalized.contains("phien dang nhap chua san sang")
| normalized.contains("session")
| normalized.contains("supabase http 401")) {
            return new OperatorGuidance(
                    "PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t háº¡n",
                    "ÄÄƒng xuáº¥t rá»“i Ä‘Äƒng nháº­p láº¡i. Sau Ä‘Ã³ báº­t láº¡i tráº¡m in."
            );
        }

        if (normalized.contains("khong co quyen")
| normalized.contains("khÃ´ng cÃ³ quyá»n")
| normalized.contains("chua co quyen bep")
| normalized.contains("chÆ°a cÃ³ quyá»n báº¿p")
| normalized.contains("chua active")
| normalized.contains("khong tim thay branch_uuid")
| normalized.contains("khÃ´ng tÃ¬m tháº¥y branch_uuid")) {
            return new OperatorGuidance(
                    "TÃ i khoáº£n nÃ y khÃ´ng cÃ³ quyá»n dÃ¹ng tráº¡m in",
                    "LiÃªn há»‡ quáº£n lÃ½ Ä‘á»ƒ kiá»ƒm tra quyá»n hoáº·c chi nhÃ¡nh."
            );
        }

        if (normalized.contains("may in")
| normalized.contains("mÃ¡y in")
| normalized.contains("printer did not accept")
| normalized.contains("khong ket noi duoc may in")
| normalized.contains("khÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c mÃ¡y in")
| normalized.contains("usb")
| normalized.contains("lan/wifi")) {
            return new OperatorGuidance(
                    "MÃ¡y in chÆ°a sáºµn sÃ ng",
                    "Kiá»ƒm tra káº¿t ná»‘i mÃ¡y in rá»“i báº¥m In test."
            );
        }

        if (normalized.contains("supabase")
| normalized.contains("realtime")
| normalized.contains("failed to fetch")
| normalized.contains("timeout")
| normalized.contains("network")
| normalized.contains("loi lay lenh in")
| normalized.contains("lá»—i láº¥y lá»‡nh in")
| normalized.contains("read print jobs failed")
| normalized.contains("khong mo duoc realtime")
| normalized.contains("khÃ´ng má»Ÿ Ä‘Æ°á»£c realtime")) {
            return new OperatorGuidance(
                    "KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c há»‡ thá»‘ng in",
                    "Báº¥m Kiá»ƒm tra lá»‡nh in. Náº¿u chÆ°a Ä‘Æ°á»£c, báº­t láº¡i tráº¡m in."
            );
        }

        if (normalized.contains("dang kiem tra lenh in")
| normalized.contains("Ä‘ang kiá»ƒm tra lá»‡nh in")) {
            return new OperatorGuidance(
                    "Äang kiá»ƒm tra lá»‡nh in",
                    "Vui lÃ²ng chá» trong giÃ¢y lÃ¡t."
            );
        }

        if (normalized.contains("chua co lenh in moi")
| normalized.contains("chÆ°a cÃ³ lá»‡nh in má»›i")) {
            return new OperatorGuidance(
                    "ChÆ°a cÃ³ lá»‡nh in má»›i",
                    "Tráº¡m in Ä‘ang hoáº¡t Ä‘á»™ng bÃ¬nh thÆ°á»ng."
            );
        }

        if (normalized.contains("in xong bill")
| normalized.contains("da gui bill")
| normalized.contains("Ä‘Ã£ gá»­i bill")
| normalized.contains("Ä‘Ã£ nháº­n lá»‡nh in")) {
            return new OperatorGuidance(
                    "ÄÃ£ xá»­ lÃ½ lá»‡nh in",
                    "Náº¿u cáº§n, tiáº¿p tá»¥c chá» bill má»›i."
            );
        }

        return new OperatorGuidance(
                String.valueOf(rawMessage == null ? "" : rawMessage).trim(),
                ""
        );
    }

    private String buildOperatorStatusText(String rawMessage) {
        OperatorGuidance guidance = resolveOperatorGuidance(cleanVietnamese(rawMessage));
        if (guidance.title.isEmpty()) return "";
        if (guidance.action.isEmpty()) return guidance.title;
        return guidance.title + "\n" + guidance.action;
    }

    private String buildOperatorLogLine(String rawMessage) {
        OperatorGuidance guidance = resolveOperatorGuidance(cleanVietnamese(rawMessage));
        if (guidance.title.isEmpty()) return "";
        if (guidance.action.isEmpty()) return guidance.title;
        return guidance.title + " - " + guidance.action;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void status(String message) {
        runOnUiThread(() -> {
            if (statusText != null) statusText.setText(cleanVietnamese(buildOperatorStatusText(message)));
        });
    }

    private void log(String message) {
        String cleanMessage = cleanVietnamese(message);
        Log.i("GHRPrintStation", cleanMessage);
        runOnUiThread(() -> {
            String time = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
            String old = logText == null ? "" : logText.getText().toString();
            String next = "[" + time + "] " + cleanVietnamese(buildOperatorLogLine(cleanMessage)) + "\n" + old;
            if (next.length() > 3000) next = next.substring(0, 3000);
            if (logText != null) logText.setText(next);
            status(cleanMessage);
        });
    }

    private void logRealtimeIssue(String message) {
        long now = System.currentTimeMillis();
        if (now - lastRealtimeIssueLogAt < REALTIME_LOG_THROTTLE_MS) return;
        lastRealtimeIssueLogAt = now;
        log(message);
    }

    private void toast(String message) {
        Toast.makeText(this, cleanVietnamese(message), Toast.LENGTH_SHORT).show();
    }

    private void playNewOrderAlert() {
        runOnUiThread(() -> {
            if (alertSoundPlaying) return;
            alertSoundPlaying = true;
            alertSoundCount = 0;
            playNextAlertSound();
        });
    }

    private void playNextAlertSound() {
        if (!alertSoundPlaying) return;
        if (alertSoundCount >= 3) {
            stopNewOrderAlert();
            return;
        }

        try {
            releaseAlertPlayer();
            alertPlayer = MediaPlayer.create(this, R.raw.new_order);
            if (alertPlayer == null) {
                stopNewOrderAlert();
                return;
            }

            alertSoundCount += 1;
            alertPlayer.setOnCompletionListener(player -> {
                releaseAlertPlayer();
                handler.postDelayed(this::playNextAlertSound, 180);
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
}
