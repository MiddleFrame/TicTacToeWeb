"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CARD_DEFINITIONS, type CardKind } from "./cards";
import type { CardMechanic } from "./card-mechanics";

export type Language = "ru" | "en";
export type Theme = "light" | "dark";

const text = {
  ru: {
    back: "Назад в меню", settings: "Настройки", options: "Параметры", playerName: "Имя игрока", language: "Язык", russian: "Русский", english: "English", sound: "Звук", soundOn: "Включён", soundOff: "Выключен", theme: "Тема", classic: "Светлая", dark: "Тёмная", googleAccount: "Google-аккаунт", googleConnect: "Привязать", googleConnected: "Привязан", googleConnecting: "Подключаем", googleFailed: "Повторить", googleRelink: "Перепривязать",
    friends: "Друзья", inDevelopment: "в разработке", bot: "Игра с ботом", roguelike: "Рогалик", multiplayer: "Мультиплеер", local: "Игра с другом", guide: "Руководство", deck: "Колода", store: "Магазин",
    newCards: "Новые карты", randomCard: "Случайная карта", collectionComplete: "Коллекция собрана", openNewCard: "Откройте новую карту", allUnlocked: "Все доступные карты уже открыты.", boughtToDeck: "Купленная карта сразу попадёт в вашу колоду.", buy50: "Купить за 50", buyFive: "Купить 5 карт", soldOut: "Всё куплено", notEnough: "Недостаточно монет", progressLoading: "Загружаем прогресс", watchAd: "Посмотреть рекламу", adLoading: "Реклама загружается", adOpening: "Открываем рекламу", adUnavailable: "Реклама недоступна", adPrivacyEyebrow: "Перед первой рекламой", adPrivacyTitle: "Настройка рекламы", adPrivacyDescription: "Укажите возраст и выберите тип рекламы. Возраст хранится только на этом устройстве и нужен для безопасной настройки рекламы.", adAge: "Возраст", adMinorNotice: "Для пользователей младше 16 лет доступна только неперсонализированная реклама.", adPersonalized: "Разрешить персонализацию", adNonPersonalized: "Без персонализации", newCard: "Новая карта", toDeck: "В колоду", nextCard: "Следующая карта", showAllCards: "Показать все карты", packOpened: "Пачка открыта", yourNewCards: "Ваши новые карты", placeInDeck: "Разложить в колоду", cardsTakingPlaces: "Новые карты занимают свои места", tapToAccelerate: "Нажмите, чтобы ускорить",
    buildDeck: "Соберите свою колоду", deckLead: "Выберите минимум 5 видов карт. Базовая карта «Поставить фигуру» добавляется в пяти экземплярах.", deckCopies: "В колоде экземпляров", saveDeck: "Сохранить колоду", mechanics: "Механики карты", deckFilters: "Фильтры карт", allCards: "Все", iceCards: "Лёд", regularCards: "Обычные",
    turn: "Ход", endTurn: "Конец хода", replaceCard: "Заменить карту", hand: "Карты в руке", pause: "Пауза", resume: "Продолжить", toMenu: "В меню", mainMenu: "В главное меню", newMatch: "Новый матч", nextRound: "Следующий раунд", nextRoundAutomatic: "Следующий раунд начнётся автоматически", matchComplete: "Матч завершён", round: "Раунд", roundComplete: "Раунд завершён", scoreByRounds: "Итог по раундам", nextBoard: "Следующее поле", mana: "мана",
    rules: "Правила", rulesTitle: "Собирайте линии картами", close: "Закрыть", health: "Здоровье игрока", board: "Игровое поле", cost: "Стоимость", dragCard: "Перетащите карту на поле",
    thawing: "Лёд разбивается", line: "Линия", roundDraw: "Раунд завершён вничью", matchDraw: "Матч завершён вничью", crosses: "Крестики", circles: "Нолики", wonMatch: "выиграли матч", wonRound: "Раунд за", victory: "Победа!", defeat: "Поражение", roundVictory: "Раунд выигран!", roundDefeat: "Раунд проигран", wonCount: "выиграно", of: "из", nextChallenge: "Следующий раунд будет сложнее",
    connectFailed: "Не удалось подключиться", connectionFailedHint: "Связь не установлена. Можно сыграть с ботом или вернуться в меню.", waitingOpponent: "Ждём соперника", connecting: "Подключаемся к Photon", searchingOpponent: "Ищем соперника", opponentFound: "Соперник найден", startingMatch: "Приготовьтесь — начинаем матч.", roomCreated: "Комната готова. Матч начнётся, когда подключится второй игрок.", searchingMatch: "Ищем соперника в общем пуле игроков.", returnMenu: "Вернуться в меню",
  },
  en: {
    back: "Back to menu", settings: "Settings", options: "Options", playerName: "Player name", language: "Language", russian: "Русский", english: "English", sound: "Sound", soundOn: "On", soundOff: "Off", theme: "Theme", classic: "Light", dark: "Dark", googleAccount: "Google account", googleConnect: "Connect", googleConnected: "Connected", googleConnecting: "Connecting", googleFailed: "Try again", googleRelink: "Relink",
    friends: "Friends", inDevelopment: "in development", bot: "Play with bot", roguelike: "Roguelike", multiplayer: "Multiplayer", local: "Local game", guide: "How to play", deck: "Deck", store: "Store",
    newCards: "New cards", randomCard: "Random card", collectionComplete: "Collection complete", openNewCard: "Unlock a new card", allUnlocked: "Every available card is already unlocked.", boughtToDeck: "The purchased card is added directly to your deck.", buy50: "Buy for 50", buyFive: "Buy 5 cards", soldOut: "Sold out", notEnough: "Not enough coins", progressLoading: "Loading progress", watchAd: "Watch an ad", adLoading: "Ad is loading", adOpening: "Opening ad", adUnavailable: "Ad unavailable", adPrivacyEyebrow: "Before the first ad", adPrivacyTitle: "Ad settings", adPrivacyDescription: "Choose your age and ad type. Your age stays on this device and is used only to configure ads safely.", adAge: "Age", adMinorNotice: "Only non-personalized ads are available to users under 16.", adPersonalized: "Allow personalization", adNonPersonalized: "No personalization", newCard: "New card", toDeck: "Add to deck", nextCard: "Next card", showAllCards: "Show all cards", packOpened: "Pack opened", yourNewCards: "Your new cards", placeInDeck: "Place in deck", cardsTakingPlaces: "New cards are taking their places", tapToAccelerate: "Tap to speed up",
    buildDeck: "Build your deck", deckLead: "Choose at least 5 card types. The basic Place Figure card adds five copies.", deckCopies: "Cards in deck", saveDeck: "Save deck", mechanics: "Card mechanics", deckFilters: "Card filters", allCards: "All", iceCards: "Ice", regularCards: "Regular",
    turn: "Turn", endTurn: "End turn", replaceCard: "Replace card", hand: "Cards in hand", pause: "Pause", resume: "Continue", toMenu: "Menu", mainMenu: "Main menu", newMatch: "New match", nextRound: "Next round", nextRoundAutomatic: "The next round will start automatically", matchComplete: "Match complete", round: "Round", roundComplete: "Round complete", scoreByRounds: "Round score", nextBoard: "Next board", mana: "mana",
    rules: "Rules", rulesTitle: "Build lines with cards", close: "Close", health: "Player health", board: "Game board", cost: "Cost", dragCard: "Drag the card onto the board",
    thawing: "Ice is breaking", line: "Line", roundDraw: "Round ended in a draw", matchDraw: "Match ended in a draw", crosses: "Crosses", circles: "Circles", wonMatch: "won the match", wonRound: "Round won by", victory: "Victory!", defeat: "Defeat", roundVictory: "Round won!", roundDefeat: "Round lost", wonCount: "won", of: "of", nextChallenge: "The next round will be tougher",
    connectFailed: "Connection failed", connectionFailedHint: "The connection did not go through. You can play the bot or return to the menu.", waitingOpponent: "Waiting for an opponent", connecting: "Connecting to Photon", searchingOpponent: "Finding an opponent", opponentFound: "Opponent found", startingMatch: "Get ready — the match is starting.", roomCreated: "The room is ready. The match starts when another player joins.", searchingMatch: "Searching the shared player pool.", returnMenu: "Return to menu",
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

const mechanicText: Record<Language, Record<CardMechanic, { name: string; description: string }>> = {
  ru: {
    area: { name: "Область", description: "Эффект применяется к нескольким соседним клеткам." },
    delayed: { name: "Отложенный эффект", description: "Эффект срабатывает в начале следующих ходов." },
    destruction: { name: "Разрушение", description: "Убирает созданные ранее объекты или эффекты с поля." },
    draw: { name: "Добор", description: "Добавляет новые карты из колоды в руку." },
    ice: { name: "Лёд", description: "Замороженная клетка временно недоступна, а после оттаивания превращается в фигуру владельца льда." },
    mana: { name: "Мана", description: "Сила эффекта зависит от оставшейся маны или расходует её." },
    placement: { name: "Размещение", description: "Добавляет одну или несколько фигур на игровое поле." },
    random: { name: "Случайность", description: "Цели эффекта выбираются случайно среди доступных клеток." },
  },
  en: {
    area: { name: "Area", description: "The effect applies to several neighbouring cells." },
    delayed: { name: "Delayed effect", description: "The effect triggers at the start of later turns." },
    destruction: { name: "Destruction", description: "Removes previously created objects or effects from the board." },
    draw: { name: "Draw", description: "Adds new cards from the deck to your hand." },
    ice: { name: "Ice", description: "A frozen cell is temporarily unavailable and becomes its ice owner's figure when it thaws." },
    mana: { name: "Mana", description: "The effect consumes or scales with your remaining mana." },
    placement: { name: "Placement", description: "Adds one or more figures to the game board." },
    random: { name: "Random", description: "Targets are selected randomly from available cells." },
  },
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
  mechanic: (mechanic: CardMechanic) => { name: string; description: string };
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
    mechanic: (mechanic) => mechanicText[language][mechanic],
    action: (source) => localizeAction(source, language),
  }), [language, theme]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error("LocalizationProvider is missing");
  return value;
}
