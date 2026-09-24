import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  getCategories,
  getMe,
  getVideos,
  type CategoryItem,
  type CurrentUser,
  type VideoItem,
} from "../../src/api";
import {
  getAuthToken,
  removeAuthToken,
} from "../../src/authStorage";
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
  const [session, setSession] = useState<CurrentUser | null>(null);

  const [heroIndex, setHeroIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      try {
        setLoading(true);
        setError("");

        const authToken = await getAuthToken();

        if (!authToken) {
          router.replace("/");
          return;
        }

        const [videosData, categoriesData, sessionData] =
          await Promise.all([
            getVideos(authToken),
            getCategories(authToken),
            getMe(authToken),
          ]);

        if (!cancelled) {
          setVideos(videosData);
          setCategories(categoriesData);
          setSession(sessionData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el contenido.",
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
  }, [router]);

  const heroVideos = useMemo(() => videos.slice(0, 6), [videos]);

  useEffect(() => {
    if (heroVideos.length <= 1) return;

    const interval = setInterval(() => {
      setHeroIndex(
        (current) => (current + 1) % heroVideos.length,
      );
    }, HERO_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [heroVideos.length]);

  const heroVideo = heroVideos[heroIndex];

  const heroImage = resolveMediaUrl(heroVideo?.thumbnail_url);

  const canUpload =
    session?.role === "SUPER_ADMIN" ||
    session?.role === "ADMIN";

  const canManageSystem = session?.role === "SUPER_ADMIN";

  function previousHero() {
    if (!heroVideos.length) return;

    setHeroIndex((current) =>
      current === 0 ? heroVideos.length - 1 : current - 1,
    );
  }

  function nextHero() {
    if (!heroVideos.length) return;

    setHeroIndex(
      (current) => (current + 1) % heroVideos.length,
    );
  }

  function openVideo(id?: string) {
    if (!id) return;
    router.push(`/videos/${id}`);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleLogout() {
    await removeAuthToken();
    setProfileOpen(false);
    setMenuOpen(false);
    router.replace("/");
  }

  function submitSearch() {
  const query = searchQuery.trim();

  if (!query) return;

  setSearchOpen(false);
  router.push(`/explorar?q=${encodeURIComponent(query)}`);
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

          <Pressable
            style={styles.loginButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.loginButtonText}>
              Volver al inicio
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.navbar}>
        <Pressable
          style={styles.navIconButton}
          onPress={() => setMenuOpen(true)}
          accessibilityLabel="Abrir menú"
        >
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>

        <Pressable
          style={styles.logoButton}
          onPress={() => router.replace("/organizar")}
        >
          <Image
            source={atomicaLogo}
            style={styles.logo}
            resizeMode="contain"
          />
        </Pressable>

        <View style={styles.navActions}>
          <Pressable
            style={styles.navIconButton}
            onPress={() => setSearchOpen((value) => !value)}
            accessibilityLabel="Buscar"
          >
            <Text style={styles.searchIcon}>⌕</Text>
          </Pressable>

          <Pressable
            style={styles.navIconButton}
            accessibilityLabel="Notificaciones"
          >
            <Text style={styles.bellIcon}>♢</Text>
            <View style={styles.notificationDot} />
          </Pressable>

          <Pressable
            style={styles.avatarButton}
            onPress={() => setProfileOpen(true)}
            accessibilityLabel="Abrir perfil"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {session?.name?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {searchOpen ? (
        <View style={styles.searchArea}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={submitSearch}
            placeholder="Buscar archivos"
            placeholderTextColor="#71717a"
            returnKeyType="search"
            autoFocus
            style={styles.searchInput}
          />
        </View>
      ) : null}

      <View style={styles.quickTabs}>
  <Pressable
    style={styles.quickTab}
    onPress={() => router.push("/explorar?tab=ultimos")}
  >
    <Text style={styles.quickTabText}>Últimos agregados</Text>
  </Pressable>

  <Pressable
    style={styles.quickTab}
    onPress={() => router.push("/explorar?tab=mas-vistos")}
  >
    <Text style={styles.quickTabText}>Más vistos</Text>
  </Pressable>
</View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
                  onPress={() => openVideo(heroVideo.id)}
                />
              </ImageBackground>
            ) : (
              <View style={styles.heroFallback}>
                <HeroContent
                  title={getVideoName(heroVideo)}
                  onPress={() => openVideo(heroVideo.id)}
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
                        index === heroIndex && styles.dotActive,
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
            Categorías principales
          </Text>

          <View style={styles.categoryGrid}>
            {categories.map((category) => {
              const cover = resolveMediaUrl(category.cover);

              return (
                <Pressable
                  key={category.id}
                  onPress={() =>
                    router.push(`/organizar/${category.slug}`)
                  }
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

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={closeMenu}
          />

          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerLabel}>MENÚ</Text>

              <Pressable onPress={closeMenu}>
                <Text style={styles.closeIcon}>×</Text>
              </Pressable>
            </View>

            <DrawerItem
              label="Home"
              onPress={() => {
                closeMenu();
                router.replace("/organizar");
              }}
            />

            <DrawerItem
  label="Todos los archivos"
  onPress={() => {
    closeMenu();
    router.push("/explorar");
  }}
/>

            {canUpload ? (
              <>
                <DrawerItem
                  label="Subir archivos"
                  onPress={closeMenu}
                />

                <DrawerItem
                  label="Control de cargas"
                  onPress={closeMenu}
                />
              </>
            ) : null}

            {canManageSystem ? (
              <>
                <DrawerItem
                  label="Gestionar usuarios"
                  onPress={closeMenu}
                />

                <DrawerItem
                  label="Gestionar categorías"
                  onPress={closeMenu}
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={profileOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileOpen(false)}
      >
        <Pressable
          style={styles.profileBackdrop}
          onPress={() => setProfileOpen(false)}
        >
          <View style={styles.profileMenu}>
            <Text style={styles.profileName}>
              {session?.name || "Usuario"}
            </Text>

            <Text style={styles.profileRole}>
              {session?.role || ""}
            </Text>

            <View style={styles.profileDivider} />

            <Pressable
              style={styles.profileItem}
              onPress={() => setProfileOpen(false)}
            >
              <Text style={styles.profileItemText}>Perfil</Text>
            </Pressable>

            <Pressable
              style={styles.profileItem}
              onPress={handleLogout}
            >
              <Text style={styles.profileItemText}>Salir</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function HeroContent({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.heroContent}>
      <Text style={styles.heroTitle}>{title}</Text>

      <Pressable
        style={styles.moreButton}
        onPress={onPress}
      >
        <Text style={styles.moreButtonText}>Ver más</Text>
      </Pressable>
    </View>
  );
}

function DrawerItem({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.drawerItem}
      onPress={onPress}
    >
      <Text style={styles.drawerItemText}>{label}</Text>
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
  loginButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#f97316",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  loginButtonText: {
    color: "#fb923c",
    fontWeight: "600",
  },

  navbar: {
    minHeight: 70,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#27272a",
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  navIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    color: "#fb923c",
    fontSize: 24,
  },
  logoButton: {
    flex: 1,
    alignItems: "flex-start",
  },
  logo: {
    width: 145,
    height: 48,
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    color: "#e4e4e7",
    fontSize: 27,
  },
  bellIcon: {
    color: "#e4e4e7",
    fontSize: 23,
  },
  notificationDot: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#f97316",
  },
  avatarButton: {
    paddingLeft: 3,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#52525b",
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  searchArea: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  searchInput: {
    height: 42,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 7,
    paddingHorizontal: 13,
    color: "#ffffff",
    backgroundColor: "rgba(24,24,27,0.9)",
  },

  quickTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.88)",
  },
  quickTab: {
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickTabText: {
    color: "#e4e4e7",
    fontSize: 12,
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
    borderWidth: 1,
    borderColor: "#fb923c",
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  moreButtonText: {
    color: "#fb923c",
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
    textAlign: "center",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
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
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  drawer: {
    width: "82%",
    maxWidth: 320,
    height: "100%",
    paddingTop: 52,
    paddingHorizontal: 16,
    backgroundColor: "rgba(9,9,11,0.98)",
    borderRightWidth: 1,
    borderRightColor: "#27272a",
  },
  drawerHeader: {
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drawerLabel: {
    color: "#fb923c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  closeIcon: {
    color: "#ffffff",
    fontSize: 30,
  },
  drawerItem: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  drawerItemText: {
    color: "#f4f4f5",
    fontSize: 14,
  },

  profileBackdrop: {
    flex: 1,
    alignItems: "flex-end",
    paddingTop: 72,
    paddingRight: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  profileMenu: {
    width: 220,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 9,
    paddingTop: 12,
    backgroundColor: "#18181b",
  },
  profileName: {
    paddingHorizontal: 14,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  profileRole: {
    marginTop: 3,
    paddingHorizontal: 14,
    color: "#a1a1aa",
    fontSize: 12,
  },
  profileDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    backgroundColor: "#3f3f46",
  },
  profileItem: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  profileItemText: {
    color: "#f4f4f5",
    fontSize: 14,
  },
});
