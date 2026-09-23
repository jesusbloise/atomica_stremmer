import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  getCategories,
  getVideos,
  type CategoryItem,
  type VideoItem,
} from "../../src/api";
import { getAuthToken } from "../../src/authStorage";
import { resolveMediaUrl } from "../../src/mediaUrl";

const atomicaLogo = require("../../assets/atomica-logo.png");

const HERO_INTERVAL_MS = 6000;
const SCREEN_WIDTH = Dimensions.get("window").width;

function getVideoName(video?: VideoItem) {
  if (!video) return "";

  const name =
    video.display_name ||
    video.titulo ||
    video.file_name ||
    "Sin nombre";

  return name.replace(/\.[^/.]+$/, "");
}

export default function OrganizarScreen() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      try {
        setLoading(true);
        setError("");

        const authToken = await getAuthToken();

        if (!authToken) {
          throw new Error("No se encontró una sesión guardada.");
        }

        const [videosData, categoriesData] = await Promise.all([
          getVideos(authToken),
          getCategories(authToken),
        ]);
        if (!cancelled) {
          setVideos(videosData);
          setCategories(categoriesData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el contenido."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHome();

    return () => {
      cancelled = true;
    };
  }, []);

  const heroVideos = useMemo(
    () => videos.slice(0, 6),
    [videos]
  );

  useEffect(() => {
    if (heroVideos.length <= 1) return;

    const interval = setInterval(() => {
      setHeroIndex((current) =>
        (current + 1) % heroVideos.length
      );
    }, HERO_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [heroVideos.length]);

  const heroVideo = heroVideos[heroIndex];

  const heroImage = resolveMediaUrl(
    heroVideo?.thumbnail_url
  );

  function previousHero() {
    if (!heroVideos.length) return;

    setHeroIndex((current) =>
      current === 0
        ? heroVideos.length - 1
        : current - 1
    );
  }

  function nextHero() {
    if (!heroVideos.length) return;

    setHeroIndex((current) =>
      (current + 1) % heroVideos.length
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Image
            source={atomicaLogo}
            style={styles.loadingLogo}
            resizeMode="contain"
          />

          <ActivityIndicator
            size="large"
            color="#ffffff"
            style={styles.loader}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Image
            source={atomicaLogo}
            style={styles.loadingLogo}
            resizeMode="contain"
          />

          <Text style={styles.error}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.menuButton}
            accessibilityLabel="Abrir menú"
          >
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>

          <Image
            source={atomicaLogo}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.headerSpacer} />
        </View>

        {heroVideo ? (
          <View style={styles.hero}>
            {heroImage ? (
              <ImageBackground
                source={{ uri: heroImage }}
                style={styles.heroMedia}
                imageStyle={styles.heroImage}
                resizeMode="cover"
              >
                <View style={styles.heroShade} />
                <HeroContent
                  title={getVideoName(heroVideo)}
                />
              </ImageBackground>
            ) : (
              <View style={styles.heroFallback}>
                <HeroContent
                  title={getVideoName(heroVideo)}
                />
              </View>
            )}

            {heroVideos.length > 1 ? (
              <>
                <Pressable
                  onPress={previousHero}
                  style={[
                    styles.heroArrow,
                    styles.heroArrowLeft,
                  ]}
                >
                  <Text style={styles.heroArrowText}>‹</Text>
                </Pressable>

                <Pressable
                  onPress={nextHero}
                  style={[
                    styles.heroArrow,
                    styles.heroArrowRight,
                  ]}
                >
                  <Text style={styles.heroArrowText}>›</Text>
                </Pressable>

                <View style={styles.dots}>
                  {heroVideos.map((video, index) => (
                    <Pressable
                      key={video.id}
                      onPress={() => setHeroIndex(index)}
                      style={[
                        styles.dot,
                        index === heroIndex &&
                          styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>
            CategorÃ­as principales
          </Text>

          <View style={styles.categoryGrid}>
            {categories.map((category) => {
              const cover = resolveMediaUrl(category.cover);

              return (
                <Pressable
                  key={category.id}
                  onPress={() => router.push(`/organizar/${category.slug}`)}
                  style={styles.categoryCard}
                >
                  {cover ? (
                    <ImageBackground
                      source={{ uri: cover }}
                      style={styles.categoryImage}
                      imageStyle={styles.categoryImageRadius}
                      resizeMode="cover"
                    >
                      <View style={styles.categoryShade} />

                      <Text style={styles.categoryTitle}>
                        {category.label}
                      </Text>
                    </ImageBackground>
                  ) : (
                    <View style={styles.categoryFallback}>
                      <Text style={styles.categoryTitle}>
                        {category.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroContent({ title }: { title: string }) {
  return (
    <View style={styles.heroContent}>
      <Text style={styles.heroTitle}>{title}</Text>

      <Pressable style={styles.moreButton}>
        <Text style={styles.moreButtonText}>Ver más</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  loadingLogo: {
    width: 190,
    height: 70,
  },

  loader: {
    marginTop: 28,
  },

  error: {
    marginTop: 24,
    color: "#f87171",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  header: {
    height: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  menuButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  menuIcon: {
    color: "#ffffff",
    fontSize: 26,
  },

  logo: {
    width: 170,
    height: 52,
  },

  headerSpacer: {
    width: 42,
  },

  hero: {
    width: SCREEN_WIDTH,
    height: 360,
    backgroundColor: "#18181b",
    overflow: "hidden",
  },

  heroMedia: {
    flex: 1,
    justifyContent: "flex-end",
  },

  heroImage: {
    backgroundColor: "#18181b",
  },

  heroFallback: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#18181b",
  },

  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.42)",
  },

  heroContent: {
    paddingHorizontal: 28,
    paddingBottom: 48,
  },

  heroTitle: {
    maxWidth: "80%",
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
  },

  moreButton: {
    alignSelf: "flex-start",
    marginTop: 18,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 11,
  },

  moreButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },

  heroArrow: {
    position: "absolute",
    top: "43%",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  heroArrowLeft: {
    left: 10,
  },

  heroArrowRight: {
    right: 10,
  },

  heroArrowText: {
    marginTop: -3,
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 36,
  },

  dots: {
    position: "absolute",
    bottom: 17,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  dotActive: {
    width: 20,
    backgroundColor: "#ffffff",
  },

  categoriesSection: {
    paddingTop: 32,
    paddingHorizontal: 16,
  },

  sectionTitle: {
    marginBottom: 18,
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "700",
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },

  categoryCard: {
    width: "48.3%",
    height: 150,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: "#18181b",
  },

  categoryImage: {
    flex: 1,
    justifyContent: "flex-end",
  },

  categoryImageRadius: {
    borderRadius: 10,
  },

  categoryShade: {
    ...StyleSheet.absoluteFill,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  categoryFallback: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
    backgroundColor: "#18181b",
  },

  categoryTitle: {
    padding: 14,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});




