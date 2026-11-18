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
