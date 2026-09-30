import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import type { CategoryItem } from "../api";
import { resolveMediaUrl } from "../mediaUrl";

type CategoryGridProps = {
  categories: CategoryItem[];
  title?: string;
  subtitle?: string;
  currentSlug?: string | null;
};

export default function CategoryGrid({
  categories,
  title,
  subtitle,
  currentSlug = null,
}: CategoryGridProps) {
  const router = useRouter();

  const visibleCategories = categories
    .filter((category) => category.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (visibleCategories.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {title || subtitle ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}

          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.grid}>
        {visibleCategories.map((category) => {
          const cover = resolveMediaUrl(category.cover);
          const isCurrent = category.slug === currentSlug;

          return (
            <Pressable
              key={category.id}
              disabled={isCurrent}
              onPress={() => router.push(`/organizar/${category.slug}`)}
              style={[
                styles.card,
                isCurrent && styles.cardActive,
              ]}
            >
              {cover ? (
                <ImageBackground
                  source={{ uri: cover }}
                  style={styles.image}
                  imageStyle={styles.imageRadius}
                  resizeMode="cover"
                >
                  <View style={styles.shade} />

                  <View style={styles.content}>
                    <Text style={styles.categoryTitle} numberOfLines={1}>
                      {category.label}
                    </Text>
                  </View>
                </ImageBackground>
              ) : (
                <View style={styles.fallback}>
                  <View style={styles.content}>
                    <Text style={styles.categoryTitle} numberOfLines={1}>
                      {category.label}
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 5,
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  card: {
    width: "48.3%",
    height: 150,
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#18181b",
  },
  cardActive: {
    borderColor: "#f97316",
  },
  image: {
    flex: 1,
    justifyContent: "flex-end",
  },
  imageRadius: {
    borderRadius: 10,
  },
  shade: {
    ...StyleSheet.absoluteFill,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  fallback: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#18181b",
  },
  content: {
    padding: 14,
  },
  categoryTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
