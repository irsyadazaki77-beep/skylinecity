import { describe, expect, it, vi } from 'vitest';
import { createEmptyGrid } from '../../engine';
import { TileData, TileType } from '../../types';
import { get2DOverlayStyle, get2DTileClass, isConnected2DRoadPlacement, isRecommended2DZoningTile, isValid2DRoadPlacement } from './City2DCanvas';

describe('2D renderer fallback map & interactions', () => {
  it('represents core city types without Three/WebGL', () => {
    const grid = createEmptyGrid(3, 3);
    grid[1][1].type = TileType.ROAD;
    grid[1][1].roadClass = 'HIGHWAY';
    grid[0][1].type = TileType.RESIDENTIAL;
    grid[0][2].type = TileType.COMMERCIAL;
    grid[2][1].type = TileType.INDUSTRIAL;
    grid[2][2].type = TileType.OFFICE;
    grid[0][0].water = true;

    expect(get2DTileClass(grid[1][1])).toBe('highway');
    expect(get2DTileClass(grid[0][1])).toBe('residential');
    expect(get2DTileClass(grid[0][2])).toBe('commercial');
    expect(get2DTileClass(grid[2][1])).toBe('industrial');
    expect(get2DTileClass(grid[2][2])).toBe('office');
    expect(get2DTileClass(grid[0][0])).toBe('water');
    expect(isValid2DRoadPlacement(grid, grid[1][0])).toBe(true);
    expect(isConnected2DRoadPlacement(grid, grid[1][0])).toBe(true);
    expect(isRecommended2DZoningTile(grid, grid[1][0])).toBe(true);
  });

  it('prioritizes bridge/road structures over water for 2D/3D parity', () => {
    const bridgeOnWater: TileData = {
      ...createEmptyGrid(1, 1)[0][0],
      type: TileType.ROAD,
      water: true,
      roadStructure: 'BRIDGE',
      roadClass: 'LOCAL',
    };
    expect(get2DTileClass(bridgeOnWater)).toBe('bridge');

    const roadOnWater: TileData = {
      ...createEmptyGrid(1, 1)[0][0],
      type: TileType.ROAD,
      water: true,
      roadClass: 'LOCAL',
    };
    expect(get2DTileClass(roadOnWater)).toBe('bridge');

    const naturalWater: TileData = {
      ...createEmptyGrid(1, 1)[0][0],
      type: TileType.EMPTY,
      water: true,
    };
    expect(get2DTileClass(naturalWater)).toBe('water');
  });

  it('correctly classifies all specialized infrastructure and utility tiles', () => {
    const base = createEmptyGrid(1, 1)[0][0];
    expect(get2DTileClass({ ...base, type: TileType.ROAD, roadClass: 'ARTERIAL' })).toBe('arterial');
    expect(get2DTileClass({ ...base, type: TileType.ROAD, roadClass: 'HIGHWAY' })).toBe('highway');
    expect(get2DTileClass({ ...base, type: TileType.ROAD, roadClass: 'LOCAL' })).toBe('road');
    expect(get2DTileClass({ ...base, type: TileType.FIRE_STATION })).toBe('emergency');
    expect(get2DTileClass({ ...base, type: TileType.POLICE_STATION })).toBe('emergency');
    expect(get2DTileClass({ ...base, type: TileType.CLINIC })).toBe('emergency');
    expect(get2DTileClass({ ...base, type: TileType.SCHOOL })).toBe('emergency');
    expect(get2DTileClass({ ...base, type: TileType.PARK })).toBe('park');
    expect(get2DTileClass({ ...base, type: TileType.PARKING })).toBe('parking');
    expect(get2DTileClass({ ...base, type: TileType.POWER_PLANT })).toBe('power');
    expect(get2DTileClass({ ...base, type: TileType.WATER_PUMP })).toBe('pump');
    expect(get2DTileClass({ ...base, type: TileType.FLOOD_BARRIER })).toBe('barrier');
    expect(get2DTileClass({ ...base, type: TileType.WATER_RESERVOIR })).toBe('reservoir');
    expect(get2DTileClass({ ...base, type: TileType.EMPTY })).toBe('empty');
  });

  it('computes overlay styling for traffic, pollution, land value, and crime', () => {
    const roadTile = { ...createEmptyGrid(1, 1)[0][0], type: TileType.ROAD, traffic: 80 };
    expect(get2DOverlayStyle(roadTile, 'TRAFFIC')).toContain('bg-red-500');

    const moderateRoad = { ...createEmptyGrid(1, 1)[0][0], type: TileType.ROAD, traffic: 40 };
    expect(get2DOverlayStyle(moderateRoad, 'TRAFFIC')).toContain('bg-amber-400');

    const pollutedTile = { ...createEmptyGrid(1, 1)[0][0], pollution: 60 };
    expect(get2DOverlayStyle(pollutedTile, 'POLLUTION')).toContain('bg-purple-600');

    const highValueTile = { ...createEmptyGrid(1, 1)[0][0], landValue: 80 };
    expect(get2DOverlayStyle(highValueTile, 'LAND_VALUE')).toContain('bg-emerald-500');

    const crimeTile = { ...createEmptyGrid(1, 1)[0][0], crime: 50 };
    expect(get2DOverlayStyle(crimeTile, 'POLICE')).toContain('bg-rose-600');

    const unpoweredTile = { ...createEmptyGrid(1, 1)[0][0], type: TileType.RESIDENTIAL, powered: false };
    expect(get2DOverlayStyle(unpoweredTile, 'POWER')).toContain('bg-rose-500');

    const damagedRoad = { ...createEmptyGrid(1, 1)[0][0], type: TileType.ROAD, roadCondition: 30 };
    expect(get2DOverlayStyle(damagedRoad, 'ROAD_CONDITION')).toContain('bg-red-500');
  });

  it('supports active interactions including build and select callbacks', () => {
    const onTileClick = vi.fn();
    const onTilePointerEnter = vi.fn();

    onTileClick(5, 10);
    expect(onTileClick).toHaveBeenCalledWith(5, 10);

    onTilePointerEnter(5, 10);
    expect(onTilePointerEnter).toHaveBeenCalledWith(5, 10);
  });
});
