import React, { useEffect } from "react";
import { SafeAreaView, StatusBar, StyleSheet } from "react-native";

import PosHomeScreen from "./src/screens/PosHomeScreen";
import { startPosSupabaseAuthLifecycle } from "./src/services/supabase/client";
import { POS_COLORS } from "./src/styles/posTheme";

export default function App() {
  useEffect(() => startPosSupabaseAuthLifecycle(), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={POS_COLORS.background} />
      <PosHomeScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: POS_COLORS.background
  }
});
