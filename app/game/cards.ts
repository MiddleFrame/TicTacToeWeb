export type CardKind =
  | "place"
  | "place-draw"
  | "random-effect"
  | "freeze-3"
  | "place-5"
  | "destroy-freeze"
  | "freeze-effect"
  | "freeze-6-figures"
  | "freeze-all-mana"
  | "freeze-cell"
  | "full-house"
  | "ice-encirclement"
  | "place-around-freeze"
  | "place-more"
  | "shortage"
  | "surrounded-by-ice";

export type CardTarget = "none" | "empty" | "ally";

export interface CardInstance {
  id: string;
  kind: CardKind;
}

export interface CardDefinition {
  name: string;
  description: string;
  cost: number;
  target: CardTarget;
  image: {
    1: string;
    2: string;
  };
}

export const CARD_DEFINITIONS: Record<CardKind, CardDefinition> = {
  place: {
    name: "Поставить фигуру",
    description: "Ставит фигуру в выбранном месте на поле",
    cost: 0,
    target: "empty",
    image: {
      1: "/game/cards/place-x.png",
      2: "/game/cards/place-o.png",
    },
  },
  "place-draw": {
    name: "Фигура + карта",
    description: "Ставит фигуру и позволяет добрать одну карту",
    cost: 1,
    target: "empty",
    image: {
      1: "/game/cards/place-x.png",
      2: "/game/cards/place-o.png",
    },
  },
  "random-effect": {
    name: "Случайная фигура",
    description: "В начале следующих 3 ходов ставит случайную фигуру",
    cost: 1,
    target: "none",
    image: {
      1: "/game/cards/effect-x.png",
      2: "/game/cards/effect-o.png",
    },
  },
  "freeze-3": {
    name: "Заморозить 3",
    description: "Замораживает 3 случайные клетки",
    cost: 2,
    target: "none",
    image: {
      1: "/game/cards/freeze-3.png",
      2: "/game/cards/freeze-3.png",
    },
  },
  "place-5": {
    name: "Поставить 5",
    description: "Ставит 5 фигур в случайных местах поля",
    cost: 4,
    target: "none",
    image: {
      1: "/game/cards/place-5-x.png",
      2: "/game/cards/place-5-o.png",
    },
  },
  "destroy-freeze": {
    name: "Разбить лёд",
    description: "Уничтожает до 6 льдин и ставит на их месте ваши фигуры",
    cost: 2,
    target: "none",
    image: {
      1: "/game/cards/destroy-freeze.png",
      2: "/game/cards/destroy-freeze.png",
    },
  },
  "freeze-effect": {
    name: "Лёд на 3 хода",
    description: "В начале следующих 3 ходов появляется одна льдина",
    cost: 2,
    target: "none",
    image: {
      1: "/game/cards/freeze-effect.png",
      2: "/game/cards/freeze-effect.png",
    },
  },
  "freeze-6-figures": {
    name: "Заморозить фигуры",
    description: "Замораживает до 6 ваших фигур",
    cost: 3,
    target: "none",
    image: {
      1: "/game/cards/freeze-6-x.png",
      2: "/game/cards/freeze-6-o.png",
    },
  },
  "freeze-all-mana": {
    name: "Всю ману в лёд",
    description: "Тратит оставшуюся ману и ставит 2 льдины за единицу",
    cost: 3,
    target: "none",
    image: {
      1: "/game/cards/freeze-all-mana.png",
      2: "/game/cards/freeze-all-mana.png",
    },
  },
  "freeze-cell": {
    name: "Заморозить клетку",
    description: "Замораживает выбранную пустую клетку",
    cost: 0,
    target: "empty",
    image: {
      1: "/game/cards/freeze-cell.png",
      2: "/game/cards/freeze-cell.png",
    },
  },
  "full-house": {
    name: "Полная рука",
    description: "Заполняет руку картами из колоды",
    cost: 0,
    target: "none",
    image: {
      1: "/game/cards/full-house.png",
      2: "/game/cards/full-house.png",
    },
  },
  "ice-encirclement": {
    name: "Ледяное окружение",
    description: "Замораживает пустые клетки рядом с вашей фигурой",
    cost: 2,
    target: "ally",
    image: {
      1: "/game/cards/ice-encirclement-x.png",
      2: "/game/cards/ice-encirclement-o.png",
    },
  },
  "place-around-freeze": {
    name: "Размножить лёд",
    description: "Возле каждой льдины появляется ещё одна",
    cost: 3,
    target: "none",
    image: {
      1: "/game/cards/place-around-freeze.png",
      2: "/game/cards/place-around-freeze.png",
    },
  },
  "place-more": {
    name: "Фигуры за ману",
    description: "Тратит оставшуюся ману и ставит по одной фигуре за единицу",
    cost: 0,
    target: "none",
    image: {
      1: "/game/cards/place-more-x.png",
      2: "/game/cards/place-more-o.png",
    },
  },
  shortage: {
    name: "Добрать две",
    description: "Вы берёте две карты",
    cost: 1,
    target: "none",
    image: {
      1: "/game/cards/shortage.png",
      2: "/game/cards/shortage.png",
    },
  },
  "surrounded-by-ice": {
    name: "Разбить лёд рядом",
    description: "Уничтожает лёд вокруг вашей фигуры",
    cost: 1,
    target: "ally",
    image: {
      1: "/game/cards/surrounded-by-ice-x.png",
      2: "/game/cards/surrounded-by-ice-o.png",
    },
  },
};

export const STARTER_DECK_KINDS: readonly CardKind[] = [
  "place",
  "place",
  "random-effect",
  "place",
  "place-draw",
  "place",
  "freeze-3",
  "place",
  "place-5",
];

export const STARTER_SELECTED_KINDS: readonly CardKind[] = [
  "place",
  "random-effect",
  "place-draw",
  "freeze-3",
  "place-5",
];

export const UNLOCKABLE_CARD_KINDS: readonly CardKind[] = [
  "destroy-freeze",
  "freeze-effect",
  "freeze-6-figures",
  "freeze-all-mana",
  "freeze-cell",
  "full-house",
  "ice-encirclement",
  "place-around-freeze",
  "place-more",
  "shortage",
  "surrounded-by-ice",
];

export const DECK_BUILDING_KINDS: readonly CardKind[] = [
  ...STARTER_SELECTED_KINDS,
  ...UNLOCKABLE_CARD_KINDS,
];

export const CARD_COUNTS: Readonly<Record<CardKind, number>> = {
  place: 5,
  "place-draw": 1,
  "random-effect": 1,
  "freeze-3": 1,
  "place-5": 1,
  "destroy-freeze": 1,
  "freeze-effect": 1,
  "freeze-6-figures": 1,
  "freeze-all-mana": 1,
  "freeze-cell": 1,
  "full-house": 1,
  "ice-encirclement": 1,
  "place-around-freeze": 1,
  "place-more": 1,
  shortage: 1,
  "surrounded-by-ice": 1,
};

export function createConfiguredDeck(
  player: 1 | 2,
  selectedKinds: readonly CardKind[],
): CardInstance[] {
  const instances: CardInstance[] = [];
  selectedKinds.forEach((kind) => {
    for (let index = 0; index < CARD_COUNTS[kind]; index += 1) {
      instances.push({
        id: `${player}-${kind}-${index}`,
        kind,
      });
    }
  });
  return instances;
}

export function createExactDeck(
  player: 1 | 2,
  kinds: readonly CardKind[],
): CardInstance[] {
  return kinds.map((kind, index) => ({
    id: `${player}-exact-${kind}-${index}`,
    kind,
  }));
}

export function createDefaultDeck(player: 1 | 2): CardInstance[] {
  return STARTER_DECK_KINDS.map((kind, index) => ({
    id: `${player}-${kind}-${index}`,
    kind,
  }));
}
