import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import {
  getControlCargas,
  type ControlCargasResponse,
  type ControlCargaStatus,
} from "../../src/api";
import { getAuthToken } from "../../src/authStorage";

type StatusFilter =
  | "ALL"
  | "COMPLETE"
  | "INCOMPLETE"
  | "EMPTY"
  | "WITHOUT_FICHA";

const STATUS_OPTIONS: {
  value: StatusFilter;
  label: string;
}[] = [
  { value: "ALL", label: "Todos" },
  { value: "COMPLETE", label: "Completas" },
  { value: "INCOMPLETE", label: "Incompletas" },
  { value: "EMPTY", label: "Vacías" },
  { value: "WITHOUT_FICHA", label: "Sin ficha" },
];

const STATUS_LABELS: Record<ControlCargaStatus, string> = {
  COMPLETE: "Completa",
  INCOMPLETE: "Incompleta",
  EMPTY: "Vacía",
  WITHOUT_FICHA: "Sin ficha",
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha desconocida";
  }

  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ControlCargasScreen() {
  const [data, setData] =
    useState<ControlCargasResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [status, setStatus] =
    useState<StatusFilter>("ALL");

  const [page, setPage] = useState(1);

  async function loadControlCargas(
    showMainLoader = false,
  ) {
    try {
      if (showMainLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      const authToken = await getAuthToken();

      if (!authToken) {
        router.replace("/");
        return;
      }

      const response = await getControlCargas(authToken, {
        search,
        status,
        page,
        limit: 20,
      });

      setData(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el control de cargas",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadControlCargas(true);
  }, [search, status, page]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function changeStatus(nextStatus: StatusFilter) {
    setPage(1);
    setStatus(nextStatus);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("ALL");
    setPage(1);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Cargando control de cargas...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Control de cargas
            </Text>

            <Text style={styles.subtitle}>
              Seguimiento de archivos y fichas técnicas
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadControlCargas()}
            >
              <Text style={styles.retryButtonText}>
                Reintentar
              </Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.summaryGrid}>
              <SummaryCard
                label="Total"
                value={data.summary.total}
              />

              <SummaryCard
                label="Completas"
                value={data.summary.complete}
              />

              <SummaryCard
                label="Pendientes"
                value={data.summary.pending}
              />

              <SummaryCard
                label="Promedio"
                value={`${data.summary.averageCompletion}%`}
              />

              <SummaryCard
                label="Responsables"
                value={data.summary.usersWithUploads}
              />
            </View>

            <View style={styles.filtersCard}>
              <Text style={styles.sectionTitle}>
                Buscar y filtrar
              </Text>

              <View style={styles.searchRow}>
                <TextInput
                  value={searchInput}
                  onChangeText={setSearchInput}
                  onSubmitEditing={applySearch}
                  placeholder="Archivo, usuario, categoría..."
                  placeholderTextColor="#71717a"
                  style={styles.searchInput}
                  returnKeyType="search"
                />

                <Pressable
                  style={styles.searchButton}
                  onPress={applySearch}
                >
                  <Text style={styles.searchButtonText}>
                    Buscar
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statusRow}
              >
                {STATUS_OPTIONS.map((option) => {
                  const active = status === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.statusFilter,
                        active &&
                          styles.statusFilterActive,
                      ]}
                      onPress={() =>
                        changeStatus(option.value)
                      }
                    >
                      <Text
                        style={[
                          styles.statusFilterText,
                          active &&
                            styles.statusFilterTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {(search || status !== "ALL") && (
                <Pressable
                  style={styles.clearButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.clearButtonText}>
                    Limpiar filtros
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.listHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Archivos
                </Text>

                <Text style={styles.resultCount}>
                  {data.pagination.total} resultado
                  {data.pagination.total === 1 ? "" : "s"}
                </Text>
              </View>

              <Pressable
                disabled={refreshing}
                onPress={() =>
                  void loadControlCargas()
                }
              >
                <Text style={styles.refreshText}>
                  {refreshing
                    ? "Actualizando..."
                    : "Actualizar"}
                </Text>
              </Pressable>
            </View>

            {data.uploads.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  No hay resultados
                </Text>

                <Text style={styles.emptyText}>
                  No se encontraron cargas con los filtros
                  seleccionados.
                </Text>
              </View>
            ) : (
              data.uploads.map((upload) => (
                <Pressable
                  key={upload.id}
                  style={styles.uploadCard}
                  onPress={() =>
                    router.push(`/videos/${upload.id}`)
                  }
                >
                  <View style={styles.uploadTop}>
                    <View style={styles.uploadTitleContainer}>
                      <Text
                        style={styles.uploadTitle}
                        numberOfLines={2}
                      >
                        {upload.fileName}
                      </Text>

                      <Text style={styles.uploadDate}>
                        {formatDate(upload.uploadedAt)}
                      </Text>
                    </View>

                    <StatusBadge
                      status={upload.ficha.status}
                    />
                  </View>

                  <View style={styles.metaBlock}>
                    <Text style={styles.metaLabel}>
                      Responsable
                    </Text>

                    <Text style={styles.metaValue}>
                      {upload.uploadedBy.name ||
                        upload.uploadedBy.email ||
                        "Sin responsable"}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaColumn}>
                      <Text style={styles.metaLabel}>
                        Categoría
                      </Text>

                      <Text style={styles.metaValue}>
                        {upload.category || "Sin categoría"}
                      </Text>
                    </View>

                    <View style={styles.metaColumn}>
                      <Text style={styles.metaLabel}>
                        Subcategoría
                      </Text>

                      <Text style={styles.metaValue}>
                        {upload.subcategory || "—"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressHeader}>
                    <Text style={styles.metaLabel}>
                      Ficha técnica
                    </Text>

                    <Text style={styles.progressValue}>
                      {upload.ficha.completion}%
                    </Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              upload.ficha.completion,
                            ),
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.fieldsText}>
                    {upload.ficha.completedFields}/
                    {upload.ficha.totalFields} campos
                    completados
                  </Text>

                  {upload.ficha.missingFields.length > 0 ? (
                    <Text
                      style={styles.missingText}
                      numberOfLines={2}
                    >
                      Faltan:{" "}
                      {upload.ficha.missingFields.join(", ")}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}

            {data.pagination.totalPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable
                  disabled={data.pagination.page <= 1}
                  style={[
                    styles.pageButton,
                    data.pagination.page <= 1 &&
                      styles.pageButtonDisabled,
                  ]}
                  onPress={() =>
                    setPage((current) =>
                      Math.max(1, current - 1),
                    )
                  }
                >
                  <Text style={styles.pageButtonText}>
                    Anterior
                  </Text>
                </Pressable>

                <Text style={styles.pageText}>
                  {data.pagination.page} de{" "}
                  {data.pagination.totalPages}
                </Text>

                <Pressable
                  disabled={
                    data.pagination.page >=
                    data.pagination.totalPages
                  }
                  style={[
                    styles.pageButton,
                    data.pagination.page >=
                      data.pagination.totalPages &&
                      styles.pageButtonDisabled,
                  ]}
                  onPress={() =>
                    setPage((current) => current + 1)
                  }
                >
                  <Text style={styles.pageButtonText}>
                    Siguiente
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({
  status,
}: {
  status: ControlCargaStatus;
}) {
  return (
    <View
      style={[
        styles.badge,
        status === "COMPLETE" &&
          styles.badgeComplete,
        status === "INCOMPLETE" &&
          styles.badgeIncomplete,
        status === "EMPTY" && styles.badgeEmpty,
        status === "WITHOUT_FICHA" &&
          styles.badgeWithoutFicha,
      ]}
    >
      <Text style={styles.badgeText}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#09090b",
  },

  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },

  content: {
    padding: 16,
    paddingBottom: 48,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#09090b",
  },

  loadingText: {
    color: "#a1a1aa",
    fontSize: 14,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  backButton: {
    width: 42,
    height: 42,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    backgroundColor: "#18181b",
  },

  backButtonText: {
    marginTop: -3,
    color: "#ffffff",
    fontSize: 32,
    lineHeight: 34,
  },

  headerText: {
    flex: 1,
  },

  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
  },

  subtitle: {
    marginTop: 3,
    color: "#a1a1aa",
    fontSize: 13,
  },

  errorBox: {
    marginBottom: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    borderRadius: 10,
    backgroundColor: "#450a0a",
  },

  errorText: {
    color: "#fecaca",
    fontSize: 14,
  },

  retryButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },

  retryButtonText: {
    color: "#09090b",
    fontWeight: "700",
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginBottom: 20,
  },

  summaryCard: {
    width: "48.5%",
    minHeight: 90,
    padding: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    backgroundColor: "#18181b",
  },

  summaryValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },

  summaryLabel: {
    marginTop: 5,
    color: "#a1a1aa",
    fontSize: 12,
  },

  filtersCard: {
    marginBottom: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    backgroundColor: "#18181b",
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },

  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 9,
    color: "#ffffff",
    backgroundColor: "#09090b",
  },

  searchButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#ffffff",
  },

  searchButtonText: {
    color: "#09090b",
    fontWeight: "700",
  },

  statusRow: {
    gap: 8,
    paddingTop: 14,
    paddingBottom: 4,
  },

  statusFilter: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 20,
    backgroundColor: "#09090b",
  },

  statusFilterActive: {
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
  },

  statusFilterText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
  },

  statusFilterTextActive: {
    color: "#09090b",
  },

  clearButton: {
    alignSelf: "flex-start",
    marginTop: 12,
  },

  clearButtonText: {
    color: "#fb923c",
    fontSize: 13,
    fontWeight: "600",
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  resultCount: {
    marginTop: 3,
    color: "#71717a",
    fontSize: 12,
  },

  refreshText: {
    color: "#fb923c",
    fontSize: 13,
    fontWeight: "700",
  },

  uploadCard: {
    marginBottom: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    backgroundColor: "#18181b",
  },

  uploadTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  uploadTitleContainer: {
    flex: 1,
  },

  uploadTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  uploadDate: {
    marginTop: 5,
    color: "#71717a",
    fontSize: 12,
  },

  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 14,
  },

  badgeComplete: {
    borderColor: "#166534",
    backgroundColor: "#052e16",
  },

  badgeIncomplete: {
    borderColor: "#92400e",
    backgroundColor: "#451a03",
  },

  badgeEmpty: {
    borderColor: "#991b1b",
    backgroundColor: "#450a0a",
  },

  badgeWithoutFicha: {
    borderColor: "#52525b",
    backgroundColor: "#27272a",
  },

  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },

  metaBlock: {
    marginTop: 16,
  },

  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 13,
  },

  metaColumn: {
    flex: 1,
  },

  metaLabel: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },

  metaValue: {
    marginTop: 4,
    color: "#e4e4e7",
    fontSize: 13,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 17,
  },

  progressValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  progressTrack: {
    height: 7,
    marginTop: 7,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: "#3f3f46",
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },

  fieldsText: {
    marginTop: 7,
    color: "#a1a1aa",
    fontSize: 11,
  },

  missingText: {
    marginTop: 6,
    color: "#fbbf24",
    fontSize: 11,
    lineHeight: 16,
  },

  emptyCard: {
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    backgroundColor: "#18181b",
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  emptyText: {
    marginTop: 7,
    color: "#a1a1aa",
    textAlign: "center",
    fontSize: 13,
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },

  pageButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 9,
    backgroundColor: "#18181b",
  },

  pageButtonDisabled: {
    opacity: 0.35,
  },

  pageButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  pageText: {
    color: "#a1a1aa",
    fontSize: 12,
  },
});