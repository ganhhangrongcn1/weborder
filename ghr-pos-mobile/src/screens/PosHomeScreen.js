import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PosCartPanel } from "../features/pos/components/PosCartPanel";
import { PosMenuPanel } from "../features/pos/components/PosMenuPanel";
import { PaymentBar } from "../features/pos/components/PaymentBar";
import { usePosComposer } from "../features/pos/hooks/usePosComposer";

export function PosHomeScreen() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    authMessage,
    shiftMessage,
    busy,
    isSignedIn,
    branchName,
    shiftLabel,
    openingCash,
    setOpeningCash,
    pagerNumber,
    setPagerNumber,
    customerName,
    setCustomerName,
    orderNote,
    setOrderNote,
    products,
    cart,
    totals,
    paymentConfirmed,
    addProduct,
    changeQuantity,
    clearCart,
    confirmCash,
    createCashOrder,
    signIn,
    signOut,
    openShiftNow,
    hasOpenShift
  } = usePosComposer();

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart]
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>GHR POS</Text>
            <Text style={styles.meta}>{branchName}</Text>
            <Text style={styles.meta}>{shiftLabel}</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{cartCount}</Text>
            <Text style={styles.headerStatLabel}>mon</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tai khoan chi nhanh</Text>
          {!isSignedIn ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                autoCapitalize="none"
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Mat khau"
                secureTextEntry
                style={styles.input}
              />
              <Pressable
                style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
                onPress={signIn}
                disabled={busy}
              >
                <Text style={styles.primaryButtonText}>
                  {busy ? "Dang dang nhap..." : "Dang nhap"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.infoLine}>{branchName}</Text>
              <Text style={styles.infoLine}>{shiftLabel}</Text>
              <TextInput
                value={openingCash}
                onChangeText={setOpeningCash}
                placeholder="Tien dau ca"
                keyboardType="number-pad"
                style={styles.input}
              />
              <View style={styles.inlineActions}>
                <Pressable
                  style={[styles.primaryButtonHalf, busy && styles.primaryButtonDisabled]}
                  onPress={openShiftNow}
                  disabled={busy}
                >
                  <Text style={styles.primaryButtonText}>
                    {hasOpenShift ? "Tai lai ca" : "Mo ca"}
                  </Text>
                </Pressable>
                <Pressable style={styles.secondaryButtonHalf} onPress={signOut}>
                  <Text style={styles.secondaryButtonText}>Dang xuat</Text>
                </Pressable>
              </View>
            </>
          )}
          {!!authMessage && <Text style={styles.feedback}>{authMessage}</Text>}
          {!!shiftMessage && <Text style={styles.feedback}>{shiftMessage}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thong tin bill</Text>
          <TextInput
            value={pagerNumber}
            onChangeText={setPagerNumber}
            placeholder="The rung"
            keyboardType="number-pad"
            style={styles.input}
          />
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Ten khach"
            style={styles.input}
          />
          <TextInput
            value={orderNote}
            onChangeText={setOrderNote}
            placeholder="Ghi chu don"
            style={[styles.input, styles.noteInput]}
            multiline
          />
        </View>

        <PosMenuPanel products={products} onAddProduct={addProduct} />
        <PosCartPanel
          cart={cart}
          totals={totals}
          onChangeQuantity={changeQuantity}
          onClear={clearCart}
        />
      </ScrollView>

      <PaymentBar
        totals={totals}
        paymentConfirmed={paymentConfirmed}
        disabled={!isSignedIn || !hasOpenShift}
        onConfirmCash={confirmCash}
        onCreateOrder={createCashOrder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4efe7"
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 14
  },
  header: {
    backgroundColor: "#2f241d",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  brand: {
    color: "#fffaf3",
    fontSize: 24,
    fontWeight: "800"
  },
  meta: {
    color: "#f3ddc1",
    marginTop: 4,
    fontSize: 13
  },
  headerStat: {
    minWidth: 74,
    borderRadius: 16,
    backgroundColor: "#4a382d",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  headerStatValue: {
    color: "#fffaf3",
    fontSize: 22,
    fontWeight: "800"
  },
  headerStatLabel: {
    color: "#e9d7bf",
    fontSize: 12
  },
  card: {
    backgroundColor: "#fffaf3",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e7dccd"
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: "#dccdb9",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: "#fff"
  },
  noteInput: {
    minHeight: 88,
    textAlignVertical: "top"
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#b45309",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonHalf: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#b45309",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonDisabled: {
    opacity: 0.55
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800"
  },
  secondaryButtonHalf: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dccdb9",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: "#1f2937",
    fontWeight: "700"
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10
  },
  infoLine: {
    marginBottom: 8,
    color: "#1f2937",
    fontWeight: "600"
  },
  feedback: {
    marginTop: 8,
    color: "#7c6858"
  }
});

export default PosHomeScreen;
