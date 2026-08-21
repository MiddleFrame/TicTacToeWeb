export type PhotonGameConfig = {
  appId: string;
  appVersion: string;
  region: string;
};

export const PHOTON_GAME_CONFIG: PhotonGameConfig = {
  appId: process.env.NEXT_PUBLIC_PHOTON_APP_ID?.trim() || "fb804bcb-3b9a-44a1-b330-c267395cb659",
  appVersion: "tttp-web-1",
  region: "EU",
};

export function isPhotonConfigured(config: PhotonGameConfig): boolean {
  return config.appId.length > 0;
}
