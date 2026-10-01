import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import {
  API_BASE_URL,
  createManagedCategory,
  createManagedSubcategory,
  deleteManagedCategory,
  deleteManagedSubcategory,
  getCategories,
  ManagedCategory,
  ManagedSubcategory,
  updateManagedCategory,
  updateManagedSubcategory,
  uploadManagedCategoryCover,
} from "../../src/api";
import { getAuthToken } from "../../src/authStorage";

type CategoryForm = {
  label: string;
  slug: string;
  description: string;
  cover: string;
};

const EMPTY_FORM: CategoryForm = {
  label: "",
  slug: "",
  description: "",
  cover: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resolveCoverUrl(cover?: string | null) {
  if (!cover) return null;

  if (
    cover.startsWith("http://") ||
    cover.startsWith("https://") ||
    cover.startsWith("file://") ||
    cover.startsWith("content://")
  ) {
    return cover;
  }

  return `${API_BASE_URL}${cover.startsWith("/") ? "" : "/"}${cover}`;
}

export default function ManageCategoriesScreen() {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [formVisible, setFormVisible] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [localCoverUri, setLocalCoverUri] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(
    null,
  );

  const [subcategoryCategory, setSubcategoryCategory] =
    useState<ManagedCategory | null>(null);
  const [newSubcategoryLabel, setNewSubcategoryLabel] = useState("");
  const [creatingSubcategory, setCreatingSubcategory] = useState(false);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<
    string | null
  >(null);
  const [editingSubcategoryLabel, setEditingSubcategoryLabel] = useState("");
  const [savingSubcategoryId, setSavingSubcategoryId] = useState<
    string | null
  >(null);
  const [deletingSubcategoryId, setDeletingSubcategoryId] = useState<
    string | null
  >(null);

  const loadCategories = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      setError("");
      const data = await getCategories();

      const normalized: ManagedCategory[] = data.map((category) => ({
        id: category.id,
        slug: category.slug,
        label: category.label,
        description: category.description || "",
        cover: category.cover || null,
        is_active: category.is_active,
        sort_order: category.sort_order,
        subcategories: Array.isArray(category.subcategories)
          ? category.subcategories
          : [],
      }));

      setCategories(normalized);

      setSubcategoryCategory((current) => {
        if (!current) return null;

        return (
          normalized.find((category) => category.id === current.id) || null
        );
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las categorías.",
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCategories(false);
    setRefreshing(false);
  };

  const openCreateCategory = () => {
    setEditingCategoryId(null);
    setForm(EMPTY_FORM);
    setLocalCoverUri("");
    setFormVisible(true);
  };

  const openEditCategory = (category: ManagedCategory) => {
    setEditingCategoryId(category.id);
    setForm({
      label: category.label,
      slug: category.slug,
      description: category.description || "",
      cover: category.cover || "",
    });
    setLocalCoverUri("");
    setFormVisible(true);
  };

  const closeCategoryForm = () => {
    if (savingCategory || uploadingCover) return;

    setFormVisible(false);
    setEditingCategoryId(null);
    setForm(EMPTY_FORM);
    setLocalCoverUri("");
  };

  const handleLabelChange = (label: string) => {
    setForm((current) => ({
      ...current,
      label,
      slug: editingCategoryId ? current.slug : slugify(label),
    }));
  };

  const handlePickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setLocalCoverUri(result.assets[0].uri);
  };

  const handleSaveCategory = async () => {
    const label = form.label.trim();
    const slug = slugify(form.slug || label);

    if (!label) {
      Alert.alert("Categoría", "El nombre de la categoría es obligatorio.");
      return;
    }

    if (!slug) {
      Alert.alert("Categoría", "El slug de la categoría no es válido.");
      return;
    }

    setSavingCategory(true);

    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }

      let cover = form.cover;

      if (localCoverUri) {
        setUploadingCover(true);

        try {
          cover = await uploadManagedCategoryCover(token, localCoverUri);
        } finally {
          setUploadingCover(false);
        }
      }

      const input = {
        label,
        slug,
        description: form.description.trim(),
        cover,
      };

      if (editingCategoryId) {
        await updateManagedCategory(token, editingCategoryId, input);
      } else {
        await createManagedCategory(token, input);
      }

      await loadCategories(false);
      closeCategoryForm();

      Alert.alert(
        "Categorías",
        editingCategoryId
          ? "Categoría actualizada correctamente."
          : "Categoría creada correctamente.",
      );
    } catch (err) {
      Alert.alert(
        "Categorías",
        err instanceof Error
          ? err.message
          : "No se pudo guardar la categoría.",
      );
    } finally {
      setSavingCategory(false);
      setUploadingCover(false);
    }
  };

  const handleDeleteCategory = (category: ManagedCategory) => {
    Alert.alert(
      "Eliminar categoría",
      `¿Eliminar "${category.label}"? Esta acción también eliminará sus subcategorías.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeletingCategoryId(category.id);

            try {
              const token = await getAuthToken();

              if (!token) {
                throw new Error(
                  "Tu sesión expiró. Inicia sesión nuevamente.",
                );
              }

              await deleteManagedCategory(token, category.id);
              await loadCategories(false);
            } catch (err) {
              Alert.alert(
                "Categorías",
                err instanceof Error
                  ? err.message
                  : "No se pudo eliminar la categoría.",
              );
            } finally {
              setDeletingCategoryId(null);
            }
          },
        },
      ],
    );
  };

  const openSubcategories = (category: ManagedCategory) => {
    setSubcategoryCategory(category);
    setNewSubcategoryLabel("");
    setEditingSubcategoryId(null);
    setEditingSubcategoryLabel("");
  };

  const closeSubcategories = () => {
    setSubcategoryCategory(null);
    setNewSubcategoryLabel("");
    setEditingSubcategoryId(null);
    setEditingSubcategoryLabel("");
  };

  const handleCreateSubcategory = async () => {
    if (!subcategoryCategory) return;

    const label = newSubcategoryLabel.trim();

    if (!label) {
      Alert.alert(
        "Subcategorías",
        "Escribe el nombre de la subcategoría.",
      );
      return;
    }

    setCreatingSubcategory(true);

    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }

      await createManagedSubcategory(
        token,
        subcategoryCategory.id,
        label,
      );

      setNewSubcategoryLabel("");
      await loadCategories(false);
    } catch (err) {
      Alert.alert(
        "Subcategorías",
        err instanceof Error
          ? err.message
          : "No se pudo crear la subcategoría.",
      );
    } finally {
      setCreatingSubcategory(false);
    }
  };

  const beginEditSubcategory = (subcategory: ManagedSubcategory) => {
    setEditingSubcategoryId(subcategory.id);
    setEditingSubcategoryLabel(subcategory.label);
  };

  const handleUpdateSubcategory = async () => {
    if (!editingSubcategoryId) return;

    const label = editingSubcategoryLabel.trim();

    if (!label) {
      Alert.alert(
        "Subcategorías",
        "El nombre de la subcategoría es obligatorio.",
      );
      return;
    }

    setSavingSubcategoryId(editingSubcategoryId);

    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }

      await updateManagedSubcategory(
        token,
        editingSubcategoryId,
        label,
      );

      setEditingSubcategoryId(null);
      setEditingSubcategoryLabel("");
      await loadCategories(false);
    } catch (err) {
      Alert.alert(
        "Subcategorías",
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la subcategoría.",
      );
    } finally {
      setSavingSubcategoryId(null);
    }
  };

  const handleDeleteSubcategory = (subcategory: ManagedSubcategory) => {
    Alert.alert(
      "Eliminar subcategoría",
      `¿Eliminar "${subcategory.label}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeletingSubcategoryId(subcategory.id);

            try {
              const token = await getAuthToken();

              if (!token) {
                throw new Error(
                  "Tu sesión expiró. Inicia sesión nuevamente.",
                );
              }

              await deleteManagedSubcategory(token, subcategory.id);
              await loadCategories(false);
            } catch (err) {
              Alert.alert(
                "Subcategorías",
                err instanceof Error
                  ? err.message
                  : "No se pudo eliminar la subcategoría.",
              );
            } finally {
              setDeletingSubcategoryId(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Cargando categorías...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ADMIN</Text>
            <Text style={styles.title}>Gestión de categorías</Text>
            <Text style={styles.subtitle}>
              Administra categorías y subcategorías del sistema.
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={openCreateCategory}
        >
          <Text style={styles.primaryButtonText}>+ Nueva categoría</Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadCategories()}
            >
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.summary}>
          <Text style={styles.summaryNumber}>{categories.length}</Text>
          <Text style={styles.summaryLabel}>Categorías activas</Text>
        </View>

        {categories.map((category) => {
          const coverUrl = resolveCoverUrl(category.cover);

          return (
            <View key={category.id} style={styles.categoryCard}>
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.cover}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Text style={styles.coverPlaceholderText}>Sin imagen</Text>
                </View>
              )}

              <View style={styles.categoryBody}>
                <View style={styles.categoryHeading}>
                  <View style={styles.categoryHeadingCopy}>
                    <Text style={styles.categoryName}>
                      {category.label}
                    </Text>
                    <Text style={styles.slug}>/{category.slug}</Text>
                  </View>

                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>
                      {category.is_active ? "Activa" : "Inactiva"}
                    </Text>
                  </View>
                </View>

                {category.description ? (
                  <Text style={styles.description}>
                    {category.description}
                  </Text>
                ) : null}

                <Text style={styles.subcategoryCount}>
                  {category.subcategories.length} subcategoría
                  {category.subcategories.length === 1 ? "" : "s"}
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => openEditCategory(category)}
                  >
                    <Text style={styles.secondaryButtonText}>Editar</Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => openSubcategories(category)}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Subcategorías
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.deleteButton}
                    disabled={deletingCategoryId === category.id}
                    onPress={() => handleDeleteCategory(category)}
                  >
                    {deletingCategoryId === category.id ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text style={styles.deleteButtonText}>Eliminar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        {!error && categories.length === 0 ? (
          <Text style={styles.emptyText}>No hay categorías disponibles.</Text>
        ) : null}
      </ScrollView>

      <Modal
        visible={formVisible}
        animationType="slide"
        transparent
        onRequestClose={closeCategoryForm}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.eyebrow}>ADMIN</Text>
                  <Text style={styles.sheetTitle}>
                    {editingCategoryId
                      ? "Editar categoría"
                      : "Nueva categoría"}
                  </Text>
                </View>

                <Pressable onPress={closeCategoryForm}>
                  <Text style={styles.closeText}>Cerrar</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Nombre</Text>
              <TextInput
                value={form.label}
                onChangeText={handleLabelChange}
                placeholder="Nombre de la categoría"
                placeholderTextColor="#666"
                style={styles.input}
              />

              <Text style={styles.label}>Slug</Text>
              <TextInput
                value={form.slug}
                onChangeText={(slug) =>
                  setForm((current) => ({
                    ...current,
                    slug: slugify(slug),
                  }))
                }
                placeholder="slug-de-la-categoria"
                placeholderTextColor="#666"
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={styles.label}>Descripción</Text>
              <TextInput
                value={form.description}
                onChangeText={(description) =>
                  setForm((current) => ({
                    ...current,
                    description,
                  }))
                }
                placeholder="Descripción"
                placeholderTextColor="#666"
                multiline
                style={[styles.input, styles.textArea]}
              />

              <Text style={styles.label}>Imagen de la categoría</Text>

              {resolveCoverUrl(localCoverUri || form.cover) ? (
                <Image
                  source={{
                    uri: resolveCoverUrl(localCoverUri || form.cover)!,
                  }}
                  style={styles.preview}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.preview, styles.coverPlaceholder]}>
                  <Text style={styles.coverPlaceholderText}>Sin imagen</Text>
                </View>
              )}

              <Pressable
                style={styles.secondaryWideButton}
                onPress={() => void handlePickCover()}
              >
                <Text style={styles.secondaryButtonText}>
                  Seleccionar imagen
                </Text>
              </Pressable>

              <View style={styles.formActions}>
                <Pressable
                  style={styles.cancelButton}
                  disabled={savingCategory}
                  onPress={closeCategoryForm}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={styles.saveButton}
                  disabled={savingCategory}
                  onPress={() => void handleSaveCategory()}
                >
                  {savingCategory ? (
                    <View style={styles.savingRow}>
                      <ActivityIndicator size="small" />
                      <Text style={styles.saveButtonText}>
                        {uploadingCover ? "Subiendo..." : "Guardando..."}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingCategoryId
                        ? "Guardar cambios"
                        : "Crear categoría"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(subcategoryCategory)}
        animationType="slide"
        transparent
        onRequestClose={closeSubcategories}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderCopy}>
                  <Text style={styles.eyebrow}>SUBCATEGORÍAS</Text>
                  <Text style={styles.sheetTitle}>
                    {subcategoryCategory?.label}
                  </Text>
                </View>

                <Pressable onPress={closeSubcategories}>
                  <Text style={styles.closeText}>Cerrar</Text>
                </Pressable>
              </View>

              <View style={styles.newSubcategoryBox}>
                <TextInput
                  value={newSubcategoryLabel}
                  onChangeText={setNewSubcategoryLabel}
                  placeholder="Nueva subcategoría"
                  placeholderTextColor="#666"
                  style={[styles.input, styles.flexInput]}
                />

                <Pressable
                  style={styles.smallPrimaryButton}
                  disabled={creatingSubcategory}
                  onPress={() => void handleCreateSubcategory()}
                >
                  {creatingSubcategory ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Text style={styles.smallPrimaryButtonText}>Agregar</Text>
                  )}
                </Pressable>
              </View>

              {subcategoryCategory?.subcategories.length ? (
                subcategoryCategory.subcategories.map((subcategory) => (
                  <View key={subcategory.id} style={styles.subcategoryRow}>
                    {editingSubcategoryId === subcategory.id ? (
                      <>
                        <TextInput
                          value={editingSubcategoryLabel}
                          onChangeText={setEditingSubcategoryLabel}
                          style={[styles.input, styles.flexInput]}
                        />

                        <Pressable
                          style={styles.smallPrimaryButton}
                          disabled={
                            savingSubcategoryId === subcategory.id
                          }
                          onPress={() => void handleUpdateSubcategory()}
                        >
                          {savingSubcategoryId === subcategory.id ? (
                            <ActivityIndicator size="small" />
                          ) : (
                            <Text style={styles.smallPrimaryButtonText}>
                              Guardar
                            </Text>
                          )}
                        </Pressable>

                        <Pressable
                          style={styles.smallDarkButton}
                          onPress={() => {
                            setEditingSubcategoryId(null);
                            setEditingSubcategoryLabel("");
                          }}
                        >
                          <Text style={styles.smallDarkButtonText}>
                            Cancelar
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Text style={styles.subcategoryName}>
                          {subcategory.label}
                        </Text>

                        <Pressable
                          style={styles.smallDarkButton}
                          onPress={() =>
                            beginEditSubcategory(subcategory)
                          }
                        >
                          <Text style={styles.smallDarkButtonText}>
                            Editar
                          </Text>
                        </Pressable>

                        <Pressable
                          style={styles.smallDeleteButton}
                          disabled={
                            deletingSubcategoryId === subcategory.id
                          }
                          onPress={() =>
                            handleDeleteSubcategory(subcategory)
                          }
                        >
                          {deletingSubcategoryId === subcategory.id ? (
                            <ActivityIndicator size="small" />
                          ) : (
                            <Text style={styles.smallDeleteButtonText}>
                              Eliminar
                            </Text>
                          )}
                        </Pressable>
                      </>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Sin subcategorías.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#000",
  },
  loadingText: {
    color: "#aaa",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 12,
    backgroundColor: "#111",
  },
  backText: {
    color: "#fff",
    fontSize: 32,
    lineHeight: 34,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: "#777",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "800",
  },
  subtitle: {
    color: "#888",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  primaryButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "800",
  },
  summary: {
    marginBottom: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 14,
    backgroundColor: "#0d0d0d",
  },
  summaryNumber: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#777",
    fontSize: 12,
    marginTop: 2,
  },
  categoryCard: {
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 16,
    backgroundColor: "#0d0d0d",
  },
  cover: {
    width: "100%",
    height: 170,
    backgroundColor: "#151515",
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  coverPlaceholderText: {
    color: "#666",
    fontSize: 12,
  },
  categoryBody: {
    padding: 15,
  },
  categoryHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryHeadingCopy: {
    flex: 1,
  },
  categoryName: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
  },
  slug: {
    color: "#777",
    fontSize: 12,
    marginTop: 3,
  },
  activeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#343434",
    borderRadius: 20,
    backgroundColor: "#181818",
  },
  activeBadgeText: {
    color: "#ddd",
    fontSize: 10,
    fontWeight: "700",
  },
  description: {
    color: "#aaa",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  subcategoryCount: {
    color: "#777",
    fontSize: 12,
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 15,
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 9,
    backgroundColor: "#181818",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#5a2929",
    borderRadius: 9,
    backgroundColor: "#211010",
  },
  deleteButtonText: {
    color: "#ffb1b1",
    fontSize: 12,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  sheet: {
    maxHeight: "90%",
    minHeight: "55%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#292929",
    backgroundColor: "#111",
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 22,
  },
  sheetHeaderCopy: {
    flex: 1,
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  closeText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "700",
  },
  label: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 10,
    color: "#fff",
    backgroundColor: "#151515",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 13,
    textAlignVertical: "top",
  },
  preview: {
    width: "100%",
    height: 170,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#151515",
  },
  secondaryWideButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 10,
    backgroundColor: "#181818",
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    backgroundColor: "#181818",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  saveButton: {
    flex: 1.5,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  saveButtonText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "800",
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  newSubcategoryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  flexInput: {
    flex: 1,
  },
  smallPrimaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  smallPrimaryButtonText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "800",
  },
  subcategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
  },
  subcategoryName: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  smallDarkButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 8,
    backgroundColor: "#181818",
  },
  smallDarkButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  smallDeleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#5a2929",
    borderRadius: 8,
    backgroundColor: "#211010",
  },
  smallDeleteButtonText: {
    color: "#ffb1b1",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyText: {
    color: "#777",
    textAlign: "center",
    paddingVertical: 24,
  },
  errorBox: {
    marginBottom: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#542222",
    borderRadius: 14,
    backgroundColor: "#1b0d0d",
  },
  errorText: {
    color: "#ffb0b0",
  },
  retryButton: {
    marginTop: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
  },
});
