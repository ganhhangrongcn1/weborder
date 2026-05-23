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
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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

import org.json.JSONArray;
import org.json.JSONObject;

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
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final String PREFS_NAME = "ghr_pos_printer";
    private static final String KEY_AUTH_EMAIL = "auth_email";
    private static final String KEY_ACCESS_TOKEN = "access_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_AUTH_USER_ID = "auth_user_id";
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
    private static final String PRINTER_KEY = "cashier-80mm";
    private static final String JOB_TYPE = "customer_bill";
    private static final String SUPABASE_URL = "https://qjaklysckgzdfjthzkzu.supabase.co";
    private static final String SUPABASE_ANON_KEY = "sb_publishable_VPLwhy64zz2QQUyy02xzsg_CXs2A1JI";
    private static final String ACTION_USB_PERMISSION = "vn.ghr.posprinter.USB_PERMISSION";
    private static final int RECEIPT_WIDTH_DOTS_80MM = 576;
    private static final int DEFAULT_LAN_PORT = 9100;
    private static final int POLL_INTERVAL_MS = 3000;

    private final Handler handler = new Handler(Looper.getMainLooper());
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
    private TextView logText;
    private Button stationButton;
    private Button usbModeButton;
    private Button lanModeButton;
    private LinearLayout usbPanel;
    private LinearLayout lanPanel;

    private String selectedMode = PRINTER_MODE_USB;
    private String pendingPrintText = "";
    private boolean stationRunning = false;
    private boolean polling = false;

    private final Runnable pollRunnable = new Runnable() {
        @Override
        public void run() {
            if (!stationRunning) return;
            pollOnceAsync();
            handler.postDelayed(this, POLL_INTERVAL_MS);
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
        log("Mở GHR Print Station.");

        if (prefs.getBoolean(KEY_STATION_ENABLED, false)) {
            startStation();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(pollRunnable);
        unregisterReceiver(usbReceiver);
        super.onDestroy();
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
        title.setText("Gánh Hàng Rong");
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        brand.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Trạm in bill khách · Xprinter 80mm");
        subtitle.setTextColor(Color.rgb(71, 85, 105));
        subtitle.setTextSize(13);
        subtitle.setTypeface(Typeface.DEFAULT_BOLD);
        brand.addView(subtitle);

        header.addView(brand, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        root.addView(header);

        stationText = makeInfoText("Trạm in đang tắt", Color.rgb(185, 28, 28));
        root.addView(stationText, fullWidthParams());

        statusText = makeInfoText("Sẵn sàng.", Color.rgb(71, 85, 105));
        root.addView(statusText, fullWidthParams());

        printerText = makeInfoText("", Color.rgb(15, 118, 110));
        root.addView(printerText, fullWidthParams());

        root.addView(makeSectionTitle("Tài khoản chi nhánh"));
        emailInput = makeInput("Email tài khoản bếp/chi nhánh");
        emailInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        root.addView(emailInput, fullWidthParams());

        passwordInput = makeInput("Mật khẩu");
        passwordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        root.addView(passwordInput, fullWidthParams());

        LinearLayout authRow = new LinearLayout(this);
        authRow.setOrientation(LinearLayout.HORIZONTAL);

        Button loginButton = makeButton("Đăng nhập chi nhánh", true);
        loginButton.setOnClickListener(view -> loginAsync());
        authRow.addView(loginButton, new LinearLayout.LayoutParams(0, dp(50), 1));

        Button logoutButton = makeButton("Đăng xuất", false);
        logoutButton.setOnClickListener(view -> logout());
        LinearLayout.LayoutParams logoutParams = new LinearLayout.LayoutParams(0, dp(50), 1);
        logoutParams.setMargins(dp(8), 0, 0, 0);
        authRow.addView(logoutButton, logoutParams);
        root.addView(authRow, fullWidthParams());

        root.addView(makeSectionTitle("Kết nối máy in"));
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
        Button chooseUsbButton = makeButton("Chọn máy in USB", false);
        chooseUsbButton.setOnClickListener(view -> showUsbDevicePicker());
        usbPanel.addView(chooseUsbButton, fullWidthParams());
        root.addView(usbPanel);

        lanPanel = new LinearLayout(this);
        lanPanel.setOrientation(LinearLayout.VERTICAL);
        lanHostInput = makeInput("IP máy in, ví dụ 192.168.1.88");
        lanHostInput.setInputType(InputType.TYPE_CLASS_PHONE);
        lanPanel.addView(lanHostInput, fullWidthParams());
        lanPortInput = makeInput("Port máy in");
        lanPortInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        lanPanel.addView(lanPortInput, fullWidthParams());
        root.addView(lanPanel);

        LinearLayout actionRow = new LinearLayout(this);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);

        Button saveButton = makeButton("Lưu cài đặt", false);
        saveButton.setOnClickListener(view -> saveSettingsFromInputs());
        actionRow.addView(saveButton, new LinearLayout.LayoutParams(0, dp(50), 1));

        stationButton = makeButton("Bật trạm in", true);
        stationButton.setOnClickListener(view -> {
            if (stationRunning) {
                stopStation();
            } else {
                saveSettingsFromInputs();
                startStation();
            }
        });
        LinearLayout.LayoutParams stationParams = new LinearLayout.LayoutParams(0, dp(50), 1);
        stationParams.setMargins(dp(8), 0, 0, 0);
        actionRow.addView(stationButton, stationParams);
        root.addView(actionRow, fullWidthParams());

        LinearLayout printRow = new LinearLayout(this);
        printRow.setOrientation(LinearLayout.HORIZONTAL);

        Button checkButton = makeButton("Kiểm tra lệnh in", false);
        checkButton.setOnClickListener(view -> {
            saveSettingsFromInputs();
            pollOnceAsync();
        });
        printRow.addView(checkButton, new LinearLayout.LayoutParams(0, dp(50), 1));

        Button testButton = makeButton("In test", false);
        testButton.setOnClickListener(view -> {
            saveSettingsFromInputs();
            printTestBill();
        });
        LinearLayout.LayoutParams testParams = new LinearLayout.LayoutParams(0, dp(50), 1);
        testParams.setMargins(dp(8), 0, 0, 0);
        printRow.addView(testButton, testParams);
        root.addView(printRow, fullWidthParams());

        root.addView(makeSectionTitle("Nhật ký"));
        logText = new TextView(this);
        logText.setTextColor(Color.rgb(51, 65, 85));
        logText.setTextSize(13);
        logText.setPadding(dp(12), dp(10), dp(12), dp(10));
        logText.setBackground(makeRoundRect(Color.WHITE, 8, 1, Color.rgb(226, 232, 240)));
        root.addView(logText, fullWidthParams());

        return scrollView;
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
        log("Đã lưu cài đặt.");
    }

    private void loginAsync() {
        saveSettingsFromInputs();
        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();
        if (email.isEmpty() || password.isEmpty()) {
            status("Vui lòng nhập email và mật khẩu.");
            return;
        }

        log("Đang đăng nhập tài khoản chi nhánh...");
        new Thread(() -> {
            try {
                JSONObject auth = signInWithPassword(email, password);
                JSONObject user = auth.optJSONObject("user");
                String accessToken = auth.optString("access_token", "");
                String refreshToken = auth.optString("refresh_token", "");
                String authUserId = user == null ? "" : user.optString("id", "");
                String authEmail = user == null ? email : user.optString("email", email);

                if (accessToken.isEmpty() || authUserId.isEmpty()) {
                    throw new Exception("Supabase chưa trả session hợp lệ.");
                }

                JSONObject profile = readProfile(accessToken, authUserId, authEmail);
                applyProfileSession(accessToken, refreshToken, authUserId, authEmail, profile);
                runOnUiThread(() -> passwordInput.setText(""));
                log("Đăng nhập thành công: " + getBranchLabel() + ".");
            } catch (Exception error) {
                clearAuthSession(false);
                log("Đăng nhập thất bại: " + normalizeAuthError(error));
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
        if (refreshToken.isEmpty()) throw new Exception("Chưa có refresh token.");

        JSONObject body = new JSONObject();
        body.put("refresh_token", refreshToken);
        String url = SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token";
        JSONObject auth = new JSONObject(httpRequest("POST", url, body.toString(), false, ""));
        String accessToken = auth.optString("access_token", "");
        String nextRefreshToken = auth.optString("refresh_token", refreshToken);
        if (accessToken.isEmpty()) throw new Exception("Không làm mới được phiên đăng nhập.");

        prefs.edit()
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, nextRefreshToken)
                .apply();
        return auth;
    }

    private JSONObject readProfile(String accessToken, String authUserId, String email) throws Exception {
        String select = "id,auth_user_id,phone,name,email,role,status,registered,metadata";
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

        throw new Exception("Tài khoản này chưa có hồ sơ trong bảng profiles.");
    }

    private void applyProfileSession(String accessToken, String refreshToken, String authUserId, String authEmail, JSONObject profile) throws Exception {
        String role = profile.optString("role", "").trim().toLowerCase(Locale.US);
        String status = profile.optString("status", "").trim().toLowerCase(Locale.US);
        if (!"active".equals(status)) {
            throw new Exception("Tài khoản chi nhánh chưa active.");
        }
        if (!("admin".equals(role) || "staff".equals(role) || "kitchen".equals(role))) {
            throw new Exception("Tài khoản này chưa có quyền bếp.");
        }

        JSONObject metadata = profile.optJSONObject("metadata");
        if (metadata == null) metadata = new JSONObject();

        String branchUuid = firstText(
                metadata.optString("branch_uuid", ""),
                metadata.optString("branchUuid", "")
        );
        if (branchUuid.isEmpty()) {
            throw new Exception("Profile chưa có metadata.branch_uuid.");
        }

        String branchName = firstText(
                metadata.optString("branch_name", ""),
                metadata.optString("branchName", "")
        );
        String branchAlias = firstText(
                metadata.optString("branch_alias", ""),
                metadata.optString("branchAlias", "")
        );
        String profileName = firstText(profile.optString("name", ""), authEmail);

        prefs.edit()
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, refreshToken)
                .putString(KEY_AUTH_USER_ID, authUserId)
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

    private void logout() {
        stopStation();
        clearAuthSession(true);
        log("Đã đăng xuất tài khoản chi nhánh.");
    }

    private void clearAuthSession(boolean clearEmail) {
        stationRunning = false;
        handler.removeCallbacks(pollRunnable);
        SharedPreferences.Editor editor = prefs.edit()
                .remove(KEY_ACCESS_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_AUTH_USER_ID)
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
        });
    }

    private void startStation() {
        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        if (branchUuid.isEmpty()) {
            status("Bạn cần đăng nhập tài khoản chi nhánh trước.");
            return;
        }
        if (prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()) {
            status("Phiên đăng nhập chưa sẵn sàng. Vui lòng đăng nhập lại.");
            return;
        }

        stationRunning = true;
        prefs.edit().putBoolean(KEY_STATION_ENABLED, true).apply();
        updateStationUi();
        log("Đã bật trạm in cho chi nhánh " + getBranchLabel() + ".");
        handler.removeCallbacks(pollRunnable);
        pollRunnable.run();
    }

    private void stopStation() {
        stationRunning = false;
        prefs.edit().putBoolean(KEY_STATION_ENABLED, false).apply();
        handler.removeCallbacks(pollRunnable);
        updateStationUi();
        log("Đã tắt trạm in.");
    }

    private void updateStationUi() {
        if (stationText == null || stationButton == null) return;
        if (stationRunning) {
            stationText.setText("Trạm in đang bật · " + getBranchLabel());
            stationText.setTextColor(Color.rgb(15, 118, 110));
            stationButton.setText("Tắt trạm in");
            stationButton.setBackground(makeRoundRect(Color.rgb(239, 68, 68), 8, 1, Color.rgb(185, 28, 28)));
        } else {
            boolean loggedIn = !prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()
                    && !prefs.getString(KEY_BRANCH_UUID, "").trim().isEmpty();
            stationText.setText(loggedIn ? "Đã đăng nhập · " + getBranchLabel() : "Chưa đăng nhập chi nhánh");
            stationText.setTextColor(loggedIn ? Color.rgb(15, 118, 110) : Color.rgb(185, 28, 28));
            stationButton.setText("Bật trạm in");
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
                log("Lỗi lấy lệnh in: " + shortError(error));
            } finally {
                polling = false;
            }
        }).start();
    }

    private void processPendingJobs() throws Exception {
        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        if (branchUuid.isEmpty()) {
            status("Chưa nhập branch_uuid.");
            return;
        }

        status("Đang kiểm tra lệnh in...");
        String url = SUPABASE_URL + "/rest/v1/print_jobs"
                + "?select=*"
                + "&status=eq.pending"
                + "&job_type=eq." + enc(JOB_TYPE)
                + "&printer_key=eq." + enc(PRINTER_KEY)
                + "&branch_uuid=eq." + enc(branchUuid)
                + "&order=created_at.asc"
                + "&limit=5";

        JSONArray jobs = new JSONArray(httpRequest("GET", url, null, false));
        if (jobs.length() == 0) {
            status("Chưa có lệnh in mới.");
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
                + "&status=eq.pending"
                + "&select=*";
        JSONArray result = new JSONArray(httpRequest("PATCH", url, body.toString(), true));
        if (result.length() == 0) return null;

        String code = result.getJSONObject(0).optString("order_code", "");
        log("Đã nhận lệnh in " + (code.isEmpty() ? jobId : code) + ".");
        return result.getJSONObject(0);
    }

    private void printClaimedJob(JSONObject job) {
        String jobId = job.optString("id", "");
        String orderCode = job.optString("order_code", "");
        int retryCount = job.optInt("retry_count", 0);

        try {
            JSONObject payload = job.optJSONObject("payload");
            String text = payload == null ? "" : payload.optString("text", "");
            if (text.trim().isEmpty()) {
                throw new Exception("Bill chưa có nội dung để in.");
            }

            boolean ok = printReceiptText(text);
            if (!ok) throw new Exception("Máy in chưa nhận bill.");

            markJobPrinted(jobId);
            log("In xong bill " + (orderCode.isEmpty() ? jobId : orderCode) + ".");
        } catch (Exception error) {
            markJobFailed(jobId, retryCount + 1, shortError(error));
            log("In lỗi " + (orderCode.isEmpty() ? jobId : orderCode) + ": " + shortError(error));
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
            printerText.setText("Máy in USB: chưa kết nối");
            printerText.setTextColor(Color.rgb(185, 28, 28));
            return;
        }

        boolean hasPermission = usbManager.hasPermission(device);
        printerText.setText(hasPermission ? "Máy in USB: sẵn sàng" : "Máy in USB: cần cấp quyền");
        printerText.setTextColor(hasPermission ? Color.rgb(15, 118, 110) : Color.rgb(194, 65, 12));
    }

    private void printTestBill() {
        String time = new SimpleDateFormat("HH:mm dd/MM/yyyy", new Locale("vi", "VN")).format(new Date());
        printReceiptText(
                "GÁNH HÀNG RONG\n" +
                "Bill test Xprinter 80mm\n" +
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

    private Button makeButton(String label, boolean primary) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setTypeface(Typeface.DEFAULT_BOLD);
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
        input.setHint(hint);
        input.setTextSize(14);
        input.setPadding(dp(12), 0, dp(12), 0);
        input.setBackground(makeRoundRect(Color.WHITE, 8, 1, Color.rgb(203, 213, 225)));
        return input;
    }

    private TextView makeSectionTitle(String text) {
        TextView title = new TextView(this);
        title.setText(text);
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setTextSize(15);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, dp(18), 0, dp(8));
        return title;
    }

    private TextView makeInfoText(String text, int color) {
        TextView view = new TextView(this);
        view.setText(text);
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

    private int getLanPort() {
        return prefs.getInt(KEY_LAN_PORT, DEFAULT_LAN_PORT);
    }

    private String getBranchLabel() {
        String name = prefs.getString(KEY_BRANCH_NAME, "").trim();
        if (!name.isEmpty()) return name;
        String alias = prefs.getString(KEY_BRANCH_ALIAS, "").trim();
        if (!alias.isEmpty()) return alias;
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

    private String normalizeAuthError(Exception error) {
        String raw = String.valueOf(error == null ? "" : error.getMessage()).trim();
        String lower = raw.toLowerCase(Locale.US);
        if (lower.contains("invalid login credentials")) return "Email hoặc mật khẩu chưa đúng.";
        if (lower.contains("email not confirmed")) return "Email này chưa được xác nhận trong Supabase Auth.";
        if (lower.contains("timeout")) return "Kết nối Supabase đang chậm. Bạn thử lại sau vài giây.";
        if (lower.contains("network") || lower.contains("failed to connect")) return "Không kết nối được Supabase. Kiểm tra mạng POS.";
        return raw.isEmpty() ? "Đăng nhập thất bại." : raw;
    }

    private void ensureDeviceId() {
        if (prefs.getString(KEY_DEVICE_ID, "").isEmpty()) {
            prefs.edit().putString(KEY_DEVICE_ID, "ghr-pos-" + UUID.randomUUID()).apply();
        }
    }

    private String getAppDeviceId() {
        return prefs.getString(KEY_DEVICE_ID, "ghr-pos");
    }

    private String nowIso() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(new Date());
    }

    private String enc(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private String shortError(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return "Không rõ lỗi";
        return message.length() > 180 ? message.substring(0, 180) : message;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void status(String message) {
        runOnUiThread(() -> {
            if (statusText != null) statusText.setText(message);
        });
    }

    private void log(String message) {
        runOnUiThread(() -> {
            String time = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
            String old = logText == null ? "" : logText.getText().toString();
            String next = "[" + time + "] " + message + "\n" + old;
            if (next.length() > 3000) next = next.substring(0, 3000);
            if (logText != null) logText.setText(next);
            status(message);
        });
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
}
