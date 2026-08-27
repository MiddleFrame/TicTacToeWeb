export const photonBrowserPlugin = {
  name: "tttp-photon-browser",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (!id.replaceAll("\\", "/").endsWith(
      "/photon-realtime/photon-realtime-module.js",
    )) {
      return null;
    }

    const nodeAdapterMarker = "const wsClass = function";
    const nodeAdapterIndex = code.lastIndexOf(nodeAdapterMarker);
    if (nodeAdapterIndex < 0) {
      throw new Error("Photon browser adapter marker was not found");
    }

    return {
      code: `${code.slice(0, nodeAdapterIndex)}module.exports = Photon;\n`,
      map: null,
    };
  },
};
