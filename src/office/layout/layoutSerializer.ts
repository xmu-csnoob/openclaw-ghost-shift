import { getColorizedSprite } from '../colorize.js';
import type {
  FloorColor,
  FurnitureInstance,
  OfficeLayout,
  PlacedFurniture,
  Seat,
  TileType as TileTypeVal,
} from '../types.js';
import {
  Direction,
  FurnitureType,
  TILE_SIZE,
  TileType,
} from '../types.js';
import { getCatalogEntry } from './furnitureCatalog.js';

/** Convert flat tile array from layout into 2D grid */
export function layoutToTileMap(layout: OfficeLayout): TileTypeVal[][] {
  const map: TileTypeVal[][] = [];
  for (let r = 0; r < layout.rows; r++) {
    const row: TileTypeVal[] = [];
    for (let c = 0; c < layout.cols; c++) {
      row.push(layout.tiles[r * layout.cols + c]);
    }
    map.push(row);
  }
  return map;
}

/** Convert placed furniture into renderable FurnitureInstance[] */
export function layoutToFurnitureInstances(furniture: PlacedFurniture[]): FurnitureInstance[] {
  // Pre-compute desk zY per tile so surface items can sort in front of desks
  const deskZByTile = new Map<string, number>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || !entry.isDesk) continue;
    const deskZY = item.row * TILE_SIZE + entry.sprite.length;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`;
        const prev = deskZByTile.get(key);
        if (prev === undefined || deskZY > prev) deskZByTile.set(key, deskZY);
      }
    }
  }

  const instances: FurnitureInstance[] = [];
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const x = item.col * TILE_SIZE;
    const y = item.row * TILE_SIZE;
    const spriteH = entry.sprite.length;
    let zY = y + spriteH;

    // Chair z-sorting: ensure characters sitting on chairs render correctly
    if (entry.category === 'chairs') {
      if (entry.orientation === 'back') {
        // Back-facing chairs render IN FRONT of the seated character
        // (the chair back visually occludes the character behind it)
        zY = (item.row + 1) * TILE_SIZE + 1;
      } else {
        // All other chairs: cap zY to first row bottom so characters
        // at any seat tile render in front of the chair
        zY = (item.row + 1) * TILE_SIZE;
      }
    }

    // Surface items render in front of the desk they sit on
    if (entry.canPlaceOnSurfaces) {
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const deskZ = deskZByTile.get(`${item.col + dc},${item.row + dr}`);
          if (deskZ !== undefined && deskZ + 0.5 > zY) zY = deskZ + 0.5;
        }
      }
    }

    // Colorize sprite if this furniture has a color override
    let sprite = entry.sprite;
    if (item.color) {
      const { h, s, b: bv, c: cv } = item.color;
      sprite = getColorizedSprite(
        `furn-${item.type}-${h}-${s}-${bv}-${cv}-${item.color.colorize ? 1 : 0}`,
        entry.sprite,
        item.color,
      );
    }

    instances.push({ sprite, x, y, zY });
  }
  return instances;
}

/** Get all tiles blocked by furniture footprints, optionally excluding a set of tiles.
 *  Skips top backgroundTiles rows so characters can walk through them. */
export function getBlockedTiles(
  furniture: PlacedFurniture[],
  excludeTiles?: Set<string>,
): Set<string> {
  const tiles = new Set<string>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const bgRows = entry.backgroundTiles || 0;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue; // skip background rows — characters can walk through
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`;
        if (excludeTiles && excludeTiles.has(key)) continue;
        tiles.add(key);
      }
    }
  }
  return tiles;
}

/** Get tiles blocked for placement purposes — skips top backgroundTiles rows per item */
export function getPlacementBlockedTiles(
  furniture: PlacedFurniture[],
  excludeUid?: string,
): Set<string> {
  const tiles = new Set<string>();
  for (const item of furniture) {
    if (item.uid === excludeUid) continue;
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const bgRows = entry.backgroundTiles || 0;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue; // skip background rows
      for (let dc = 0; dc < entry.footprintW; dc++) {
        tiles.add(`${item.col + dc},${item.row + dr}`);
      }
    }
  }
  return tiles;
}

/** Map chair orientation to character facing direction */
function orientationToFacing(orientation: string): Direction {
  switch (orientation) {
    case 'front':
      return Direction.DOWN;
    case 'back':
      return Direction.UP;
    case 'left':
      return Direction.LEFT;
    case 'right':
      return Direction.RIGHT;
    default:
      return Direction.DOWN;
  }
}

/** Generate seats from chair furniture.
 *  Facing priority: 1) chair orientation, 2) adjacent desk, 3) forward (DOWN). */
export function layoutToSeats(furniture: PlacedFurniture[]): Map<string, Seat> {
  const seats = new Map<string, Seat>();

  // Build set of all desk tiles
  const deskTiles = new Set<string>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || !entry.isDesk) continue;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        deskTiles.add(`${item.col + dc},${item.row + dr}`);
      }
    }
  }

  const dirs: Array<{ dc: number; dr: number; facing: Direction }> = [
    { dc: 0, dr: -1, facing: Direction.UP }, // desk is above chair → face UP
    { dc: 0, dr: 1, facing: Direction.DOWN }, // desk is below chair → face DOWN
    { dc: -1, dr: 0, facing: Direction.LEFT }, // desk is left of chair → face LEFT
    { dc: 1, dr: 0, facing: Direction.RIGHT }, // desk is right of chair → face RIGHT
  ];

  // For each chair, every footprint tile becomes a seat.
  // Multi-tile chairs (e.g. 2-tile couches) produce multiple seats.
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || entry.category !== 'chairs') continue;

    let seatCount = 0;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const tileCol = item.col + dc;
        const tileRow = item.row + dr;

        // Determine facing direction:
        // 1) Chair orientation takes priority
        // 2) Adjacent desk direction
        // 3) Default forward (DOWN)
        let facingDir: Direction = Direction.DOWN;
        if (entry.orientation) {
          facingDir = orientationToFacing(entry.orientation);
        } else {
          for (const d of dirs) {
            if (deskTiles.has(`${tileCol + d.dc},${tileRow + d.dr}`)) {
              facingDir = d.facing;
              break;
            }
          }
        }

        // First seat uses chair uid (backward compat), subsequent use uid:N
        const seatUid = seatCount === 0 ? item.uid : `${item.uid}:${seatCount}`;
        seats.set(seatUid, {
          uid: seatUid,
          seatCol: tileCol,
          seatRow: tileRow,
          facingDir,
          assigned: false,
        });
        seatCount++;
      }
    }
  }

  return seats;
}

/** Get the set of tiles occupied by seats (so they can be excluded from blocked tiles) */
export function getSeatTiles(seats: Map<string, Seat>): Set<string> {
  const tiles = new Set<string>();
  for (const seat of seats.values()) {
    tiles.add(`${seat.seatCol},${seat.seatRow}`);
  }
  return tiles;
}

/** Default floor colors for the two rooms */
const DEFAULT_LEFT_ROOM_COLOR: FloorColor = { h: 35, s: 30, b: 15, c: 0 }; // warm beige
const DEFAULT_RIGHT_ROOM_COLOR: FloorColor = { h: 25, s: 45, b: 5, c: 10 }; // warm brown
const DEFAULT_CARPET_COLOR: FloorColor = { h: 280, s: 40, b: -5, c: 0 }; // purple
const DEFAULT_DOORWAY_COLOR: FloorColor = { h: 35, s: 25, b: 10, c: 0 }; // tan

function buildDeskCluster(prefix: string, col: number, row: number): PlacedFurniture[] {
  return [
    { uid: `${prefix}-desk`, type: FurnitureType.DESK, col, row },
    { uid: `${prefix}-chair-top`, type: FurnitureType.CHAIR, col, row: row - 1 },
    { uid: `${prefix}-chair-bottom`, type: FurnitureType.CHAIR, col: col + 1, row: row + 2 },
    { uid: `${prefix}-chair-left`, type: FurnitureType.CHAIR, col: col - 1, row: row + 1 },
    { uid: `${prefix}-chair-right`, type: FurnitureType.CHAIR, col: col + 2, row },
    { uid: `${prefix}-pc`, type: FurnitureType.PC, col, row },
    { uid: `${prefix}-lamp`, type: FurnitureType.LAMP, col: col + 1, row },
  ];
}

/** Create the default three-wing showcase office. */
export function createDefaultLayout(): OfficeLayout {
  const cols = 28;
  const rows = 15;
  const W = TileType.WALL;
  const F1 = TileType.FLOOR_1;
  const F2 = TileType.FLOOR_2;
  const F3 = TileType.FLOOR_3;
  const F4 = TileType.FLOOR_4;
  const F6 = TileType.FLOOR_6;

  const tiles: TileTypeVal[] = [];
  const tileColors: Array<FloorColor | null> = [];
  const codeFloorColor: FloorColor = { h: 214, s: 34, b: -12, c: 8 };
  const chatFloorColor: FloorColor = { h: 34, s: 42, b: 16, c: 2 };
  const opsFloorColor: FloorColor = { h: 165, s: 26, b: -2, c: 6 };
  const hallFloorColor: FloorColor = { h: 28, s: 16, b: 8, c: 4 };
  const loungeColor: FloorColor = { h: 14, s: 32, b: 4, c: 6 };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1) {
        tiles.push(W);
        tileColors.push(null);
        continue;
      }
      if (c === 0 || c === cols - 1) {
        tiles.push(W);
        tileColors.push(null);
        continue;
      }
      if (c === 9 || c === 18) {
        if (r >= 6 && r <= 8) {
          tiles.push(F4);
          tileColors.push(hallFloorColor);
        } else {
          tiles.push(W);
          tileColors.push(null);
        }
        continue;
      }
      if (r >= 6 && r <= 8) {
        if (c >= 11 && c <= 16) {
          tiles.push(F3);
          tileColors.push(loungeColor);
        } else {
          tiles.push(F4);
          tileColors.push(hallFloorColor);
        }
        continue;
      }
      if (c < 9) {
        tiles.push(F2);
        tileColors.push(codeFloorColor);
      } else if (c < 18) {
        tiles.push(F1);
        tileColors.push(chatFloorColor);
      } else {
        tiles.push(F6);
        tileColors.push(opsFloorColor);
      }
    }
  }

  const furniture: PlacedFurniture[] = [
    { uid: 'code-whiteboard', type: FurnitureType.WHITEBOARD, col: 3, row: 0 },
    { uid: 'chat-whiteboard', type: FurnitureType.WHITEBOARD, col: 12, row: 0 },
    { uid: 'ops-whiteboard', type: FurnitureType.WHITEBOARD, col: 21, row: 0 },

    { uid: 'code-shelf-top', type: FurnitureType.BOOKSHELF, col: 1, row: 2 },
    { uid: 'code-shelf-bottom', type: FurnitureType.BOOKSHELF, col: 1, row: 10 },
    { uid: 'chat-shelf-top', type: FurnitureType.BOOKSHELF, col: 17, row: 2 },
    { uid: 'chat-shelf-bottom', type: FurnitureType.BOOKSHELF, col: 17, row: 10 },
    { uid: 'ops-shelf-top', type: FurnitureType.BOOKSHELF, col: 26, row: 2 },
    { uid: 'ops-shelf-bottom', type: FurnitureType.BOOKSHELF, col: 26, row: 10 },

    { uid: 'code-plant-nw', type: FurnitureType.PLANT, col: 1, row: 1 },
    { uid: 'code-plant-sw', type: FurnitureType.PLANT, col: 8, row: 12 },
    { uid: 'chat-plant-nw', type: FurnitureType.PLANT, col: 10, row: 1 },
    { uid: 'chat-plant-ne', type: FurnitureType.PLANT, col: 17, row: 1 },
    { uid: 'chat-plant-s', type: FurnitureType.PLANT, col: 13, row: 12 },
    { uid: 'ops-plant-ne', type: FurnitureType.PLANT, col: 26, row: 1 },
    { uid: 'ops-plant-sw', type: FurnitureType.PLANT, col: 19, row: 12 },

    { uid: 'lounge-cooler', type: FurnitureType.COOLER, col: 13, row: 7 },
    { uid: 'lounge-plant-left', type: FurnitureType.PLANT, col: 11, row: 7 },
    { uid: 'lounge-plant-right', type: FurnitureType.PLANT, col: 16, row: 7 },

    ...buildDeskCluster('code-a', 3, 2),
    ...buildDeskCluster('code-b', 3, 9),
    ...buildDeskCluster('chat-a', 12, 2),
    ...buildDeskCluster('chat-b', 12, 9),
    ...buildDeskCluster('ops-a', 21, 2),
    ...buildDeskCluster('ops-b', 21, 9),
  ];

  return { version: 1, cols, rows, tiles, tileColors, furniture };
}

/** Serialize layout to JSON string */
export function serializeLayout(layout: OfficeLayout): string {
  return JSON.stringify(layout);
}

/** Deserialize layout from JSON string, migrating old tile types if needed */
export function deserializeLayout(json: string): OfficeLayout | null {
  try {
    const obj = JSON.parse(json);
    if (obj && obj.version === 1 && Array.isArray(obj.tiles) && Array.isArray(obj.furniture)) {
      return migrateLayout(obj as OfficeLayout);
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}

/**
 * Ensure layout has tileColors. If missing, generate defaults based on tile types.
 * Exported for use by message handlers that receive layouts over the wire.
 */
export function migrateLayoutColors(layout: OfficeLayout): OfficeLayout {
  return migrateLayout(layout);
}

/**
 * Migrate old layouts that use legacy tile types (TILE_FLOOR=1, WOOD_FLOOR=2, CARPET=3, DOORWAY=4)
 * to the new pattern-based system. If tileColors is already present, no migration needed.
 */
function migrateLayout(layout: OfficeLayout): OfficeLayout {
  if (layout.tileColors && layout.tileColors.length === layout.tiles.length) {
    return layout; // Already migrated
  }

  // Check if any tiles use old values (1-4) — these map directly to FLOOR_1-4
  // but need color assignments
  const tileColors: Array<FloorColor | null> = [];
  for (const tile of layout.tiles) {
    switch (tile) {
      case 0: // WALL
        tileColors.push(null);
        break;
      case 1: // was TILE_FLOOR → FLOOR_1 beige
        tileColors.push(DEFAULT_LEFT_ROOM_COLOR);
        break;
      case 2: // was WOOD_FLOOR → FLOOR_2 brown
        tileColors.push(DEFAULT_RIGHT_ROOM_COLOR);
        break;
      case 3: // was CARPET → FLOOR_3 purple
        tileColors.push(DEFAULT_CARPET_COLOR);
        break;
      case 4: // was DOORWAY → FLOOR_4 tan
        tileColors.push(DEFAULT_DOORWAY_COLOR);
        break;
      default:
        // New tile types (5-7) without colors — use neutral gray
        tileColors.push(tile > 0 ? { h: 0, s: 0, b: 0, c: 0 } : null);
    }
  }

  return { ...layout, tileColors };
}
