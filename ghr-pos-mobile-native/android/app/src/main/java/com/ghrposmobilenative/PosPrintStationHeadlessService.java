package vn.ghr.posmobile;

import android.content.Intent;

import androidx.annotation.Nullable;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

public class PosPrintStationHeadlessService extends HeadlessJsTaskService {
    @Nullable
    @Override
    protected HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        String branchUuid = intent != null ? intent.getStringExtra("branch_uuid") : "";
        String deviceId = intent != null ? intent.getStringExtra("device_id") : "";
        WritableMap taskData = Arguments.createMap();
        taskData.putString("branchUuid", branchUuid == null ? "" : branchUuid);
        taskData.putString("deviceId", deviceId == null ? "" : deviceId);

        return new HeadlessJsTaskConfig(
                "GhrPosPrintStationTask",
                taskData,
                60000,
                true
        );
    }
}
