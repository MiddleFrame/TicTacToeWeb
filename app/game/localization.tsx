"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CARD_DEFINITIONS, type CardKind } from "./cards";

export type Language = "ru" | "en";
export type Theme = "light" | "dark";

const text = {
  ru: {
    back: "Назад в меню", settings: "Настройки", options: "Параметры", playerName: "Имя игрока", language: "Язык", russian: "Русский", english: "English", sound: "Звук", soundOn: "Включён", soundOff: "Выключен", theme: "Тема", classic: "Светлая", dark: "Тёмная",
    friends: "Друзья", inDevelopment: "в разработке", bot: "Игра с ботом", roguelike: "Рогалик", multiplayer: "Мультиплеер", local: "Игра с другом", guide: "Руководство", deck: "Колода", store: "Магазин",
    newCards: "Новые карты", randomCard: "Случайная карта", collectionComplete: "Коллекция собрана", openNewCard: "Откройте новую карту", allUnlocked: "Все доступные карты уже открыты.", boughtToDeck: "Купленная карта сразу попадёт в вашу колоду.", buy50: "Купить за 50", soldOut: "Всё куплено", notEnough: "Недостаточно монет", newCard: "Новая карта", toDeck: "В колоду",
    buildDeck: "Соберите свою колоду", deckLead: "Выберите минимум 5 видов карт. Базовая карта «Поставить фигуру» добавляется в пяти экземплярах.", deckCopies: "В колоде экземпляров", saveDeck: "Сохранить колоду",
    turn: "Ход", endTurn: "Конец хода", replaceCard: "Заменить карту", hand: "Карты в руке", pause: "Пауза", resume: "Продолжить", toMenu: "В меню", mainMenu: "В главное меню", newMatch: "Новый матч", nextRound: "Следующий раунд", matchComplete: "Матч завершён", round: "Раунд", scoreByRounds: "Итог по раундам", nextBoard: "Следующее поле", mana: "мана",
    rules: "Правила", rulesTitle: "Собирайте линии картами", close: "Закрыть", health: "Здоровье игрока", board: "Игровое поле", cost: "Стоимость", dragCard: "Перетащите карту на поле",
    thawing: "Лёд разбивается", line: "Линия", roundDraw: "Раунд завершён вничью", matchDraw: "Матч завершён вничью", crosses: "Крестики", circles: "Нолики", wonMatch: "выиграли матч", wonRound: "Раунд за",
    connectFailed: "Не удалось подключиться", waitingOpponent: "Ждём соперника", connecting: "Подключаемся к Photon", roomCreated: "Комната создана. Матч начнётся, когда войдёт второй игрок.", searchingMatch: "Ищем свободный матч в европейском регионе.", returnMenu: "Вернуться в меню",
  },
  en: {
    back: "Back to menu", settings: "Settings", options: "Options", playerName: "Player name", language: "Language", russian: "Русский", english: "English", sound: "Sound", soundOn: "On", soundOff: "Off", theme: "Theme", classic: "Light", dark: "Dark",
    friends: "Friends", inDevelopment: "in development", bot: "Play with bot", roguelike: "Roguelike", multiplayer: "Multiplayer", local: "Local game", guide: "How to play", deck: "Deck", store: "Store",
    newCards: "New cards", randomCard: "Random card", collectionComplete: "Collection complete", openNewCard: "Unlock a new card", allUnlocked: "Every available card is already unlocked.", boughtToDeck: "The purchased card is added directly to your deck.", buy50: "Buy for 50", soldOut: "Sold out", notEnough: "Not enough coins", newCard: "New card", toDeck: "Add to deck",
    buildDeck: "Build your deck", deckLead: "Choose at least 5 card types. The basic Place Figure card adds five copies.", deckCopies: "Cards in deck", saveDeck: "Save deck",
    turn: "Turn", endTurn: "End turn", replaceCard: "Replace card", hand: "Cards in hand", pause: "Pause", resume: "Continue", toMenu: "Menu", mainMenu: "Main menu", newMatch: "New match", nextRound: "Next round", matchComplete: "Match complete", round: "Round", scoreByRounds: "Round score", nextBoard: "Next board", mana: "mana",
    rules: "Rules", rulesTitle: "Build lines with cards", close: "Close", health: "Player health", board: "Game board", cost: "Cost", dragCard: "Drag the card onto the board",
    thawing: "Ice is breaking", line: "Line", roundDraw: "Round ended in a draw", matchDraw: "Match ended in a draw", crosses: "Crosses", circles: "Circles", wonMatch: "won the match", wonRound: "Round won by",
    connectFailed: "Connection failed", waitingOpponent: "Waiting for an opponent", connecting: "Connecting to Photon", roomCreated: "Room created. The match starts when another player joins.", searchingMatch: "Searching for a match in the European region.", returnMenu: "Return to menu",
  },
} as const;

const englishCards: Record<CardKind, { name: string; description: string }> = {
  place: { name: "Place figure", description: "Places a figure in the selected empty cell" },
  "place-draw": { name: "Figure + card", description: "Places a figure and draws one card" },
  "random-effect": { name: "Random figure", description: "Places one random figure at the start of your next 3 turns" },
  "freeze-3": { name: "Freeze 3", description: "Freezes 3 random cells" },
  "place-5": { name: "Place 5", description: "Places 5 figures in random cells" },
  "destroy-freeze": { name: "Break ice", description: "Breaks up to 6 ice blocks and replaces them with your figures" },
  "freeze-effect": { name: "Ice for 3 turns", description: "Creates one ice block at the start of your next 3 turns" },
  "freeze-6-figures": { name: "Freeze figures", description: "Freezes up to 6 of your figures" },
  "freeze-all-mana": { name: "Mana into ice", description: "Spends all remaining mana to create 2 ice blocks per point" },
  "freeze-cell": { name: "Freeze cell", description: "Freezes the selected empty cell" },
  "full-house": { name: "Full hand", description: "Fills your hand with cards from the deck" },
  "ice-encirclement": { name: "Ice encirclement", description: "Freezes empty cells around your figure" },
  "place-around-freeze": { name: "Spread ice", description: "Creates another ice block next to every existing one" },
  "place-more": { name: "Figures for mana", description: "Spends all remaining mana to place one figure per point" },
  shortage: { name: "Draw two", description: "Draws two cards" },
  "surrounded-by-ice": { name: "Break nearby ice", description: "Breaks ice around your figure" },
};

const englishActions: Record<string, string> = {
  "Выберите карту и разыграйте её": "Choose a card and play it",
  "Фигура поставлена": "Figure placed",
  "Фигура поставлена, добрана карта": "Figure placed and one card drawn",
  "Фигура будет появляться в начале следующих 3 ходов": "A figure will appear at the start of your next 3 turns",
  "Лёд будет появляться в начале следующих 3 ходов": "Ice will appear at the start of your next 3 turns",
  "Рука заполнена картами": "Hand filled with cards",
  "Добраны две карты": "Two cards drawn",
  "Клетка заморожена": "Cell frozen",
  "Нет свободных клеток": "No empty cells",
  "Сработали эффекты начала хода": "Start-of-turn effects resolved",
  "Новый ход: мана восстановлена, добраны 2 карты": "New turn: mana restored and 2 cards drawn",
  "Одна случайная карта заменена": "One random card replaced",
};

const actionPrefixes: [string, string][] = [
  ["Линия принесла ", "Line dealt "],
  ["Размещено фигур: ", "Figures placed: "],
  ["Случайные фигуры: +", "Random figures: +"],
  ["Заморожено клеток: ", "Cells frozen: "],
  ["Создано льдин: ", "Ice created: "],
  ["Сработал эффект льда: ", "Ice effect resolved: "],
  ["Разбито льдин: ", "Ice broken: "],
  ["Заморожено ваших фигур: ", "Your figures frozen: "],
  ["Заморожено соседних клеток: ", "Neighbouring cells frozen: "],
  ["Добавлено льдин: ", "Ice added: "],
  ["Разбито льдин рядом: ", "Nearby ice broken: "],
];

function localizeAction(value: string, language: Language): string {
  if (language === "ru") return value;
  const exact = englishActions[value];
  if (exact) return exact;
  const prefix = actionPrefixes.find(([source]) => value.startsWith(source));
  if (!prefix) return value;
  const translated = `${prefix[1]}${value.slice(prefix[0].length)}`;
  return translated.replace(/ очк\.$/, " damage.");
}

type TranslationKey = keyof typeof text.ru;
type LocalizationValue = {
  language: Language;
  theme: Theme;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  t: (key: TranslationKey) => string;
  card: (kind: CardKind) => { name: string; description: string };
  action: (value: string) => string;
};

const LocalizationContext = createContext<LocalizationValue | null>(null);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ru");
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("tttp-language");
    const savedTheme = window.localStorage.getItem("tttp-theme");
    const timeout = window.setTimeout(() => {
      if (saved === "ru" || saved === "en") setLanguageState(saved);
      if (savedTheme === "light" || savedTheme === "dark") setThemeState(savedTheme);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
  }, [language, theme]);

  const value = useMemo<LocalizationValue>(() => ({
    language,
    theme,
    setLanguage: (next) => {
      setLanguageState(next);
      window.localStorage.setItem("tttp-language", next);
    },
    setTheme: (next) => {
      setThemeState(next);
      window.localStorage.setItem("tttp-theme", next);
    },
    t: (key) => text[language][key],
    card: (kind) => language === "en" ? englishCards[kind] : CARD_DEFINITIONS[kind],
    action: (source) => localizeAction(source, language),
  }), [language, theme]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error("LocalizationProvider is missing");
  return value;
}
