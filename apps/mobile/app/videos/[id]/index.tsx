import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";

import { getUploadById, UploadDetail } from "../../../src/api";
import { getAuthToken } from "../../../src/authStorage";

export default function VideoDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const id = useMemo(() => {
    const value = params.id;
    return Array.isArray(value) ? value[0] : value;
  }, [params.id]);

  const [upload, setUpload] = useState<UploadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUpload() {
      try {
        setLoading(true);
        setError(null);

        if (!id) {
          throw new Error("No se recibió el identificador del video");
        }

        const authToken = await getAuthToken();

        if (!authToken) {
          throw new Error("Tu sesión no está disponible");
        }

        const detail = await getUploadById(authToken, id);

        if (!active) return;

        setUpload(detail);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error ? err.message : "No se pudo cargar el video",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadUpload();

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

  if (error || !upload) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>No se pudo abrir el video</Text>

          <Text style={styles.errorText}>
            {error || "El archivo no está disponible"}
          </Text>

          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <LoadedVideoDetail upload={upload} />;
}

function LoadedVideoDetail({ upload }: { upload: UploadDetail }) {
  const playbackUrl = upload.cf_stream_hls_url || null;

  const player = useVideoPlayer(playbackUrl, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  const title =
    upload.titulo || upload.display_name || upload.file_name || "Video";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
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
              fullscreenOptions={{
                enable: true,
              }}
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
          {upload.category ? (
            <Text style={styles.metadataText}>
              {upload.category}
              {upload.subcategory ? ` · ${upload.subcategory}` : ""}
            </Text>
          ) : null}

          {typeof upload.views === "number" ? (
            <Text style={styles.secondaryText}>
              {upload.views} reproducciones
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 40,
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

  backButton: {
    marginTop: 24,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  backButtonText: {
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
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },

  unavailableTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  unavailableText: {
    marginTop: 8,
    color: "#aaaaaa",
    fontSize: 14,
    lineHeight: 20,
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
});
