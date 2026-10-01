import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import {
  File,
  FileMode,
  Paths,
  UploadType,
} from "expo-file-system";

import {
  getAvailableUploadGroups,
  getAvailableUploadUsers,
  getCategories,
  abortMultipartUpload,
completeMultipartUpload,
createSmallUpload,
finalizeMultipartUpload,
initMultipartUpload,
signMultipartPart,
type CompletedMultipartPart,
  type AvailableUploadGroup,
  type AvailableUploadUser,
  type CategoryItem,
  type MobileUploadFile,
  type UploadAccessLevel,
  type UploadAssignment,
  type UploadFicha,
  type UploadGroupAssignment,
  type UploadVisibility,
} from "../../src/api";
import { getAuthToken } from "../../src/authStorage";

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
];

const OFICINA_OPTIONS = ["Chile", "Mexico"] as const;

const ACCEPTED_MIME_TYPES = [
  "video/*",
  "audio/*",
  "image/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

function emptyFicha(): UploadFicha {
  return {
    titulo: "",
    marca: "",
    agencia: "",
    productora: "",
    contacto: "",
    oficina: "",
    tipo: [],
    estudio: "",
    director: "",
    productor: "",
    produccion: "",
    corporativo: "",
    nuevosNegocios: "",
    otros: "",
    duracion: "",
    formato: "",
    version: "",
    fecha: "",
  };
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** index;

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function Field({
  label,
  value,
  placeholder,
  multiline = false,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#777"
        onChangeText={onChangeText}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.textarea,
        ]}
      />
    </View>
  );
}

export default function UploadScreen() {
  const [authToken, setAuthToken] = useState("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [file, setFile] = useState<MobileUploadFile | null>(null);
  const [ficha, setFicha] = useState<UploadFicha>(emptyFicha());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibility, setVisibility] =
  useState<UploadVisibility>("PUBLIC");

const [requiresApproval, setRequiresApproval] =
  useState(false);

const [availableUsers, setAvailableUsers] =
  useState<AvailableUploadUser[]>([]);

const [availableGroups, setAvailableGroups] =
  useState<AvailableUploadGroup[]>([]);

const [assignedUsers, setAssignedUsers] =
  useState<UploadAssignment[]>([]);

const [assignedGroups, setAssignedGroups] =
  useState<UploadGroupAssignment[]>([]);

const [loadingAccess, setLoadingAccess] =
  useState(false);

const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [uploadMessage, setUploadMessage] = useState("");

  const selectedCategory = useMemo(
    () => categories.find((item) => item.slug === category) ?? null,
    [categories, category],
  );

  const availableSubcategories = useMemo(
    () =>
      (selectedCategory?.subcategories ?? []).filter(
        (item) => item.is_active !== false,
      ),
    [selectedCategory],
  );

  const requiresSubcategory = availableSubcategories.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const token = await getAuthToken();

        if (!token) {
          router.replace("/");
          return;
        }

        const result = await getCategories(token);

setLoadingAccess(true);

const [usersResult, groupsResult] = await Promise.allSettled([
  getAvailableUploadUsers(token),
  getAvailableUploadGroups(token),
]);

if (cancelled) return;

if (usersResult.status === "fulfilled") {
  setAvailableUsers(usersResult.value);
} else {
  console.warn(
    "No se pudieron cargar usuarios para privacidad:",
    usersResult.reason,
  );
  setAvailableUsers([]);
}

if (groupsResult.status === "fulfilled") {
  setAvailableGroups(groupsResult.value);
} else {
  console.warn(
    "No se pudieron cargar grupos para privacidad:",
    groupsResult.reason,
  );
  setAvailableGroups([]);
}

setLoadingAccess(false);

        if (cancelled) return;

        setAuthToken(token);

        const activeCategories = result.filter(
          (item) => item.is_active !== false,
        );

        setCategories(activeCategories);

        if (activeCategories.length > 0) {
          setCategory(activeCategories[0].slug);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo preparar la pantalla de subida.",
          );
        }
      } finally {
  if (!cancelled) {
    setLoading(false);
    setLoadingAccess(false);
  }
}
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateFicha<K extends keyof UploadFicha>(
    key: K,
    value: UploadFicha[K],
  ) {
    setFicha((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function selectCategory(slug: string) {
    setCategory(slug);
    setSubcategory("");
  }

  function toggleTipo(tipo: string) {
    const current = ficha.tipo ?? [];

    updateFicha(
      "tipo",
      current.includes(tipo)
        ? current.filter((item) => item !== tipo)
        : [...current, tipo],
    );
  }

  function toggleAssignedUser(userId: string) {
  setAssignedUsers((current) => {
    const exists = current.some((item) => item.userId === userId);

    if (exists) {
      return current.filter((item) => item.userId !== userId);
    }

    return [
      ...current,
      {
        userId,
        accessLevel: "VIEWER",
      },
    ];
  });
}

function setUserAccessLevel(
  userId: string,
  accessLevel: UploadAccessLevel,
) {
  setAssignedUsers((current) =>
    current.map((item) =>
      item.userId === userId
        ? { ...item, accessLevel }
        : item,
    ),
  );
}

function toggleAssignedGroup(groupId: string) {
  setAssignedGroups((current) => {
    const exists = current.some(
      (item) => item.groupId === groupId,
    );

    if (exists) {
      return current.filter(
        (item) => item.groupId !== groupId,
      );
    }

    return [
      ...current,
      {
        groupId,
        accessLevel: "VIEWER",
      },
    ];
  });
}

function setGroupAccessLevel(
  groupId: string,
  accessLevel: UploadAccessLevel,
) {
  setAssignedGroups((current) =>
    current.map((item) =>
      item.groupId === groupId
        ? { ...item, accessLevel }
        : item,
    ),
  );
}

function changeVisibility(next: UploadVisibility) {
  setVisibility(next);

  if (next === "PUBLIC") {
    setAssignedUsers([]);
    setAssignedGroups([]);
  }
}

async function handleUpload() {
  if (uploading) return;

  if (!authToken) {
    Alert.alert(
      "Sesión no disponible",
      "Vuelve a iniciar sesión para continuar.",
    );
    return;
  }

  if (!file) {
    Alert.alert(
      "Archivo requerido",
      "Selecciona un archivo antes de continuar.",
    );
    return;
  }

  if (!category) {
    Alert.alert(
      "Categoría requerida",
      "Selecciona una categoría.",
    );
    return;
  }

  const selectedCategory = categories.find(
    (item) => item.slug === category,
  );

  const activeSubcategories =
    selectedCategory?.subcategories?.filter(
      (item) => item.is_active !== false,
    ) ?? [];

  if (activeSubcategories.length > 0 && !subcategory) {
    Alert.alert(
      "Subcategoría requerida",
      "Selecciona una subcategoría.",
    );
    return;
  }

  if (!ficha.titulo?.trim()) {
    Alert.alert(
      "Título requerido",
      "Ingresa el título del archivo.",
    );
    return;
  }

  if (
    visibility === "RESTRICTED" &&
    assignedUsers.length === 0 &&
    assignedGroups.length === 0
  ) {
    Alert.alert(
      "Acceso requerido",
      "Selecciona al menos un usuario o grupo para un archivo restringido.",
    );
    return;
  }

  const input = {
    file,
    category,
    subcategory:
      activeSubcategories.length > 0 ? subcategory : "",
    ficha: {
      ...ficha,
      titulo: ficha.titulo.trim(),
    },
    visibility,
    requiresApproval,
    assignedUsers,
    assignedGroups,
  };

  let multipart:
    | {
        uploadId: string;
        finalizeToken: string;
      }
    | undefined;

  try {
    setUploading(true);
    setUploadProgress(0);
    setError("");

    const LARGE_FILE_THRESHOLD =
      30 * 1024 * 1024;

    let createdUploadId: string;

    if (file.size <= LARGE_FILE_THRESHOLD) {
      setUploadMessage("Subiendo archivo...");
      setUploadProgress(10);

      createdUploadId = await createSmallUpload(
        authToken,
        input,
      );

      setUploadProgress(100);
    } else {
      setUploadMessage("Preparando subida a R2...");

      const init = await initMultipartUpload(
        authToken,
        input,
      );

      multipart = {
        uploadId: init.uploadId,
        finalizeToken: init.finalizeToken,
      };

      const nativeFile = new File(file.uri);

      if (!nativeFile.exists) {
        throw new Error(
          "El archivo seleccionado ya no está disponible.",
        );
      }

      const completedParts: CompletedMultipartPart[] = [];

      const sourceHandle = nativeFile.open(FileMode.ReadOnly);

try {
  for (
    let partNumber = 1;
    partNumber <= init.totalParts;
    partNumber++
  ) {
        const start =
          (partNumber - 1) * init.partSize;

        const end = Math.min(
          start + init.partSize,
          file.size,
        );

        const partLength = end - start;

const tempPart = new File(
  Paths.cache,
  `atomica-upload-${init.uploadId}-part-${partNumber}.tmp`,
);

if (tempPart.exists) {
  tempPart.delete();
}

tempPart.create();

const tempHandle = tempPart.open(FileMode.WriteOnly);

try {
  const bytes = sourceHandle.readBytes(partLength);
  tempHandle.writeBytes(bytes);
} finally {
  tempHandle.close();
}

        const progressBefore = Math.floor(
          ((partNumber - 1) / init.totalParts) * 100,
        );

        setUploadProgress(progressBefore);
        setUploadMessage(
          `Subiendo archivo a R2: ${progressBefore}% (${partNumber}/${init.totalParts})`,
        );

        const uploadUrl = await signMultipartPart(
          authToken,
          init.uploadId,
          init.finalizeToken,
          partNumber,
        );

     let etag: string | undefined;

try {
  const partResponse = await tempPart.upload(uploadUrl, {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    headers: {
      "Content-Type":
        file.mimeType || "application/octet-stream",
    },
  });

  if (
    partResponse.status < 200 ||
    partResponse.status >= 300
  ) {
    throw new Error(
      `Error subiendo la parte ${partNumber} (${partResponse.status})`,
    );
  }

  etag =
    partResponse.headers?.etag ||
    partResponse.headers?.ETag;
} finally {
  if (tempPart.exists) {
    tempPart.delete();
  }
}

        if (!etag) {
          throw new Error(
            `R2 no devolvió el ETag de la parte ${partNumber}`,
          );
        }

        completedParts.push({
          partNumber,
          etag,
        });

       const progressAfter = Math.floor(
  (partNumber / init.totalParts) * 100,
);

setUploadProgress(progressAfter);
  }
} finally {
  sourceHandle.close();
}

setUploadMessage(
  "Uniendo las partes del archivo en R2...",
);
      await completeMultipartUpload(
        authToken,
        init.uploadId,
        init.finalizeToken,
        completedParts,
      );

      setUploadMessage(
        "Registrando archivo en Atomica Stremmer...",
      );

      createdUploadId = await finalizeMultipartUpload(
        authToken,
        init.finalizeToken,
      );

      setUploadProgress(100);
    }

    setUploadMessage("Archivo subido correctamente.");

    Alert.alert(
      "Subida completada",
      "El archivo fue registrado correctamente.",
      [
        {
          text: "Ver archivo",
          onPress: () =>
            router.replace(`/videos/${createdUploadId}`),
        },
        {
          text: "Aceptar",
          onPress: () =>
            router.replace("/organizar"),
        },
      ],
    );
  } catch (uploadError) {
    if (multipart && authToken) {
      try {
        await abortMultipartUpload(
          authToken,
          multipart.uploadId,
          multipart.finalizeToken,
        );
      } catch (abortError) {
        console.warn(
          "No se pudo abortar la subida multipart:",
          abortError,
        );
      }
    }

    const message =
      uploadError instanceof Error
        ? uploadError.message
        : "No se pudo subir el archivo.";

    setError(message);
    setUploadMessage("");

    Alert.alert("Error al subir", message);
  } finally {
    setUploading(false);
  }
}

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_MIME_TYPES,
        multiple: false,
        copyToCacheDirectory: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];

      if (typeof asset.size !== "number") {
        Alert.alert(
          "Archivo no disponible",
          "No fue posible determinar el tamaño del archivo seleccionado.",
        );
        return;
      }

      const maxBytes = 30 * 1024 * 1024 * 1024;

      if (asset.size > maxBytes) {
        Alert.alert(
          "Archivo demasiado grande",
          "El tamaño máximo permitido es 30 GB.",
        );
        return;
      }

      setFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
        mimeType: asset.mimeType,
      });
    } catch (pickError) {
      Alert.alert(
        "No se pudo seleccionar el archivo",
        pickError instanceof Error
          ? pickError.message
          : "Intenta nuevamente.",
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Preparando subida...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹ Volver</Text>
          </Pressable>

          <Text style={styles.title}>Subir archivos</Text>

          <Text style={styles.subtitle}>
            Agrega el archivo y completa su información.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Guardar en categoría:
          </Text>

          <View style={styles.chips}>
            {categories.map((item) => {
              const active = item.slug === category;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => selectCategory(item.slug)}
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {requiresSubcategory ? (
            <View style={styles.subcategoryBlock}>
              <Text style={styles.label}>Subcategoría</Text>

              <View style={styles.chips}>
                {availableSubcategories.map((item) => {
                  const active = item.label === subcategory;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setSubcategory(item.label)}
                      style={[
                        styles.chip,
                        active && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos del archivo</Text>

          <Text style={styles.sectionDescription}>
            Completa lo necesario antes de subir.
          </Text>

          <Field
            label="Título *"
            value={ficha.titulo ?? ""}
            placeholder="Ej: Campaña Verano 2026 - Master"
            onChangeText={(value) => updateFicha("titulo", value)}
          />

          <Field
            label="Marca"
            value={ficha.marca ?? ""}
            onChangeText={(value) => updateFicha("marca", value)}
          />

          <Field
            label="Agencia"
            value={ficha.agencia ?? ""}
            onChangeText={(value) => updateFicha("agencia", value)}
          />

          <Field
            label="Productora"
            value={ficha.productora ?? ""}
            onChangeText={(value) => updateFicha("productora", value)}
          />

          <Field
            label="Contacto"
            value={ficha.contacto ?? ""}
            onChangeText={(value) => updateFicha("contacto", value)}
          />

          <Text style={styles.label}>Oficina</Text>

          <View style={styles.chips}>
            {OFICINA_OPTIONS.map((item) => {
              const active = ficha.oficina === item;

              return (
                <Pressable
                  key={item}
                  onPress={() =>
                    updateFicha(
                      "oficina",
                      active ? "" : item,
                    )
                  }
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, styles.topSpacing]}>
            Tipo
          </Text>

          <View style={styles.chips}>
            {TIPO_OPTIONS.map((item) => {
              const active = (ficha.tipo ?? []).includes(item);

              return (
                <Pressable
                  key={item}
                  onPress={() => toggleTipo(item)}
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Field
            label="Estudio"
            value={ficha.estudio ?? ""}
            onChangeText={(value) => updateFicha("estudio", value)}
          />

          <Field
            label="Director"
            value={ficha.director ?? ""}
            onChangeText={(value) => updateFicha("director", value)}
          />

          <Field
            label="Productor"
            value={ficha.productor ?? ""}
            onChangeText={(value) => updateFicha("productor", value)}
          />

          <Field
            label="Duración"
            value={ficha.duracion ?? ""}
            placeholder="Ej: 00:30 / 1:20 / 2 min"
            onChangeText={(value) => updateFicha("duracion", value)}
          />

          <Field
            label="Formato"
            value={ficha.formato ?? ""}
            placeholder="Ej: 16:9 / 9:16 / 4:5 / 1:1"
            onChangeText={(value) => updateFicha("formato", value)}
          />

          <Field
            label="Versión"
            value={ficha.version ?? ""}
            placeholder="Ej: V1 / V2 / Master / Final"
            onChangeText={(value) => updateFicha("version", value)}
          />

          <Field
            label="Fecha"
            value={ficha.fecha ?? ""}
            placeholder="Ej: 09-06-2026"
            onChangeText={(value) => updateFicha("fecha", value)}
          />

          <Field
            label="Producción"
            value={ficha.produccion ?? ""}
            onChangeText={(value) => updateFicha("produccion", value)}
          />

          <Field
            label="Corporativo"
            value={ficha.corporativo ?? ""}
            onChangeText={(value) => updateFicha("corporativo", value)}
          />

          <Field
            label="Nuevos Negocios"
            value={ficha.nuevosNegocios ?? ""}
            onChangeText={(value) =>
              updateFicha("nuevosNegocios", value)
            }
          />

          <Field
            label="Otros"
            value={ficha.otros ?? ""}
            multiline
            onChangeText={(value) => updateFicha("otros", value)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Archivo</Text>

          {!file ? (
            <Pressable
              style={styles.filePicker}
              onPress={pickFile}
            >
              <Text style={styles.filePickerTitle}>
                Seleccionar archivo
              </Text>

              <Text style={styles.filePickerDescription}>
                Video/Documento hasta 30 GB
              </Text>
            </Pressable>
          ) : (
            <View style={styles.selectedFile}>
              <View style={styles.fileInfo}>
                <Text
                  style={styles.fileName}
                  numberOfLines={2}
                >
                  {file.name}
                </Text>

                <Text style={styles.fileSize}>
                  {formatBytes(file.size)}
                </Text>
              </View>

              <Pressable
                onPress={() => setFile(null)}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>
                  Limpiar archivo
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.card}>
  <Text style={styles.sectionTitle}>Privacidad y acceso</Text>

  <Text style={styles.sectionDescription}>
    Define quién podrá acceder al archivo.
  </Text>

  <View style={styles.optionRow}>
    <Pressable
      onPress={() => changeVisibility("PUBLIC")}
      style={[
        styles.visibilityOption,
        visibility === "PUBLIC" && styles.visibilityOptionActive,
      ]}
    >
      <Text
        style={[
          styles.visibilityTitle,
          visibility === "PUBLIC" && styles.visibilityTextActive,
        ]}
      >
        Público
      </Text>

      <Text
        style={[
          styles.visibilityDescription,
          visibility === "PUBLIC" && styles.visibilityTextActive,
        ]}
      >
        Disponible según los permisos generales de la plataforma.
      </Text>
    </Pressable>

    <Pressable
      onPress={() => changeVisibility("RESTRICTED")}
      style={[
        styles.visibilityOption,
        visibility === "RESTRICTED" &&
          styles.visibilityOptionActive,
      ]}
    >
      <Text
        style={[
          styles.visibilityTitle,
          visibility === "RESTRICTED" &&
            styles.visibilityTextActive,
        ]}
      >
        Restringido
      </Text>

      <Text
        style={[
          styles.visibilityDescription,
          visibility === "RESTRICTED" &&
            styles.visibilityTextActive,
        ]}
      >
        Solo usuarios o grupos seleccionados.
      </Text>
    </Pressable>
  </View>

  <Pressable
    onPress={() => setRequiresApproval((current) => !current)}
    style={styles.approvalRow}
  >
    <View
      style={[
        styles.checkbox,
        requiresApproval && styles.checkboxActive,
      ]}
    >
      {requiresApproval ? (
        <Text style={styles.checkboxMark}>✓</Text>
      ) : null}
    </View>

    <View style={styles.approvalText}>
      <Text style={styles.approvalTitle}>
        Requiere aprobación
      </Text>

      <Text style={styles.approvalDescription}>
        Marca el archivo para utilizar el flujo de aprobación.
      </Text>
    </View>
  </Pressable>

  {visibility === "RESTRICTED" ? (
    <>
      <View style={styles.accessDivider} />

      <Text style={styles.accessHeading}>Usuarios</Text>

      {loadingAccess ? (
        <ActivityIndicator />
      ) : availableUsers.length === 0 ? (
        <Text style={styles.emptyAccessText}>
          No hay usuarios disponibles.
        </Text>
      ) : (
        availableUsers.map((user) => {
          const assignment = assignedUsers.find(
            (item) => item.userId === user.id,
          );

          return (
            <View key={user.id} style={styles.accessItem}>
              <Pressable
                onPress={() => toggleAssignedUser(user.id)}
                style={styles.accessIdentity}
              >
                <View
                  style={[
                    styles.checkbox,
                    assignment && styles.checkboxActive,
                  ]}
                >
                  {assignment ? (
                    <Text style={styles.checkboxMark}>✓</Text>
                  ) : null}
                </View>

                <View style={styles.accessIdentityText}>
                  <Text style={styles.accessName}>
                    {user.name || user.email || "Usuario"}
                  </Text>

                  {user.email && user.name ? (
                    <Text style={styles.accessEmail}>
                      {user.email}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              {assignment ? (
                <View style={styles.levelRow}>
                  {(
                    [
                      "VIEWER",
                      "APPROVER",
                      "EDITOR",
                    ] as UploadAccessLevel[]
                  ).map((level) => {
                    const active =
                      assignment.accessLevel === level;

                    return (
                      <Pressable
                        key={level}
                        onPress={() =>
                          setUserAccessLevel(user.id, level)
                        }
                        style={[
                          styles.levelChip,
                          active && styles.levelChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.levelText,
                            active && styles.levelTextActive,
                          ]}
                        >
                          {level}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <View style={styles.accessDivider} />

      <Text style={styles.accessHeading}>Grupos</Text>

      {loadingAccess ? (
        <ActivityIndicator />
      ) : availableGroups.length === 0 ? (
        <Text style={styles.emptyAccessText}>
          No hay grupos disponibles.
        </Text>
      ) : (
        availableGroups.map((group) => {
          const assignment = assignedGroups.find(
            (item) => item.groupId === group.id,
          );

          return (
            <View key={group.id} style={styles.accessItem}>
              <Pressable
                onPress={() => toggleAssignedGroup(group.id)}
                style={styles.accessIdentity}
              >
                <View
                  style={[
                    styles.checkbox,
                    assignment && styles.checkboxActive,
                  ]}
                >
                  {assignment ? (
                    <Text style={styles.checkboxMark}>✓</Text>
                  ) : null}
                </View>

                <View style={styles.accessIdentityText}>
                  <Text style={styles.accessName}>
                    {group.name}
                  </Text>

                  <Text style={styles.accessEmail}>
                    {group.member_count} miembros
                  </Text>
                </View>
              </Pressable>

              {assignment ? (
                <View style={styles.levelRow}>
                  {(
                    [
                      "VIEWER",
                      "APPROVER",
                      "EDITOR",
                    ] as UploadAccessLevel[]
                  ).map((level) => {
                    const active =
                      assignment.accessLevel === level;

                    return (
                      <Pressable
                        key={level}
                        onPress={() =>
                          setGroupAccessLevel(group.id, level)
                        }
                        style={[
                          styles.levelChip,
                          active && styles.levelChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.levelText,
                            active && styles.levelTextActive,
                          ]}
                        >
                          {level}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </>
  ) : null}
</View>

<View style={styles.pendingCard}>
  <Text style={styles.pendingTitle}>
    Imagen de portada opcional
  </Text>

  <Text style={styles.pendingText}>
    La portada y la ejecución final de la subida se completan a
    continuación.
  </Text>
</View>
<View style={styles.uploadCard}>
  <Text style={styles.sectionTitle}>Subir archivo</Text>

  <Text style={styles.sectionDescription}>
    Revisa los datos antes de iniciar la subida.
  </Text>

  {uploading ? (
    <View style={styles.progressBlock}>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(
                0,
                Math.min(100, uploadProgress),
              )}%`,
            },
          ]}
        />
      </View>

      <Text style={styles.progressText}>
        {uploadProgress}%
      </Text>

      {uploadMessage ? (
        <Text style={styles.uploadMessage}>
          {uploadMessage}
        </Text>
      ) : null}
    </View>
  ) : null}

  {error ? (
    <Text style={styles.uploadError}>{error}</Text>
  ) : null}

  <Pressable
    onPress={handleUpload}
    disabled={uploading}
    style={[
      styles.uploadButton,
      uploading && styles.uploadButtonDisabled,
    ]}
  >
    {uploading ? (
      <ActivityIndicator color="#000000" />
    ) : (
      <Text style={styles.uploadButtonText}>
        Subir archivo
      </Text>
    )}
  </Pressable>

  <Text style={styles.uploadLimit}>
    Video / Documento hasta 30 GB
  </Text>
</View>
        <Text style={styles.debugText}>
          {authToken
            ? "Sesión lista para subir"
            : "Sesión no disponible"}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 80,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 14,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    color: "#ffffff",
    fontSize: 16,
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#a3a3a3",
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "rgba(12,12,12,0.94)",
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionDescription: {
    color: "#9a9a9a",
    fontSize: 13,
    marginTop: -6,
    marginBottom: 4,
  },
  field: {
    gap: 7,
  },
  label: {
    color: "#e5e5e5",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#111111",
    color: "#ffffff",
    fontSize: 14,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#3b3b3b",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "#151515",
  },
  chipActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  chipText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#000000",
  },
  subcategoryBlock: {
    gap: 9,
    marginTop: 4,
  },
  topSpacing: {
    marginTop: 4,
  },
  filePicker: {
    minHeight: 130,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#555555",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 6,
  },
  filePickerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  filePickerDescription: {
    color: "#8d8d8d",
    fontSize: 13,
  },
  selectedFile: {
    gap: 12,
  },
  fileInfo: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#151515",
    gap: 5,
  },
  fileName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  fileSize: {
    color: "#969696",
    fontSize: 12,
  },
  clearButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  clearButtonText: {
    color: "#d8d8d8",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  pendingCard: {
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 14,
    padding: 15,
    backgroundColor: "rgba(10,10,10,0.9)",
    gap: 5,
  },
  pendingTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  pendingText: {
    color: "#929292",
    fontSize: 13,
    lineHeight: 19,
  },
  errorBox: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#6b2626",
    borderRadius: 10,
    backgroundColor: "rgba(90,20,20,0.35)",
  },
  errorText: {
    color: "#ffb4b4",
    fontSize: 13,
  },
  debugText: {
    color: "#666666",
    textAlign: "center",
    fontSize: 11,
  },
  optionRow: {
  gap: 10,
},
visibilityOption: {
  borderWidth: 1,
  borderColor: "#333333",
  borderRadius: 12,
  padding: 14,
  backgroundColor: "#111111",
  gap: 4,
},
visibilityOptionActive: {
  borderColor: "#ffffff",
  backgroundColor: "#ffffff",
},
visibilityTitle: {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: "700",
},
visibilityDescription: {
  color: "#8f8f8f",
  fontSize: 12,
  lineHeight: 17,
},
visibilityTextActive: {
  color: "#000000",
},
approvalRow: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 11,
  marginTop: 4,
},
checkbox: {
  width: 22,
  height: 22,
  borderWidth: 1,
  borderColor: "#555555",
  borderRadius: 5,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#111111",
},
checkboxActive: {
  backgroundColor: "#ffffff",
  borderColor: "#ffffff",
},
checkboxMark: {
  color: "#000000",
  fontSize: 14,
  fontWeight: "900",
},
approvalText: {
  flex: 1,
  gap: 2,
},
approvalTitle: {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: "700",
},
approvalDescription: {
  color: "#8e8e8e",
  fontSize: 12,
  lineHeight: 17,
},
accessDivider: {
  height: 1,
  backgroundColor: "#292929",
  marginVertical: 5,
},
accessHeading: {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: "700",
},
emptyAccessText: {
  color: "#858585",
  fontSize: 13,
},
accessItem: {
  borderWidth: 1,
  borderColor: "#292929",
  borderRadius: 12,
  padding: 12,
  gap: 11,
  backgroundColor: "#101010",
},
accessIdentity: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},
accessIdentityText: {
  flex: 1,
  gap: 2,
},
accessName: {
  color: "#ffffff",
  fontSize: 13,
  fontWeight: "700",
},
accessEmail: {
  color: "#858585",
  fontSize: 11,
},
levelRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 7,
  paddingLeft: 32,
},
levelChip: {
  borderWidth: 1,
  borderColor: "#383838",
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 6,
},
levelChipActive: {
  backgroundColor: "#ffffff",
  borderColor: "#ffffff",
},
levelText: {
  color: "#bdbdbd",
  fontSize: 10,
  fontWeight: "700",
},
levelTextActive: {
  color: "#000000",
},
uploadCard: {
  borderWidth: 1,
  borderColor: "#292929",
  borderRadius: 14,
  padding: 16,
  gap: 12,
  backgroundColor: "#0d0d0d",
},
progressBlock: {
  gap: 8,
},
progressTrack: {
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  backgroundColor: "#292929",
},
progressFill: {
  height: "100%",
  borderRadius: 999,
  backgroundColor: "#ffffff",
},
progressText: {
  color: "#ffffff",
  fontSize: 12,
  fontWeight: "700",
  textAlign: "right",
},
uploadMessage: {
  color: "#a5a5a5",
  fontSize: 12,
  lineHeight: 17,
},
uploadError: {
  color: "#ff8c8c",
  fontSize: 12,
  lineHeight: 18,
},
uploadButton: {
  minHeight: 50,
  borderRadius: 12,
  backgroundColor: "#ffffff",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 16,
},
uploadButtonDisabled: {
  opacity: 0.65,
},
uploadButtonText: {
  color: "#000000",
  fontSize: 15,
  fontWeight: "800",
},
uploadLimit: {
  color: "#777777",
  fontSize: 11,
  textAlign: "center",
},
});