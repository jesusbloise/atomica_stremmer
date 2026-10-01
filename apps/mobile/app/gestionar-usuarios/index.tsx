import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { getAuthToken } from "../../src/authStorage";
import {
  addManagedGroupMembers,
  createManagedUserGroup,
  createManagedRegistrationInvite,
  deleteManagedUserGroup,
  getManagedGroupMembers,
  getCategories,
  getManagedGroupPermissions,
  getManagedRegistrationInvites,
  getManagedUserDetail,
  getManagedUserGroups,
  getManagedUsers,
  getVideos,
  removeManagedGroupMember,
  removeManagedGroupPermission,
  revokeManagedRegistrationInvite,
  saveManagedGroupPermission,
  resetManagedUser2FA,
  updateManagedUser,
  CategoryItem,
  ManagedGroupMember,
  ManagedGroupMembersResponse,
  ManagedGroupPermission,
  ManagedRegistrationInvite,
  ManagedPermissionAccessLevel,
  ManagedPermissionResourceType,
  ManagedUser,
  ManagedUserDetail,
  ManagedUserGroup,
  VideoItem,
} from "../../src/api";

const PAGE_SIZE = 10;

export default function ManageUsersScreen() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteExpiresInHours, setInviteExpiresInHours] = useState("72");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState("");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [groups, setGroups] = useState<ManagedUserGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<ManagedUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [resetting2FA, setResetting2FA] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [groupMembersVisible, setGroupMembersVisible] = useState(false);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] =
    useState<ManagedGroupMembersResponse | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [groupPermissionsVisible, setGroupPermissionsVisible] = useState(false);
  const [groupPermissionsLoading, setGroupPermissionsLoading] = useState(false);
  const [permissionGroup, setPermissionGroup] =
    useState<ManagedUserGroup | null>(null);
  const [groupPermissions, setGroupPermissions] =
    useState<ManagedGroupPermission[]>([]);
  const [permissionCategories, setPermissionCategories] =
    useState<CategoryItem[]>([]);
  const [permissionVideos, setPermissionVideos] =
    useState<VideoItem[]>([]);
  const [permissionResourceType, setPermissionResourceType] =
    useState<ManagedPermissionResourceType>("CATEGORY");
  const [permissionResourceId, setPermissionResourceId] =
    useState("");
  const [permissionAccessLevel, setPermissionAccessLevel] =
    useState<ManagedPermissionAccessLevel>("VIEWER");
  const [savingPermission, setSavingPermission] = useState(false);
  const [deletingPermissionKey, setDeletingPermissionKey] =
    useState<string | null>(null);
  const [invitesVisible, setInvitesVisible] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [registrationInvites, setRegistrationInvites] =
    useState<ManagedRegistrationInvite[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const memberships = useMemo(
    () =>
      groups.reduce(
        (sum, group) => sum + Number(group.member_count || 0),
        0,
      ),
    [groups],
  );

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const token = await getAuthToken();

        if (!token) {
          router.replace("/");
          return;
        }

        const [usersResponse, groupsResponse] = await Promise.all([
          getManagedUsers(token, {
            q: appliedSearch,
            page,
            limit: PAGE_SIZE,
          }),
          getManagedUserGroups(token),
        ]);

        setUsers(usersResponse.rows);
        setTotal(usersResponse.total);
        setGroups(groupsResponse);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el gestor de usuarios.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedSearch, page],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function openRegistrationInvites() {
    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setInvitesVisible(true);
    setInvitesLoading(true);

    try {
      const invites = await getManagedRegistrationInvites(token);
      setRegistrationInvites(invites);
    } catch (err) {
      setInvitesVisible(false);

      Alert.alert(
        "No se pudieron cargar las invitaciones",
        err instanceof Error
          ? err.message
          : "Ocurrio un error al cargar las invitaciones.",
      );
    } finally {
      setInvitesLoading(false);
    }
  }

  function confirmRemoveGroupPermission(
    permission: ManagedGroupPermission,
  ) {
    if (!permissionGroup || deletingPermissionKey) {
      return;
    }

    Alert.alert(
      "Eliminar permiso",
      "¿Quieres eliminar este permiso del grupo?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            void handleRemoveGroupPermission(permission);
          },
        },
      ],
    );
  }

  async function handleRemoveGroupPermission(
    permission: ManagedGroupPermission,
  ) {
    if (!permissionGroup) {
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    const permissionKey =
      `${permission.resourceType}-${permission.resourceId}`;

    setDeletingPermissionKey(permissionKey);

    try {
      await removeManagedGroupPermission(
        token,
        permissionGroup.id,
        permission.resourceType,
        permission.resourceId,
      );

      const refreshedPermissions =
        await getManagedGroupPermissions(
          token,
          permissionGroup.id,
        );

      setGroupPermissions(refreshedPermissions);
    } catch (err) {
      Alert.alert(
        "No se pudo eliminar el permiso",
        err instanceof Error
          ? err.message
          : "Ocurrio un error al eliminar el permiso.",
      );
    } finally {
      setDeletingPermissionKey(null);
    }
  }

  async function handleSaveGroupPermission() {
    if (
      !permissionGroup ||
      !permissionResourceId ||
      savingPermission
    ) {
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setSavingPermission(true);

    try {
      await saveManagedGroupPermission(
        token,
        permissionGroup.id,
        {
          resourceType: permissionResourceType,
          resourceId: permissionResourceId,
          accessLevel: permissionAccessLevel,
        },
      );

      const refreshedPermissions =
        await getManagedGroupPermissions(
          token,
          permissionGroup.id,
        );

      setGroupPermissions(refreshedPermissions);
      setPermissionResourceId("");

      Alert.alert(
        "Permiso guardado",
        "El permiso del grupo fue actualizado correctamente.",
      );
    } catch (err) {
      Alert.alert(
        "No se pudo guardar el permiso",
        err instanceof Error
          ? err.message
          : "Ocurrio un error al guardar el permiso.",
      );
    } finally {
      setSavingPermission(false);
    }
  }

  async function openGroupPermissions(group: ManagedUserGroup) {
    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setPermissionGroup(group);
    setGroupPermissions([]);
    setPermissionResourceType("CATEGORY");
    setPermissionResourceId("");
    setPermissionAccessLevel("VIEWER");
    setGroupPermissionsVisible(true);
    setGroupPermissionsLoading(true);

    try {
      const [permissions, categories, videos] = await Promise.all([
        getManagedGroupPermissions(token, group.id),
        getCategories(token),
        getVideos(token),
      ]);

      setGroupPermissions(permissions);
      setPermissionCategories(categories);
      setPermissionVideos(videos);
    } catch (err) {
      setGroupPermissionsVisible(false);
      setPermissionGroup(null);

      Alert.alert(
        "No se pudieron cargar los permisos",
        err instanceof Error
          ? err.message
          : "Ocurrio un error al cargar los permisos del grupo.",
      );
    } finally {
      setGroupPermissionsLoading(false);
    }
  }

  async function refreshGroupMembers(
    token: string,
    groupId: string,
  ) {
    const [detail, refreshedGroups] = await Promise.all([
      getManagedGroupMembers(token, groupId),
      getManagedUserGroups(token),
    ]);

    setSelectedGroupMembers(detail);
    setGroups(refreshedGroups);
  }

  async function addGroupMember(member: ManagedGroupMember) {
    if (!selectedGroupMembers || updatingMemberId) {
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setUpdatingMemberId(member.id);

    try {
      await addManagedGroupMembers(
        token,
        selectedGroupMembers.group.id,
        [member.id],
      );

      await refreshGroupMembers(
        token,
        selectedGroupMembers.group.id,
      );
    } catch (err) {
      Alert.alert(
        "No se pudo agregar el miembro",
        err instanceof Error
          ? err.message
          : "Ocurrio un error al agregar el miembro.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function removeGroupMember(member: ManagedGroupMember) {
    if (!selectedGroupMembers || updatingMemberId) {
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setUpdatingMemberId(member.id);

    try {
      await removeManagedGroupMember(
        token,
        selectedGroupMembers.group.id,
        member.id,
      );

      await refreshGroupMembers(
        token,
        selectedGroupMembers.group.id,
      );
    } catch (err) {
      Alert.alert(
        "No se pudo quitar el miembro",
        err instanceof Error
          ? err.message
          : "Ocurrio un error al quitar el miembro.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function openGroupMembers(group: ManagedUserGroup) {
    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setGroupMembersVisible(true);
    setGroupMembersLoading(true);
    setSelectedGroupMembers(null);

    try {
      const detail = await getManagedGroupMembers(token, group.id);
      setSelectedGroupMembers(detail);
    } catch (err) {
      setGroupMembersVisible(false);

      Alert.alert(
        "No se pudo abrir el grupo",
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los miembros del grupo.",
      );
    } finally {
      setGroupMembersLoading(false);
    }
  }

  function confirmDeleteGroup(group: ManagedUserGroup) {
    if (deletingGroupId) {
      return;
    }

    Alert.alert(
      "Eliminar grupo",
      `¿Quieres eliminar el grupo "${group.name}"?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            void handleDeleteGroup(group);
          },
        },
      ],
    );
  }

  async function handleDeleteGroup(group: ManagedUserGroup) {
    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setDeletingGroupId(group.id);
    setError(null);

    try {
      await deleteManagedUserGroup(token, group.id);

      setGroups((current) =>
        current.filter((item) => item.id !== group.id),
      );
    } catch (err) {
      Alert.alert(
        "No se pudo eliminar el grupo",
        err instanceof Error
          ? err.message
          : "Ocurrio un error al eliminar el grupo.",
      );
    } finally {
      setDeletingGroupId(null);
    }
  }

  async function handleCreateGroup() {
    const name = groupName.trim();

    if (!name || creatingGroup) {
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setCreatingGroup(true);
    setError(null);

    try {
      await createManagedUserGroup(token, {
        name,
        description: groupDescription.trim() || undefined,
      });

      const refreshedGroups = await getManagedUserGroups(token);

      setGroups(refreshedGroups);
      setGroupName("");
      setGroupDescription("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo crear el grupo.",
      );
    } finally {
      setCreatingGroup(false);
    }
  }

  function confirmReset2FA() {
    if (!selectedUser || resetting2FA) {
      return;
    }

    Alert.alert(
      "Restablecer 2FA",
      `¿Quieres restablecer el 2FA de ${selectedUser.user.name || selectedUser.user.email}?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Restablecer",
          style: "destructive",
          onPress: () => {
            void handleReset2FA();
          },
        },
      ],
    );
  }

  async function handleReset2FA() {
    if (!selectedUser) {
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setResetting2FA(true);

    try {
      await resetManagedUser2FA(
        token,
        selectedUser.user.id,
      );

      Alert.alert(
        "2FA restablecido",
        "El usuario deberá configurar nuevamente la autenticación de dos factores.",
      );
    } catch (err) {
      Alert.alert(
        "No se pudo restablecer el 2FA",
        err instanceof Error
          ? err.message
          : "Ocurrió un error al restablecer el 2FA."
      );
    } finally {
      setResetting2FA(false);
    }
  }

  async function openUserDetail(user: ManagedUser) {
    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setDetailVisible(true);
    setDetailLoading(true);
    setSelectedUser(null);
    setError(null);

    try {
      const detail = await getManagedUserDetail(token, user.id);
      setSelectedUser(detail);
    } catch (err) {
      setDetailVisible(false);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el detalle del usuario.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeUserRole(
    user: ManagedUser,
    role: ManagedUser["role"],
  ) {
    if (role === user.role) {
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setUpdatingUserId(user.id);
    setError(null);

    try {
      await updateManagedUser(token, user.id, { role });

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, role }
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el rol.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function toggleUserStatus(user: ManagedUser) {
    const token = await getAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setUpdatingUserId(user.id);
    setError(null);

    try {
      await updateManagedUser(token, user.id, {
        is_active: !user.is_active,
      });

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, is_active: !item.is_active }
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el usuario.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  function submitSearch() {
    const value = search.trim();

    if (page !== 1) {
      setPage(1);
    }

    setAppliedSearch(value);
  }

  const handleCreateRegistrationInvite = async () => {
    if (creatingInvite) return;

    const hours = Number(inviteExpiresInHours);

    if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
      Alert.alert("Duración inválida", "Ingresa una duración entre 1 y 720 horas.");
      return;
    }

    try {
      setCreatingInvite(true);

      const token = await getAuthToken();

      if (!token) {
        router.replace("/");
        return;
      }

      const inviteUrl = await createManagedRegistrationInvite(token, {
        email: inviteEmail.trim() || undefined,
        expiresInHours: hours,
      });

      setGeneratedInviteUrl(inviteUrl);
      setInviteEmail("");

      const updatedInvites = await getManagedRegistrationInvites(token);
      setRegistrationInvites(updatedInvites);

      Alert.alert("Invitación creada", "La invitación fue creada correctamente.");
    } catch (err) {
      Alert.alert(
        "No se pudo crear la invitación",
        err instanceof Error ? err.message : "Ocurrió un error al crear la invitación."
      );
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeRegistrationInvite = (
    invite: ManagedRegistrationInvite
  ) => {
    Alert.alert(
      "Revocar invitación",
      "¿Quieres revocar esta invitación?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revocar",
          style: "destructive",
          onPress: async () => {
            try {
              setRevokingInviteId(invite.id);

              const token = await getAuthToken();

              if (!token) {
                router.replace("/");
                return;
              }

              await revokeManagedRegistrationInvite(token, invite.id);

              const updatedInvites =
                await getManagedRegistrationInvites(token);

              setRegistrationInvites(updatedInvites);

              if (generatedInviteUrl) {
                setGeneratedInviteUrl("");
              }
            } catch (err) {
              Alert.alert(
                "No se pudo revocar",
                err instanceof Error
                  ? err.message
                  : "Ocurrió un error al revocar la invitación."
              );
            } finally {
              setRevokingInviteId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>ADMIN</Text>
          <Text style={styles.title}>Gestor de usuarios</Text>

          <Pressable
            style={styles.inviteButton}
            onPress={openRegistrationInvites}
          >
            <Text style={styles.inviteButtonText}>+ Invitar usuario</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Cargando usuarios...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData(true)}
            />
          }
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>

              <Pressable
                style={styles.retryButton}
                onPress={() => void loadData()}
              >
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.metrics}>
            <MetricCard label="Usuarios" value={total} />
            <MetricCard label="Grupos" value={groups.length} />
            <MetricCard label="Membresías" value={memberships} />
            <MetricCard
              label="Página"
              value={`${page}/${totalPages}`}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Usuarios</Text>

            <View style={styles.searchRow}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={submitSearch}
                placeholder="Buscar por nombre o correo"
                placeholderTextColor="#737373"
                autoCapitalize="none"
                style={styles.searchInput}
              />

              <Pressable
                style={styles.searchButton}
                onPress={submitSearch}
              >
                <Text style={styles.searchButtonText}>Buscar</Text>
              </Pressable>
            </View>

            {users.length === 0 ? (
              <Text style={styles.empty}>
                No se encontraron usuarios.
              </Text>
            ) : (
              users.map((user) => (
                <View key={user.id} style={styles.userCard}>
                  <View style={styles.userTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(user.name || user.email)
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.userIdentity}>
                      <Text style={styles.userName}>
                        {user.name || "Sin nombre"}
                      </Text>
                      <Text style={styles.userEmail}>
                        {user.email}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.status,
                        user.is_active
                          ? styles.statusActive
                          : styles.statusInactive,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {user.is_active ? "Activo" : "Inactivo"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.roleSelector}>
                    {(["SUPER_ADMIN", "ADMIN", "USUARIO"] as const).map(
                      (role) => (
                        <Pressable
                          key={role}
                          disabled={updatingUserId === user.id}
                          onPress={() =>
                            void changeUserRole(user, role)
                          }
                          style={[
                            styles.roleOption,
                            user.role === role &&
                              styles.roleOptionActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleOptionText,
                              user.role === role &&
                                styles.roleOptionTextActive,
                            ]}
                          >
                            {role === "SUPER_ADMIN"
                              ? "Super Admin"
                              : role === "ADMIN"
                                ? "Admin"
                                : "Usuario"}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>

                  <View style={styles.userActionsRow}>
                    <Text style={styles.role}>{user.role}</Text>

                    <Pressable
                      disabled={updatingUserId === user.id}
                      onPress={() => void toggleUserStatus(user)}
                      style={[
                        styles.statusAction,
                        updatingUserId === user.id && styles.disabled,
                      ]}
                    >
                      <Text style={styles.statusActionText}>
                        {updatingUserId === user.id
                          ? "Guardando..."
                          : user.is_active
                            ? "Desactivar"
                            : "Activar"}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.userStats}>
                    <UserStat
                      label="Archivos"
                      value={user.total_uploads}
                    />
                    <UserStat
                      label="Públicos"
                      value={user.public_uploads}
                    />
                    <UserStat
                      label="Restringidos"
                      value={user.restricted_uploads}
                    />
                    <UserStat
                      label="Accesos"
                      value={user.private_access_count}
                    />
                  </View>

                  <Pressable
                    style={styles.detailButton}
                    onPress={() => void openUserDetail(user)}
                  >
                    <Text style={styles.detailButtonText}>
                      Ver detalle
                    </Text>
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.pagination}>
              <Pressable
                disabled={page <= 1}
                onPress={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
                style={[
                  styles.pageButton,
                  page <= 1 && styles.disabled,
                ]}
              >
                <Text style={styles.pageButtonText}>Anterior</Text>
              </Pressable>

              <Text style={styles.pageLabel}>
                {page} de {totalPages}
              </Text>

              <Pressable
                disabled={page >= totalPages}
                onPress={() =>
                  setPage((current) =>
                    Math.min(totalPages, current + 1),
                  )
                }
                style={[
                  styles.pageButton,
                  page >= totalPages && styles.disabled,
                ]}
              >
                <Text style={styles.pageButtonText}>Siguiente</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grupos</Text>

            <View style={styles.createGroupBox}>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Nombre del grupo"
                placeholderTextColor="#737373"
                style={styles.groupInput}
              />

              <TextInput
                value={groupDescription}
                onChangeText={setGroupDescription}
                placeholder="Descripcion opcional"
                placeholderTextColor="#737373"
                style={styles.groupInput}
              />

              <Pressable
                disabled={!groupName.trim() || creatingGroup}
                onPress={() => void handleCreateGroup()}
                style={[
                  styles.createGroupButton,
                  (!groupName.trim() || creatingGroup) && styles.disabled,
                ]}
              >
                <Text style={styles.createGroupButtonText}>
                  {creatingGroup ? "Creando..." : "+ Crear grupo"}
                </Text>
              </Pressable>
            </View>

            {groups.length === 0 ? (
              <Text style={styles.empty}>No hay grupos creados.</Text>
            ) : (
              groups.map((group) => (
                <View key={group.id} style={styles.groupCard}>
                  <View>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.muted}>
                      {group.member_count} miembros
                    </Text>
                  </View>

                  <View style={styles.groupActions}>
                    <Text style={styles.groupSlug}>
                      {group.slug}
                    </Text>

                    <Pressable
                      onPress={() => void openGroupMembers(group)}
                      style={styles.manageGroupButton}
                    >
                      <Text style={styles.manageGroupButtonText}>
                        Miembros
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => void openGroupPermissions(group)}
                      style={styles.manageGroupButton}
                    >
                      <Text style={styles.manageGroupButtonText}>
                        Permisos
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={deletingGroupId === group.id}
                      onPress={() => confirmDeleteGroup(group)}
                      style={[
                        styles.deleteGroupButton,
                        deletingGroupId === group.id && styles.disabled,
                      ]}
                    >
                      <Text style={styles.deleteGroupButtonText}>
                        {deletingGroupId === group.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
      <Modal
        visible={groupPermissionsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setGroupPermissionsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailTitle}>
                  Permisos
                </Text>
                <Text style={styles.muted}>
                  {permissionGroup?.name || ""}
                </Text>
              </View>

              <Pressable
                onPress={() => setGroupPermissionsVisible(false)}
              >
                <Text style={styles.closeText}>Cerrar</Text>
              </Pressable>
            </View>

            {groupPermissionsLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator />
                <Text style={styles.muted}>
                  Cargando permisos...
                </Text>
              </View>
            ) : (
              <ScrollView>
                <View style={styles.permissionEditor}>
                  <Text style={styles.permissionEditorTitle}>
                    Asignar permiso
                  </Text>

                  <Text style={styles.permissionLabel}>
                    Tipo de recurso
                  </Text>

                  <View style={styles.permissionOptions}>
                    {(["CATEGORY", "SUBCATEGORY", "UPLOAD"] as ManagedPermissionResourceType[]).map(
                      (type) => (
                        <Pressable
                          key={type}
                          onPress={() => {
                            setPermissionResourceType(type);
                            setPermissionResourceId("");
                          }}
                          style={[
                            styles.permissionOption,
                            permissionResourceType === type &&
                              styles.permissionOptionActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.permissionOptionText,
                              permissionResourceType === type &&
                                styles.permissionOptionTextActive,
                            ]}
                          >
                            {type === "CATEGORY"
                              ? "Categoria"
                              : type === "SUBCATEGORY"
                                ? "Subcategoria"
                                : "Archivo"}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>

                  <Text style={styles.permissionLabel}>
                    Recurso
                  </Text>

                  <View style={styles.resourceList}>
                    {permissionResourceType === "CATEGORY"
                      ? permissionCategories.map((category) => (
                          <Pressable
                            key={category.id}
                            onPress={() =>
                              setPermissionResourceId(category.id)
                            }
                            style={[
                              styles.resourceOption,
                              permissionResourceId === category.id &&
                                styles.resourceOptionActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.resourceOptionText,
                                permissionResourceId === category.id &&
                                  styles.resourceOptionTextActive,
                              ]}
                            >
                              {category.label}
                            </Text>
                          </Pressable>
                        ))
                      : null}

                    {permissionResourceType === "SUBCATEGORY"
                      ? permissionCategories.flatMap((category) =>
                          category.subcategories.map((subcategory) => (
                            <Pressable
                              key={subcategory.id}
                              onPress={() =>
                                setPermissionResourceId(subcategory.id)
                              }
                              style={[
                                styles.resourceOption,
                                permissionResourceId === subcategory.id &&
                                  styles.resourceOptionActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.resourceOptionText,
                                  permissionResourceId === subcategory.id &&
                                    styles.resourceOptionTextActive,
                                ]}
                              >
                                {category.label} / {subcategory.label}
                              </Text>
                            </Pressable>
                          )),
                        )
                      : null}

                    {permissionResourceType === "UPLOAD"
                      ? permissionVideos.map((video) => (
                          <Pressable
                            key={video.id}
                            onPress={() =>
                              setPermissionResourceId(video.id)
                            }
                            style={[
                              styles.resourceOption,
                              permissionResourceId === video.id &&
                                styles.resourceOptionActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.resourceOptionText,
                                permissionResourceId === video.id &&
                                  styles.resourceOptionTextActive,
                              ]}
                            >
                              {video.display_name ||
                                video.titulo ||
                                video.file_name ||
                                video.id}
                            </Text>
                          </Pressable>
                        ))
                      : null}
                  </View>

                  <Text style={styles.permissionLabel}>
                    Nivel de acceso
                  </Text>

                  <View style={styles.permissionOptions}>
                    {(["VIEWER", "APPROVER", "EDITOR"] as ManagedPermissionAccessLevel[]).map(
                      (level) => (
                        <Pressable
                          key={level}
                          onPress={() =>
                            setPermissionAccessLevel(level)
                          }
                          style={[
                            styles.permissionOption,
                            permissionAccessLevel === level &&
                              styles.permissionOptionActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.permissionOptionText,
                              permissionAccessLevel === level &&
                                styles.permissionOptionTextActive,
                            ]}
                          >
                            {level}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>

                  <Pressable
                    disabled={
                      !permissionResourceId ||
                      savingPermission
                    }
                    onPress={() => void handleSaveGroupPermission()}
                    style={[
                      styles.savePermissionButton,
                      (!permissionResourceId ||
                        savingPermission) &&
                        styles.disabled,
                    ]}
                  >
                    <Text style={styles.savePermissionButtonText}>
                      {savingPermission
                        ? "Guardando..."
                        : "Guardar permiso"}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.detailSectionTitle}>
                  Permisos asignados ({groupPermissions.length})
                </Text>

                {groupPermissions.length ? (
                  groupPermissions.map((permission) => (
                    <View
                      key={`${permission.resourceType}-${permission.resourceId}`}
                      style={styles.permissionRow}
                    >
                      <View style={styles.memberInfo}>
                        <Text style={styles.permissionType}>
                          {permission.resourceType}
                        </Text>
                        <Text style={styles.muted}>
                          {permission.resourceId}
                        </Text>
                      </View>

                      <View style={styles.permissionRowActions}>
                        <Text style={styles.permissionLevel}>
                          {permission.accessLevel}
                        </Text>

                        <Pressable
                          disabled={deletingPermissionKey !== null}
                          onPress={() =>
                            confirmRemoveGroupPermission(permission)
                          }
                          style={[
                            styles.removePermissionButton,
                            deletingPermissionKey !== null &&
                              styles.disabled,
                          ]}
                        >
                          <Text style={styles.removePermissionButtonText}>
                            {deletingPermissionKey ===
                            `${permission.resourceType}-${permission.resourceId}`
                              ? "Eliminando..."
                              : "Eliminar"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>
                    Este grupo no tiene permisos asignados.
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={groupMembersVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setGroupMembersVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>
                {selectedGroupMembers?.group.name || "Miembros del grupo"}
              </Text>

              <Pressable onPress={() => setGroupMembersVisible(false)}>
                <Text style={styles.closeText}>Cerrar</Text>
              </Pressable>
            </View>

            {groupMembersLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator />
                <Text style={styles.muted}>
                  Cargando miembros...
                </Text>
              </View>
            ) : selectedGroupMembers ? (
              <ScrollView>
                <Text style={styles.detailSectionTitle}>
                  Miembros ({selectedGroupMembers.members.length})
                </Text>

                {selectedGroupMembers.members.length ? (
                  selectedGroupMembers.members.map((member: ManagedGroupMember) => (
                    <View key={member.id} style={styles.memberRow}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {member.name || "Sin nombre"}
                        </Text>
                        <Text style={styles.muted}>
                          {member.email}
                        </Text>
                      </View>

                      <View style={styles.memberActions}>
                        <View style={styles.memberActions}>
                          <Text style={styles.memberRole}>
                            {member.role}
                          </Text>

                          <Pressable
                            disabled={updatingMemberId !== null}
                            onPress={() => void addGroupMember(member)}
                            style={[
                              styles.addMemberButton,
                              updatingMemberId !== null && styles.disabled,
                            ]}
                          >
                            <Text style={styles.addMemberButtonText}>
                              {updatingMemberId === member.id
                                ? "Agregando..."
                                : "Agregar"}
                            </Text>
                          </Pressable>
                        </View>

                        <Pressable
                          disabled={updatingMemberId !== null}
                          onPress={() => void removeGroupMember(member)}
                          style={[
                            styles.removeMemberButton,
                            updatingMemberId !== null && styles.disabled,
                          ]}
                        >
                          <Text style={styles.removeMemberButtonText}>
                            {updatingMemberId === member.id
                              ? "Quitando..."
                              : "Quitar"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>
                    Este grupo no tiene miembros.
                  </Text>
                )}

                <Text style={styles.detailSectionTitle}>
                  Usuarios disponibles ({selectedGroupMembers.availableUsers.length})
                </Text>

                {selectedGroupMembers.availableUsers.length ? (
                  selectedGroupMembers.availableUsers.map(
                    (member: ManagedGroupMember) => (
                      <View key={member.id} style={styles.memberRow}>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {member.name || "Sin nombre"}
                          </Text>
                          <Text style={styles.muted}>
                            {member.email}
                          </Text>
                        </View>

                        <Text style={styles.memberRole}>
                          {member.role}
                        </Text>
                      </View>
                    ),
                  )
                ) : (
                  <Text style={styles.muted}>
                    No hay usuarios disponibles.
                  </Text>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>
                Detalle del usuario
              </Text>

              <Pressable onPress={() => setDetailVisible(false)}>
                <Text style={styles.closeText}>Cerrar</Text>
              </Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator />
                <Text style={styles.muted}>
                  Cargando detalle...
                </Text>
              </View>
            ) : selectedUser ? (
              <ScrollView>
                <Text style={styles.detailName}>
                  {selectedUser.user.name || "Sin nombre"}
                </Text>
                <Text style={styles.detailEmail}>
                  {selectedUser.user.email}
                </Text>
                <Text style={styles.detailRole}>
                  {selectedUser.user.role}
                </Text>

                <View style={styles.detailMetrics}>
                  <UserStat
                    label="Archivos"
                    value={selectedUser.user.total_uploads}
                  />
                  <UserStat
                    label="Públicos"
                    value={selectedUser.user.public_uploads}
                  />
                  <UserStat
                    label="Restringidos"
                    value={selectedUser.user.restricted_uploads}
                  />
                  <UserStat
                    label="Accesos"
                    value={selectedUser.user.private_access_count}
                  />
                </View>

                <Pressable
                  disabled={resetting2FA}
                  onPress={confirmReset2FA}
                  style={[
                    styles.reset2FAButton,
                    resetting2FA && styles.disabled,
                  ]}
                >
                  <Text style={styles.reset2FAText}>
                    {resetting2FA
                      ? "Restableciendo..."
                      : "Restablecer 2FA"}
                  </Text>
                </Pressable>

                <Text style={styles.detailSectionTitle}>
                  Grupos ({selectedUser.groups.length})
                </Text>

                {selectedUser.groups.length ? (
                  selectedUser.groups.map((group) => (
                    <Text key={group.id} style={styles.detailRow}>
                      {group.name}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.muted}>
                    No pertenece a grupos.
                  </Text>
                )}

                <Text style={styles.detailSectionTitle}>
                  Archivos ({selectedUser.uploads.length})
                </Text>

                <Text style={styles.muted}>
                  Accesos privados recibidos:{" "}
                  {selectedUser.receivedAccess.length}
                </Text>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        visible={invitesVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInvitesVisible(false)}
      >
        <View style={styles.inviteModalBackdrop}>
          <View style={styles.inviteModalContainer}>
            <View style={styles.inviteModalHeader}>
              <View>
                <Text style={styles.inviteModalEyebrow}>ADMIN</Text>
                <Text style={styles.inviteModalTitle}>Invitar usuario</Text>
              </View>

              <Pressable
                style={styles.inviteCloseButton}
                onPress={() => setInvitesVisible(false)}
              >
                <Text style={styles.inviteCloseButtonText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.inviteModalContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inviteSectionTitle}>
                Crear nueva invitación
              </Text>

              <Text style={styles.inviteFieldLabel}>
                Correo electrónico (opcional)
              </Text>

              <TextInput
                style={styles.inviteInput}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="usuario@correo.com"
                placeholderTextColor="#777777"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inviteFieldLabel}>
                Duración de la invitación
              </Text>

              <View style={styles.inviteExpiryRow}>
                {["24", "72", "168"].map((hours) => (
                  <Pressable
                    key={hours}
                    style={[
                      styles.inviteExpiryButton,
                      inviteExpiresInHours === hours &&
                        styles.inviteExpiryButtonActive,
                    ]}
                    onPress={() => setInviteExpiresInHours(hours)}
                  >
                    <Text
                      style={[
                        styles.inviteExpiryButtonText,
                        inviteExpiresInHours === hours &&
                          styles.inviteExpiryButtonTextActive,
                      ]}
                    >
                      {hours === "24"
                        ? "24 horas"
                        : hours === "72"
                          ? "72 horas"
                          : "7 días"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.inviteInput}
                value={inviteExpiresInHours}
                onChangeText={setInviteExpiresInHours}
                placeholder="Horas"
                placeholderTextColor="#777777"
                keyboardType="number-pad"
              />

              <Pressable
                style={[
                  styles.inviteCreateButton,
                  creatingInvite && styles.inviteButtonDisabled,
                ]}
                onPress={handleCreateRegistrationInvite}
                disabled={creatingInvite}
              >
                {creatingInvite ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.inviteCreateButtonText}>
                    Crear invitación
                  </Text>
                )}
              </Pressable>

              {generatedInviteUrl ? (
                <View style={styles.generatedInviteCard}>
                  <Text style={styles.generatedInviteLabel}>
                    Enlace de invitación generado
                  </Text>

                  <Text selectable style={styles.generatedInviteUrl}>
                    {generatedInviteUrl}
                  </Text>

                  <Text style={styles.generatedInviteHint}>
                    Mantén presionado el enlace para seleccionarlo y copiarlo.
                  </Text>
                </View>
              ) : null}

              <View style={styles.inviteHistoryHeader}>
                <Text style={styles.inviteSectionTitle}>
                  Historial de invitaciones
                </Text>

                <Text style={styles.inviteHistoryCount}>
                  {registrationInvites.length}
                </Text>
              </View>

              {invitesLoading ? (
                <View style={styles.inviteLoading}>
                  <ActivityIndicator color="#ffffff" />
                  <Text style={styles.inviteMutedText}>
                    Cargando invitaciones...
                  </Text>
                </View>
              ) : registrationInvites.length === 0 ? (
                <View style={styles.inviteEmptyCard}>
                  <Text style={styles.inviteMutedText}>
                    No hay invitaciones registradas.
                  </Text>
                </View>
              ) : (
                registrationInvites.map((invite) => {
                  const isRevoked = Boolean(invite.revoked_at);
                  const isUsed = Boolean(invite.used_at);
                  const isExpired =
                    new Date(invite.expires_at).getTime() < Date.now();

                  const status = isRevoked
                    ? "Revocada"
                    : isUsed
                      ? "Utilizada"
                      : isExpired
                        ? "Expirada"
                        : "Activa";

                  const canRevoke =
                    !isRevoked && !isUsed && !isExpired;

                  return (
                    <View key={invite.id} style={styles.inviteHistoryCard}>
                      <View style={styles.inviteHistoryTop}>
                        <View style={styles.inviteHistoryInfo}>
                          <Text style={styles.inviteHistoryEmail}>
                            {invite.email || "Invitación abierta"}
                          </Text>

                          <Text style={styles.inviteHistoryDate}>
                            Vence:{" "}
                            {new Date(invite.expires_at).toLocaleString()}
                          </Text>
                        </View>

                        <View style={styles.inviteStatusBadge}>
                          <Text style={styles.inviteStatusText}>
                            {status}
                          </Text>
                        </View>
                      </View>

                      {canRevoke ? (
                        <Pressable
                          style={[
                            styles.inviteRevokeButton,
                            revokingInviteId === invite.id &&
                              styles.inviteButtonDisabled,
                          ]}
                          disabled={revokingInviteId === invite.id}
                          onPress={() =>
                            handleRevokeRegistrationInvite(invite)
                          }
                        >
                          <Text style={styles.inviteRevokeButtonText}>
                            {revokingInviteId === invite.id
                              ? "Revocando..."
                              : "Revocar"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function UserStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {

  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inviteModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "flex-end",
  },
  inviteModalContainer: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: "#292929",
  },
  inviteModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#292929",
  },
  inviteModalEyebrow: {
    color: "#8f8f8f",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  inviteModalTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 3,
  },
  inviteCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#202020",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteCloseButtonText: {
    color: "#ffffff",
    fontSize: 26,
    lineHeight: 28,
  },
  inviteModalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  inviteSectionTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  inviteFieldLabel: {
    color: "#bcbcbc",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 18,
    marginBottom: 8,
  },
  inviteInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#343434",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#ffffff",
    backgroundColor: "#181818",
    fontSize: 14,
  },
  inviteExpiryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  inviteExpiryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#343434",
    backgroundColor: "#181818",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  inviteExpiryButtonActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  inviteExpiryButtonText: {
    color: "#bcbcbc",
    fontSize: 12,
    fontWeight: "600",
  },
  inviteExpiryButtonTextActive: {
    color: "#000000",
  },
  inviteCreateButton: {
    minHeight: 50,
    marginTop: 18,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteCreateButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
  },
  inviteButtonDisabled: {
    opacity: 0.5,
  },
  generatedInviteCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#343434",
    backgroundColor: "#181818",
  },
  generatedInviteLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  generatedInviteUrl: {
    color: "#d7d7d7",
    fontSize: 12,
    lineHeight: 18,
  },
  generatedInviteHint: {
    color: "#777777",
    fontSize: 11,
    marginTop: 8,
  },
  inviteHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  inviteHistoryCount: {
    minWidth: 30,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#242424",
    color: "#ffffff",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  inviteLoading: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 10,
  },
  inviteMutedText: {
    color: "#8d8d8d",
    fontSize: 13,
  },
  inviteEmptyCard: {
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#292929",
    backgroundColor: "#161616",
  },
  inviteHistoryCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#292929",
    backgroundColor: "#161616",
    marginBottom: 10,
  },
  inviteHistoryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  inviteHistoryInfo: {
    flex: 1,
  },
  inviteHistoryEmail: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  inviteHistoryDate: {
    color: "#888888",
    fontSize: 11,
    marginTop: 5,
  },
  inviteStatusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#292929",
  },
  inviteStatusText: {
    color: "#d6d6d6",
    fontSize: 10,
    fontWeight: "700",
  },
  inviteRevokeButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4a4a4a",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteRevokeButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  inviteButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  inviteButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },
  screen: {
    flex: 1,
    backgroundColor: "#050505",
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#202020",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#fff",
    fontSize: 32,
    lineHeight: 34,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: "#777",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "700",
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 50,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  muted: {
    color: "#888",
    fontSize: 13,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#242424",
    borderRadius: 16,
    padding: 16,
  },
  metricValue: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "700",
  },
  metricLabel: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#202020",
    borderRadius: 18,
    padding: 14,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    height: 46,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 12,
    paddingHorizontal: 13,
    color: "#fff",
  },
  searchButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#000",
    fontWeight: "700",
  },
  userCard: {
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingVertical: 16,
  },
  userTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#202020",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  userIdentity: {
    flex: 1,
    marginLeft: 11,
  },
  userName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  userEmail: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusActive: {
    backgroundColor: "#17331e",
  },
  statusInactive: {
    backgroundColor: "#351919",
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  roleSelector: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  roleOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2d2d2d",
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: "center",
  },
  roleOptionActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  roleOptionText: {
    color: "#888",
    fontSize: 10,
    fontWeight: "700",
  },
  roleOptionTextActive: {
    color: "#000",
  },
  userActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  statusAction: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  statusActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  role: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 12,
  },
  userStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    color: "#fff",
    fontWeight: "700",
  },
  statLabel: {
    color: "#777",
    fontSize: 10,
    marginTop: 2,
  },
  detailButton: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 14,
  },
  detailButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  pageButton: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  pageButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  pageLabel: {
    color: "#888",
    fontSize: 12,
  },
  disabled: {
    opacity: 0.3,
  },
  groupCard: {
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  groupSlug: {
    color: "#666",
    fontSize: 11,
  },
  empty: {
    color: "#777",
    paddingVertical: 18,
    textAlign: "center",
  },
  permissionEditor: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 14,
    backgroundColor: "#0d0d0d",
  },
  permissionEditorTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  permissionLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  permissionOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  permissionOption: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    backgroundColor: "#161616",
  },
  permissionOptionActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  permissionOptionText: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "700",
  },
  permissionOptionTextActive: {
    color: "#000",
  },
  resourceList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 10,
    overflow: "hidden",
  },
  resourceOption: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
    backgroundColor: "#151515",
  },
  resourceOptionActive: {
    backgroundColor: "#fff",
  },
  resourceOptionText: {
    color: "#ccc",
    fontSize: 12,
  },
  resourceOptionTextActive: {
    color: "#000",
    fontWeight: "700",
  },
  savePermissionButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  savePermissionButtonText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "700",
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
  },
  permissionType: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  permissionRowActions: {
    alignItems: "flex-end",
    gap: 7,
  },
  removePermissionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#5a2929",
    borderRadius: 7,
    backgroundColor: "#211010",
  },
  removePermissionButtonText: {
    color: "#ffb1b1",
    fontSize: 10,
    fontWeight: "700",
  },
  permissionLevel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 7,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
  },
  memberActions: {
    alignItems: "flex-end",
    gap: 7,
  },
  addMemberButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  addMemberButtonText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "700",
  },
  removeMemberButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#5a2929",
    borderRadius: 8,
    backgroundColor: "#211010",
  },
  removeMemberButtonText: {
    color: "#ffb1b1",
    fontSize: 11,
    fontWeight: "700",
  },
  memberRole: {
    color: "#888",
    fontSize: 11,
    fontWeight: "700",
  },
  manageGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 8,
    backgroundColor: "#181818",
  },
  manageGroupButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  groupActions: {
    alignItems: "flex-end",
    gap: 10,
  },
  deleteGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#5a2929",
    borderRadius: 8,
    backgroundColor: "#211010",
  },
  deleteGroupButtonText: {
    color: "#ffb1b1",
    fontSize: 12,
    fontWeight: "700",
  },
  createGroupBox: {
    gap: 10,
    marginBottom: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 14,
    backgroundColor: "#0d0d0d",
  },
  groupInput: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 10,
    color: "#fff",
    backgroundColor: "#151515",
  },
  createGroupButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  createGroupButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  detailSheet: {
    maxHeight: "82%",
    minHeight: "45%",
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#292929",
    padding: 20,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  detailTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  closeText: {
    color: "#aaa",
    fontWeight: "600",
  },
  detailLoading: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 12,
  },
  detailName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  detailEmail: {
    color: "#888",
    marginTop: 4,
  },
  detailRole: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  detailMetrics: {
    flexDirection: "row",
    marginTop: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#252525",
  },
  reset2FAButton: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#5a2929",
    backgroundColor: "#211010",
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
  },
  reset2FAText: {
    color: "#ffb1b1",
    fontSize: 13,
    fontWeight: "700",
  },
  detailSectionTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 10,
  },
  detailRow: {
    color: "#ccc",
    borderTopWidth: 1,
    borderTopColor: "#252525",
    paddingVertical: 10,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: "#542222",
    backgroundColor: "#1b0d0d",
    borderRadius: 14,
    padding: 14,
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
