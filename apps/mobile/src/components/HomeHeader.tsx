import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const logoAtomica = require("../../assets/atomica-logo.png");

type Props = {
  onMenuPress?: () => void;
  onSearchPress?: () => void;
  onNotificationsPress?: () => void;
  onProfilePress?: () => void;
};

export default function HomeHeader({
  onMenuPress,
  onSearchPress,
  onNotificationsPress,
  onProfilePress,
}: Props) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onMenuPress}
        style={styles.actionButton}
        hitSlop={10}
      >
        <Text style={styles.actionText}>MENÚ</Text>
      </Pressable>

      <Image
        source={logoAtomica}
        style={styles.logo}
        resizeMode="contain"
      />

      <View style={styles.actions}>
        <Pressable
          onPress={onSearchPress}
          style={styles.actionButton}
          hitSlop={10}
        >
          <Text style={styles.actionText}>BUSCAR</Text>
        </Pressable>

        <Pressable
          onPress={onNotificationsPress}
          style={styles.compactButton}
          hitSlop={10}
        >
          <Text style={styles.compactText}>AVISOS</Text>
        </Pressable>

        <Pressable
          onPress={onProfilePress}
          style={styles.profileButton}
          hitSlop={10}
        >
          <Text style={styles.profileText}>P</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 72,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#27272a",
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
  },

  logo: {
    width: 92,
    height: 50,
    marginLeft: 12,
  },

  actions: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  actionButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 7,
  },

  actionText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },

  compactButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  compactText: {
    color: "#a1a1aa",
    fontSize: 9,
    fontWeight: "600",
  },

  profileButton: {
    width: 34,
    height: 34,
    marginLeft: 2,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#52525b",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b",
  },

  profileText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
