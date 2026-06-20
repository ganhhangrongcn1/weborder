import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { PosHomeScreen } from "../screens/PosHomeScreen";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PosHome"
        component={PosHomeScreen}
        options={{ title: "GHR POS Mobile" }}
      />
    </Stack.Navigator>
  );
}
