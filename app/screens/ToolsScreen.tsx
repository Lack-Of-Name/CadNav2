import React, { FC, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useCadNav } from '../state/CadNavContext';
import { usePager } from '../state/PagerContext';
import { calculateDistanceMeters, formatDistance } from '../utils/geo';

interface CardProps {
  title: string;
  body: string;
}

const Card: FC<CardProps> = ({ title, body }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
};

const ToolsScreen: FC = () => {
  const {
    checkpoints,
    selectedCheckpointId,
    location,
    placingCheckpoint,
    grid,
    startLocation,
    beginCheckpointPlacement,
    cancelCheckpointPlacement,
    centerOnCheckpoint,
    selectCheckpoint,
    setGridEnabled,
    setGridAnchorFromOffsetMeters,
  } = useCadNav();

  const { goToPage } = usePager();
  const { width: windowWidth } = useWindowDimensions();

  const scrollRef = useRef<ScrollView | null>(null);
  const sectionYRef = useRef<{
    checkpoints?: number;
    gridTop?: number;
    gridTools?: number;
    placement?: number;
    share?: number;
  }>({});

  const [checkpointsExpanded, setCheckpointsExpanded] = useState(true);
  const [gridExpanded, setGridExpanded] = useState(true);

  const [eastingText, setEastingText] = useState('0');
  const [northingText, setNorthingText] = useState('0');
  const [scaleMode, setScaleMode] = useState<'auto' | '1000' | '100' | '10' | '1'>('auto');
  const [referenceCoord, setReferenceCoord] = useState<null | { latitude: number; longitude: number }>(null);
  const [referenceLabel, setReferenceLabel] = useState<string | null>(null);

  const selectedIndex = selectedCheckpointId
    ? checkpoints.findIndex((c) => c.id === selectedCheckpointId)
    : -1;

  const selectedCheckpoint =
    selectedCheckpointId ? checkpoints.find((c) => c.id === selectedCheckpointId) ?? null : null;

  const parseDigits = (value: string) => value.trim().replace(/[^0-9]/g, '');
  const eDigits = parseDigits(eastingText);
  const nDigits = parseDigits(northingText);
  const eValue = eDigits ? Number.parseInt(eDigits, 10) : 0;
  const nValue = nDigits ? Number.parseInt(nDigits, 10) : 0;

  const scaleFromDigits = (digitsCount: number) => {
    // 2 digits => 1000m, 3 => 100m, 4 => 10m, 5 => 1m...
    return 10 ** (5 - Math.max(1, digitsCount));
  };

  const manualScaleMeters = Number(scaleMode);
  const eScaleMeters = scaleMode === 'auto' ? scaleFromDigits(eDigits.length || 1) : manualScaleMeters;
  const nScaleMeters = scaleMode === 'auto' ? scaleFromDigits(nDigits.length || 1) : manualScaleMeters;
  const eastingMeters = (Number.isFinite(eValue) ? eValue : 0) * eScaleMeters;
  const northingMeters = (Number.isFinite(nValue) ? nValue : 0) * nScaleMeters;
  const canApply = Boolean(referenceCoord) && eastingText.trim().length > 0 && northingText.trim().length > 0;

  const snakeLayout = useMemo(() => {
    const count = checkpoints.length;
    const gridWidth = Math.max(260, windowWidth - 32 - 28);

    const minCellWidth = windowWidth >= 1000 ? 170 : 190;
    const maxColumnsByWidth = Math.max(1, Math.floor(gridWidth / minCellWidth));
    const maxColumns = Math.min(6, maxColumnsByWidth);

    const targetRowsPerColumn = windowWidth >= 1000 ? 5 : 6;
    const columns = Math.min(maxColumns, Math.max(1, Math.ceil(count / targetRowsPerColumn)));
    const rows = Math.max(1, Math.ceil(count / columns));

    type Cell = { cp: (typeof checkpoints)[number]; index: number };
    const grid: Array<Array<Cell | null>> = Array.from({ length: columns }, () =>
      Array.from({ length: rows }, () => null)
    );

    for (let index = 0; index < count; index += 1) {
      const col = Math.floor(index / rows);
      const posInCol = index % rows;
      const row = col % 2 === 0 ? posInCol : rows - 1 - posInCol;
      if (!grid[col]) continue;
      grid[col][row] = { cp: checkpoints[index], index };
    }

    const turns = Array.from({ length: Math.max(0, columns - 1) }, (_, col) => {
      const boundaryIndex = (col + 1) * rows;
      const exists = boundaryIndex < count;
      const row = col % 2 === 0 ? rows - 1 : 0;
      return { col, row, boundaryIndex, exists };
    }).filter((t) => t.exists);

    const cellWidth = gridWidth / columns;
    const cellHeight = 72;

    return { columns, rows, grid, turns, gridWidth, cellWidth, cellHeight };
  }, [checkpoints, windowWidth]);

  const segmentDistances = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < checkpoints.length - 1; i += 1) {
      const a = checkpoints[i]?.coordinate;
      const b = checkpoints[i + 1]?.coordinate;
      if (!a || !b) {
        out.push('–');
        continue;
      }
      out.push(formatDistance(calculateDistanceMeters(a, b)));
    }
    return out;
  }, [checkpoints]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.rootContent}
      alwaysBounceVertical={false}
      ref={(r) => {
        scrollRef.current = r;
      }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Tools</Text>
        <Text style={styles.subtitle}>Full-page tools to keep the map uncluttered.</Text>
      </View>

      <View style={styles.quickJumpRow}>
        <Pressable
          style={styles.quickJumpButton}
          onPress={() => {
            setCheckpointsExpanded(true);
            const y = sectionYRef.current.checkpoints;
            if (typeof y === 'number') scrollRef.current?.scrollTo({ y, animated: true });
          }}
        >
          <Text style={styles.quickJumpText}>Checkpoints</Text>
        </Pressable>

        <Pressable
          style={styles.quickJumpButton}
          onPress={() => {
            const y = sectionYRef.current.gridTools;
            if (typeof y === 'number') scrollRef.current?.scrollTo({ y, animated: true });
          }}
        >
          <Text style={styles.quickJumpText}>Grid Tools</Text>
        </Pressable>

        <Pressable
          style={styles.quickJumpButton}
          onPress={() => {
            const y = sectionYRef.current.placement;
            if (typeof y === 'number') scrollRef.current?.scrollTo({ y, animated: true });
          }}
        >
          <Text style={styles.quickJumpText}>Placement</Text>
        </Pressable>

        <Pressable
          style={styles.quickJumpButton}
          onPress={() => {
            const y = sectionYRef.current.share;
            if (typeof y === 'number') scrollRef.current?.scrollTo({ y, animated: true });
          }}
        >
          <Text style={styles.quickJumpText}>Share</Text>
        </Pressable>
      </View>

      <View
        style={styles.section}
        onLayout={(e) => {
          sectionYRef.current.checkpoints = e.nativeEvent.layout.y;
        }}
      >
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setCheckpointsExpanded((v) => !v)}
        >
          <Text style={styles.sectionTitle}>Checkpoints</Text>
          <Text style={styles.sectionHeaderMeta}>
            {checkpoints.length} • {checkpointsExpanded ? 'Hide' : 'Show'}
          </Text>
        </Pressable>

        {checkpointsExpanded && (
          <>
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButtonPrimary, placingCheckpoint && styles.actionButtonPrimaryActive]}
                onPress={async () => {
                  if (placingCheckpoint) {
                    cancelCheckpointPlacement();
                    return;
                  }
                  await startLocation();
                  beginCheckpointPlacement();
                  goToPage(0, { animated: true });
                }}
              >
                <Text style={styles.actionTextPrimary}>
                  {placingCheckpoint ? 'Placing checkpoints' : 'Place checkpoint'}
                </Text>
                <Text style={styles.actionSubtextPrimary}>
                  {placingCheckpoint ? 'Tap the map to drop checkpoints' : 'Starts placing mode on the map'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusText}>
                {location.coordinate
                  ? `GPS: ${location.coordinate.latitude.toFixed(5)}, ${location.coordinate.longitude.toFixed(5)}`
                  : 'GPS: Off'}
              </Text>
            </View>

            {checkpoints.length === 0 ? (
              <Text style={styles.emptyText}>
                No checkpoints yet. Tap Place checkpoint, then tap the map to drop flags.
              </Text>
            ) : (
              <View style={styles.checkpointList}>
              {Array.from({ length: snakeLayout.rows }, (_, row) => {
                const rowTurns = snakeLayout.turns.filter((t) => t.row === row);

                return (
                  <View
                    key={`row-${row}`}
                    style={[styles.snakeRow, { width: snakeLayout.gridWidth, height: snakeLayout.cellHeight }]}
                  >
                    {rowTurns.map((turn) => {
                      const hasSelection = selectedIndex >= 0;
                      const active = hasSelection ? selectedIndex >= turn.boundaryIndex : false;
                      const left = turn.col * snakeLayout.cellWidth + snakeLayout.cellWidth / 2;

                      const rawWidth = snakeLayout.cellWidth;
                      const width = Math.max(0, rawWidth - 18);
                      const leftWithMargin = left + 9;

                      const segIndex = turn.boundaryIndex - 1;
                      const distanceLabel = segIndex >= 0 ? (segmentDistances[segIndex] ?? null) : null;

                      return (
                        <React.Fragment key={`turn-${row}-${turn.col}`}>
                          <View
                            pointerEvents="none"
                            style={[
                              styles.turnConnector,
                              active ? styles.railActive : styles.railInactive,
                              {
                                left: leftWithMargin,
                                width,
                                top: snakeLayout.cellHeight / 2 - 2,
                              },
                            ]}
                          />
                          {distanceLabel && (
                            <View
                              pointerEvents="none"
                              style={[
                                styles.turnLabelContainer,
                                {
                                  left: leftWithMargin,
                                  width,
                                  top: snakeLayout.cellHeight / 2 - 2,
                                },
                              ]}
                            >
                              <View style={styles.distanceLabelWrap}>
                                <Text style={styles.distanceLabelText}>{distanceLabel}</Text>
                              </View>
                            </View>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {Array.from({ length: snakeLayout.columns }, (_, col) => {
                      const cell = snakeLayout.grid[col]?.[row] ?? null;
                      const isEmpty = !cell;
                      const columnEven = col % 2 === 0;
                      const side: 'left' | 'right' = columnEven ? 'right' : 'left';

                      const hasSelection = selectedIndex >= 0;
                      const index = cell?.index ?? -1;
                      const selected = cell?.cp?.id === selectedCheckpointId;

                      const prevIndex = index - 1;
                      const nextIndex = index + 1;
                      const prevSameCol =
                        !isEmpty && prevIndex >= 0 && Math.floor(prevIndex / snakeLayout.rows) === col;
                      const nextSameCol =
                        !isEmpty &&
                        nextIndex < checkpoints.length &&
                        Math.floor(nextIndex / snakeLayout.rows) === col;

                      const needsTop = (prevSameCol && columnEven) || (nextSameCol && !columnEven);
                      const needsBottom = (nextSameCol && columnEven) || (prevSameCol && !columnEven);

                      const verticalTopActive = hasSelection && !isEmpty
                        ? selectedIndex >= (columnEven ? index : nextIndex)
                        : false;
                      const verticalBottomActive = hasSelection && !isEmpty
                        ? selectedIndex >= (columnEven ? nextIndex : index)
                        : false;

                      const dotActive = hasSelection && !isEmpty ? selectedIndex >= index : false;

                      const nextDistanceLabel = nextSameCol ? (segmentDistances[index] ?? null) : null;
                      const showDistanceTop = Boolean(nextSameCol && !columnEven);
                      const showDistanceBottom = Boolean(nextSameCol && columnEven);

                      return (
                        <View
                          key={`cell-${row}-${col}`}
                          style={[styles.snakeCell, { width: snakeLayout.cellWidth, height: snakeLayout.cellHeight }]}
                        >
                          <View style={styles.railLayer} pointerEvents="none">
                            {needsTop && (
                              <View
                                style={[
                                  styles.railVerticalTop,
                                  verticalTopActive ? styles.railActive : styles.railInactive,
                                ]}
                              />
                            )}
                            {needsBottom && (
                              <View
                                style={[
                                  styles.railVerticalBottom,
                                  verticalBottomActive ? styles.railActive : styles.railInactive,
                                ]}
                              />
                            )}

                            {!isEmpty && (
                              <View
                                style={[
                                  styles.railDot,
                                  dotActive && styles.railDotActive,
                                  selected && styles.railDotSelected,
                                ]}
                              />
                            )}
                          </View>

                          {(showDistanceTop || showDistanceBottom) && nextDistanceLabel && (
                            <View style={styles.distanceLayer} pointerEvents="none">
                              {showDistanceTop && (
                                <View style={[styles.distanceLabelWrapVertical, styles.distanceLabelTop]}>
                                  <Text style={styles.distanceLabelText}>{nextDistanceLabel}</Text>
                                </View>
                              )}
                              {showDistanceBottom && (
                                <View style={[styles.distanceLabelWrapVertical, styles.distanceLabelBottom]}>
                                  <Text style={styles.distanceLabelText}>{nextDistanceLabel}</Text>
                                </View>
                              )}
                            </View>
                          )}

                          {!isEmpty && (
                            (() => {
                              const stationMaxWidthFactor =
                                selected
                                  ? snakeLayout.columns >= 5
                                    ? 0.5
                                    : snakeLayout.columns >= 4
                                      ? 0.55
                                      : 0.65
                                  : snakeLayout.columns >= 5
                                    ? 0.3
                                    : snakeLayout.columns >= 4
                                      ? 0.34
                                      : 0.42;
                              const stationOffsetPx = snakeLayout.cellWidth / 2 + 16;
                              const stationSideStyle =
                                side === 'right'
                                  ? { left: stationOffsetPx }
                                  : { right: stationOffsetPx };

                              return (
                            <Pressable
                              style={({ pressed }) => [
                                styles.stationCard,
                                stationSideStyle,
                                selected && styles.stationCardExpanded,
                                selected && styles.stationCardSelected,
                                pressed && styles.stationCardPressed,
                                { maxWidth: snakeLayout.cellWidth * stationMaxWidthFactor },
                              ]}
                              onPress={() => {
                                selectCheckpoint(cell.cp.id);
                                centerOnCheckpoint(cell.cp.id);
                              }}
                            >
                              <Text
                                style={[
                                  styles.stationName,
                                  selected && styles.stationNameSelected,
                                  selected && styles.stationNameExpanded,
                                ]}
                                numberOfLines={selected ? 2 : 1}
                              >
                                {cell.cp.name}
                              </Text>
                              <Text
                                style={[styles.stationMeta, selected && styles.stationMetaExpanded]}
                                numberOfLines={selected ? 2 : 1}
                              >
                                {cell.cp.coordinate.latitude.toFixed(6)}, {cell.cp.coordinate.longitude.toFixed(6)}
                              </Text>
                            </Pressable>
                              );
                            })()
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              </View>
            )}
          </>
        )}
      </View>

      <View
        style={styles.grid}
        onLayout={(e) => {
          sectionYRef.current.gridTop = e.nativeEvent.layout.y;
        }}
      >
        <View
          onLayout={(e) => {
            const base = sectionYRef.current.gridTop ?? 0;
            sectionYRef.current.gridTools = base + e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.section}>
            <Pressable
              style={styles.sectionHeaderRow}
              onPress={() => setGridExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Toggle Grid Tools section"
            >
              <Text style={styles.sectionTitle}>Grid Tools</Text>
              <Text style={styles.sectionHeaderMeta}>{gridExpanded ? 'Hide' : 'Show'}</Text>
            </Pressable>

            {gridExpanded && (
              <>
                <View style={styles.gridRow}>
                  <Text style={styles.gridRowLabel}>Grid</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.gridToggle,
                      grid.enabled ? styles.gridToggleOn : styles.gridToggleOff,
                      pressed && styles.gridTogglePressed,
                    ]}
                    onPress={() => setGridEnabled(!grid.enabled)}
                    accessibilityRole="button"
                    accessibilityLabel={grid.enabled ? 'Disable grid' : 'Enable grid'}
                  >
                    <Text style={[styles.gridToggleText, grid.enabled && styles.gridToggleTextOn]}>
                      {grid.enabled ? 'On' : 'Off'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.gridHint}>
                  Grid size: {grid.majorSpacingMeters}m • Subdivisions: {grid.minorDivisions}
                </Text>

                <View style={styles.gridOriginRow}>
                  <Text style={styles.gridRowLabel}>Scale</Text>
                  <View style={styles.scaleChips}>
                    {([
                      { key: 'auto', label: 'Auto' },
                      { key: '1000', label: '1km' },
                      { key: '100', label: '100m' },
                      { key: '10', label: '10m' },
                      { key: '1', label: '1m' },
                    ] as const).map((opt) => {
                      const active = scaleMode === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          style={({ pressed }) => [
                            styles.scaleChip,
                            active && styles.scaleChipActive,
                            pressed && styles.scaleChipPressed,
                          ]}
                          onPress={() => setScaleMode(opt.key)}
                          accessibilityRole="button"
                          accessibilityLabel={`Set scale ${opt.label}`}
                        >
                          <Text style={[styles.scaleChipText, active && styles.scaleChipTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.gridOriginRow}>
                  <Text style={styles.gridRowLabel}>Origin</Text>
                  <View style={styles.gridCoordInputs}>
                    <TextInput
                      value={eastingText}
                      onChangeText={setEastingText}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      placeholder="E"
                      style={styles.gridCoordInput}
                    />
                    <TextInput
                      value={northingText}
                      onChangeText={setNorthingText}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      placeholder="N"
                      style={styles.gridCoordInput}
                    />
                  </View>
                </View>

                <View style={styles.gridButtonsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.gridButton,
                      !selectedCheckpoint && styles.gridButtonDisabled,
                      pressed && styles.gridButtonPressed,
                    ]}
                    disabled={!selectedCheckpoint}
                    onPress={() => {
                      if (!selectedCheckpoint) return;
                      setReferenceCoord(selectedCheckpoint.coordinate);
                      setReferenceLabel(selectedCheckpoint.name);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Set grid origin from selected checkpoint"
                  >
                    <Text style={styles.gridButtonText}>Use selected</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.gridButton,
                      !location.coordinate && styles.gridButtonDisabled,
                      pressed && styles.gridButtonPressed,
                    ]}
                    disabled={!location.coordinate}
                    onPress={async () => {
                      await startLocation();
                      if (!location.coordinate) return;
                      setReferenceCoord(location.coordinate);
                      setReferenceLabel('My location');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Set grid origin from my location"
                  >
                    <Text style={styles.gridButtonText}>Use my location</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.gridButtonPrimary,
                      !canApply && styles.gridButtonDisabled,
                      pressed && styles.gridButtonPrimaryPressed,
                    ]}
                    disabled={!canApply}
                    onPress={() => {
                      if (!referenceCoord) return;
                      setGridAnchorFromOffsetMeters(referenceCoord, {
                        eastingMeters,
                        northingMeters,
                        eastingInput: eastingText,
                        northingInput: northingText,
                        scaleMeters: scaleMode === 'auto' ? undefined : manualScaleMeters,
                      });
                      setGridEnabled(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Apply grid offset"
                  >
                    <Text style={styles.gridButtonPrimaryText}>Apply</Text>
                  </Pressable>
                </View>

                <Text style={styles.gridStatus}>
                  {grid.anchor
                    ? `Locked: ${grid.anchor.eastingMeters.toFixed(0)}m ${grid.anchor.northingMeters.toFixed(0)}m @ ${grid.anchor.coordinate.latitude.toFixed(5)}, ${grid.anchor.coordinate.longitude.toFixed(5)}`
                    : 'Locked: Not set'}
                </Text>

                <Text style={styles.gridStatus}>
                  {referenceCoord
                    ? `Selected reference: ${referenceLabel ?? 'Point'} @ ${referenceCoord.latitude.toFixed(5)}, ${referenceCoord.longitude.toFixed(5)}`
                    : 'Selected reference: Choose a point, then Apply'}
                </Text>
              </>
            )}
          </View>
        </View>
        <View
          onLayout={(e) => {
            const base = sectionYRef.current.gridTop ?? 0;
            sectionYRef.current.placement = base + e.nativeEvent.layout.y;
          }}
        >
          <Card title="Placement" body="Bearing • Range • Offset" />
        </View>
        <View
          onLayout={(e) => {
            const base = sectionYRef.current.gridTop ?? 0;
            sectionYRef.current.share = base + e.nativeEvent.layout.y;
          }}
        >
          <Card title="Share / Export" body="QR • File • Clipboard" />
        </View>
      </View>
    </ScrollView>
  );
};

export default ToolsScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  rootContent: {
    padding: 16,
    paddingBottom: 140,
  },
  header: {
    marginTop: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#475569',
  },
  grid: {
    marginTop: 16,
    gap: 12,
  },
  section: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
  },
  quickJumpRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickJumpButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  quickJumpText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionsRow: {
    marginTop: 12,
    gap: 10,
  },
  actionButtonPrimary: {
    borderWidth: 1,
    borderColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  actionButtonPrimaryActive: {
    backgroundColor: '#0f172a',
  },
  actionTextPrimary: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  actionSubtextPrimary: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  statusRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#475569',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748b',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  checkpointList: {
    marginTop: 10,
    paddingTop: 6,
    paddingBottom: 2,
    alignItems: 'center',
  },
  snakeRow: {
    position: 'relative',
    flexDirection: 'row',
  },
  snakeCell: {
    position: 'relative',
    zIndex: 1,
  },
  railLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railVerticalTop: {
    position: 'absolute',
    width: 4,
    top: 0,
    height: '50%',
    borderRadius: 999,
  },
  railVerticalBottom: {
    position: 'absolute',
    width: 4,
    bottom: 0,
    height: '50%',
    borderRadius: 999,
  },
  railInactive: {
    backgroundColor: '#e2e8f0',
  },
  railActive: {
    backgroundColor: '#0f172a',
  },
  turnConnector: {
    position: 'absolute',
    height: 4,
    borderRadius: 999,
    zIndex: 0,
  },
  turnLabelContainer: {
    position: 'absolute',
    height: 4,
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceLabelWrap: {
    position: 'absolute',
    top: -14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 6,
  },
  distanceLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  distanceLabelWrapVertical: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -28 }],
    width: 56,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 6,
  },
  distanceLabelTop: {
    top: 6,
  },
  distanceLabelBottom: {
    bottom: 6,
  },
  distanceLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  railDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#94a3b8',
  },
  railDotActive: {
    borderColor: '#0f172a',
  },
  railDotSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#ffffff',
  },
  stationCard: {
    position: 'absolute',
    top: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    zIndex: 2,
  },
  stationCardExpanded: {
    top: 6,
    paddingVertical: 12,
  },
  stationCardPressed: {
    backgroundColor: '#f1f5f9',
  },
  stationCardSelected: {
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  stationName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  stationNameExpanded: {
    fontSize: 14,
  },
  stationNameSelected: {
    color: '#0f172a',
  },
  stationMeta: {
    marginTop: 3,
    fontSize: 12,
    color: '#475569',
  },
  stationMetaExpanded: {
    marginTop: 4,
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardBody: {
    marginTop: 4,
    fontSize: 12,
    color: '#475569',
  },

  gridRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridOriginRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  gridRowLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  gridHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#475569',
  },
  gridToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  gridToggleOn: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  gridToggleOff: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  gridTogglePressed: {
    opacity: 0.92,
  },
  gridToggleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
  },
  gridToggleTextOn: {
    color: '#ffffff',
  },
  gridCoordInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCoordInput: {
    width: 84,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  gridButtonsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  scaleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  scaleChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scaleChipActive: {
    borderColor: '#0f172a',
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  scaleChipPressed: {
    opacity: 0.92,
  },
  scaleChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  scaleChipTextActive: {
    color: '#0f172a',
  },
  gridButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  gridButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  gridButtonDisabled: {
    opacity: 0.5,
  },
  gridButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  gridButtonPrimary: {
    borderWidth: 1,
    borderColor: '#0f172a',
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  gridButtonPrimaryPressed: {
    opacity: 0.92,
  },
  gridButtonPrimaryText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  gridStatus: {
    marginTop: 10,
    fontSize: 12,
    color: '#475569',
  },
});
