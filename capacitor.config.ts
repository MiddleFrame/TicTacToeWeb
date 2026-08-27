import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.MiddleFrame.Tictactoe",
  appName: "Tic tac toe",
  webDir: "android-shell",
  loggingBehavior: "none",
  backgroundColor: "#ffffff",
  android: {
    minWebViewVersion: 60,
    webContentsDebuggingEnabled: false,
  },
  server: {
    url: "https://tic-tac-toe-plus-alpha.stofs.chatgpt.site",
    errorPath: "offline.html",
  },
};

export default config;
