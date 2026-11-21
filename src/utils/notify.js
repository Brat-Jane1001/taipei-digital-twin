/**
 * notify - 跨平台提示（手機用 Alert，網頁版用 window.alert）
 */
import { Alert, Platform } from "react-native";

export function notify(title, message) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// 需要確認的動作：回傳 Promise<boolean>
export function confirmAction(title, message, confirmText = "OK") {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Not now", style: "cancel", onPress: () => resolve(false) },
      { text: confirmText, style: "destructive", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
