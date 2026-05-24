package vn.ghr.posprinter;

import android.content.Context;
import android.content.SharedPreferences;
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
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;

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
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class PrintStationEngine {
    private static final String TAG = "GHRPrintStation";
    private static final String PREFS_NAME = "ghr_pos_printer";
    private static final String KEY_ACCESS_TOKEN = "access_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_BRANCH_UUID = "branch_uuid";
    private static final String KEY_BRANCH_NAME = "branch_name";
    private static final String KEY_BRANCH_ALIAS = "branch_alias";
    private static final String KEY_DEVICE_ID = "device_id";
    private static final String KEY_USB_DEVICE = "usb_device";
    private static final String KEY_PRINTER_MODE = "printer_mode";
    private static final String KEY_LAN_HOST = "lan_host";
    private static final String KEY_LAN_PORT = "lan_port";

    private static final String PRINTER_MODE_USB = "usb";
    private static final String PRINTER_MODE_LAN = "lan";
    private static final String PRINTER_KEY = "cashier-80mm";
    private static final String JOB_TYPE = "customer_bill";
    private static final String PRINT_JOB_SELECT = "id,order_code,payload,retry_count";
    private static final String SUPABASE_URL = "https://qjaklysckgzdfjthzkzu.supabase.co";
    private static final String SUPABASE_ANON_KEY = "sb_publishable_VPLwhy64zz2QQUyy02xzsg_CXs2A1JI";
    private static final String LOYALTY_QR_URL = "https://ganhhangrong.vn/loyalty?source=receipt";
    private static final int DEFAULT_LAN_PORT = 9100;
    private static final int REALTIME_HEARTBEAT_MS = 25000;
    private static final int REALTIME_RECONNECT_MS = 8000;
    private static final int PRINT_POLL_INTERVAL_MS = 30000;
    private static final int MAX_JOBS_PER_POLL = 3;
    private static final int RECEIPT_WIDTH_DOTS_80MM = 576;
    private static final int BIG_TEXT_SIZE = 84;
    private static final int BIG_TEXT_MIN_SIZE = 42;
    private static final int BIG_LINE_HEIGHT = 100;

    private final Context context;
    private final SharedPreferences prefs;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final UsbManager usbManager;
    private final OkHttpClient realtimeClient = new OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(20, TimeUnit.SECONDS)
            .build();

    private boolean running = false;
    private boolean polling = false;
    private boolean realtimeConnecting = false;
    private boolean realtimeJoined = false;
    private int realtimeRef = 1;
    private Bitmap fixedQrBitmap;
    private byte[] fixedFooterRasterBytes;
    private WebSocket realtimeSocket;

    private final Runnable realtimeHeartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running || realtimeSocket == null) return;
            sendRealtimeEvent("phoenix", "heartbeat", new JSONObject());
            handler.postDelayed(this, REALTIME_HEARTBEAT_MS);
        }
    };

    private final Runnable realtimeReconnectRunnable = new Runnable() {
        @Override
        public void run() {
            if (running && realtimeSocket == null) startRealtime();
        }
    };

    private final Runnable printPollingRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            pollOnceAsync();
            handler.postDelayed(this, PRINT_POLL_INTERVAL_MS);
        }
    };

    public PrintStationEngine(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.usbManager = (UsbManager) this.context.getSystemService(Context.USB_SERVICE);
    }

    public synchronized void start() {
        if (running) return;
        if (prefs.getString(KEY_BRANCH_UUID, "").trim().isEmpty()) {
            log("Missing branch_uuid. Print station was not started.");
            return;
        }
        if (prefs.getString(KEY_ACCESS_TOKEN, "").trim().isEmpty()) {
            log("Missing access token. Print station was not started.");
            return;
        }

        running = true;
        log("Service print station started for " + getBranchLabel() + ".");
        startRealtime();
        pollOnceAsync();
        schedulePrintPolling();
    }

    public synchronized void stop() {
        running = false;
        handler.removeCallbacks(printPollingRunnable);
        handler.removeCallbacks(realtimeReconnectRunnable);
        closeRealtime();
        log("Service print station stopped.");
    }

    private void pollOnceAsync() {
        if (polling) return;
        polling = true;
        new Thread(() -> {
            try {
                processPendingJobs();
            } catch (Exception error) {
                log("Read print jobs failed: " + shortError(error));
            } finally {
                polling = false;
            }
        }).start();
    }

    private void schedulePrintPolling() {
        handler.removeCallbacks(printPollingRunnable);
        if (running) {
            handler.postDelayed(printPollingRunnable, PRINT_POLL_INTERVAL_MS);
        }
    }

    private void processPendingJobs() throws Exception {
        String branchUuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        if (branchUuid.isEmpty()) return;

        String url = SUPABASE_URL + "/rest/v1/print_jobs"
                + "?select=" + PRINT_JOB_SELECT
                + "&status=eq.pending"
                + "&job_type=eq." + enc(JOB_TYPE)
                + "&printer_key=eq." + enc(PRINTER_KEY)
                + "&branch_uuid=eq." + enc(branchUuid)
                + "&order=created_at.asc"
                + "&limit=" + MAX_JOBS_PER_POLL;

        JSONArray jobs = new JSONArray(httpRequest("GET", url, null, false));
        for (int i = 0; i < jobs.length(); i++) {
            JSONObject claimedJob = claimJob(jobs.getJSONObject(i));
            if (claimedJob != null) printClaimedJob(claimedJob);
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
                + "&select=" + PRINT_JOB_SELECT;
        JSONArray result = new JSONArray(httpRequest("PATCH", url, body.toString(), true));
        if (result.length() == 0) return null;

        String code = result.getJSONObject(0).optString("order_code", "");
        log("Claimed print job " + (code.isEmpty() ? jobId : code) + ".");
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
            if (text.trim().isEmpty()) throw new Exception("Bill content is empty.");

            boolean ok = printReceiptPayload(text, loyaltyUrl);
            if (!ok) throw new Exception("Printer did not accept the bill.");

            markJobPrinted(jobId);
            log("Printed bill " + (orderCode.isEmpty() ? jobId : orderCode) + ".");
        } catch (Exception error) {
            markJobFailed(jobId, retryCount + 1, shortError(error));
            log("Print failed " + (orderCode.isEmpty() ? jobId : orderCode) + ": " + shortError(error));
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
                    if (running) scheduleRealtimeReconnect();
                }

                @Override
                public void onFailure(WebSocket webSocket, Throwable throwable, Response response) {
                    realtimeConnecting = false;
                    realtimeJoined = false;
                    realtimeSocket = null;
                    handler.removeCallbacks(realtimeHeartbeatRunnable);
                    log("Realtime disconnected. Reconnecting.");
                    if (running) scheduleRealtimeReconnect();
                }
            });
        } catch (Exception error) {
            realtimeConnecting = false;
            log("Realtime open failed: " + shortError(error));
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
            JSONObject change = new JSONObject();
            change.put("event", "INSERT");
            change.put("schema", "public");
            change.put("table", "print_jobs");
            change.put("filter", "branch_uuid=eq." + prefs.getString(KEY_BRANCH_UUID, "").trim());

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
            log("Realtime join failed: " + shortError(error));
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
                log("Realtime ready.");
                return;
            }
            if ("postgres_changes".equals(event)) {
                log("Realtime print job event received.");
                pollOnceAsync();
            }
        } catch (Exception ignored) {
        }
    }

    private boolean printReceiptPayload(String text, String qrUrl) {
        if (PRINTER_MODE_LAN.equals(getPrinterMode())) {
            return printReceiptTextViaLan(text, qrUrl);
        }
        return printReceiptTextViaUsb(text, qrUrl);
    }

    private boolean printReceiptTextViaLan(String text, String qrUrl) {
        String host = prefs.getString(KEY_LAN_HOST, "").trim();
        int port = getLanPort();
        if (host.isEmpty()) return false;

        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(5000);

            OutputStream outputStream = socket.getOutputStream();
            outputStream.write(buildEscPosRaster(text, qrUrl));
            outputStream.flush();
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    private boolean printReceiptTextViaUsb(String text, String qrUrl) {
        if (usbManager == null) return false;
        UsbDevice device = getSelectedDevice();
        if (device == null || !usbManager.hasPermission(device)) return false;

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

        if (usbInterface == null || outEndpoint == null) return false;

        UsbDeviceConnection connection = usbManager.openDevice(device);
        if (connection == null) return false;

        try {
            if (!connection.claimInterface(usbInterface, true)) return false;

            byte[] data = buildEscPosRaster(text, qrUrl);
            int offset = 0;
            while (offset < data.length) {
                int chunkSize = Math.min(4096, data.length - offset);
                int sent = connection.bulkTransfer(outEndpoint, data, offset, chunkSize, 5000);
                if (sent <= 0) return false;
                offset += sent;
            }
            return true;
        } finally {
            try {
                connection.releaseInterface(usbInterface);
            } catch (Exception ignored) {
            }
            connection.close();
        }
    }

    private UsbDevice getSelectedDevice() {
        if (usbManager == null) return null;
        HashMap<String, UsbDevice> devices = usbManager.getDeviceList();
        if (devices.isEmpty()) return null;

        String saved = prefs.getString(KEY_USB_DEVICE, "");
        for (UsbDevice device : devices.values()) {
            String key = device.getVendorId() + ":" + device.getProductId();
            if (key.equals(saved)) return device;
        }
        return new ArrayList<>(devices.values()).get(0);
    }

    private byte[] buildEscPosRaster(String text, String qrUrl) {
        ReceiptRasterParts parts = splitReceiptFooter(text);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write(0x1B);
        output.write(0x40);

        writeRasterBitmap(output, renderTextBitmap(parts.bodyText, RECEIPT_WIDTH_DOTS_80MM, qrUrl));
        if (!parts.footerText.trim().isEmpty()) {
            byte[] footerBytes = getFixedFooterRasterBytes(parts.footerText, qrUrl);
            output.write(footerBytes, 0, footerBytes.length);
        }

        output.write("\n\n\n".getBytes(StandardCharsets.US_ASCII), 0, 3);
        output.write(0x1D);
        output.write(0x56);
        output.write(0x42);
        output.write(0x00);
        return output.toByteArray();
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
                        if ((red + green + blue) / 3 < 160) value |= 1 << (7 - bit);
                    }
                }
                output.write(value);
            }
        }
    }

    private synchronized byte[] getFixedFooterRasterBytes(String footerText, String qrUrl) {
        if (fixedFooterRasterBytes == null) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            writeRasterBitmap(output, renderTextBitmap(footerText, RECEIPT_WIDTH_DOTS_80MM, qrUrl));
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
        Bitmap qrBitmap = getFixedQrBitmap(dp(150));
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

    private synchronized Bitmap getFixedQrBitmap(int size) {
        if (fixedQrBitmap == null) {
            fixedQrBitmap = createQrBitmap(LOYALTY_QR_URL, size);
        }
        return fixedQrBitmap;
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
        String[] words = text.trim().split("\\s+");
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
        return result;
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
        if (returnRepresentation) connection.setRequestProperty("Prefer", "return=representation");

        if (body != null) {
            connection.setDoOutput(true);
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(bytes);
            }
        }

        int code = connection.getResponseCode();
        InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
        String response = readStream(stream);
        connection.disconnect();

        if (code == 401 && bearerToken != null && !bearerToken.trim().isEmpty()) {
            JSONObject refreshed = refreshAccessToken();
            return httpRequest(method, urlString, body, returnRepresentation, refreshed.optString("access_token", ""));
        }
        if (code < 200 || code >= 300) throw new Exception("Supabase HTTP " + code + " " + response);
        return response == null || response.trim().isEmpty() ? "[]" : response;
    }

    private JSONObject refreshAccessToken() throws Exception {
        String refreshToken = prefs.getString(KEY_REFRESH_TOKEN, "").trim();
        if (refreshToken.isEmpty()) throw new Exception("Missing refresh token.");

        JSONObject body = new JSONObject();
        body.put("refresh_token", refreshToken);
        String url = SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token";
        JSONObject auth = new JSONObject(httpRequest("POST", url, body.toString(), false, ""));
        String accessToken = auth.optString("access_token", "");
        String nextRefreshToken = auth.optString("refresh_token", refreshToken);
        if (accessToken.isEmpty()) throw new Exception("Could not refresh access token.");

        prefs.edit()
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, nextRefreshToken)
                .apply();
        return auth;
    }

    private String readStream(InputStream stream) throws Exception {
        if (stream == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) builder.append(line);
        return builder.toString();
    }

    private String getPrinterMode() {
        String mode = prefs.getString(KEY_PRINTER_MODE, PRINTER_MODE_USB);
        return PRINTER_MODE_LAN.equals(mode) ? PRINTER_MODE_LAN : PRINTER_MODE_USB;
    }

    private int getLanPort() {
        return prefs.getInt(KEY_LAN_PORT, DEFAULT_LAN_PORT);
    }

    private String getAppDeviceId() {
        return prefs.getString(KEY_DEVICE_ID, "ghr-pos");
    }

    private String getBranchLabel() {
        String name = prefs.getString(KEY_BRANCH_NAME, "").trim();
        if (!name.isEmpty()) return name;
        String alias = prefs.getString(KEY_BRANCH_ALIAS, "").trim();
        if (!alias.isEmpty()) return alias;
        String uuid = prefs.getString(KEY_BRANCH_UUID, "").trim();
        return uuid.length() > 8 ? uuid.substring(0, 8) + "..." : uuid;
    }

    private String nowIso() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(new Date());
    }

    private String enc(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private String shortError(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return "Unknown error";
        return message.length() > 180 ? message.substring(0, 180) : message;
    }

    private int dp(int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    private void log(String message) {
        Log.i(TAG, message);
    }
}
