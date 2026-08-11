import { GameClient } from "./components/GameClient";
import { LocalizationProvider } from "./game/localization";

export default function Home() {
  return <LocalizationProvider><GameClient /></LocalizationProvider>;
}
