import { useState } from "react";
import { useLocalization } from "../../game/localization";
import { progressionCopy } from "../../game/progression-copy";
import type { CardKind } from "../../game/cards";
import type { useElementProgression } from "./hooks/useElementProgression";

export function DeckLibraryControls({ progression, selectedKinds }: { progression: ReturnType<typeof useElementProgression>; selectedKinds: CardKind[] }) {
  const { language } = useLocalization();
  const copy = progressionCopy[language];
  const { deckLibrary, busy, error, saveLibrary } = progression;
  const active = deckLibrary.decks.find((deck) => deck.id === deckLibrary.activeId)!;
  const [name, setName] = useState(active.name);
  const currentDecks = () => deckLibrary.decks.map((deck) => deck.id === active.id ? { ...deck, name: name.trim() || deck.name, kinds: selectedKinds } : deck);
  const create = () => {
    const id = crypto.randomUUID();
    void saveLibrary({ activeId: id, decks: [...currentDecks(), { id, name: String(deckLibrary.decks.length + 1), kinds: [...selectedKinds] }] });
  };
  return <section className="deck-library-controls">
    <label>{copy.deckSelect}<select value={active.id} disabled={busy} onChange={(event) => void saveLibrary({ activeId: event.target.value, decks: currentDecks() })}>
      {deckLibrary.decks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}
    </select></label>
    <label>{copy.deckName}<input value={name} maxLength={30} disabled={busy} onChange={(event) => setName(event.target.value)} onBlur={() => name.trim() !== active.name && void saveLibrary({ activeId: active.id, decks: currentDecks() })} /></label>
    <div><button className="secondary-button" disabled={busy || deckLibrary.decks.length >= 100} onClick={create}>+ {copy.newDeck}</button>
      <button className="secondary-button" disabled={busy || deckLibrary.decks.length <= 1} onClick={() => {
        const decks = deckLibrary.decks.filter((deck) => deck.id !== active.id);
        void saveLibrary({ activeId: decks[0].id, decks });
      }}>{copy.deleteDeck}</button></div>
    <p>{copy.deckRule}</p>{error && <p role="alert">{copy.failed}</p>}
  </section>;
}
