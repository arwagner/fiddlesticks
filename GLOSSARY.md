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
