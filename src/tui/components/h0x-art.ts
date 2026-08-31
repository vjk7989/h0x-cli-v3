/** Original dot-matrix lettering for the terminal; no font or image dependency. */
const LETTERS = [
  ["#    ", "#    ", "# ## ", "##  #", "#   #", "#   #", "#   #"],
  [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "],
  ["     ", "     ", "#   #", " # # ", "  #  ", " # # ", "#   #"],
  ["     ", "     ", "     ", "#####", "     ", "     ", "     "],
  ["     ", "     ", " ### ", "#   #", "#    ", "#   #", " ### "],
  [" #   ", " #   ", " #   ", " #   ", " #   ", " #   ", "  ###"],
  ["  #  ", "     ", " ##  ", "  #  ", "  #  ", "  #  ", " ### "],
] as const;

export const SMALL_H0X_ART = Array.from({ length: 7 }, (_, row) =>
  LETTERS.map((letter) => letter[row]).join("  ").replaceAll("#", "\u28ff"),
);
// Widen strokes without stretching their height; terminal cells are tall.
export const FULL_H0X_ART = Array.from({ length: 7 }, (_, row) =>
  LETTERS.map((letter) =>
    letter[row]!.split("").map((cell) => cell === "#" ? "\u28ff\u28ff" : "  ").join(""),
  ).join("  "),
);
/** The rail keeps its existing six-column, three-row footprint. */
export const H0X_RAIL_ART = ["h 0 x ", ": : : ", " CLI  "] as const;
