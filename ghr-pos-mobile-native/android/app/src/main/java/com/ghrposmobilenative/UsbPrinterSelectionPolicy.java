package vn.ghr.posmobile;

import java.util.List;

/** Never substitute another printer, or guess between identical models. */
final class UsbPrinterSelectionPolicy {
    static int selectedIndex(String savedKey, List<String> deviceKeys) {
        if (savedKey == null || savedKey.isEmpty()) return -1;
        int match = -1;
        for (int i = 0; i < deviceKeys.size(); i++) {
            if (!savedKey.equals(deviceKeys.get(i))) continue;
            if (match >= 0) return -1;
            match = i;
        }
        return match;
    }
}
