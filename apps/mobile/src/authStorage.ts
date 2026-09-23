import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "atomica_auth_token";

export async function saveAuthToken(token: string) {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function getAuthToken() {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function removeAuthToken() {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
