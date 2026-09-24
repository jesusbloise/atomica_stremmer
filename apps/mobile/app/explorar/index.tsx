import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import {
  API_BASE_URL,
  getVideos,
  searchUploads,
  type SearchResultItem,
  type VideoItem,
} from "../../src/api";
import { getAuthToken } from "../../src/authStorage";

type TabKey = "ultimos" | "mas-vistos";
type FilterKey = "con_subtitulos" | "sin_subtitulos" | "hoy" | null;

type LibraryItem = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  createdAt: string | null;
  views: number;
  category: string | null;
  subcategory: string | null;
  hasSubtitles?: boolean;
};

const ITEMS_PER_PAGE = 16;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stripExtension(value?: string | null): string {
  if (!value) return "Archivo";

  let safe = value;

  try {
    safe = decodeURIComponent(value);
  } catch {}

  const base = safe.split("/").pop() || safe;
  return base.replace(/\.[^./\\]+$/g, "");
}

function resolveMediaUrl(value?: string | null): string | null {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("r2://")) {
    return `${API_BASE_URL}/api/r2/proxy?url=${encodeURIComponent(raw)}`;
  }

  if (raw.startsWith("gs://")) {
    return `${API_BASE_URL}/api/proxy?url=${encodeURIComponent(raw)}`;
  }

  if (raw.startsWith("/")) {
    return `${API_BASE_URL}${raw}`;
  }

  return raw;
}

function videoToLibraryItem(item: VideoItem): LibraryItem {
  return {
    id: item.id,
    name: stripExtension(
      item.titulo || item.display_name || item.file_name || "Archivo",
    ),
    thumbnailUrl: resolveMediaUrl(item.thumbnail_url),
    createdAt: item.created_at || item.uploaded_at || null,
    views: Number(item.views || 0),
    category: item.category || null,
    subcategory: item.subcategory || null,
  };
}

function searchToLibraryItem(item: SearchResultItem): LibraryItem {
  return {
    id: item.id,
    name: stripExtension(
      item.titulo ||
        item.ficha?.titulo ||
        item.display_name ||
        item.file_name ||
        "Archivo",
    ),
    thumbnailUrl: resolveMediaUrl(item.thumbnail_url),
    createdAt: item.created_at || item.uploaded_at || null,
    views: Number(item.views || 0),
    category: item.category || null,
    subcategory: item.subcategory || null,
  };
}

function uniqueById(items: LibraryItem[]): LibraryItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{
    tab?: string | string[];
    q?: string | string[];
  }>();

  const { width } = useWindowDimensions();

  const initialTab =
    firstParam(params.tab) === "mas-vistos" ? "mas-vistos" : "ultimos";

  const initialQuery = firstParam(params.q);

  const [authToken, setAuthToken] = useState("");
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [filter, setFilter] = useState<FilterKey>(null);

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const columns = width >= 900 ? 4 : width >= 620 ? 3 : 2;

  useEffect(() => {
    const nextTab =
      firstParam(params.tab) === "mas-vistos" ? "mas-vistos" : "ultimos";

    const nextQuery = firstParam(params.q);

    setTab(nextTab);
    setQuery(nextQuery);
    setSubmittedQuery(nextQuery.trim());
    setCurrentPage(1);
  }, [params.tab, params.q]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setLoading(true);
        setError("");

        const token = await getAuthToken();

        if (!token) {
          router.replace("/");
          return;
        }

        const videos = await getVideos(token);

        if (cancelled) return;

        setAuthToken(token);
        setItems(uniqueById(videos.map(videoToLibraryItem)));
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los archivos",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authToken) return;

    let cancelled = false;

    async function runSearch() {
      const cleanQuery = submittedQuery.trim();

      if (!cleanQuery) {
        try {
          setSearching(true);
          setError("");

          const videos = await getVideos(authToken);

          if (cancelled) return;

          setItems(uniqueById(videos.map(videoToLibraryItem)));
          setCurrentPage(1);
        } catch (err) {
          if (cancelled) return;

          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los archivos",
          );
        } finally {
          if (!cancelled) {
            setSearching(false);
          }
        }

        return;
      }

      try {
        setSearching(true);
        setError("");

        const results = await searchUploads(authToken, cleanQuery);

        if (cancelled) return;

        setItems(uniqueById(results.map(searchToLibraryItem)));
        setCurrentPage(1);
      } catch (err) {
        if (cancelled) return;

        setItems([]);
        setError(
          err instanceof Error ? err.message : "No se pudo realizar la búsqueda",
        );
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [authToken, submittedQuery]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (filter === "con_subtitulos") {
      result = result.filter((item) => item.hasSubtitles === true);
    }

    if (filter === "sin_subtitulos") {
      result = result.filter((item) => item.hasSubtitles !== true);
    }

    if (filter === "hoy") {
      const today = new Date().toISOString().split("T")[0];

      result = result.filter((item) => item.createdAt?.startsWith(today));
    }

    if (tab === "mas-vistos") {
      result.sort((a, b) => b.views - a.views);
    } else {
      result.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    }

    return result;
  }, [items, filter, tab]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const submitSearch = () => {
    setSubmittedQuery(query.trim());
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setQuery("");
    setSubmittedQuery("");
    setCurrentPage(1);
  };

  const changeTab = (nextTab: TabKey) => {
    setTab(nextTab);
    setCurrentPage(1);
  };

  const applyFilter = (nextFilter: FilterKey) => {
    setFilter(nextFilter);
    setFilterOpen(false);
    setCurrentPage(1);
  };

  const title =
    tab === "mas-vistos"
      ? "Archivos más vistos"
      : "Últimos archivos agregados";

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Cargando archivos…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        key={`library-${columns}`}
        data={currentItems}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={styles.topbar}>
              <Pressable
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backText}>‹</Text>
              </Pressable>

              <Pressable
                style={styles.logoButton}
                onPress={() => router.replace("/organizar")}
              >
                <Image
                  source={require("../../assets/atomica-logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </Pressable>

              <View style={styles.topbarSpacer} />
            </View>

            <View style={styles.tabs}>
              <Pressable
                style={[
                  styles.tab,
                  tab === "ultimos" && styles.tabActive,
                ]}
                onPress={() => changeTab("ultimos")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "ultimos" && styles.tabTextActive,
                  ]}
                >
                  Últimos agregados
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.tab,
                  tab === "mas-vistos" && styles.tabActive,
                ]}
                onPress={() => changeTab("mas-vistos")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "mas-vistos" && styles.tabTextActive,
                  ]}
                >
                  Más vistos
                </Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{title}</Text>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={submitSearch}
                  returnKeyType="search"
                  placeholder="Buscar por nombre, subtítulos o texto..."
                  placeholderTextColor="#71717a"
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {!!query && (
                  <Pressable
                    style={styles.clearButton}
                    onPress={clearSearch}
                  >
                    <Text style={styles.clearText}>×</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                style={styles.searchButton}
                onPress={submitSearch}
              >
                <Text style={styles.searchButtonText}>Buscar</Text>
              </Pressable>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[
                  styles.filterButton,
                  filter && styles.filterButtonActive,
                ]}
                onPress={() => setFilterOpen(true)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filter && styles.filterButtonTextActive,
                  ]}
                >
                  {filter === "hoy"
                    ? "Subidos hoy"
                    : filter === "con_subtitulos"
                      ? "Con subtítulos"
                      : filter === "sin_subtitulos"
                        ? "Sin subtítulos"
                        : "Filtros"}
                </Text>
              </Pressable>

              {submittedQuery ? (
                <Text style={styles.resultText}>
                  Resultados para “{submittedQuery}”
                </Text>
              ) : (
                <Text style={styles.resultText}>
                  {filteredItems.length} archivos
                </Text>
              )}
            </View>

            {searching && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" />
                <Text style={styles.searchingText}>Buscando…</Text>
              </View>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardColumn}>
            <View style={styles.card}>
              <View style={styles.preview}>
                {item.thumbnailUrl ? (
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noPreview}>
                    <Text style={styles.noPreviewTitle}>VIDEO</Text>
                    <Text style={styles.noPreviewText}>Sin portada</Text>
                  </View>
                )}

                <View style={styles.previewOverlay} />

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.name}
                  </Text>

                  {(item.category || item.subcategory) && (
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {[item.category, item.subcategory]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  )}

                  <Pressable
                    style={styles.moreButton}
                    onPress={() => router.push(`/videos/${item.id}`)}
                  >
                    <Text style={styles.moreButtonText}>Ver más</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !searching ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No se encontraron archivos</Text>
              <Text style={styles.emptyText}>
                Prueba con otra búsqueda o restablece los filtros.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          filteredItems.length > 0 ? (
            <View style={styles.pagination}>
              <Pressable
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(1)}
                style={[
                  styles.pageButton,
                  currentPage === 1 && styles.pageButtonDisabled,
                ]}
              >
                <Text style={styles.pageText}>««</Text>
              </Pressable>

              <Pressable
                disabled={currentPage === 1}
                onPress={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
                style={[
                  styles.pageButton,
                  currentPage === 1 && styles.pageButtonDisabled,
                ]}
              >
                <Text style={styles.pageText}>‹</Text>
              </Pressable>

              <View style={styles.currentPage}>
                <Text style={styles.currentPageText}>
                  {currentPage} / {totalPages}
                </Text>
              </View>

              <Pressable
                disabled={currentPage === totalPages}
                onPress={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1),
                  )
                }
                style={[
                  styles.pageButton,
                  currentPage === totalPages && styles.pageButtonDisabled,
                ]}
              >
                <Text style={styles.pageText}>›</Text>
              </Pressable>

              <Pressable
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage(totalPages)}
                style={[
                  styles.pageButton,
                  currentPage === totalPages && styles.pageButtonDisabled,
                ]}
              >
                <Text style={styles.pageText}>»»</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setFilterOpen(false)}
        >
          <Pressable
            style={styles.filterModal}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.filterTitle}>Filtros</Text>

            <Pressable
              style={styles.filterOption}
              onPress={() => applyFilter("con_subtitulos")}
            >
              <Text style={styles.filterOptionText}>Con subtítulos</Text>
            </Pressable>

            <Pressable
              style={styles.filterOption}
              onPress={() => applyFilter("sin_subtitulos")}
            >
              <Text style={styles.filterOptionText}>Sin subtítulos</Text>
            </Pressable>

            <Pressable
              style={styles.filterOption}
              onPress={() => applyFilter("hoy")}
            >
              <Text style={styles.filterOptionText}>Subidos hoy</Text>
            </Pressable>

            <Pressable
              style={styles.filterOption}
              onPress={() => applyFilter(null)}
            >
              <Text style={styles.resetText}>Resetear filtros</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#a1a1aa",
    marginTop: 12,
  },

  content: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },

  topbar: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#27272a",
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: "#ffffff",
    fontSize: 38,
    lineHeight: 40,
  },

  logoButton: {
    flex: 1,
    alignItems: "center",
  },

  logo: {
    width: 150,
    height: 42,
  },

  topbarSpacer: {
    width: 44,
  },

  tabs: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },

  tab: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "rgba(24,24,27,0.85)",
  },

  tabActive: {
    borderColor: "#f97316",
  },

  tabText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "700",
  },

  tabTextActive: {
    color: "#fb923c",
  },

  title: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 22,
    marginBottom: 18,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },

  searchBox: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#52525b",
    borderRadius: 9,
    backgroundColor: "#27272a",
  },

  searchInput: {
    flex: 1,
    color: "#ffffff",
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },

  clearButton: {
    width: 38,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  clearText: {
    color: "#a1a1aa",
    fontSize: 25,
  },

  searchButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#fb923c",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  searchButtonText: {
    color: "#fb923c",
    fontSize: 13,
    fontWeight: "700",
  },

  actionsRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },

  filterButton: {
    borderWidth: 1,
    borderColor: "#fb923c",
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  filterButtonActive: {
    backgroundColor: "#fb923c",
  },

  filterButtonText: {
    color: "#fb923c",
    fontSize: 12,
    fontWeight: "700",
  },

  filterButtonTextActive: {
    color: "#000000",
  },

  resultText: {
    flex: 1,
    color: "#a1a1aa",
    fontSize: 12,
    textAlign: "right",
  },

  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },

  searchingText: {
    color: "#a1a1aa",
    fontSize: 12,
  },

  errorBox: {
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "rgba(127,29,29,0.22)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },

  errorText: {
    color: "#fca5a5",
    textAlign: "center",
  },

  row: {
    gap: 12,
  },

  cardColumn: {
    flex: 1,
    paddingBottom: 12,
  },

  card: {
    overflow: "hidden",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#18181b",
  },

  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    backgroundColor: "#27272a",
  },

  noPreview: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },

  noPreviewTitle: {
    color: "#e4e4e7",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 2,
  },

  noPreviewText: {
    color: "#71717a",
    fontSize: 10,
    marginTop: 5,
  },

  previewOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.42)",
  },

  cardContent: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 11,
  },

  cardTitle: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },

  cardMeta: {
    color: "#d4d4d8",
    fontSize: 10,
    marginTop: 4,
  },

  moreButton: {
    alignSelf: "flex-start",
    marginTop: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#fb923c",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  moreButtonText: {
    color: "#fb923c",
    fontSize: 11,
    fontWeight: "700",
  },

  empty: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },

  emptyText: {
    color: "#a1a1aa",
    fontSize: 13,
    textAlign: "center",
    marginTop: 7,
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 22,
    marginBottom: 18,
  },

  pageButton: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3f3f46",
  },

  pageButtonDisabled: {
    opacity: 0.3,
  },

  pageText: {
    color: "#ffffff",
    fontSize: 18,
  },

  currentPage: {
    height: 38,
    minWidth: 72,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },

  currentPageText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 24,
  },

  filterModal: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    overflow: "hidden",
  },

  filterTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3f3f46",
  },

  filterOption: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#27272a",
  },

  filterOptionText: {
    color: "#e4e4e7",
    fontSize: 14,
  },

  resetText: {
    color: "#fb7185",
    fontSize: 14,
    fontWeight: "700",
  },
});
