import { cp } from "node:fs/promises";
import type { Plugin } from "vite";

type AndroidPublicAssetsOptions = {
  source: string;
  destination: string;
};

export const androidPublicAssetsPlugin = ({
  source,
  destination,
}: AndroidPublicAssetsOptions): Plugin => ({
  name: "tttp-android-public-assets",
  async closeBundle() {
    await cp(source, destination, { recursive: true });
  },
});
