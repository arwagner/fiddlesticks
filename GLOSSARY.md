# Fiddlesticks

A collection of small browser puzzles and card games. Terms are grouped by game.

## Pipes

**Tile**:
One square of the board. It has a fixed set of arms and can be rotated in place.
_Avoid_: Cell, piece

**Kind**:
The shape of a tile's arms: end (one arm), straight (two opposite), corner (two adjacent), or tee (three).
_Avoid_: Type, piece type

**Arm**:
One open side of a tile, where its pipe reaches the tile's edge.
_Avoid_: Pipe end, opening, connector

**Join**:
Two arms of neighbouring tiles that face each other.
_Avoid_: Link, connection

**Loose end**:
An arm with no join: it faces a side with no arm, or the board's edge.
_Avoid_: Leak, open end

**Source**:
The marked centre tile that lighting spreads out from.
_Avoid_: Root, server, power

**Lit**:
A tile that is connected to the source by an unbroken chain of joins.
_Avoid_: Powered, connected, filled

**Network**:
The tiles and joins that make up the puzzle. When it's solved, it's a single tree that covers every tile.
_Avoid_: Graph, circuit

**Lock**:
A mark the player puts on a tile to stop it rotating. It doesn't affect whether the puzzle is solved.
_Avoid_: Pin, freeze

**Solved**:
A board with no loose ends and every tile lit.
_Avoid_: Complete, won

## Nonogram

**Cell**:
One square of the board. It is blank until the player marks it.
_Avoid_: Square, tile

**Line**:
One row or one column of the board.
_Avoid_: Lane, strip

**Clue**:
The numbers beside a line: the lengths of its runs, in order.
_Avoid_: Hint (that is the Hint button's answer), key

**Run**:
A block of consecutive filled cells in a line's solution. Each clue number is one run.
_Avoid_: Using "run" for anything else, such as a drag across cells; Block, group

**Mark**:
What the player puts on a blank cell: fill or X. A cell can be marked once, and marks can't be undone.
_Avoid_: Paint, set

**Fill**:
A mark that says the cell is part of the picture.
_Avoid_: Shade, black

**X**:
A mark that says the cell is empty in the picture.
_Avoid_: Cross, dot, blank (a blank cell is unmarked)

**Mode**:
Which mark a left click or left drag makes: Fill or X. A right click or right drag always marks X.
_Avoid_: Tool, brush

**Drag**:
A press that moves off its start cell. It marks every cell along one line, from the start to the pointer.
_Avoid_: Run, swipe, stroke

**Mistake**:
A mark that disagrees with the solution. It is counted, and the cell shows its true value in red.
_Avoid_: Error, wrong move

**Hint**:
One blank cell that a single line's clue decides, and the line that proves it.
_Avoid_: Clue, tip

## Bridges

**Island**:
A circle on the board with a count in it. Every other cell is water.
_Avoid_: Node, dot, circle

**Count**:
The number on an island: how many bridges touch it in the solution, from 1 to 8.
_Avoid_: Number, clue (that is Nonogram's), value

**Neighbour**:
An island in the same row or column as another, with only water between them. Bridges only join
neighbours.
_Avoid_: Adjacent (neighbours can be far apart), link

**Pair**:
Two neighbours, and the place a bridge between them would go.
_Avoid_: Edge, connection

**Bridge**:
A straight line joining a pair. A pair has 0, 1 or 2 bridges, drawn as no line, one line or a double line.
Bridges never cross each other or pass over an island.
_Avoid_: Link, edge, line (on its own)

**Level**:
How many bridges a pair has: 0, 1 or 2.
_Avoid_: Weight, width

**Done island**:
An island touched by exactly its count of bridges. It is drawn in the calm done colour.
_Avoid_: Full, complete, satisfied

**Over island**:
An island touched by more bridges than its count. It is flagged in the warning colour.
_Avoid_: Overfull, broken

**Solved**:
A board where every island is done and bridges connect every island into one group.
_Avoid_: Complete, won

**Hint**:
Either one pair with more bridges than the solution, pointed out and left as it is, or one pair the solver can
settle from the bridges already laid, set to its level.
_Avoid_: Tip, clue

## Cards

Terms shared by the card games (Solitaire, FreeCell). Each game's own piles get their own section.

**Suit**:
Hearts, diamonds, clubs or spades. Hearts and diamonds are red, clubs and spades black.
_Avoid_: Colour (that is red or black), kind

**Rank**:
A card's value from Ace (1) to King (13), shown as A, 2–10, J, Q, K.
_Avoid_: Value, number

**Pip**:
The suit's symbol (♥ ♦ ♣ ♠) drawn on a card.
_Avoid_: Icon, glyph

**Index**:
A card's rank and pip printed together in a corner ("10♥"): large at the top left, smaller at the bottom
right.
_Avoid_: Label, corner

**Face**:
The side of a face-up card, showing its index.
_Avoid_: Front

**Back**:
The striped side of a face-down card.
_Avoid_: Reverse, cover

**Slot**:
A place a card can go, drawn as a dashed outline when no card is on it.
_Avoid_: Placeholder, space
