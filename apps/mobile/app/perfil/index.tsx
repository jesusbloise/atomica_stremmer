import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import {
  getMe,
  getTwoFactorStatus,
  getUserProfile,
  updateProfile,
  type CurrentUser,
  type TwoFactorStatus,
  type UserProfile,
} from "../../src/api";
import { getAuthToken } from "../../src/authStorage";

const atomicaLogo = require("../../assets/atomica-logo.png");

export default function PerfilScreen() {
  const router = useRouter();

  const [session, setSession] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [generacion, setGeneracion] = useState("");
  const [facultad, setFacultad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [participaciones, setParticipaciones] = useState<
    UserProfile["participaciones"]
  >([]);

  const [selectedAvatar, setSelectedAvatar] = useState<{
    uri: string;
    name?: string;
    type?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const authToken = await getAuthToken();

        if (!authToken) {
          router.replace("/");
          return;
        }

        const sessionData = await getMe(authToken);
        const userId = sessionData.id || sessionData.sub;

        if (!userId) {
          throw new Error("No se pudo identificar al usuario.");
        }

        const [profileData, twoFactorData] = await Promise.all([
          getUserProfile(authToken, userId),
          getTwoFactorStatus(authToken),
        ]);

        if (!cancelled) {
          setSession(sessionData);
          setProfile(profileData);
          setTwoFactor(twoFactorData);
          setParticipaciones(profileData.participaciones);

          setNombre(profileData.name || sessionData.name || "");
          setEmail(profileData.email || sessionData.email || "");
          setGeneracion(profileData.generacion || "");
          setFacultad(profileData.facultad || "");
          setDescripcion(profileData.descripcion || "");
          setInstagram(profileData.instagram || "");
          setFacebook(profileData.facebook || "");
          setWhatsapp(profileData.whatsapp || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el perfil.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleAddParticipation() {
    setParticipaciones((current) => [
      ...current,
      {
        fecha: "",
        nombre: "",
        miniatura: "",
        ruta: "",
      },
    ]);

    setSaveMessage("");
  }

  function handleUpdateParticipation(
    index: number,
    field: "fecha" | "nombre" | "miniatura" | "ruta",
    value: string,
  ) {
    setParticipaciones((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item,
      ),
    );

    setSaveMessage("");
  }

  function handleRemoveParticipation(index: number) {
    setParticipaciones((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );

    setSaveMessage("");
  }

  async function handlePickAvatar() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        "Necesitamos permiso para acceder a tus fotos.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    setSelectedAvatar({
      uri: asset.uri,
      name: asset.fileName || "avatar.jpg",
      type: asset.mimeType || "image/jpeg",
    });

    setError("");
    setSaveMessage("");
  }

  async function handleSave() {
    if (!profile || saving) return;

    try {
      setSaving(true);
      setError("");
      setSaveMessage("");

      const authToken = await getAuthToken();

      if (!authToken) {
        router.replace("/");
        return;
      }

      await updateProfile(authToken, {
        nombre: nombre.trim(),
        email: email.trim(),
        generacion: generacion.trim(),
        facultad: facultad.trim(),
        descripcion: descripcion.trim(),
        instagram: instagram.trim(),
        facebook: facebook.trim(),
        whatsapp: whatsapp.trim(),
        participaciones,
        avatar: selectedAvatar,
      });

      const sessionData = await getMe(authToken);
      const userId = sessionData.id || sessionData.sub;

      if (!userId) {
        throw new Error("No se pudo identificar al usuario.");
      }

      const refreshedProfile = await getUserProfile(
        authToken,
        userId,
      );

      setSession(sessionData);
      setProfile(refreshedProfile);
      setParticipaciones(refreshedProfile.participaciones);

      setNombre(refreshedProfile.name || sessionData.name || "");
      setEmail(refreshedProfile.email || sessionData.email || "");
      setGeneracion(refreshedProfile.generacion || "");
      setFacultad(refreshedProfile.facultad || "");
      setDescripcion(refreshedProfile.descripcion || "");
      setInstagram(refreshedProfile.instagram || "");
      setFacebook(refreshedProfile.facebook || "");
      setWhatsapp(refreshedProfile.whatsapp || "");
      setSelectedAvatar(null);

      setSaveMessage("Datos guardados correctamente.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error || "No se pudo cargar el perfil."}
          </Text>

          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile.name || session?.name || "Usuario";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerSide}
          onPress={() => router.back()}
        >
          <Text style={styles.backSymbol}>‹</Text>
        </Pressable>

        <Image
          source={atomicaLogo}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Mi Perfil</Text>

        <View style={styles.avatarSection}>
          {selectedAvatar?.uri || profile.avatar_url ? (
            <Image
              source={{
                uri: selectedAvatar?.uri || profile.avatar_url || "",
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>
                {initials || "A"}
              </Text>
            </View>
          )}

          <Pressable
            style={styles.changeAvatarButton}
            onPress={handlePickAvatar}
            disabled={saving}
          >
            <Text style={styles.changeAvatarText}>
              Cambiar foto
            </Text>
          </Pressable>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.role}>
            {profile.role || session?.role || ""}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos personales</Text>

          <ProfileInput
            label="Nombre"
            value={nombre}
            onChangeText={setNombre}
          />

          <ProfileInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <ProfileInput
            label="Generaci?n"
            value={generacion}
            onChangeText={setGeneracion}
          />

          <ProfileInput
            label="Facultad"
            value={facultad}
            onChangeText={setFacultad}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Escribe una descripci?n"
            placeholderTextColor="#666666"
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Redes y contacto</Text>

          <ProfileInput
            label="Instagram"
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
          />

          <ProfileInput
            label="Facebook"
            value={facebook}
            onChangeText={setFacebook}
            autoCapitalize="none"
          />

          <ProfileInput
            label="WhatsApp"
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seguridad</Text>

          <View style={styles.securityRow}>
            <View style={styles.securityText}>
              <Text style={styles.rowLabel}>
                Autenticación en dos pasos
              </Text>
              <Text style={styles.securityDescription}>
                Google Authenticator
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                twoFactor?.enabled
                  ? styles.statusEnabled
                  : styles.statusDisabled,
              ]}
            >
              <Text style={styles.statusText}>
                {twoFactor?.enabled ? "Activado" : "Desactivado"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.participationHeader}>
            <Text style={styles.cardTitle}>Participaciones</Text>

            <Pressable
              style={styles.addParticipationButton}
              onPress={handleAddParticipation}
              disabled={saving}
            >
              <Text style={styles.addParticipationText}>
                + Agregar
              </Text>
            </Pressable>
          </View>

          {participaciones.length === 0 ? (
            <Text style={styles.emptyText}>
              No hay participaciones registradas.
            </Text>
          ) : (
            participaciones.map((item, index) => (
              <View
                key={`participation-${index}`}
                style={styles.participationEditor}
              >
                <Text style={styles.participationNumber}>
                  Participaci?n {index + 1}
                </Text>

                <ProfileInput
                  label="Nombre"
                  value={item.nombre}
                  onChangeText={(value) =>
                    handleUpdateParticipation(
                      index,
                      "nombre",
                      value,
                    )
                  }
                />

                <ProfileInput
                  label="Fecha"
                  value={item.fecha}
                  onChangeText={(value) =>
                    handleUpdateParticipation(
                      index,
                      "fecha",
                      value,
                    )
                  }
                />

                <ProfileInput
                  label="Miniatura"
                  value={item.miniatura}
                  onChangeText={(value) =>
                    handleUpdateParticipation(
                      index,
                      "miniatura",
                      value,
                    )
                  }
                  autoCapitalize="none"
                />

                <ProfileInput
                  label="Ruta"
                  value={item.ruta}
                  onChangeText={(value) =>
                    handleUpdateParticipation(
                      index,
                      "ruta",
                      value,
                    )
                  }
                  autoCapitalize="none"
                />

                {item.miniatura ? (
                  <Image
                    source={{ uri: item.miniatura }}
                    style={styles.participationPreview}
                  />
                ) : null}

                <Pressable
                  style={styles.removeParticipationButton}
                  onPress={() =>
                    handleRemoveParticipation(index)
                  }
                  disabled={saving}
                >
                  <Text style={styles.removeParticipationText}>
                    Eliminar
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        {saveMessage ? (
          <Text style={styles.saveSuccess}>
            {saveMessage}
          </Text>
        ) : null}

        {error ? (
          <Text style={styles.inlineError}>
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.saveButton,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.saveButtonText}>
              Guardar datos
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileInput({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor="#666666"
      />
    </View>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>
        {value?.trim() || "No registrado"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#272727",
  },
  headerSide: {
    width: 44,
    height: 44,
    justifyContent: "center",
  },
  backSymbol: {
    color: "#ffffff",
    fontSize: 40,
    lineHeight: 42,
  },
  logo: {
    width: 145,
    height: 36,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 48,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#181818",
  },
  changeAvatarButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 8,
  },
  changeAvatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#343434",
  },
  avatarInitials: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "700",
  },
  name: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  role: {
    color: "#8e8e8e",
    fontSize: 13,
    marginTop: 5,
  },
  card: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#242424",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 14,
  },
  row: {
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#292929",
  },
  rowLabel: {
    color: "#8e8e8e",
    fontSize: 12,
    marginBottom: 5,
  },
  rowValue: {
    color: "#ffffff",
    fontSize: 15,
  },
  description: {
    color: "#d5d5d5",
    fontSize: 15,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 14,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#343434",
    borderRadius: 8,
    backgroundColor: "#080808",
    color: "#ffffff",
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  descriptionInput: {
    minHeight: 120,
  },
  participationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  addParticipationButton: {
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addParticipationText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  participationEditor: {
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
    paddingTop: 16,
    marginTop: 4,
    marginBottom: 18,
  },
  participationNumber: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 14,
  },
  participationPreview: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    backgroundColor: "#111111",
    marginBottom: 14,
  },
  removeParticipationButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#6b2d2d",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  removeParticipationText: {
    color: "#ff8c8c",
    fontSize: 13,
    fontWeight: "700",
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
  },
  saveSuccess: {
    color: "#8ee3a7",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  inlineError: {
    color: "#ff8c8c",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  securityText: {
    flex: 1,
    paddingRight: 12,
  },
  securityDescription: {
    color: "#ffffff",
    fontSize: 15,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusEnabled: {
    backgroundColor: "#173a25",
  },
  statusDisabled: {
    backgroundColor: "#3a1d1d",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  participation: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#292929",
  },
  participationLast: {
    borderBottomWidth: 0,
  },
  participationImage: {
    width: 62,
    height: 62,
    borderRadius: 6,
    backgroundColor: "#1d1d1d",
    marginRight: 12,
  },
  participationContent: {
    flex: 1,
  },
  participationName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  participationDate: {
    color: "#8e8e8e",
    fontSize: 12,
    marginTop: 5,
  },
  emptyText: {
    color: "#8e8e8e",
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#ffffff",
    marginTop: 12,
  },
  errorText: {
    color: "#ffffff",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 18,
  },
  backButton: {
    borderWidth: 1,
    borderColor: "#ffffff",
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
