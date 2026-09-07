import type { CapacitorConfig } from "@capacitor/cli";
import { androidWebViewPolicy } from "./build/android-webview-policy";

const config: CapacitorConfig = {
  appId: "com.MiddleFrame.Tictactoe",
  appName: "Tic tac toe",
  webDir: "android-shell",
  loggingBehavior: "none",
  backgroundColor: "#ffffff",
  android: {
    minWebViewVersion: androidWebViewPolicy.minimumChromiumMajor,
    webContentsDebuggingEnabled: false,
  },
  server: {
    errorPath: androidWebViewPolicy.errorPage,
  },
};

export default config;
