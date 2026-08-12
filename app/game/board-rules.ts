type Player = 1 | 2;
type Cell = Player | null;
type FrozenCells = Readonly<Record<number, unknown>>;

function cellAt(board: Cell[], size: number, row: number, column: number): Cell {
  if (row < 0 || column < 0 || row >= size || column >= size) return null;
  return board[row * size + column];
}

function collectLine(
  board: Cell[],
  frozen: FrozenCells,
  size: number,
  player: Player,
  row: number,
  column: number,
  rowStep: number,
  columnStep: number,
): number[] {
  const line: number[] = [];
  let currentRow = row;
  let currentColumn = column;
  while (currentRow >= 0 && currentColumn >= 0 && currentRow < size && currentColumn < size) {
    const index = currentRow * size + currentColumn;
    if (frozen[index] || cellAt(board, size, currentRow, currentColumn) !== player) break;
    line.push(index);
    currentRow += rowStep;
    currentColumn += columnStep;
  }
  return line;
}

export function findScoringCells(
  board: Cell[],
  size: number,
  player: Player,
  frozen: FrozenCells = {},
): number[] {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
  const scored = new Set<number>();
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const start = row * size + column;
      if (frozen[start] || cellAt(board, size, row, column) !== player) continue;
      directions.forEach(([rowStep, columnStep]) => {
        const previousRow = row - rowStep;
        const previousColumn = column - columnStep;
        const previousIndex = previousRow * size + previousColumn;
        const previousContinues = previousRow >= 0 && previousColumn >= 0 &&
          previousRow < size && previousColumn < size && !frozen[previousIndex] &&
          cellAt(board, size, previousRow, previousColumn) === player;
        if (previousContinues) return;
        const line = collectLine(board, frozen, size, player, row, column, rowStep, columnStep);
        if (line.length >= 3) line.forEach((index) => scored.add(index));
      });
    }
  }
  return [...scored];
}

export function orthogonalNeighbours(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const column = index % size;
  return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
    .filter(([nextRow, nextColumn]) => nextRow >= 0 && nextColumn >= 0 && nextRow < size && nextColumn < size)
    .map(([nextRow, nextColumn]) => nextRow * size + nextColumn);
}
