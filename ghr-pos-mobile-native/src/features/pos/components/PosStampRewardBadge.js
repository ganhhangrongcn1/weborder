import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import PosIcon from "./PosIcon";

export default function PosStampRewardBadge() {
  const rotation = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) { rotation.setValue(0); return undefined; }
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(rotation, { toValue: -1, duration: 110, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: -1, duration: 160, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.delay(3500)
    ]));
    motion.start();
    return () => { motion.stop(); rotation.setValue(0); };
  }, [reduceMotion, rotation]);
  return <View style={styles.badge}>
    <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [-1, 1], outputRange: ["-12deg", "12deg"] }) }] }}>
      <PosIcon name="points" size={18} color="#8b4300" />
    </Animated.View>
    <Text style={styles.text}>Đổi quà</Text>
  </View>;
}
const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff0c2", borderWidth: 1, borderColor: "#e5a333", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  text: { color: "#8b4300", fontSize: 11, fontWeight: "900" }
});
