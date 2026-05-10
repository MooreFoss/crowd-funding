function normalizeMoneyInput(value: string) {
  return value.trim().replaceAll(",", "");
}

export function parseMoneyToFen(value: string) {
  if (typeof value !== "string") {
    throw new TypeError("Money input must be provided as a string amount.");
  }

  const normalized = normalizeMoneyInput(value);

  if (!/^[-+]?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money amount: ${value}`);
  }

  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^[-+]/, "");
  const [wholePart, decimalPart = ""] = unsigned.split(".");
  const fen = Number.parseInt(wholePart, 10) * 100 + Number.parseInt(decimalPart.padEnd(2, "0"), 10);

  return sign * fen;
}

function groupThousands(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatFenParts(fen: number) {
  const absoluteFen = Math.abs(Math.trunc(fen));
  const wholePart = Math.floor(absoluteFen / 100).toString();
  const decimalPart = (absoluteFen % 100).toString().padStart(2, "0");

  return `${groupThousands(wholePart)}.${decimalPart}`;
}

export function formatFenToYuan(fen: number) {
  const sign = fen < 0 ? "-" : "";

  return `¥ ${sign}${formatFenParts(fen)}`;
}

export function formatBalanceFen(fen: number) {
  return formatFenToYuan(fen);
}
