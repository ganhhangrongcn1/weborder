#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
task_test_dir=$(mktemp -d /tmp/ghr-usb-policy-XXXXXX)
trap 'rm -rf "$task_test_dir"' EXIT
cat > "$task_test_dir/UsbPrinterSelectionPolicyTest.java" <<'JAVA_TEST'
package vn.ghr.posmobile;
import java.util.Arrays;
public class UsbPrinterSelectionPolicyTest {
  static void expect(int result, String saved, String... devices) {
    if (UsbPrinterSelectionPolicy.selectedIndex(saved, Arrays.asList(devices)) != result)
      throw new AssertionError("Incorrect printer selection");
  }
  public static void main(String[] args) {
    expect(-1, "", "100:200");
    expect(-1, "100:200");
    expect(-1, "100:200", "300:400");
    expect(1, "100:200", "300:400", "100:200");
    expect(0, "100:200", "100:200", "300:400");
    expect(-1, "100:200", "100:200", "100:200");
    expect(0, "100:200", "100:200");
    System.out.println("7 USB selection/reconnect scenarios passed");
  }
}
JAVA_TEST
java -m jdk.compiler/com.sun.tools.javac.Main -d "$task_test_dir" ghr-pos-mobile-native/android/app/src/main/java/com/ghrposmobilenative/UsbPrinterSelectionPolicy.java "$task_test_dir/UsbPrinterSelectionPolicyTest.java"
java -cp "$task_test_dir" vn.ghr.posmobile.UsbPrinterSelectionPolicyTest
