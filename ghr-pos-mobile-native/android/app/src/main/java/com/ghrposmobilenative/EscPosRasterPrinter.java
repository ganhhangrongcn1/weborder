package vn.ghr.posmobile;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

final class EscPosRasterPrinter {
    private static final int RECEIPT_WIDTH_DOTS_80MM = 576;
    private static final int BIG_TEXT_SIZE = 84;
    private static final int BIG_TEXT_MIN_SIZE = 42;
    private static final int BIG_LINE_HEIGHT = 100;
    private static final int NORMAL_TEXT_SIZE = 24;
    private static final int NORMAL_LINE_HEIGHT = 34;
    private static final int PAYMENT_QR_SIZE_DOTS = 320;
    private static final int FOOTER_QR_SIZE_DOTS = 220;

    private EscPosRasterPrinter() {
    }

    static byte[] buildReceiptRaster(
            String text,
            String qrUrl,
            String sourceType,
            String footerText,
            String footerQrUrl
    ) {
        String cleanText = cleanVietnamese(text);
        ReceiptRasterParts parts = "pos_payment_qr".equals(normalizeSourceType(sourceType))
                ? new ReceiptRasterParts(cleanText, "")
                : splitReceiptFooter(cleanText);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write(0x1B);
        output.write(0x40);

        int bodyQrSize = "pos_payment_qr".equals(normalizeSourceType(sourceType))
                ? PAYMENT_QR_SIZE_DOTS
                : FOOTER_QR_SIZE_DOTS;

        writeRasterBitmap(output, renderTextBitmap(parts.bodyText, RECEIPT_WIDTH_DOTS_80MM, qrUrl, bodyQrSize));
        if (footerText != null && !footerText.trim().isEmpty()) {
            writeRasterBitmap(output, renderTextBitmap(cleanVietnamese(footerText), RECEIPT_WIDTH_DOTS_80MM, footerQrUrl, FOOTER_QR_SIZE_DOTS));
        }

        output.write("\n\n\n".getBytes(StandardCharsets.US_ASCII), 0, 3);
        output.write(0x1D);
        output.write(0x56);
        output.write(0x42);
        output.write(0x00);
        return output.toByteArray();
    }

    private static String normalizeSourceType(String value) {
        return String.valueOf(value == null ? "" : value).trim().toLowerCase();
    }

    static String cleanVietnamese(String value) {
        String text = String.valueOf(value == null ? "" : value);
        for (int i = 0; i < 3 && looksMojibake(text); i++) {
            String decoded = new String(text.getBytes(Charset.forName("Windows-1252")), StandardCharsets.UTF_8);
            if (decoded.equals(text)) break;
            text = decoded;
        }
        return text;
    }

    private static void writeRasterBitmap(ByteArrayOutputStream output, Bitmap bitmap) {
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

    private static ReceiptRasterParts splitReceiptFooter(String text) {
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

    private static Bitmap renderTextBitmap(String text, int width, String qrUrl, int qrSize) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        paint.setTextSize(NORMAL_TEXT_SIZE);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));

        int padding = 16;
        Bitmap qrBitmap = createQrBitmap(qrUrl, qrSize);
        List<String> lines = expandReceiptLines(cleanVietnamese(text), paint, width - padding * 2);
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

    private static int estimateReceiptHeight(List<String> lines, Bitmap qrBitmap) {
        int height = 0;
        for (String line : lines) {
            if ("@@QR".equals(line) && qrBitmap != null) {
                height += qrBitmap.getHeight() + 20;
            } else if (line.startsWith("@@BIG:")) {
                height += BIG_LINE_HEIGHT;
            } else {
                height += NORMAL_LINE_HEIGHT;
            }
        }
        return height;
    }

    private static int drawReceiptLine(Canvas canvas, Paint paint, String line, int padding, int y, int width) {
        boolean big = line.startsWith("@@BIG:");
        boolean center = line.startsWith("@@CENTER:");
        String text = line;
        if (big) text = line.substring(6);
        if (center) text = line.substring(9);
        if ("@@QR".equals(line)) return y;

        paint.setTextSize(big ? BIG_TEXT_SIZE : NORMAL_TEXT_SIZE);
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

        return y + (big ? BIG_LINE_HEIGHT : NORMAL_LINE_HEIGHT);
    }

    private static void fitTextToWidth(Paint paint, String text, int maxWidth, int maxTextSize, int minTextSize) {
        paint.setTextSize(maxTextSize);
        while (paint.measureText(text) > maxWidth && paint.getTextSize() > minTextSize) {
            paint.setTextSize(paint.getTextSize() - 2);
        }
    }

    private static List<String> expandReceiptLines(String text, Paint paint, int maxWidth) {
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

    private static Bitmap createQrBitmap(String qrUrl, int size) {
        String value = String.valueOf(qrUrl == null ? "" : qrUrl).trim();
        if (value.isEmpty()) return null;
        try {
            Bitmap remoteQrBitmap = loadRemoteQrBitmap(value, size);
            if (remoteQrBitmap != null) return remoteQrBitmap;

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

    private static Bitmap loadRemoteQrBitmap(String value, int size) {
        if (!value.startsWith("http://") && !value.startsWith("https://")) return null;

        HttpURLConnection connection = null;
        try {
            URL url = new URL(value);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setUseCaches(false);
            connection.connect();
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) return null;

            try (InputStream inputStream = connection.getInputStream()) {
                Bitmap decoded = BitmapFactory.decodeStream(inputStream);
                if (decoded == null) return null;
                return fitBitmapOnWhiteCanvas(decoded, size);
            }
        } catch (Exception ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static Bitmap fitBitmapOnWhiteCanvas(Bitmap source, int size) {
        Bitmap result = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(result);
        canvas.drawColor(Color.WHITE);

        float scale = Math.min((float) size / source.getWidth(), (float) size / source.getHeight());
        int targetWidth = Math.max(1, Math.round(source.getWidth() * scale));
        int targetHeight = Math.max(1, Math.round(source.getHeight() * scale));
        int left = (size - targetWidth) / 2;
        int top = (size - targetHeight) / 2;

        Bitmap scaled = Bitmap.createScaledBitmap(source, targetWidth, targetHeight, false);
        Paint paint = new Paint();
        paint.setFilterBitmap(false);
        paint.setDither(false);
        canvas.drawBitmap(scaled, left, top, paint);

        if (scaled != source) scaled.recycle();
        source.recycle();
        return result;
    }

    private static List<String> wrapLines(String text, Paint paint, int maxWidth) {
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

    private static boolean looksMojibake(String value) {
        if (value == null || value.isEmpty()) return false;
        return value.contains("Ãƒ")
                || value.contains("Ã‚")
                || value.contains("Ã„")
                || value.contains("Ã†")
                || value.contains("Ã¡Âº")
                || value.contains("Ã¡Â»");
    }

    private static class ReceiptRasterParts {
        final String bodyText;
        final String footerText;

        ReceiptRasterParts(String bodyText, String footerText) {
            this.bodyText = bodyText == null ? "" : bodyText;
            this.footerText = footerText == null ? "" : footerText;
        }
    }
}
