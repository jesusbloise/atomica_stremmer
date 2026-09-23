import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const logoAtomica = require("../../assets/atomica-logo.png");

type Props = {
  loading: boolean;
  error?: string;
  onVerify: (code: string) => void;
  onBack: () => void;
};

export default function TwoFactorScreen({
  loading,
  error,
  onVerify,
  onBack,
}: Props) {
  const [code, setCode] = useState("");

  function handleChange(value: string) {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  }

  function handleVerify() {
    if (code.length !== 6 || loading) {
      return;
    }

    onVerify(code);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Image
            source={logoAtomica}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.header}>
            <Text style={styles.title}>
              Verificación de seguridad
            </Text>

            <Text style={styles.subtitle}>
              Ingresa el código de 6 dígitos de Google Authenticator
            </Text>
          </View>

          <TextInput
            value={code}
            onChangeText={handleChange}
            placeholder="000000"
            placeholderTextColor="#71717a"
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            autoFocus
            textContentType="oneTimeCode"
            style={styles.codeInput}
            onSubmitEditing={handleVerify}
          />

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <Pressable
            onPress={handleVerify}
            disabled={loading || code.length !== 6}
            style={({ pressed }) => [
              styles.verifyButton,
              pressed && styles.pressed,
              (loading || code.length !== 6) && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.verifyButtonText}>
                Verificar
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={onBack}
            disabled={loading}
            hitSlop={8}
            style={styles.backButton}
          >
            <Text style={styles.backText}>
              Volver al inicio de sesión
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  container: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 42,
  },

  logo: {
    width: 190,
    height: 102,
    alignSelf: "center",
    marginBottom: 24,
  },

  header: {
    alignItems: "center",
    marginBottom: 24,
  },

  title: {
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 8,
    color: "#a1a1aa",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  codeInput: {
    width: "100%",
    minHeight: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#52525b",
    borderRadius: 6,
    backgroundColor: "#27272a",
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 10,
  },

  errorText: {
    marginTop: 12,
    color: "#f87171",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },

  verifyButton: {
    width: "100%",
    minHeight: 44,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },

  verifyButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },

  backButton: {
    alignSelf: "center",
    marginTop: 20,
  },

  backText: {
    color: "#60a5fa",
    fontSize: 14,
    textDecorationLine: "underline",
  },

  pressed: {
    opacity: 0.82,
  },

  disabled: {
    opacity: 0.5,
  },
});
