import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import {
  createUploadShareLink,
  CurrentUser,
  getMe,
  getTechnicalSheet,
  getThumbnailCandidates,
  getTranscript,
  getUploadById,
  moveUpload,
  TechnicalSheet,
  ThumbnailCandidate,
  TranscriptLine,
  updateTechnicalSheet,
  updateTranscriptLine,
  updateUploadVisibility,
  UploadDetail,
  UploadVisibility,
  selectUploadThumbnail,
  uploadCustomThumbnail,
} from "../../../src/api";
import { getAuthToken } from "../../../src/authStorage";

const OFICINA_OPTIONS = ["Chile", "Mexico"] as const;

const TIPO_OPTIONS = [
  "Color",
  "3D",
  "IA",
  "Musica",
  "Sonido",
  "VFX",
  "Edicion",
  "Motion",
  "Dailies",
  "Master & Deliveries",
] as const;

const EMPTY_FICHA: TechnicalSheet = {
  titulo: null,
  marca: null,
  agencia: null,
  productora: null,
  contacto: null,
  oficina: null,
  tipo: [],
  estudio: null,
  director: null,
  productor: null,
  produccion: null,
  corporativo: null,
  nuevosNegocios: null,
  otros: null,
  duracion: null,
  formato: null,
  version: null,
  fecha: null,
};

type DetailData = {
  upload: UploadDetail;
  ficha: TechnicalSheet | null;
  transcript: TranscriptLine[];
  me: CurrentUser | null;
  fichaError: string | null;
  transcriptError: string | null;
};

export default function VideoDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const id = useMemo(() => {
    const value = params.id;
    return Array.isArray(value) ? value[0] : value;
  }, [params.id]);

  const [data, setData] = useState<DetailData | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);

        if (!id) {
          throw new Error("No se recibió el identificador del video");
        }

        const token = await getAuthToken();

        if (!token) {
          throw new Error("Tu sesión no está disponible");
        }

        const upload = await getUploadById(token, id);

        if (!active) return;

        setAuthToken(token);

        const [fichaResult, transcriptResult, meResult] =
          await Promise.allSettled([
            getTechnicalSheet(token, id),
            getTranscript(token, id),
            getMe(token),
          ]);

        if (!active) return;

        setData({
          upload,

          ficha:
            fichaResult.status === "fulfilled"
              ? fichaResult.value
              : null,

          transcript:
            transcriptResult.status === "fulfilled"
              ? transcriptResult.value
              : [],

          me:
            meResult.status === "fulfilled"
              ? meResult.value
              : null,

          fichaError:
            fichaResult.status === "rejected"
              ? fichaResult.reason instanceof Error
                ? fichaResult.reason.message
                : "No se pudo cargar la ficha técnica"
              : null,

          transcriptError:
            transcriptResult.status === "rejected"
              ? transcriptResult.reason instanceof Error
                ? transcriptResult.reason.message
                : "No se pudo cargar la transcripción"
              : null,
        });
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el video",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Cargando video...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data || !authToken || !id) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>No se pudo abrir el video</Text>

          <Text style={styles.errorText}>
            {error || "El archivo no está disponible"}
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LoadedVideoDetail
      initialData={data}
      authToken={authToken}
      uploadId={id}
    />
  );
}

function LoadedVideoDetail({
  initialData,
  authToken,
  uploadId,
}: {
  initialData: DetailData;
  authToken: string;
  uploadId: string;
}) {
  const [ficha, setFicha] = useState<TechnicalSheet | null>(
    initialData.ficha,
  );

  const [transcript, setTranscript] = useState<TranscriptLine[]>(
    initialData.transcript,
  );

 const [openPanel, setOpenPanel] = useState<
  "ficha" | "transcript" | "options" | null
>(null);

  const [searchTerm, setSearchTerm] = useState("");

  const playbackUrl =
    initialData.upload.cf_stream_hls_url || null;

  const player = useVideoPlayer(playbackUrl, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  const title =
    initialData.upload.titulo ||
    initialData.upload.display_name ||
    initialData.upload.file_name ||
    "Video";

  const role = initialData.me?.role;

  const canEditFicha =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "PROFESOR";

  const canEditTranscript =
    role === "SUPER_ADMIN" || role === "ADMIN";

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

  const filteredTranscript = useMemo(() => {
    if (!normalizedSearch) {
      return transcript;
    }

    return transcript.filter((line) =>
      (line.text || "")
        .toLocaleLowerCase()
        .includes(normalizedSearch),
    );
  }, [normalizedSearch, transcript]);

  function togglePanel(
  panel: "ficha" | "transcript" | "options",
) {
  setOpenPanel((current) =>
    current === panel ? null : panel,
  );
}

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.back()}
          >
            <Text style={styles.iconButtonText}>‹</Text>
          </Pressable>

          <Text style={styles.brand}>ATOMICA</Text>

          <View style={styles.topBarSpacer} />
        </View>

        <Text style={styles.title}>{title}</Text>

        {playbackUrl ? (
          <View style={styles.playerContainer}>
            <VideoView
              player={player}
              style={styles.player}
              contentFit="contain"
              nativeControls
              surfaceType="textureView"
              fullscreenOptions={{ enable: true }}
            />
          </View>
        ) : (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableTitle}>
              Reproducción no disponible
            </Text>

            <Text style={styles.unavailableText}>
              Este video todavía no tiene una fuente HLS disponible.
            </Text>
          </View>
        )}

        <View style={styles.metadata}>
          {initialData.upload.category ? (
            <Text style={styles.metadataText}>
              {initialData.upload.category}
              {initialData.upload.subcategory
                ? ` · ${initialData.upload.subcategory}`
                : ""}
            </Text>
          ) : null}

          {typeof initialData.upload.views === "number" ? (
            <Text style={styles.secondaryText}>
              {initialData.upload.views} reproducciones
            </Text>
          ) : null}
        </View>

        <View style={styles.panels}>
          <PanelButton
            title="Ficha técnica"
            open={openPanel === "ficha"}
            onPress={() => togglePanel("ficha")}
          />

          {openPanel === "ficha" ? (
            <View style={styles.panelContent}>
              {initialData.fichaError ? (
                <PanelMessage
                  title="No se pudo cargar la ficha técnica"
                  text={initialData.fichaError}
                />
              ) : (
                <TechnicalSheetPanel
                  ficha={ficha}
                  canEdit={canEditFicha}
                  authToken={authToken}
                  uploadId={uploadId}
                  onSaved={setFicha}
                />
              )}
            </View>
          ) : null}

          <PanelButton
            title="Transcripción"
            open={openPanel === "transcript"}
            onPress={() => togglePanel("transcript")}
          />

          {openPanel === "transcript" ? (
            <View style={styles.panelContent}>
              {initialData.transcriptError ? (
                <PanelMessage
                  title="No se pudo cargar la transcripción"
                  text={initialData.transcriptError}
                />
              ) : (
                <>
                  <View style={styles.transcriptHeader}>
                    <View>
                      <Text style={styles.sectionTitle}>
                        Transcripción
                      </Text>

                      <Text style={styles.sectionSubtitle}>
                        {transcript.length} líneas
                        {normalizedSearch
                          ? ` · ${filteredTranscript.length} coincidencias`
                          : ""}
                      </Text>
                    </View>

                    {canEditTranscript ? (
                      <View style={styles.editEnabledBadge}>
                        <Text style={styles.editEnabledText}>
                          Edición habilitada
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.searchRow}>
                    <TextInput
                      style={styles.searchInput}
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      placeholder="Buscar palabra o frase..."
                      placeholderTextColor="#71717a"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />

                    <View style={styles.matchBadge}>
                      <Text style={styles.matchBadgeText}>
                        {normalizedSearch
                          ? `${filteredTranscript.length}/${transcript.length}`
                          : `${transcript.length}`}
                      </Text>
                    </View>
                  </View>

                  {transcript.length === 0 ? (
                    <PanelMessage
                      title="Sin transcripción"
                      text="No hay transcripción disponible para este video."
                    />
                  ) : filteredTranscript.length === 0 ? (
                    <PanelMessage
                      title="Sin coincidencias"
                      text="No encontramos esa palabra o frase en la transcripción."
                    />
                  ) : (
                    <View style={styles.transcriptList}>
                      {filteredTranscript.map((line) => (
                        <EditableTranscriptRow
                          key={line.id}
                          line={line}
                          canEdit={canEditTranscript}
                          authToken={authToken}
                          onSaved={(subtitleId, text) => {
                            setTranscript((current) =>
                              current.map((item) =>
                                item.id === subtitleId
                                  ? { ...item, text }
                                  : item,
                              ),
                            );
                          }}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          ) : null}
                    <PanelButton
            title="Opciones"
            open={openPanel === "options"}
            onPress={() => togglePanel("options")}
          />

          {openPanel === "options" ? (
            <View style={styles.panelContent}>
              <UploadOptionsPanel
                upload={initialData.upload}
                authToken={authToken}
                uploadId={uploadId}
                role={role}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PanelButton({
  title,
  open,
  onPress,
}: {
  title: string;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.panelButton,
        open && styles.panelButtonOpen,
        pressed && styles.panelButtonPressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.panelButtonTitle}>{title}</Text>

      <Text
        style={[
          styles.panelChevron,
          open && styles.panelChevronOpen,
        ]}
      >
        ›
      </Text>
    </Pressable>
  );
}
function formatThumbnailTime(timeSec: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number(timeSec) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function UploadOptionsPanel({
  upload,
  authToken,
  uploadId,
  role,
}: {
  upload: UploadDetail;
  authToken: string;
  uploadId: string;
  role?: string | null;
}) {
  const normalizedRole = String(role || "").trim().toUpperCase();

  const isAdmin =
    normalizedRole === "SUPER_ADMIN" ||
    normalizedRole === "ADMIN";

  const isSuperAdmin = normalizedRole === "SUPER_ADMIN";

  const canManagePrivacy =
    upload.can_manage_privacy === true;

  const [visibility, setVisibility] =
    useState<UploadVisibility>(
      upload.visibility === "RESTRICTED"
        ? "RESTRICTED"
        : "PUBLIC",
    );

  const [category, setCategory] = useState(
    upload.category || "",
  );

  const [subcategory, setSubcategory] = useState(
    upload.subcategory || "",
  );

  const [moveCategory, setMoveCategory] = useState(
    upload.category || "",
  );

  const [moveSubcategory, setMoveSubcategory] = useState(
    upload.subcategory || "",
  );

  const [moving, setMoving] = useState(false);
  const [changingPrivacy, setChangingPrivacy] =
    useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareExpiresInHours, setShareExpiresInHours] =
    useState(168);

  const [loadingThumbnails, setLoadingThumbnails] =
    useState(false);

  const [thumbnailCandidates, setThumbnailCandidates] =
    useState<ThumbnailCandidate[]>([]);

  async function handleChangePrivacy() {
    if (!isAdmin || !canManagePrivacy || changingPrivacy) {
      return;
    }

    const nextVisibility: UploadVisibility =
      visibility === "PUBLIC"
        ? "RESTRICTED"
        : "PUBLIC";

    Alert.alert(
      nextVisibility === "PUBLIC"
        ? "Hacer público"
        : "Hacer restringido",
      nextVisibility === "PUBLIC"
        ? "¿Quieres hacer público este archivo?"
        : "¿Quieres restringir este archivo?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Confirmar",
          onPress: () => {
            void (async () => {
              try {
                setChangingPrivacy(true);

                const savedVisibility =
                  await updateUploadVisibility(
                    authToken,
                    uploadId,
                    nextVisibility,
                  );

                setVisibility(savedVisibility);

                Alert.alert(
                  "Privacidad actualizada",
                  savedVisibility === "PUBLIC"
                    ? "El archivo ahora es público."
                    : "El archivo ahora es restringido.",
                );
              } catch (error) {
                Alert.alert(
                  "No se pudo cambiar la privacidad",
                  error instanceof Error
                    ? error.message
                    : "Ocurrió un error inesperado.",
                );
              } finally {
                setChangingPrivacy(false);
              }
            })();
          },
        },
      ],
    );
  }

  async function handleMoveUpload() {
    if (!isSuperAdmin || moving) {
      return;
    }

    const cleanCategory = moveCategory.trim();

    if (!cleanCategory) {
      Alert.alert(
        "Categoría requerida",
        "Selecciona o escribe una categoría.",
      );
      return;
    }

    try {
      setMoving(true);

      const updated = await moveUpload(
        authToken,
        uploadId,
        cleanCategory,
        moveSubcategory,
      );

      setCategory(updated.category || cleanCategory);
      setSubcategory(updated.subcategory || "");
      setMoveCategory(updated.category || cleanCategory);
      setMoveSubcategory(updated.subcategory || "");

      Alert.alert(
        "Archivo movido",
        updated.subcategory
          ? `Ahora está en ${updated.category} · ${updated.subcategory}.`
          : `Ahora está en ${updated.category}.`,
      );
    } catch (error) {
      Alert.alert(
        "No se pudo mover el archivo",
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setMoving(false);
    }
  }

  async function handleShare() {
    if (!isAdmin || sharing) {
      return;
    }

    if (visibility !== "PUBLIC") {
      Alert.alert(
        "Archivo restringido",
        "Solo puedes generar un enlace público cuando el archivo es público.",
      );
      return;
    }

    try {
      setSharing(true);

      const shareUrl = await createUploadShareLink(
        authToken,
        uploadId,
        shareExpiresInHours,
      );

      Alert.alert(
        "Enlace generado",
        shareUrl,
      );
    } catch (error) {
      Alert.alert(
        "No se pudo generar el enlace",
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setSharing(false);
    }
  }

  async function handleLoadThumbnails() {
    if (!isAdmin || loadingThumbnails) {
      return;
    }

    try {
      setLoadingThumbnails(true);

      const candidates = await getThumbnailCandidates(
        authToken,
        uploadId,
      );

      setThumbnailCandidates(candidates);

      if (candidates.length === 0) {
        Alert.alert(
          "Sin portadas",
          "No se generaron candidatos de portada para este video.",
        );
      }
    } catch (error) {
      Alert.alert(
        "No se pudieron cargar las portadas",
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setLoadingThumbnails(false);
    }
  }

  const handlePickCustomThumbnail = async () => {
  try {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permiso necesario",
        "Debes permitir el acceso a tus fotos para elegir una portada.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const image = result.assets[0];

    Alert.alert(
      "Cambiar portada",
      "¿Quieres usar esta imagen como portada del archivo?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Usar portada",
          onPress: async () => {
            try {
              await uploadCustomThumbnail(authToken, uploadId, {
                uri: image.uri,
                fileName: image.fileName,
                mimeType: image.mimeType,
              });

              setThumbnailCandidates([]);

              Alert.alert(
                "Portada actualizada",
                "La imagen se guardó correctamente como nueva portada.",
              );
            } catch (error) {
              Alert.alert(
                "No se pudo cambiar la portada",
                error instanceof Error
                  ? error.message
                  : "Ocurrió un error inesperado.",
              );
            }
          },
        },
      ],
    );
  } catch (error) {
    Alert.alert(
      "No se pudo abrir la galería",
      error instanceof Error
        ? error.message
        : "Ocurrió un error inesperado.",
    );
  }
};

  if (!isAdmin) {
    return (
      <PanelMessage
        title="Opciones"
        text="No tienes permisos administrativos para modificar este archivo."
      />
    );
  }

  return (
    <View style={styles.optionsContainer}>
      <View style={styles.optionsHeader}>
        <Text style={styles.sectionTitle}>Opciones</Text>

        <Text style={styles.sectionSubtitle}>
          Administra este archivo desde la aplicación.
        </Text>
      </View>

      {canManagePrivacy ? (
        <View style={styles.optionCard}>
          <Text style={styles.optionTitle}>Privacidad</Text>

          <Text style={styles.optionDescription}>
            Estado actual:{" "}
            {visibility === "PUBLIC"
              ? "Público"
              : "Restringido"}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.optionButton,
              pressed && styles.optionButtonPressed,
              changingPrivacy && styles.optionButtonDisabled,
            ]}
            disabled={changingPrivacy}
            onPress={handleChangePrivacy}
          >
            {changingPrivacy ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.optionButtonText}>
                {visibility === "PUBLIC"
                  ? "Hacer restringido"
                  : "Hacer público"}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.optionCard}>
        <Text style={styles.optionTitle}>Cambiar portada</Text>

        <Text style={styles.optionDescription}>
          Genera imágenes del video para seleccionar una nueva
          portada.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.optionButton,
            pressed && styles.optionButtonPressed,
            loadingThumbnails && styles.optionButtonDisabled,
          ]}
          disabled={loadingThumbnails}
          onPress={handleLoadThumbnails}
        >
          {loadingThumbnails ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text style={styles.optionButtonText}>
              Generar portadas
            </Text>
          )}
        </Pressable>
          <Pressable
  style={({ pressed }) => [
    styles.optionButton,
    pressed && styles.optionButtonPressed,
  ]}
  onPress={handlePickCustomThumbnail}
>
  <Text style={styles.optionButtonText}>
    Elegir de mi galería
  </Text>
</Pressable>

       {thumbnailCandidates.length > 0 ? (
  <View style={styles.thumbnailGrid}>
    {thumbnailCandidates.map((candidate, index) => (
      <Pressable
        key={`${candidate.r2Uri}-${index}`}
        style={({ pressed }) => [
          styles.thumbnailCandidate,
          pressed && styles.thumbnailCandidatePressed,
        ]}
        onPress={() => {
          Alert.alert(
            "Cambiar portada",
            "¿Quieres usar esta imagen como portada del archivo?",
            [
              {
                text: "Cancelar",
                style: "cancel",
              },
              {
                text: "Usar portada",
                onPress: async () => {
                  try {
                    const thumbnailUrl = await selectUploadThumbnail(
                      authToken,
                      uploadId,
                      candidate.r2Uri,
                    );

                    Alert.alert(
                      "Portada actualizada",
                      "La nueva portada se guardó correctamente.",
                    );

                    setThumbnailCandidates([]);
                  } catch (error) {
                    Alert.alert(
                      "No se pudo cambiar la portada",
                      error instanceof Error
                        ? error.message
                        : "Ocurrió un error inesperado.",
                    );
                  }
                },
              },
            ],
          );
        }}
      >
        <Image
          source={{ uri: candidate.url }}
          style={styles.thumbnailCandidateImage}
          resizeMode="cover"
        />

        <View style={styles.thumbnailCandidateFooter}>
          <Text style={styles.thumbnailCandidateText}>
            {formatThumbnailTime(candidate.timeSec)}
          </Text>
        </View>
      </Pressable>
    ))}
  </View>
) : null}
      </View>

      {isSuperAdmin ? (
        <View style={styles.optionCard}>
          <Text style={styles.optionTitle}>Mover archivo</Text>

          <Text style={styles.optionDescription}>
            Cambia la categoría o subcategoría sin mover el
            archivo físico.
          </Text>

          <Text style={styles.optionCurrent}>
            Actual: {category || "Sin categoría"}
            {subcategory ? ` · ${subcategory}` : ""}
          </Text>

          <TextInput
            style={styles.optionInput}
            value={moveCategory}
            onChangeText={setMoveCategory}
            placeholder="Categoría"
            placeholderTextColor="#71717a"
          />

          <TextInput
            style={styles.optionInput}
            value={moveSubcategory}
            onChangeText={setMoveSubcategory}
            placeholder="Subcategoría"
            placeholderTextColor="#71717a"
          />

          <Pressable
            style={({ pressed }) => [
              styles.optionButton,
              pressed && styles.optionButtonPressed,
              moving && styles.optionButtonDisabled,
            ]}
            disabled={moving}
            onPress={handleMoveUpload}
          >
            {moving ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.optionButtonText}>
                Mover archivo
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.optionCard}>
        <Text style={styles.optionTitle}>
          Descargar archivo
        </Text>

        <Text style={styles.optionDescription}>
          Descarga el archivo original.
        </Text>

        <View style={styles.optionPending}>
          <Text style={styles.optionPendingText}>
            Preparando descarga nativa
          </Text>
        </View>
      </View>

      {visibility === "PUBLIC" ? (
        <View style={styles.optionCard}>
          <Text style={styles.optionTitle}>
            Compartir archivo
          </Text>

          <Text style={styles.optionDescription}>
            Genera un enlace público con fecha de expiración.
          </Text>

          <View style={styles.expirationRow}>
            {[
              { label: "3 días", hours: 72 },
              { label: "7 días", hours: 168 },
              { label: "15 días", hours: 360 },
              { label: "30 días", hours: 720 },
            ].map((option) => {
              const selected =
                shareExpiresInHours === option.hours;

              return (
                <Pressable
                  key={option.hours}
                  style={[
                    styles.expirationChip,
                    selected &&
                      styles.expirationChipSelected,
                  ]}
                  onPress={() =>
                    setShareExpiresInHours(option.hours)
                  }
                >
                  <Text
                    style={[
                      styles.expirationChipText,
                      selected &&
                        styles.expirationChipTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.optionButton,
              pressed && styles.optionButtonPressed,
              sharing && styles.optionButtonDisabled,
            ]}
            disabled={sharing}
            onPress={handleShare}
          >
            {sharing ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.optionButtonText}>
                Generar enlace ·{" "}
                {shareExpiresInHours / 24} días
              </Text>
            )}
          </Pressable>

          <Text style={styles.optionHint}>
            El enlace se mostrará al generarlo.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TechnicalSheetPanel({
  ficha,
  canEdit,
  authToken,
  uploadId,
  onSaved,
}: {
  ficha: TechnicalSheet | null;
  canEdit: boolean;
  authToken: string;
  uploadId: string;
  onSaved: (ficha: TechnicalSheet | null) => void;
}) {
  const currentFicha = ficha ?? EMPTY_FICHA;

  const [editing, setEditing] = useState(false);
  const [form, setForm] =
    useState<TechnicalSheet>(currentFicha);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setForm(ficha ?? EMPTY_FICHA);
    }
  }, [editing, ficha]);

  function setField(
    field: keyof TechnicalSheet,
    value: string | string[] | null,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEditing() {
    setForm({
      ...currentFicha,
      tipo: Array.isArray(currentFicha.tipo)
        ? [...currentFicha.tipo]
        : [],
    });

    setEditing(true);
  }

  function cancelEditing() {
    setForm({
      ...currentFicha,
      tipo: Array.isArray(currentFicha.tipo)
        ? [...currentFicha.tipo]
        : [],
    });

    setEditing(false);
  }

  function toggleTipo(value: string) {
    setForm((current) => {
      const selected = new Set(current.tipo ?? []);

      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }

      return {
        ...current,
        tipo: Array.from(selected),
      };
    });
  }

  async function saveFicha() {
    try {
      setSaving(true);

      const saved = await updateTechnicalSheet(
        authToken,
        uploadId,
        form,
      );

      onSaved(saved);
      setEditing(false);

      Alert.alert(
        "Ficha técnica",
        "Ficha guardada correctamente.",
      );
    } catch (err) {
      Alert.alert(
        "No se pudo guardar",
        err instanceof Error
          ? err.message
          : "No se pudo guardar la ficha técnica.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <View style={styles.fichaHeader}>
        <View style={styles.fichaHeaderText}>
          <Text style={styles.sectionTitle}>Ficha técnica</Text>
          <Text style={styles.sectionSubtitle}>
            Datos y clasificación
          </Text>
        </View>

        {canEdit ? (
          !editing ? (
            <Pressable
              style={styles.editOutlineButton}
              onPress={startEditing}
            >
              <Text style={styles.editOutlineButtonText}>
                Editar
              </Text>
            </Pressable>
          ) : (
            <View style={styles.headerActions}>
              <Pressable
                style={[
                  styles.saveOutlineButton,
                  saving && styles.disabledButton,
                ]}
                onPress={() => void saveFicha()}
                disabled={saving}
              >
                <Text style={styles.saveOutlineButtonText}>
                  {saving ? "Guardando..." : "Guardar"}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.cancelOutlineButton,
                  saving && styles.disabledButton,
                ]}
                onPress={cancelEditing}
                disabled={saving}
              >
                <Text style={styles.cancelOutlineButtonText}>
                  Cancelar
                </Text>
              </Pressable>
            </View>
          )
        ) : null}
      </View>

      {!ficha && !editing ? (
        <Text style={styles.emptyFichaNotice}>
          No hay ficha guardada aún.
          {canEdit
            ? " Puedes completarla con el botón Editar."
            : ""}
        </Text>
      ) : null}

      <View style={styles.fichaSection}>
        <Text style={styles.fichaSectionTitle}>
          INFORMACIÓN DEL ARCHIVO
        </Text>

        {editing ? (
          <TechnicalSheetForm
            form={form}
            setField={setField}
            toggleTipo={toggleTipo}
          />
        ) : (
          <TechnicalSheetRead ficha={currentFicha} />
        )}
      </View>
    </View>
  );
}

function TechnicalSheetRead({
  ficha,
}: {
  ficha: TechnicalSheet;
}) {
  const fields: Array<[string, string | null | undefined]> = [
    ["Título", ficha.titulo],
    ["Marca", ficha.marca],
    ["Agencia", ficha.agencia],
    ["Productora", ficha.productora],
    ["Contacto", ficha.contacto],
    ["Duración", ficha.duracion],
    ["Formato", ficha.formato],
    ["Versión", ficha.version],
    ["Fecha", formatDateCL(ficha.fecha)],
    ["Producción", ficha.produccion],
    ["Corporativo", ficha.corporativo],
    ["Nuevos Negocios", ficha.nuevosNegocios],
    ["Oficina", ficha.oficina],
    ["Tipo", formatTipo(ficha.tipo)],
  ];

  return (
    <View>
      {fields.map(([label, value]) => (
        <FichaReadRow
          key={label}
          label={label}
          value={value}
        />
      ))}

      <View style={styles.otrosRead}>
        <Text style={styles.fichaLabel}>Otros</Text>
        <Text style={styles.fichaValue}>
          {displayValue(ficha.otros)}
        </Text>
      </View>
    </View>
  );
}

function FichaReadRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.fichaRow}>
      <Text style={styles.fichaLabel}>{label}</Text>
      <Text style={styles.fichaValue}>
        {displayValue(value)}
      </Text>
    </View>
  );
}

function TechnicalSheetForm({
  form,
  setField,
  toggleTipo,
}: {
  form: TechnicalSheet;
  setField: (
    field: keyof TechnicalSheet,
    value: string | string[] | null,
  ) => void;
  toggleTipo: (value: string) => void;
}) {
  return (
    <View style={styles.form}>
      <FichaInput
        label="Título"
        value={form.titulo}
        onChange={(value) => setField("titulo", value)}
      />

      <FichaInput
        label="Marca"
        value={form.marca}
        onChange={(value) => setField("marca", value)}
      />

      <FichaInput
        label="Agencia"
        value={form.agencia}
        onChange={(value) => setField("agencia", value)}
      />

      <FichaInput
        label="Productora"
        value={form.productora}
        onChange={(value) => setField("productora", value)}
      />

      <FichaInput
        label="Contacto"
        value={form.contacto}
        onChange={(value) => setField("contacto", value)}
      />

      <FichaInput
        label="Duración"
        value={form.duracion}
        onChange={(value) => setField("duracion", value)}
        placeholder="Ej: 00:30 / 1:20"
      />

      <FichaInput
        label="Formato"
        value={form.formato}
        onChange={(value) => setField("formato", value)}
        placeholder="Ej: 16:9 / 9:16 / 4:5"
      />

      <FichaInput
        label="Versión"
        value={form.version}
        onChange={(value) => setField("version", value)}
        placeholder="Ej: V1 / Final / Master"
      />

      <FichaInput
        label="Fecha"
        value={form.fecha}
        onChange={(value) => setField("fecha", value)}
        placeholder="AAAA-MM-DD"
      />

      <FichaInput
        label="Producción"
        value={form.produccion}
        onChange={(value) => setField("produccion", value)}
      />

      <FichaInput
        label="Corporativo"
        value={form.corporativo}
        onChange={(value) => setField("corporativo", value)}
      />

      <FichaInput
        label="Nuevos Negocios"
        value={form.nuevosNegocios}
        onChange={(value) =>
          setField("nuevosNegocios", value)
        }
      />

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Oficina</Text>

        <View style={styles.chipContainer}>
          {OFICINA_OPTIONS.map((option) => {
            const active = form.oficina === option;

            return (
              <Pressable
                key={option}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                ]}
                onPress={() =>
                  setField(
                    "oficina",
                    active ? null : option,
                  )
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    active && styles.chipTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>
          Tipo (puede ser una o varias)
        </Text>

        <View style={styles.chipContainer}>
          {TIPO_OPTIONS.map((option) => {
            const active = (form.tipo ?? []).includes(option);

            return (
              <Pressable
                key={option}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                ]}
                onPress={() => toggleTipo(option)}
              >
                <Text
                  style={[
                    styles.chipText,
                    active && styles.chipTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.selectedText}>
          Seleccionado: {formatTipo(form.tipo)}
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Otros</Text>

        <TextInput
          style={[styles.formInput, styles.multilineInput]}
          value={form.otros ?? ""}
          onChangeText={(value) => setField("otros", value)}
          placeholder="Escribe una nota, descripción, comentario o información adicional..."
          placeholderTextColor="#71717a"
          multiline
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

function FichaInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.inputLabel}>{label}</Text>

      <TextInput
        style={styles.formInput}
        value={value ?? ""}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#71717a"
      />
    </View>
  );
}

function EditableTranscriptRow({
  line,
  canEdit,
  authToken,
  onSaved,
}: {
  line: TranscriptLine;
  canEdit: boolean;
  authToken: string;
  onSaved: (subtitleId: number, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editingText, setEditingText] = useState(
    line.text || "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setEditingText(line.text || "");
    }
  }, [editing, line.text]);

  function startEditing() {
    if (!canEdit || !Number.isInteger(line.id)) return;

    setEditingText(line.text || "");
    setMessage(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (saving) return;

    setEditingText(line.text || "");
    setMessage(null);
    setEditing(false);
  }

  async function save() {
    const cleanText = editingText.trim();

    if (!cleanText) {
      setMessage("La línea no puede quedar vacía.");
      return;
    }

    const videoId = String(line.video_id || "").trim();

    if (!videoId) {
      setMessage("No se pudo identificar el video.");
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const savedText = await updateTranscriptLine(
        authToken,
        videoId,
        line.id,
        cleanText,
      );

      onSaved(line.id, savedText);

      setEditingText(savedText);
      setEditing(false);
      setMessage("Línea corregida correctamente.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la corrección.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.transcriptRow}>
      <Text style={styles.transcriptTime}>
        {formatTime(line.time_start)}
      </Text>

      <View style={styles.transcriptBody}>
        {editing ? (
          <>
            <TextInput
              style={styles.transcriptEditInput}
              value={editingText}
              onChangeText={setEditingText}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />

            <View style={styles.transcriptEditActions}>
              <Pressable
                style={[
                  styles.transcriptCancelButton,
                  saving && styles.disabledButton,
                ]}
                onPress={cancelEditing}
                disabled={saving}
              >
                <Text style={styles.transcriptCancelText}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.transcriptSaveButton,
                  (!editingText.trim() || saving) &&
                    styles.disabledButton,
                ]}
                onPress={() => void save()}
                disabled={!editingText.trim() || saving}
              >
                <Text style={styles.transcriptSaveText}>
                  {saving ? "Guardando..." : "Guardar"}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.transcriptReadRow}>
            <Text style={styles.transcriptText}>
              {line.text || "—"}
            </Text>

            {canEdit && Number.isInteger(line.id) ? (
              <Pressable
                style={styles.lineEditButton}
                onPress={startEditing}
              >
                <Text style={styles.lineEditButtonText}>
                  Editar
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {message ? (
          <Text style={styles.editingMessage}>{message}</Text>
        ) : null}
      </View>
    </View>
  );
}

function PanelMessage({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <View style={styles.panelMessage}>
      <Text style={styles.panelMessageTitle}>{title}</Text>
      <Text style={styles.panelMessageText}>{text}</Text>
    </View>
  );
}

function displayValue(value?: string | null) {
  return value && String(value).trim() ? String(value) : "—";
}

function formatTipo(tipo?: string[] | null) {
  if (!tipo || !Array.isArray(tipo) || tipo.length === 0) {
    return "—";
  }

  return tipo.join(", ");
}

function formatDateCL(value?: string | null) {
  if (!value) return "—";

  const date = String(value).slice(0, 10);
  const [yyyy, mm, dd] = date.split("-");

  if (!yyyy || !mm || !dd) return date;

  return `${dd}-${mm}-${yyyy}`;
}

function formatTime(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 50,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  loadingText: {
    marginTop: 14,
    color: "#ffffff",
    fontSize: 15,
  },

  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },

  errorText: {
    marginTop: 10,
    color: "#bdbdbd",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  primaryButton: {
    marginTop: 24,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  primaryButtonText: {
    color: "#000000",
    fontWeight: "700",
  },

  topBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  iconButtonText: {
    color: "#ffffff",
    fontSize: 38,
    lineHeight: 40,
    fontWeight: "300",
  },

  brand: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },

  topBarSpacer: {
    width: 42,
  },

  title: {
    marginTop: 16,
    marginBottom: 18,
    color: "#ffffff",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
  },

  playerContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: "#000000",
  },

  player: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },

  unavailable: {
    width: "100%",
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.85)",
  },

  unavailableTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },

  unavailableText: {
    marginTop: 8,
    color: "#aaaaaa",
    fontSize: 14,
    textAlign: "center",
  },

  metadata: {
    marginTop: 18,
  },

  metadataText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },

  secondaryText: {
    marginTop: 6,
    color: "#999999",
    fontSize: 14,
  },

  panels: {
    marginTop: 28,
    gap: 8,
  },

  panelButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    backgroundColor: "rgba(9,9,11,0.55)",
  },

  panelButtonOpen: {
    borderColor: "rgba(251,146,60,0.50)",
    backgroundColor: "rgba(24,24,27,0.82)",
  },

  panelButtonPressed: {
    opacity: 0.8,
  },

  panelButtonTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  panelChevron: {
    color: "#71717a",
    fontSize: 25,
  },

  panelChevronOpen: {
    color: "#fdba74",
    transform: [{ rotate: "90deg" }],
  },

  panelContent: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    backgroundColor: "rgba(9,9,11,0.86)",
    padding: 12,
  },

  fichaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },

  fichaHeaderText: {
    flex: 1,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  sectionSubtitle: {
    marginTop: 3,
    color: "#71717a",
    fontSize: 11,
  },

  headerActions: {
    flexDirection: "row",
    gap: 6,
  },

  editOutlineButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
    borderRadius: 7,
  },

  editOutlineButtonText: {
    color: "#fb923c",
    fontSize: 12,
    fontWeight: "600",
  },

  saveOutlineButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.40)",
    borderRadius: 7,
  },

  saveOutlineButtonText: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "600",
  },

  cancelOutlineButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#52525b",
    borderRadius: 7,
  },

  cancelOutlineButtonText: {
    color: "#e4e4e7",
    fontSize: 12,
  },

  disabledButton: {
    opacity: 0.5,
  },

  emptyFichaNotice: {
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },

  fichaSection: {
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 9,
    padding: 12,
    backgroundColor: "rgba(9,9,11,0.30)",
  },

  fichaSectionTitle: {
    marginBottom: 8,
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.7,
  },

  fichaRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },

  fichaLabel: {
    color: "#71717a",
    fontSize: 11,
  },

  fichaValue: {
    marginTop: 3,
    color: "#f4f4f5",
    fontSize: 13,
    lineHeight: 19,
  },

  otrosRead: {
    paddingTop: 12,
  },

  form: {
    gap: 12,
  },

  formGroup: {
    gap: 5,
  },

  inputLabel: {
    color: "#71717a",
    fontSize: 11,
  },

  formInput: {
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#52525b",
    borderRadius: 7,
    backgroundColor: "#27272a",
    color: "#ffffff",
    fontSize: 13,
  },

  multilineInput: {
    minHeight: 110,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 18,
    backgroundColor: "#18181b",
  },

  chipActive: {
    borderColor: "rgba(249,115,22,0.50)",
    backgroundColor: "rgba(249,115,22,0.20)",
  },

  chipText: {
    color: "#d4d4d8",
    fontSize: 12,
  },

  chipTextActive: {
    color: "#fdba74",
  },

  selectedText: {
    color: "#71717a",
    fontSize: 11,
  },

  transcriptHeader: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  editEnabledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.10)",
  },

  editEnabledText: {
    color: "#fdba74",
    fontSize: 10,
    fontWeight: "600",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  searchInput: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    color: "#ffffff",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  matchBadge: {
    minWidth: 48,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
  },

  matchBadgeText: {
    color: "#a1a1aa",
    fontSize: 11,
  },

  transcriptList: {
    gap: 2,
  },

  transcriptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },

  transcriptTime: {
    width: 52,
    paddingTop: 4,
    color: "#71717a",
    fontSize: 12,
    fontWeight: "600",
  },

  transcriptBody: {
    flex: 1,
  },

  transcriptReadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  transcriptText: {
    flex: 1,
    color: "#e4e4e7",
    fontSize: 14,
    lineHeight: 21,
  },

  lineEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 7,
    backgroundColor: "#18181b",
  },

  lineEditButtonText: {
    color: "#d4d4d8",
    fontSize: 11,
  },

  transcriptEditInput: {
    minHeight: 88,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.40)",
    borderRadius: 8,
    backgroundColor: "#18181b",
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 21,
  },

  transcriptEditActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 7,
  },

  transcriptCancelButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 7,
  },

  transcriptCancelText: {
    color: "#d4d4d8",
    fontSize: 11,
  },

  transcriptSaveButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#f97316",
    borderRadius: 7,
    backgroundColor: "#f97316",
  },

  transcriptSaveText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "700",
  },

  editingMessage: {
    marginTop: 7,
    color: "#fdba74",
    fontSize: 11,
    lineHeight: 16,
  },

  panelMessage: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  panelMessageTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  panelMessageText: {
    marginTop: 7,
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
    optionsContainer: {
    gap: 12,
  },

  optionsHeader: {
    gap: 4,
    marginBottom: 2,
  },

  optionCard: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.24)",
  },

  optionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  optionDescription: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 19,
  },

  optionCurrent: {
    color: "#d4d4d8",
    fontSize: 13,
    lineHeight: 18,
  },

  optionInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    fontSize: 14,
  },

  optionButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  optionButtonPressed: {
    opacity: 0.72,
  },

  optionButtonDisabled: {
    opacity: 0.5,
  },

  optionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  optionHint: {
    color: "#71717a",
    fontSize: 12,
    lineHeight: 17,
  },

  optionPending: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  optionPendingText: {
    color: "#71717a",
    fontSize: 13,
    fontWeight: "600",
  },

  expirationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  expirationChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  expirationChipSelected: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.14)",
  },

  expirationChipText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
  },

  expirationChipTextSelected: {
    color: "#ffffff",
  },
  thumbnailGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 12,
},

thumbnailCandidate: {
  width: "48%",
  overflow: "hidden",
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.14)",
  backgroundColor: "rgba(255,255,255,0.05)",
},

thumbnailCandidatePressed: {
  opacity: 0.7,
},

thumbnailCandidateImage: {
  width: "100%",
  aspectRatio: 16 / 9,
  backgroundColor: "#18181b",
},

thumbnailCandidateFooter: {
  paddingHorizontal: 8,
  paddingVertical: 7,
},

thumbnailCandidateText: {
  color: "#a1a1aa",
  fontSize: 12,
  fontWeight: "600",
},
});