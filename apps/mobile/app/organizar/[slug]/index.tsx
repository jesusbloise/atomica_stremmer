import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCategories,
  getCategoryUploads,
  type CategoryItem,
  type UploadItem,
} from "../../../src/api";
import { getAuthToken } from "../../../src/authStorage";
import { resolveMediaUrl } from "../../../src/mediaUrl";

const atomicaLogo = require("../../../assets/atomica-logo.png");

function getUploadName(item?: UploadItem) {
  if (!item) return "";

  const name =
    item.display_name || item.titulo || item.file_name || "Sin nombre";

  return name.replace(/\.[^/.]+$/, "");
}

function getDefaultGroup(slug: string) {
  if (slug === "publicidad") return "Marca";
  if (slug === "entretenimiento") return "Estudio";
  if (slug === "ia") return "Generativo";
  return "Producción";
}

export default function CategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slug?: string | string[];
  }>();

  const slug = Array.isArray(params.slug)
    ? params.slug[0] || ""
    : params.slug || "";

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [activeShelf, setActiveShelf] = useState("Todo");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCategory() {
      try {
        setLoading(true);
        setError("");

        const authToken = await getAuthToken();

        if (!authToken) {
          throw new Error("No se encontró una sesión guardada.");
        }

        if (!slug) {
          throw new Error("La categoría no es válida.");
        }

        const [uploadsData, categoriesData] = await Promise.all([
          getCategoryUploads(authToken, slug, 80),
          getCategories(authToken),
        ]);

        if (!cancelled) {
          setUploads(uploadsData);
          setCategories(categoriesData);
          setActiveShelf("Todo");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar la categoría.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCategory();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.slug === slug) || null,
    [categories, slug],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, UploadItem[]>();

    for (const item of uploads) {
      const subcategory = item.subcategory?.trim();
      const key = subcategory || getDefaultGroup(slug);

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(item);
    }

    return [...map.entries()].filter(([, items]) => items.length > 0);
  }, [uploads, slug]);

  const visibleGroups = useMemo(() => {
    if (activeShelf === "Todo") {
      return grouped;
    }

    return grouped.filter(([label]) => label === activeShelf);
  }, [activeShelf, grouped]);

  const featuredItem = uploads[0];

  const featuredImage = resolveMediaUrl(featuredItem?.thumbnail_url);

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

          <Pressable
            style={styles.backErrorButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backErrorText}>Volver</Text>
          </Pressable>
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
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Volver"
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <Image
            source={atomicaLogo}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.headerSpacer} />
        </View>

        {featuredItem ? (
          <View style={styles.hero}>
            {featuredImage ? (
              <ImageBackground
                source={{ uri: featuredImage }}
                style={styles.heroMedia}
                resizeMode="cover"
              >
                <View style={styles.heroShade} />

                <CategoryHeroContent
                  category={activeCategory?.label || slug}
                  total={uploads.length}
                  item={featuredItem}
                />
              </ImageBackground>
            ) : (
              <View style={styles.heroFallback}>
                <CategoryHeroContent
                  category={activeCategory?.label || slug}
                  total={uploads.length}
                  item={featuredItem}
                />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.categoryName}>
              {activeCategory?.label || slug}
            </Text>

            <Text style={styles.emptyText}>
              No hay archivos en esta sección.
            </Text>
          </View>
        )}

        {grouped.length > 0 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {["Todo", ...grouped.map(([label]) => label)].map((label) => {
                const active = activeShelf === label;

                return (
                  <Pressable
                    key={label}
                    onPress={() => setActiveShelf(label)}
                    style={[
                      styles.filterButton,
                      active && styles.filterButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        active && styles.filterTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.groups}>
              {visibleGroups.map(([label, items]) => (
                <View key={label} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <View>
                      <Text style={styles.groupTitle}>{label}</Text>

                      <Text style={styles.groupCount}>
                        {items.length}{" "}
                        {items.length === 1 ? "archivo" : "archivos"}
                      </Text>
                    </View>

                    <Pressable>
                      <Text style={styles.seeAll}>Ver todos</Text>
                    </Pressable>
                  </View>

                  <FlatList
                    horizontal
                    data={items}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <UploadCard item={item} />}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carousel}
                    ItemSeparatorComponent={() => (
                      <View style={{ width: 14 }} />
                    )}
                    initialNumToRender={3}
                    maxToRenderPerBatch={3}
                    windowSize={3}
                    removeClippedSubviews
                    getItemLayout={(_, index) => ({
                      length: 299,
                      offset: 299 * index,
                      index,
                    })}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryHeroContent({
  category,
  total,
  item,
}: {
  category: string;
  total: number;
  item: UploadItem;
}) {
  return (
    <View style={styles.heroLayout}>
      <View style={styles.heroTop}>
        <Text style={styles.categoryName}>{category}</Text>

        <Text style={styles.assetCount}>
          {total} {total === 1 ? "archivo" : "archivos"} disponibles
        </Text>
      </View>

      <View style={styles.heroContent}>
        <Text style={styles.latestLabel}>ÚLTIMO AGREGADO</Text>

        <Text style={styles.heroTitle}>{getUploadName(item)}</Text>

        <Pressable
          style={styles.playButton}
          onPress={() => router.push(`/videos/${item.id}`)}
        >
          <Text style={styles.playButtonText}>Reproducir</Text>
        </Pressable>
      </View>
    </View>
  );
}

function UploadCard({ item }: { item: UploadItem }) {
  const thumbnail = resolveMediaUrl(item.thumbnail_url);

  if (thumbnail) {
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/videos/${item.id}`)}
      >
        <ImageBackground
          source={{ uri: thumbnail }}
          style={styles.cardImage}
          resizeMode="cover"
        >
          <View style={styles.cardShade} />

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {getUploadName(item)}
            </Text>

            <View style={styles.moreButton}>
              <Text style={styles.moreButtonText}>Ver más</Text>
            </View>
          </View>
        </ImageBackground>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/videos/${item.id}`)}
    >
      <View style={styles.cardFallback}>
        {item.tipo === "video" && (
          <View style={styles.videoFallback}>
            <Text style={styles.videoFallbackTitle}>VIDEO</Text>
            <Text style={styles.videoFallbackSubtitle}>Sin portada</Text>
          </View>
        )}

        <Text style={styles.cardTitle} numberOfLines={2}>
          {getUploadName(item)}
        </Text>

        <View style={styles.moreButton}>
          <Text style={styles.moreButtonText}>Ver más</Text>
        </View>
      </View>
    </Pressable>
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
    paddingBottom: 48,
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

  backErrorButton: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: "#52525b",
    borderRadius: 7,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  backErrorText: {
    color: "#ffffff",
    fontWeight: "600",
  },

  header: {
    height: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  backIcon: {
    color: "#ffffff",
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "300",
  },

  logo: {
    width: 170,
    height: 52,
  },

  headerSpacer: {
    width: 42,
  },

  hero: {
    height: 390,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#18181b",
  },

  heroMedia: {
    flex: 1,
  },

  heroFallback: {
    flex: 1,
    backgroundColor: "#18181b",
  },

  heroLayout: {
    flex: 1,
    justifyContent: "space-between",
  },

  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.46)",
  },

  heroTop: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },

  categoryName: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },

  assetCount: {
    marginTop: 5,
    color: "#d4d4d8",
    fontSize: 13,
  },

  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 26,
  },

  latestLabel: {
    color: "#fdba74",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
  },

  heroTitle: {
    marginTop: 7,
    maxWidth: "88%",
    color: "#ffffff",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "800",
  },

  playButton: {
    alignSelf: "flex-start",
    marginTop: 17,
    borderWidth: 1,
    borderColor: "#fb923c",
    borderRadius: 7,
    backgroundColor: "rgba(249,115,22,0.12)",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  playButtonText: {
    color: "#fdba74",
    fontSize: 13,
    fontWeight: "700",
  },

  emptyHero: {
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 24,
    backgroundColor: "#18181b",
  },

  emptyText: {
    marginTop: 8,
    color: "#a1a1aa",
    fontSize: 14,
  },

  filters: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 8,
    gap: 9,
  },

  filterButton: {
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 999,
    backgroundColor: "#09090b",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },

  filterButtonActive: {
    borderColor: "#f97316",
    backgroundColor: "#f97316",
  },

  filterText: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "500",
  },

  filterTextActive: {
    color: "#000000",
    fontWeight: "700",
  },

  groups: {
    paddingTop: 10,
  },

  group: {
    marginBottom: 28,
  },

  groupHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  groupTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "700",
  },

  groupCount: {
    marginTop: 3,
    color: "#71717a",
    fontSize: 12,
  },

  seeAll: {
    color: "#fdba74",
    fontSize: 12,
    fontWeight: "600",
  },

  carousel: {
    paddingHorizontal: 16,
    gap: 14,
  },

  card: {
    width: 285,
    height: 180,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },

  cardImage: {
    flex: 1,
    justifyContent: "flex-end",
  },

  cardShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  cardFallback: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 15,
    backgroundColor: "#18181b",
  },

  videoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  videoFallbackTitle: {
    color: "#e4e4e7",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
  },

  videoFallbackSubtitle: {
    marginTop: 6,
    color: "#a1a1aa",
    fontSize: 11,
  },

  cardContent: {
    padding: 15,
  },

  cardTitle: {
    color: "#ffffff",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
  },

  moreButton: {
    alignSelf: "flex-start",
    marginTop: 11,
    borderWidth: 1,
    borderColor: "#fb923c",
    borderRadius: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  moreButtonText: {
    color: "#fdba74",
    fontSize: 11,
    fontWeight: "600",
  },
});
