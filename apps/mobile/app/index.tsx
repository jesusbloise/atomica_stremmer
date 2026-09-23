import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { login, verifyTwoFactorLogin } from "../src/api";
import { saveAuthToken } from "../src/authStorage";
import TwoFactorScreen from "../src/components/TwoFactorScreen";

const logoAtomica = require("../assets/atomica-logo.png");

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState("");

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert(
        "Faltan datos",
        "Ingresa tu correo y contraseña."
      );
      return;
    }

    try {
      setLoading(true);

      const result = await login(email, password);

      if (result.requiresTwoFactor && result.challengeToken) {
        setTwoFactorError("");
        setChallengeToken(result.challengeToken);
        return;
      }

      if (result.requiresTwoFactorSetup) {
        Alert.alert(
          "Protege tu cuenta",
          "Configura Google Authenticator para continuar."
        );
        return;
      }

      Alert.alert(
        "Error",
        "No se pudo completar la verificación de seguridad."
      );
    } catch (error) {
      Alert.alert(
        "No se pudo iniciar sesión",
        error instanceof Error
          ? error.message
          : "No se pudo completar el inicio de sesión."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFactor(code: string) {
    if (!challengeToken) {
      setTwoFactorError(
        "La verificación expiró. Inicia sesión nuevamente."
      );
      return;
    }

    try {
      setLoading(true);
      setTwoFactorError("");

      const result = await verifyTwoFactorLogin(
        challengeToken,
        code
      );

      if (!result.authToken) {
        throw new Error(
          "El servidor no devolvió una sesión válida."
        );
      }

      await saveAuthToken(result.authToken);

      router.replace("/organizar");
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : "No se pudo completar la verificación."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleBackFromTwoFactor() {
    if (loading) return;

    setChallengeToken(null);
    setTwoFactorError("");
  }
  function handleForgotPassword() {
    Alert.alert(
      "Recuperar contraseña",
      "Esta opción todavía no está implementada en la plataforma web."
    );
  }

  function handleGoogleLogin() {
    Alert.alert(
      "Continuar con Google",
      "El acceso nativo con Google será conectado en el siguiente flujo de autenticación."
    );
  }

  if (challengeToken) {
    return (
      <TwoFactorScreen
        loading={loading}
        error={twoFactorError}
        onVerify={handleTwoFactor}
        onBack={handleBackFromTwoFactor}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />

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
              Inicio de sesión
            </Text>

            <Text style={styles.subtitle}>
              Ingresa tu correo y contraseña
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="correoelectrónico@dominio.com"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
              style={styles.input}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Contraseña"
              placeholderTextColor="#71717a"
              secureTextEntry
              editable={!loading}
              style={styles.input}
              onSubmitEditing={handleLogin}
            />

            <View style={styles.forgotRow}>
              <Pressable
                onPress={handleForgotPassword}
                disabled={loading}
                hitSlop={8}
              >
                <Text style={styles.forgotText}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.loginButtonText}>
                  Iniciar sesión
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.separator}>
            <View style={styles.separatorLine} />

            <Text style={styles.separatorText}>
              o continuar con
            </Text>

            <View style={styles.separatorLine} />
          </View>

          <Pressable
            onPress={handleGoogleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continuar con Google"
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.googleIcon}>
              <Text style={styles.googleG}>G</Text>
            </View>

            <Text style={styles.googleButtonText}>
              Continuar con Google
            </Text>
          </Pressable>

          <Text style={styles.terms}>
            Al continuar aceptas nuestros{" "}
            <Text style={styles.termsLink}>
              Términos de servicio
            </Text>{" "}
            y{" "}
            <Text style={styles.termsLink}>
              Política de privacidad
            </Text>
          </Text>
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

  form: {
    gap: 16,
  },

  input: {
    width: "100%",
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#52525b",
    borderRadius: 6,
    backgroundColor: "#27272a",
    color: "#ffffff",
    fontSize: 16,
  },

  forgotRow: {
    alignItems: "flex-end",
    marginTop: -2,
  },

  forgotText: {
    color: "#60a5fa",
    fontSize: 14,
    textDecorationLine: "underline",
  },

  loginButton: {
    width: "100%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },

  loginButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },

  separator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginVertical: 24,
  },

  separatorLine: {
    width: "20%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#52525b",
  },

  separatorText: {
    color: "#a1a1aa",
    fontSize: 14,
  },

  googleButton: {
    width: "100%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#52525b",
    borderRadius: 6,
    backgroundColor: "#18181b",
  },

  googleIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },

  googleG: {
    color: "#4285F4",
    fontSize: 14,
    fontWeight: "800",
  },

  googleButtonText: {
    color: "#e4e4e7",
    fontSize: 14,
    fontWeight: "500",
  },

  terms: {
    marginTop: 16,
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  termsLink: {
    color: "#d4d4d8",
    textDecorationLine: "underline",
  },

  pressed: {
    opacity: 0.82,
  },

  disabled: {
    opacity: 0.6,
  },
});



