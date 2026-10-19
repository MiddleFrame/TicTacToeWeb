import type { GameWorld } from "../../game/game-world";
import { useLocalization } from "../../game/localization";

export type WorldControlsProps = {
  world: GameWorld;
  defaultWorld: GameWorld;
  onSwitch: (world: GameWorld) => void;
  onMakeDefault: () => void;
  error: boolean;
};

export type WorldSceneProps = { worldControls: WorldControlsProps };

export function WorldControls(props: WorldControlsProps) {
  const { language } = useLocalization();
  const ru = language === "ru";
  const other = props.world === "tttp" ? "tttr" : "tttp";
  const isDefault = props.defaultWorld === props.world;
  return <nav className="world-controls" aria-label={ru ? "Выбор игры" : "Choose a game"}>
    <button className="unity-menu-button world-switch" onClick={() => props.onSwitch(other)}>
      <span aria-hidden="true">⇄</span> {ru ? "Перейти в" : "Switch to"} {other.toUpperCase()}
      <small>{other === "tttr" ? "Tic Tac Toe Roguelite" : "Tic Tac Toe Plus"}</small>
    </button>
    <button className="unity-menu-button world-default" disabled={isDefault} onClick={props.onMakeDefault}>
      {isDefault ? (ru ? "✓ Открывается при запуске" : "✓ Opens on launch") : (ru ? "Открывать по умолчанию" : "Open by default")}
    </button>
    {props.error && <p role="alert">{ru ? "Не удалось сохранить выбор. Проверьте доступ к хранилищу и повторите." : "Could not save your choice. Check storage access and try again."}</p>}
  </nav>;
}
