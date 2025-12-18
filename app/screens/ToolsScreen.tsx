import React, { FC, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
    startLocation,
    beginCheckpointPlacement,
    cancelCheckpointPlacement,
    centerOnCheckpoint,
    selectCheckpoint,
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

  const selectedIndex = selectedCheckpointId
    ? checkpoints.findIndex((c) => c.id === selectedCheckpointId)
    : -1;

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
          <Card title="Grid Tools" body="Snap • Rotate • Scale" />
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
});
