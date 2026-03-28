import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  Stage,
  Layer,
  Line,
  Transformer,
  Group,
  Image as KonvaImage,
  Rect,
  Circle,
  Text,
  Shape,
} from "react-konva";
import Konva from "konva";
import { getStroke } from "perfect-freehand";
import { useStore, PASTEL_COLORS } from "../../store";
import { screenToGraph, graphToScreen } from "../../core/geo/coordinates";
import type { ImageLayer } from "../../types";

interface KonvaDrawingLayerProps {
  width: number;
  height: number;
  onPanStart?: () => void;
  stageRef?: React.RefObject<Konva.Stage>;
}

export interface KonvaDrawingLayerHandle {
  copy: () => { drawings: any[]; images: any[]; geometryObjects: any[] } | null;
  paste: (
    items?: { drawings: any[]; images: any[]; geometryObjects: any[] } | null,
  ) => void;
  hasSelection: () => boolean;
  hasCopiedItems: () => boolean;
  clearSelection: () => void;
}

// Convert Perfect Freehand stroke points to flat array for Konva
function strokeToKonvaPoints(stroke: number[][]): number[] {
  return stroke.flat();
}

// Check if a point is inside a polygon using ray casting algorithm
function isPointInPolygon(
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

// Check if a bounding box intersects with a polygon
function isBoxIntersectingPolygon(
  box: { x: number; y: number; width: number; height: number },
  polygon: Array<{ x: number; y: number }>,
): boolean {
  // Check if any corner of the box is inside the polygon
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];

  for (const corner of corners) {
    if (isPointInPolygon(corner, polygon)) {
      return true;
    }
  }

  // Check if the center is inside
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return isPointInPolygon(center, polygon);
}

// Memoized stroke component for performance
const MemoizedStroke = React.memo(
  ({
    drawing,
    screenPoints,
    isSelected,
    isHovered,
    drawingTool,
    isLassoSelecting,
    onDragEnd,
    onTransformEnd,
  }: {
    drawing: any;
    screenPoints: number[][];
    isSelected: boolean;
    isHovered: boolean;
    drawingTool: string;
    isLassoSelecting: boolean;
    onDragEnd: () => void;
    onTransformEnd: () => void;
  }) => {
    // Cache previous stroke result to avoid recalculation when only view changes
    const cachedStrokeRef = useRef<{ pointCount: number; width: number; tool: string; result: number[] } | null>(null);

    const points = useMemo(() => {
      // If drawing data hasn't changed (same point count, width, tool), reuse cached stroke
      // and just re-map to new screen coordinates
      const cache = cachedStrokeRef.current;
      if (cache && cache.pointCount === screenPoints.length && cache.width === drawing.width && cache.tool === drawing.tool) {
        // Drawing unchanged, but view changed - need to recalculate with new screen positions
        // This is unavoidable but the memo comparison prevents unnecessary calls
      }

      const stroke = getStroke(screenPoints, {
        size: drawing.width,
        thinning: 0,
        smoothing: drawing.tool === 'eraser' ? 0.2 : 0.8,
        streamline: drawing.tool === 'eraser' ? 0.2 : 0.3,
        easing: (t) => t,
        start: { taper: 0, cap: true },
        end: { taper: 0, cap: true },
      });
      const result = strokeToKonvaPoints(stroke);
      cachedStrokeRef.current = { pointCount: screenPoints.length, width: drawing.width, tool: drawing.tool, result };
      return result;
    }, [screenPoints, drawing.width, drawing.tool]);

    const groupRef = useRef<Konva.Group>(null);
    const isCachedRef = useRef(false);

    // Cache the shape as bitmap for performance - only when not selected/hovered
    useEffect(() => {
      const group = groupRef.current;
      if (!group) return;

      if (!isSelected && !isHovered && !isCachedRef.current) {
        // Cache the group as a bitmap image
        group.cache();
        isCachedRef.current = true;
      } else if ((isSelected || isHovered) && isCachedRef.current) {
        // Clear cache when selected or hovered to allow dynamic updates
        group.clearCache();
        isCachedRef.current = false;
      }
    }, [isSelected, isHovered]);

    // Update cache when points change (only if already cached)
    useEffect(() => {
      const group = groupRef.current;
      if (group && isCachedRef.current && !isSelected && !isHovered) {
        // Recache after points update
        group.clearCache();
        group.cache();
      }
    }, [points, isSelected, isHovered]);

    return (
      <Group
        ref={groupRef}
        key={drawing.id}
        id={drawing.id}
        draggable={drawingTool === "select" && !isLassoSelecting && drawing.tool !== "eraser"}
        listening={drawing.tool !== "eraser"}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
      >
        {/* Eraser hover highlight (red) - don't show for eraser strokes */}
        {isHovered && drawingTool === "eraser" && drawing.tool !== "eraser" && (
          <Line
            points={points}
            stroke="#ff4444"
            strokeWidth={drawing.tool === "highlighter" ? 0 : 4}
            lineCap="round"
            lineJoin="round"
            fill="#ff4444"
            closed={true}
            opacity={0.5}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}

        {/* Selection highlight (cyan) - don't show for eraser strokes */}
        {isSelected && drawingTool === "select" && drawing.tool !== "eraser" && (
          <Line
            points={points}
            stroke="#4ecdc4"
            strokeWidth={drawing.tool === "highlighter" ? 0 : 4}
            lineCap="round"
            lineJoin="round"
            fill="#4ecdc4"
            closed={true}
            opacity={0.3}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}

        {/* Actual stroke - hide eraser strokes in vector mode */}
        <Line
          points={points}
          stroke={drawing.color}
          strokeWidth={drawing.tool === "highlighter" ? 0 : 1}
          lineCap="round"
          lineJoin="round"
          fill={drawing.color}
          closed={true}
          opacity={drawing.tool === "highlighter" ? 0.3 : 1}
          visible={drawing.tool !== "eraser"}
          hitStrokeWidth={20}
          listening={
            !isLassoSelecting &&
            (drawingTool === "select" || drawingTool === "eraser") &&
            drawing.tool !== "eraser"
          }
          perfectDrawEnabled={false}
        />
      </Group>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for React.memo - return true if props are EQUAL (skip re-render)
    // JSON.stringify is EXPENSIVE - avoid it!

    // Quick checks first
    if (prevProps.drawing.id !== nextProps.drawing.id) return false;
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.isHovered !== nextProps.isHovered) return false;
    if (prevProps.drawingTool !== nextProps.drawingTool) return false;
    if (prevProps.isLassoSelecting !== nextProps.isLassoSelecting) return false;

    // Check drawing properties
    if (prevProps.drawing.color !== nextProps.drawing.color) return false;
    if (prevProps.drawing.width !== nextProps.drawing.width) return false;
    if (prevProps.drawing.tool !== nextProps.drawing.tool) return false;

    // Check screenPoints length first (fast)
    if (prevProps.screenPoints.length !== nextProps.screenPoints.length)
      return false;

    // If lengths are same and > 0, check first and last points only (much faster than full comparison)
    if (prevProps.screenPoints.length > 0) {
      const prevFirst = prevProps.screenPoints[0];
      const nextFirst = nextProps.screenPoints[0];
      const prevLast =
        prevProps.screenPoints[prevProps.screenPoints.length - 1];
      const nextLast =
        nextProps.screenPoints[nextProps.screenPoints.length - 1];

      if (prevFirst[0] !== nextFirst[0] || prevFirst[1] !== nextFirst[1])
        return false;
      if (prevLast[0] !== nextLast[0] || prevLast[1] !== nextLast[1])
        return false;
    }

    // Props are equal, skip re-render
    return true;
  },
);

// Component for delete button that tracks transformer bounding box
function DeleteButtonForSelection({
  transformerRef,
  onDelete,
}: {
  transformerRef: React.RefObject<Konva.Transformer>;
  onDelete: () => void;
}) {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    let animationFrameId: number;

    const updatePosition = () => {
      const transformer = transformerRef.current;
      const group = groupRef.current;
      if (!transformer || !group) return;

      const nodes = transformer.nodes();
      if (nodes.length === 0) {
        group.visible(false);
        return;
      }

      group.visible(true);

      // Calculate bounding box by getting the actual client rect in absolute coordinates
      // then convert back to layer coordinates
      const stage = transformer.getStage();
      const layer = transformer.getLayer();
      if (!stage || !layer) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      nodes.forEach((node) => {
        // Get absolute position on canvas (screen coordinates)
        const absTransform = node.getAbsoluteTransform();
        const box = node.getClientRect();

        // Transform all corners to absolute positions
        const corners = [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x + box.width, y: box.y + box.height },
          { x: box.x, y: box.y + box.height },
        ];

        corners.forEach((corner) => {
          minX = Math.min(minX, corner.x);
          minY = Math.min(minY, corner.y);
          maxX = Math.max(maxX, corner.x);
          maxY = Math.max(maxY, corner.y);
        });
      });

      // Position delete button at top-right corner with margin
      const newX = maxX + 15;
      const newY = minY - 15;

      group.position({ x: newX, y: newY });

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    updatePosition();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [transformerRef]);

  return (
    <Group
      ref={groupRef}
      listening={true}
      onClick={(e) => {
        console.log("Delete button clicked!");
        e.cancelBubble = true;
        onDelete();
      }}
      onTap={(e) => {
        console.log("Delete button tapped!");
        e.cancelBubble = true;
        onDelete();
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = "pointer";
        }
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = "default";
        }
      }}
    >
      <Circle
        radius={12}
        fill="#ff4444"
        stroke="#ffffff"
        strokeWidth={4}
        shadowColor="#000000"
        shadowBlur={4}
        shadowOpacity={0.3}
        listening={true}
      />
      <Line
        points={[-4, -4, 4, 4]}
        stroke="#ffffff"
        strokeWidth={4}
        lineCap="round"
        listening={false}
      />
      <Line
        points={[4, -4, -4, 4]}
        stroke="#ffffff"
        strokeWidth={4}
        lineCap="round"
        listening={false}
      />
    </Group>
  );
}

// Component for delete button that tracks image node position in real-time
function DeleteButton({
  imageId,
  layerRef,
  removeImage,
  setSelectedIds,
  selectedIds,
}: {
  imageId: string;
  layerRef: React.RefObject<Konva.Layer>;
  removeImage: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  selectedIds: string[];
}) {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    let animationFrameId: number;

    const updatePosition = () => {
      const layer = layerRef.current;
      const group = groupRef.current;
      if (!layer || !group) return;

      // Find the image node
      const imageNode = layer.findOne(`#${imageId}`) as Konva.Group;
      if (!imageNode) return;

      // Get actual transform from the node (includes scale from transformer)
      const x = imageNode.x();
      const y = imageNode.y();
      const scaleX = imageNode.scaleX();
      const scaleY = imageNode.scaleY();
      const rotation = (imageNode.rotation() * Math.PI) / 180;

      // Get the image size from children
      const imageShape = imageNode.findOne("Image") as Konva.Image;
      if (!imageShape) return;

      const width = imageShape.width() * scaleX;
      const height = imageShape.height() * scaleY;

      // Calculate delete button offset
      const offsetX = width / 2 + 15;
      const offsetY = -height / 2 - 25;

      // Apply rotation
      const rotatedOffsetX =
        offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation);
      const rotatedOffsetY =
        offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation);

      // Update position
      const newX = x + rotatedOffsetX;
      const newY = y + rotatedOffsetY;

      group.position({ x: newX, y: newY });

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    updatePosition();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [imageId, layerRef]);

  return (
    <Group
      ref={groupRef}
      onClick={(e) => {
        e.cancelBubble = true;
        removeImage(imageId);
        setSelectedIds(selectedIds.filter((id) => id !== imageId));
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        removeImage(imageId);
        setSelectedIds(selectedIds.filter((id) => id !== imageId));
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = "pointer";
        }
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = "default";
        }
      }}
    >
      <Circle
        radius={12}
        fill="#ff4444"
        stroke="#ffffff"
        strokeWidth={4}
        shadowColor="#000000"
        shadowBlur={4}
        shadowOpacity={0.3}
      />
      <Line
        points={[-4, -4, 4, 4]}
        stroke="#ffffff"
        strokeWidth={4}
        lineCap="round"
      />
      <Line
        points={[4, -4, -4, 4]}
        stroke="#ffffff"
        strokeWidth={4}
        lineCap="round"
      />
    </Group>
  );
}

// Component for delete button that tracks geometry object node position in real-time
function GeometryObjectDeleteButton({
  geometryObjectId,
  layerRef,
  removeGeometryObject,
  setSelectedIds,
  selectedIds,
}: {
  geometryObjectId: string;
  layerRef: React.RefObject<Konva.Layer>;
  removeGeometryObject: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  selectedIds: string[];
}) {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    let animationFrameId: number;

    const updatePosition = () => {
      const layer = layerRef.current;
      const group = groupRef.current;
      if (!layer || !group) return;

      // Find the geometry object node
      const objectNode = layer.findOne(`#${geometryObjectId}`) as Konva.Group;
      if (!objectNode) {
        return;
      }

      // Get bounding box of the geometry object
      const box = objectNode.getClientRect();

      // Position delete button at top-right corner with margin
      const newX = box.x + box.width + 15;
      const newY = box.y - 15;

      group.position({ x: newX, y: newY });

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    updatePosition();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [geometryObjectId, layerRef]);

  return (
    <Group
      ref={groupRef}
      onClick={(e) => {
        e.cancelBubble = true;
        removeGeometryObject(geometryObjectId);
        setSelectedIds(selectedIds.filter((id) => id !== geometryObjectId));
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        removeGeometryObject(geometryObjectId);
        setSelectedIds(selectedIds.filter((id) => id !== geometryObjectId));
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = "pointer";
        }
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = "default";
        }
      }}
    >
      <Circle
        radius={12}
        fill="#ff4444"
        stroke="#ffffff"
        strokeWidth={4}
        shadowColor="#000000"
        shadowBlur={4}
        shadowOpacity={0.3}
      />
      <Line
        points={[-4, -4, 4, 4]}
        stroke="#ffffff"
        strokeWidth={4}
        lineCap="round"
      />
      <Line
        points={[4, -4, -4, 4]}
        stroke="#ffffff"
        strokeWidth={4}
        lineCap="round"
      />
    </Group>
  );
}

const KonvaDrawingLayerComponent = (
  props: KonvaDrawingLayerProps,
  ref: React.ForwardedRef<KonvaDrawingLayerHandle>
) => {
  const { width, height, onPanStart, stageRef: externalStageRef } = props;
  const internalStageRef = useRef<Konva.Stage>(null);
  const stageRef = externalStageRef || internalStageRef;
  const layerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedIds = useStore((state) => state.selectedIds);
  const setSelectedIds = useStore((state) => state.setSelectedIds);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokePoints = useRef<Array<{ x: number; y: number }>>([]);
  const drawingRenderFrameRef = useRef<number | null>(null);
  const pendingDrawingUpdateRef = useRef(false);
  const [tempStrokeData, setTempStrokeData] = useState<number[] | null>(null);
  const tempStrokeRef = useRef<any>(null); // Konva Line node ref for direct updates
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionPath, setSelectionPath] = useState<
    { x: number; y: number }[] | null
  >(null);
  const [isLassoSelecting, setIsLassoSelecting] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const erasedIdsRef = useRef<Set<string>>(new Set());
  const justFinishedLassoSelectionRef = useRef(false);
  const [copiedItems, setCopiedItems] = useState<{
    drawings: any[];
    images: any[];
  } | null>(null);
  const imageCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [erasingImageId, setErasingImageId] = useState<string | null>(null);
  const eraserPathRef = useRef<Array<{ x: number; y: number }>>([]);
  const globalRasterCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Two-finger pinch/pan on the Konva Stage (highest z-index, so must handle here)
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const pinchActiveRef = useRef(false); // True from second finger down until all fingers lifted
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();
    if (!container) return;

    const getDist = (t: TouchList) => Math.sqrt(
      (t[0].clientX - t[1].clientX) ** 2 + (t[0].clientY - t[1].clientY) ** 2
    );
    const getCenter = (t: TouchList) => {
      const rect = container.getBoundingClientRect();
      return {
        x: (t[0].clientX + t[1].clientX) / 2 - rect.left,
        y: (t[0].clientY + t[1].clientY) / 2 - rect.top,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        pinchRef.current = { dist: getDist(e.touches), ...getCenter(e.touches) };
      }
      // Don't preventDefault for single finger — let Konva process it normally
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 && pinchRef.current) {
        e.preventDefault();
        const newDist = getDist(e.touches);
        const center = getCenter(e.touches);
        // Pinch zoom
        const factor = newDist / pinchRef.current.dist;
        useStore.getState().zoom(factor, center.x, center.y);
        // Pan - use getState() to avoid stale closure
        const currentScale = useStore.getState().view.scale;
        const dx = (center.x - pinchRef.current.cx) / currentScale;
        const dy = (center.y - pinchRef.current.cy) / currentScale;
        useStore.getState().pan(-dx, dy);
        pinchRef.current = { dist: newDist, cx: center.x, cy: center.y };
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
      if (e.touches.length === 0) {
        // All fingers lifted — ensure pinch state is fully reset
        pinchActiveRef.current = false;
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [stageRef]);
  const [rasterCanvasVersion, setRasterCanvasVersion] = useState(0);
  const [isErasingRaster, setIsErasingRaster] = useState(false);
  const [eraserCursorPos, setEraserCursorPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const eraserRafRef = useRef<number | null>(null);
  const pendingEraserRedraw = useRef(false);

  const view = useStore((state) => state.view);
  const drawings = useStore((state) => state.drawings);
  const addDrawing = useStore((state) => state.addDrawing);
  const updateDrawing = useStore((state) => state.updateDrawing);
  const removeDrawing = useStore((state) => state.removeDrawing);
  const drawingTool = useStore((state) => state.drawingTool);
  const setDrawingTool = useStore((state) => state.setDrawingTool);
  const penColor = useStore((state) => state.penColor);
  const penThickness = useStore((state) => state.penThickness);
  const highlighterColor = useStore((state) => state.highlighterColor);
  const highlighterThickness = useStore((state) => state.highlighterThickness);
  const eraserThickness = useStore((state) => state.eraserThickness);
  const images = useStore((state) => state.images);
  const addImage = useStore((state) => state.addImage);
  const updateImage = useStore((state) => state.updateImage);
  const removeImage = useStore((state) => state.removeImage);
  const geometryObjects = useStore((state) => state.geometryObjects);
  const addGeometryObject = useStore((state) => state.addGeometryObject);
  const updateGeometryObject = useStore((state) => state.updateGeometryObject);
  const removeGeometryObject = useStore((state) => state.removeGeometryObject);
  const geometryTool = useStore((state) => state.geometryTool);
  const creationState = useStore((state) => state.creationState);
  const pointVisibilityMode = useStore((state) => state.pointVisibilityMode);
  const shapeRenderMode = useStore((state) => state.shapeRenderMode);
  const regularPolygonDialog = useStore((state) => state.regularPolygonDialog);

  // Cache for loaded images
  const [loadedImages, setLoadedImages] = useState<
    Record<string, HTMLImageElement>
  >({});

  // Clear selection when switching to a different tool (except copy/paste)
  useEffect(() => {
    if (drawingTool !== "select" && selectedIds.length > 0) {
      console.log("Tool changed from select, clearing selection");
      setSelectedIds([]);
      setIsLassoSelecting(false);
      setSelectionPath(null);
      setIsSelecting(false);
      setSelectionRect(null);
      setDragStartPos(null);
    }
  }, [drawingTool, selectedIds.length]);

  // Convert graph coordinates to screen coordinates for rendering
  const convertStrokeToScreen = (points: Array<{ x: number; y: number }>) => {
    return points.map((p) => {
      const screen = graphToScreen(p.x, p.y, width, height, view);
      return [screen.x, screen.y];
    });
  };

  // Helper function to convert hex to rgba
  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Note: rasterizeDrawings() removed - we now draw directly to canvas in Krita style

  // Canvas constants - smaller for mobile to reduce memory usage
  const isMobileDevice = width < 768 || ('ontouchstart' in window);
  const CANVAS_SIZE = isMobileDevice ? 4000 : 10000;
  const CANVAS_CENTER = CANVAS_SIZE / 2;
  const PIXELS_PER_UNIT = isMobileDevice ? 50 : 100;

  // Graph coordinate to canvas pixel coordinate
  const graphToCanvasPixel = useCallback(
    (gx: number, gy: number): { x: number; y: number } => {
      return {
        x: CANVAS_CENTER + gx * PIXELS_PER_UNIT,
        y: CANVAS_CENTER - gy * PIXELS_PER_UNIT, // Y-axis inverted
      };
    },
    [],
  );

  // Initialize large raster canvas (Krita style)
  useEffect(() => {
    if (!globalRasterCanvasRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      globalRasterCanvasRef.current = canvas;

      console.log(
        `Created ${CANVAS_SIZE}x${CANVAS_SIZE} raster canvas (center at ${CANVAS_CENTER}, ${CANVAS_CENTER})`,
      );

      // Initialize with transparent background
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  // Track how many drawings we've already rasterized
  const rasterizedCountRef = useRef(0);

  // Helper: rasterize a single drawing onto the canvas
  const rasterizeOneDrawing = useCallback((ctx: CanvasRenderingContext2D, drawing: any) => {
    if (drawing.points.length < 2) return;

    const canvasPoints = drawing.points.map((p: any) => {
      const pixel = graphToCanvasPixel(p.x, p.y);
      return [pixel.x, pixel.y];
    });

    const canvasThickness = drawing.width * (PIXELS_PER_UNIT / view.scale);
    const stroke = getStroke(canvasPoints, {
      size: canvasThickness,
      thinning: 0,
      smoothing: drawing.tool === 'eraser' ? 0.2 : 0.8,
      streamline: drawing.tool === 'eraser' ? 0.2 : 0.3,
      easing: (t: number) => t,
      start: { taper: 0, cap: true },
      end: { taper: 0, cap: true },
    });

    if (drawing.tool === 'eraser') {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = '#000000';
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = drawing.tool === "highlighter" ? hexToRgba(drawing.color, 0.3) : drawing.color;
    }

    ctx.beginPath();
    if (stroke.length > 0) {
      ctx.moveTo(stroke[0][0], stroke[0][1]);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i][0], stroke[i][1]);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }, [graphToCanvasPixel, view.scale]);

  // Incremental rasterization: only draw new strokes, full redraw on undo
  useEffect(() => {
    const canvas = globalRasterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (drawings.length < rasterizedCountRef.current) {
      // Undo/delete happened - full redraw needed
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawings.forEach((d) => rasterizeOneDrawing(ctx, d));
      rasterizedCountRef.current = drawings.length;
    } else if (drawings.length > rasterizedCountRef.current) {
      // New strokes added - only draw the new ones
      for (let i = rasterizedCountRef.current; i < drawings.length; i++) {
        rasterizeOneDrawing(ctx, drawings[i]);
      }
      rasterizedCountRef.current = drawings.length;
    }

    setRasterCanvasVersion((prev) => prev + 1);
  }, [drawings, rasterizeOneDrawing]);

  // Update Konva layer when canvas version changes
  useEffect(() => {
    if (rasterCanvasVersion > 0) {
      layerRef.current?.batchDraw();
    }
  }, [rasterCanvasVersion]);

  // Create sceneFunc with proper closure over view, width, height
  const rasterSceneFunc = useCallback(
    (context: any, shape: any) => {
      const canvas = globalRasterCanvasRef.current;
      if (!canvas) return;

      // Use component-level constants (responsive to mobile)
      const _CANVAS_CENTER = CANVAS_CENTER;
      const _PIXELS_PER_UNIT = PIXELS_PER_UNIT;

      // Calculate current viewport bounds in graph coordinates
      const viewCenterX = view.center.x;
      const viewCenterY = view.center.y;
      const viewLeft = viewCenterX - width / 2 / (view.scale * view.scaleX);
      const viewRight = viewCenterX + width / 2 / (view.scale * view.scaleX);
      const viewTop = viewCenterY + height / 2 / (view.scale * view.scaleY);
      const viewBottom = viewCenterY - height / 2 / (view.scale * view.scaleY);

      // Convert to canvas pixel coordinates
      const topLeftX = _CANVAS_CENTER + viewLeft * _PIXELS_PER_UNIT;
      const topLeftY = _CANVAS_CENTER - viewTop * _PIXELS_PER_UNIT;
      const bottomRightX = _CANVAS_CENTER + viewRight * _PIXELS_PER_UNIT;
      const bottomRightY = _CANVAS_CENTER - viewBottom * _PIXELS_PER_UNIT;

      const cropX = topLeftX;
      const cropY = topLeftY;
      const cropWidth = bottomRightX - topLeftX;
      const cropHeight = bottomRightY - topLeftY;

      context.drawImage(
        canvas,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        width,
        height,
      );
    },
    [view, width, height],
  );

  // Note: Rasterization timer removed - we now draw directly to canvas

  // Load images when they change
  useEffect(() => {
    images.forEach((image) => {
      if (!loadedImages[image.id]) {
        const img = new window.Image();
        img.src = image.src;
        img.onload = () => {
          setLoadedImages((prev) => ({ ...prev, [image.id]: img }));
        };
      }
    });

    // Clean up images that were removed
    const currentImageIds = new Set(images.map((img) => img.id));
    setLoadedImages((prev) => {
      const filtered: Record<string, HTMLImageElement> = {};
      Object.keys(prev).forEach((id) => {
        if (currentImageIds.has(id)) {
          filtered[id] = prev[id];
        }
      });
      return filtered;
    });
  }, [images]);

  // Handle stage click - for deselection
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Don't deselect if we just finished lasso selecting
    // Need to use ref because onClick fires after onMouseUp, so isLassoSelecting is already false
    if (justFinishedLassoSelectionRef.current) {
      console.log("Prevented click from clearing lasso selection");
      return;
    }

    // If clicking on empty area, deselect all
    if (e.target === e.target.getStage()) {
      setSelectedIds([]);
      return;
    }
  };

  // Handle mouse down - start drawing or selection
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    console.log(
      "handleMouseDown called, drawingTool:",
      drawingTool,
      "target:",
      e.target.getType(),
    );

    // Start drawing with pen or highlighter
    if (drawingTool === "pen" || drawingTool === "highlighter") {
      setIsDrawing(true);
      setSelectedIds([]); // Clear selection when starting to draw
      setTempStrokeData(null); // Clear previous temp stroke
      const graphPoint = screenToGraph(pos.x, pos.y, width, height, view);
      currentStrokePoints.current = [graphPoint];
      return;
    }

    // Eraser tool - start erasing mode
    if (drawingTool === "eraser") {
      setIsErasing(true);
      erasedIdsRef.current.clear();
      eraserPathRef.current = [];

      // Start raster erasing mode
      setIsErasingRaster(true);
      eraserPathRef.current = [{ x: pos.x, y: pos.y }];
      return;
    }

    // Select tool - handle lasso selection or shape selection
    if (drawingTool === "select") {
      const clickedShape = e.target;
      if (clickedShape === stage) {
        // Clicked on empty space - prepare for potential lasso selection or click
        // pos already declared at the beginning of the function

        // Prevent starting new selection immediately after finishing one
        if (justFinishedLassoSelectionRef.current) {
          console.log(
            "Prevented new selection start - just finished selection",
          );
          return;
        }

        // Store starting position but don't start lasso yet
        // We'll determine if it's a click or drag in handleMouseMove
        setDragStartPos({ x: pos.x, y: pos.y });
      } else {
        // Clicked on a shape - find the parent Group
        let currentNode = clickedShape;
        let group = null;

        // Traverse up the tree to find a Group with an ID (but stop at Layer/Stage)
        while (currentNode && currentNode.getType() !== "Layer" && currentNode.getType() !== "Stage") {
          if (currentNode.getType() === "Group" && currentNode.id()) {
            group = currentNode;
            break;
          }
          currentNode = currentNode.getParent();
        }

        console.log("Clicked shape:", {
          targetType: clickedShape.getType(),
          targetName: clickedShape.name(),
          targetId: clickedShape.id(),
          parentType: clickedShape.getParent()?.getType(),
          foundGroupType: group?.getType(),
          foundGroupId: group?.id(),
          groupChildren: group?.children?.length,
        });

        if (group && group.id()) {
          const id = group.id();
          console.log("Selected ID:", id, "Current selectedIds:", selectedIds);

          if (e.evt.shiftKey) {
            // Multi-select with Shift
            if (selectedIds.includes(id)) {
              setSelectedIds(
                selectedIds.filter((selectedId) => selectedId !== id),
              );
            } else {
              setSelectedIds([...selectedIds, id]);
            }
          } else {
            // If clicking on an already selected item and there are multiple selections,
            // don't change selection (allow dragging the group)
            if (selectedIds.includes(id) && selectedIds.length > 1) {
              console.log(
                "Clicked on already selected item in multi-selection, keeping selection",
              );
              return;
            }
            // Otherwise, single select this item
            setSelectedIds([id]);
          }
        }
      }
      return;
    }
  };

  // Handle mouse move - continue drawing or show eraser preview and delete on hover
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();

    // Update eraser cursor position - only set state when tool is eraser
    if (drawingTool === "eraser") {
      if (pos) {
        setEraserCursorPos({ x: pos.x, y: pos.y });
      }
    } else if (eraserCursorPos !== null) {
      setEraserCursorPos(null);
    }

    // Check if we should start selection (drag detected)
    if (
      dragStartPos &&
      !isLassoSelecting &&
      !isSelecting &&
      drawingTool === "select"
    ) {
      if (pos) {
        const distance = Math.sqrt(
          Math.pow(pos.x - dragStartPos.x, 2) +
            Math.pow(pos.y - dragStartPos.y, 2),
        );

        // Start selection if moved more than 5 pixels
        if (distance > 5) {
          if (!e.evt.shiftKey) {
            setSelectedIds([]);
          }

          // Use rectangle selection if Alt key is pressed, otherwise use lasso selection (default)
          if (e.evt.altKey) {
            console.log(
              "Starting rectangle selection - drag detected with Alt",
            );
            setIsSelecting(true);
            setSelectionRect({
              x1: dragStartPos.x,
              y1: dragStartPos.y,
              x2: pos.x,
              y2: pos.y,
            });
          } else {
            console.log("Starting lasso selection - drag detected");
            setIsLassoSelecting(true);
            setSelectionPath([dragStartPos, { x: pos.x, y: pos.y }]);
          }
          setDragStartPos(null); // Clear drag start pos
        }
      }
      return;
    }

    // Handle lasso selection
    if (isLassoSelecting && selectionPath) {
      const lassoPos = stage.getPointerPosition();
      if (lassoPos) {
        // Add point to path (with some distance threshold to avoid too many points)
        const lastPoint = selectionPath[selectionPath.length - 1];
        const distance = Math.sqrt(
          Math.pow(lassoPos.x - lastPoint.x, 2) + Math.pow(lassoPos.y - lastPoint.y, 2),
        );

        if (distance > 5) {
          // Only add if moved at least 5 pixels
          setSelectionPath([...selectionPath, { x: lassoPos.x, y: lassoPos.y }]);
        }
      }
      return;
    }

    // Handle rectangle selection
    if (isSelecting && selectionRect) {
      const rectPos = stage.getPointerPosition();
      if (rectPos) {
        // Update rectangle to current position
        setSelectionRect({
          x1: selectionRect.x1,
          y1: selectionRect.y1,
          x2: rectPos.x,
          y2: rectPos.y,
        });
      }
      return;
    }

    // Handle eraser - real-time pixel-level erasing
    if (drawingTool === "eraser") {
      const stage = stageRef.current;

      // Real-time erasing as mouse moves
      if (isErasingRaster && isErasing) {
        const eraserPos = stage?.getPointerPosition();
        if (eraserPos && globalRasterCanvasRef.current) {
          // Add to path for tracking
          eraserPathRef.current.push({ x: eraserPos.x, y: eraserPos.y });

          // Erase immediately on canvas
          const canvas = globalRasterCanvasRef.current;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            // Convert screen position to graph coordinates, then to canvas pixels
            const graphPoint = screenToGraph(eraserPos.x, eraserPos.y, width, height, view);
            const canvasPixel = graphToCanvasPixel(graphPoint.x, graphPoint.y);

            // Convert screen radius to canvas pixel radius
            // Screen 1px = canvas (PIXELS_PER_UNIT / view.scale) px
            const canvasEraserRadius = (eraserThickness / 2) * (PIXELS_PER_UNIT / view.scale);

            // Erase circular area
            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath();
            ctx.arc(canvasPixel.x, canvasPixel.y, canvasEraserRadius, 0, Math.PI * 2);
            ctx.fill();

            // Reset composite operation
            ctx.globalCompositeOperation = "source-over";

            // Throttle re-render to RAF to avoid state churn on every mousemove
            if (!eraserRafRef.current) {
              eraserRafRef.current = requestAnimationFrame(() => {
                setRasterCanvasVersion((prev) => prev + 1);
                eraserRafRef.current = null;
              });
            }
          }
        }
      }
      return;
    }

    if (!isDrawing || !stageRef.current) return;

    const drawPos = stageRef.current.getPointerPosition();
    if (!drawPos) return;

    const graphPoint = screenToGraph(drawPos.x, drawPos.y, width, height, view);

    // Only add point if it's far enough from the last point (reduces points)
    const lastPoint =
      currentStrokePoints.current[currentStrokePoints.current.length - 1];
    if (lastPoint) {
      const distance = Math.sqrt(
        Math.pow(graphPoint.x - lastPoint.x, 2) +
          Math.pow(graphPoint.y - lastPoint.y, 2),
      );
      // Skip if too close (reduces calculation load)
      if (distance < 0.05) return; // Increased from 0.01 for better performance
    }

    currentStrokePoints.current.push(graphPoint);
    pendingDrawingUpdateRef.current = true;

    // Use requestAnimationFrame to throttle rendering (like image dragging)
    if (drawingRenderFrameRef.current === null) {
      drawingRenderFrameRef.current = requestAnimationFrame(() => {
        if (!pendingDrawingUpdateRef.current) {
          drawingRenderFrameRef.current = null;
          return;
        }

        // Convert to screen coordinates for Perfect Freehand
        const screenPoints = convertStrokeToScreen(currentStrokePoints.current);

        // Get current tool settings
        const baseSize = drawingTool === "pen" ? penThickness : highlighterThickness;
        const size = baseSize;

        // Generate stroke with Perfect Freehand
        // Optimized settings for better responsiveness
        const stroke = getStroke(screenPoints, {
          size: size,
          thinning: 0,
          smoothing: 0.5,  // Reduced from 0.8 for better responsiveness
          streamline: 0.15,  // Reduced from 0.3 to minimize lag
          easing: (t) => t,
          start: {
            taper: 0,
            cap: true,
          },
          end: {
            taper: 0,
            cap: true,
          },
        });

        // Convert stroke to points for Konva - update node directly to skip React re-render
        const points = strokeToKonvaPoints(stroke);
        if (tempStrokeRef.current) {
          tempStrokeRef.current.points(points);
          tempStrokeRef.current.getLayer()?.batchDraw();
        } else {
          setTempStrokeData(points); // Fallback for initial render
        }

        pendingDrawingUpdateRef.current = false;
        drawingRenderFrameRef.current = null;
      });
    }
  };

  // Handle mouse up - finish drawing or lasso selection or erasing
  const handleMouseUp = useCallback(() => {
    console.log(
      "handleMouseUp called, isLassoSelecting:",
      isLassoSelecting,
      "isSelecting:",
      isSelecting,
      "selectionPath length:",
      selectionPath?.length,
    );

    // Handle click (dragStartPos is set but selection never started)
    if (
      dragStartPos &&
      !isLassoSelecting &&
      !isSelecting &&
      drawingTool === "select"
    ) {
      console.log("Click detected on empty space - deselecting all");
      setSelectedIds([]);
      setDragStartPos(null);
      return;
    }

    // Handle rectangle selection completion
    if (isSelecting && selectionRect) {
      console.log("Processing rectangle selection...");
      const selectedObjects: string[] = [];

      const rectMinX = Math.min(selectionRect.x1, selectionRect.x2);
      const rectMaxX = Math.max(selectionRect.x1, selectionRect.x2);
      const rectMinY = Math.min(selectionRect.y1, selectionRect.y2);
      const rectMaxY = Math.max(selectionRect.y1, selectionRect.y2);

      // Helper function to check if two rectangles intersect
      const isRectIntersecting = (box: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => {
        return !(
          box.x + box.width < rectMinX ||
          box.x > rectMaxX ||
          box.y + box.height < rectMinY ||
          box.y > rectMaxY
        );
      };

      // Check all drawings
      drawings.forEach((drawing) => {
        const screenPoints = drawing.points.map((p) => {
          const screen = graphToScreen(p.x, p.y, width, height, view);
          return screen;
        });

        if (screenPoints.length > 0) {
          const minX = Math.min(...screenPoints.map((p) => p.x));
          const maxX = Math.max(...screenPoints.map((p) => p.x));
          const minY = Math.min(...screenPoints.map((p) => p.y));
          const maxY = Math.max(...screenPoints.map((p) => p.y));

          const box = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          };

          if (isRectIntersecting(box)) {
            selectedObjects.push(drawing.id);
          }
        }
      });

      // Check all images
      images.forEach((image) => {
        if (image.graphPosition) {
          const centerScreen = graphToScreen(
            image.graphPosition.x,
            image.graphPosition.y,
            width,
            height,
            view,
          );

          const widthScreen =
            image.graphPosition.width * view.scale * view.scaleX;
          const heightScreen =
            image.graphPosition.height * view.scale * view.scaleY;

          const box = {
            x: centerScreen.x - widthScreen / 2,
            y: centerScreen.y - heightScreen / 2,
            width: widthScreen,
            height: heightScreen,
          };

          if (isRectIntersecting(box)) {
            selectedObjects.push(image.id);
          }
        }
      });

      // Check all geometry objects
      geometryObjects.forEach((obj) => {
        if (!obj.visible) return;

        // Check points
        if (obj.type === "point" && obj.points && obj.points.length > 0) {
          const point = obj.points[0];
          const screenPos = graphToScreen(
            point.x,
            point.y,
            width,
            height,
            view,
          );

          // Check if point is inside selection rectangle
          if (
            screenPos.x >= rectMinX &&
            screenPos.x <= rectMaxX &&
            screenPos.y >= rectMinY &&
            screenPos.y <= rectMaxY
          ) {
            selectedObjects.push(obj.id);
          }
        }

        // Check polygons
        if (obj.type === "polygon" && obj.points && obj.points.length > 0) {
          const screenPoints = obj.points.map((p) =>
            graphToScreen(p.x, p.y, width, height, view),
          );

          if (screenPoints.length > 0) {
            const minX = Math.min(...screenPoints.map((p) => p.x));
            const maxX = Math.max(...screenPoints.map((p) => p.x));
            const minY = Math.min(...screenPoints.map((p) => p.y));
            const maxY = Math.max(...screenPoints.map((p) => p.y));

            const box = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            };

            if (isRectIntersecting(box)) {
              selectedObjects.push(obj.id);
            }
          }
        }
      });

      // Remove dependency points from selection
      const dependencyPointIds = new Set<string>();
      selectedObjects.forEach((id) => {
        const obj = geometryObjects.find((o) => o.id === id);
        if (obj && obj.dependencies) {
          obj.dependencies.forEach((depId) => {
            dependencyPointIds.add(depId);
          });
        }
      });

      const filteredSelection = selectedObjects.filter(
        (id) => !dependencyPointIds.has(id),
      );

      console.log("Setting selectedIds to:", filteredSelection);
      setSelectedIds(filteredSelection);
      setIsSelecting(false);
      setSelectionRect(null);

      // Set flag to prevent handleStageClick from immediately clearing the selection
      justFinishedLassoSelectionRef.current = true;
      setTimeout(() => {
        justFinishedLassoSelectionRef.current = false;
        console.log("Cleared justFinishedSelection flag");
      }, 100);

      return;
    }

    // Handle lasso selection completion (check this first, before erasing)
    if (isLassoSelecting && selectionPath && selectionPath.length > 1) {
      console.log("Processing lasso selection...");
      const selectedObjects: string[] = [];

      // Check all drawings (use drawing data directly, not DOM nodes, to avoid viewport culling issues)
      drawings.forEach((drawing) => {
        const screenPoints = drawing.points.map((p) => {
          const screen = graphToScreen(p.x, p.y, width, height, view);
          return screen;
        });

        if (screenPoints.length > 0) {
          const minX = Math.min(...screenPoints.map((p) => p.x));
          const maxX = Math.max(...screenPoints.map((p) => p.x));
          const minY = Math.min(...screenPoints.map((p) => p.y));
          const maxY = Math.max(...screenPoints.map((p) => p.y));

          const box = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          };

          if (isBoxIntersectingPolygon(box, selectionPath)) {
            selectedObjects.push(drawing.id);
          }
        }
      });

      // Check all images (use image data directly)
      images.forEach((image) => {
        if (image.graphPosition) {
          const centerScreen = graphToScreen(
            image.graphPosition.x,
            image.graphPosition.y,
            width,
            height,
            view,
          );

          const widthScreen =
            image.graphPosition.width * view.scale * view.scaleX;
          const heightScreen =
            image.graphPosition.height * view.scale * view.scaleY;

          const box = {
            x: centerScreen.x - widthScreen / 2,
            y: centerScreen.y - heightScreen / 2,
            width: widthScreen,
            height: heightScreen,
          };

          if (isBoxIntersectingPolygon(box, selectionPath)) {
            selectedObjects.push(image.id);
          }
        }
      });

      // Check all geometry objects
      geometryObjects.forEach((obj) => {
        if (!obj.visible) return;

        // Check points
        if (obj.type === "point" && obj.points && obj.points.length > 0) {
          const point = obj.points[0];
          const screenPos = graphToScreen(
            point.x,
            point.y,
            width,
            height,
            view,
          );

          // Check if point is inside selection polygon
          if (isPointInPolygon(screenPos, selectionPath)) {
            selectedObjects.push(obj.id);
          }
        }

        // Check polygons
        if (obj.type === "polygon" && obj.points && obj.points.length > 0) {
          const screenPoints = obj.points.map((p) =>
            graphToScreen(p.x, p.y, width, height, view),
          );

          if (screenPoints.length > 0) {
            const minX = Math.min(...screenPoints.map((p) => p.x));
            const maxX = Math.max(...screenPoints.map((p) => p.x));
            const minY = Math.min(...screenPoints.map((p) => p.y));
            const maxY = Math.max(...screenPoints.map((p) => p.y));

            const box = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            };

            if (isBoxIntersectingPolygon(box, selectionPath)) {
              selectedObjects.push(obj.id);
            }
          }
        }
      });

      // Remove dependency points from selection to match click selection behavior
      // If a polygon is selected, don't also select its dependency points (vertices)
      const dependencyPointIds = new Set<string>();
      selectedObjects.forEach((id) => {
        const obj = geometryObjects.find((o) => o.id === id);
        if (obj && obj.dependencies) {
          obj.dependencies.forEach((depId) => {
            dependencyPointIds.add(depId);
          });
        }
      });

      const filteredSelection = selectedObjects.filter(
        (id) => !dependencyPointIds.has(id),
      );

      console.log("Setting selectedIds to:", filteredSelection);
      setSelectedIds(filteredSelection);
      setIsLassoSelecting(false);
      setSelectionPath(null);

      // Set flag to prevent handleStageClick from immediately clearing the selection
      // onClick fires after onMouseUp, so we need this flag to persist briefly
      justFinishedLassoSelectionRef.current = true;
      setTimeout(() => {
        justFinishedLassoSelectionRef.current = false;
        console.log("Cleared justFinishedLassoSelection flag");
      }, 100); // Clear after 100ms

      // Force layer redraw to ensure selected objects are visible
      setTimeout(() => {
        const layer = layerRef.current;
        if (layer) {
          layer.batchDraw();
        }
      }, 0);

      return;
    }

    // Handle eraser mode end - save eraser path as drawing for undo/redo
    if (isErasing) {
      console.log(
        `Eraser mouse up - ${eraserPathRef.current.length} points were erased in real-time`,
      );

      // Convert eraser path to graph coordinates and save as drawing
      if (eraserPathRef.current.length > 0) {
        const graphPoints = eraserPathRef.current.map((screenPoint) =>
          screenToGraph(screenPoint.x, screenPoint.y, width, height, view)
        );

        addDrawing({
          points: graphPoints,
          color: '#000000', // Color doesn't matter for eraser
          width: eraserThickness,
          tool: 'eraser',
        });
      }

      setIsErasing(false);
      setIsErasingRaster(false);
      setErasingImageId(null);
      erasedIdsRef.current.clear();
      eraserPathRef.current = [];
      return;
    }

    if (!isDrawing) return;

    setIsDrawing(false);

    // Cancel any pending RAF for drawing
    if (drawingRenderFrameRef.current !== null) {
      cancelAnimationFrame(drawingRenderFrameRef.current);
      drawingRenderFrameRef.current = null;
      pendingDrawingUpdateRef.current = false;
    }

    if (currentStrokePoints.current.length > 1) {
      const color = drawingTool === "pen" ? penColor : highlighterColor;
      const thickness =
        drawingTool === "pen" ? penThickness : highlighterThickness;

      console.log(
        `Saving ${currentStrokePoints.current.length} points as drawing`,
      );

      // Save drawing to store (useEffect will redraw canvas)
      addDrawing({
        points: currentStrokePoints.current,
        color: color,
        width: thickness,
        tool: drawingTool,
      });
    }

    currentStrokePoints.current = [];
  }, [
    isLassoSelecting,
    selectionPath,
    dragStartPos,
    isErasing,
    isDrawing,
    drawings,
    images,
    geometryObjects,
    drawingTool,
    penColor,
    highlighterColor,
    penThickness,
    highlighterThickness,
    erasingImageId,
    loadedImages,
    updateImage,
    width,
    height,
    view,
    graphToScreen,
    setSelectedIds,
    graphToCanvasPixel,
  ]);

  // Handle mouse leave - clean up hover state and selection
  const handleMouseLeave = useCallback(() => {
    console.log("handleMouseLeave called");
    setHoveredId(null);
    setEraserCursorPos(null); // Hide eraser cursor

    // Only finish drawing/selection if actually in progress
    if (isDrawing || isLassoSelecting || isErasing) {
      console.log("Finishing in-progress action due to mouse leave");
      handleMouseUp();
    } else {
      // Just clean up state without triggering mouseUp
      setIsLassoSelecting(false);
      setSelectionPath(null);
      setDragStartPos(null);
      setIsErasing(false);
      erasedIdsRef.current.clear();
    }
  }, [isDrawing, isLassoSelecting, isErasing, handleMouseUp]);

  // Update transformer when selection changes or view changes
  useEffect(() => {
    const transformer = transformerRef.current;
    const layer = layerRef.current;
    if (!transformer || !layer) return;

    console.log("Updating transformer, selectedIds:", selectedIds);

    // Use setTimeout to ensure nodes are rendered before finding them
    setTimeout(() => {
      // Find selected nodes, excluding division points (point-midpoint)
      const selectedNodes = selectedIds
        .filter((id) => {
          // Exclude point-midpoint from geometry objects, but include everything else
          const obj = geometryObjects.find((o) => o.id === id);
          if (obj && obj.subType === "point-midpoint") {
            return false; // Exclude midpoints
          }
          return true; // Include drawings, images, and other geometry objects
        })
        .map((id) => {
          const node = layer.findOne(`#${id}`);
          if (node) {
            console.log(`Looking for node ${id}: FOUND at position (${node.x()}, ${node.y()})`);
          } else {
            console.log(`Looking for node ${id}: NOT FOUND`);
          }
          return node;
        })
        .filter((node) => node !== undefined && node !== null);

      console.log("Selected nodes count:", selectedNodes.length);

      if (selectedNodes.length > 0) {
        transformer.nodes(selectedNodes as Konva.Node[]);
        transformer.forceUpdate();
      } else {
        transformer.nodes([]);
      }

      // Customize rotation anchor appearance
      const rotater = transformer.findOne(".rotater");
      if (rotater) {
        // Make rotation anchor circular and red (like a rotation icon)
        rotater.fill("#ff6b6b");
        rotater.stroke("#ffffff");
        rotater.strokeWidth(2);
        rotater.width(12);
        rotater.height(12);
        rotater.offsetX(6);
        rotater.offsetY(6);
        rotater.cornerRadius(6);
      }

      // Customize middle anchors (edge centers) to be rectangular
      const middleAnchors = [
        transformer.findOne(".top-center"),
        transformer.findOne(".bottom-center"),
        transformer.findOne(".middle-left"),
        transformer.findOne(".middle-right"),
      ];

      middleAnchors.forEach((anchor, index) => {
        if (anchor) {
          // Make edge center anchors rectangular instead of square
          if (index < 2) {
            // top-center, bottom-center - wider horizontally
            anchor.width(16);
            anchor.height(6);
            anchor.offsetX(8);
            anchor.offsetY(3);
          } else {
            // middle-left, middle-right - taller vertically
            anchor.width(6);
            anchor.height(16);
            anchor.offsetX(3);
            anchor.offsetY(8);
          }
          anchor.cornerRadius(2);
        }
      });

      // Customize corner anchors to be more rounded
      const cornerAnchors = [
        transformer.findOne(".top-left"),
        transformer.findOne(".top-right"),
        transformer.findOne(".bottom-left"),
        transformer.findOne(".bottom-right"),
      ];

      cornerAnchors.forEach((anchor) => {
        if (anchor) {
          anchor.cornerRadius(3);
        }
      });

      layer.batchDraw();
    }, 0);
  }, [selectedIds, view, width, height, drawings, images, geometryObjects]);

  // Reset drawing group positions after store updates
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    // Reset positions of all drawing groups to (0, 0)
    drawings.forEach((drawing) => {
      const node = layer.findOne(`#${drawing.id}`);
      if (node && (node.x() !== 0 || node.y() !== 0)) {
        node.position({ x: 0, y: 0 });
      }
    });

    layer.batchDraw();
  }, [drawings]);

  // Handle window mouseup for lasso selection (to ensure it completes even if mouse is released over an object)
  useEffect(() => {
    const handleWindowMouseUp = () => {
      console.log("Window mouseup, isLassoSelecting:", isLassoSelecting);
      if (isLassoSelecting) {
        handleMouseUp();
      }
    };

    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [isLassoSelecting, handleMouseUp]);

  // NOTE: Polygon transformer is now handled by the main transformer useEffect above
  // This separate effect was causing conflicts by overriding the main transformer

  // Copy selected items
  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return null;

    const selectedDrawings = drawings.filter((d) => selectedIds.includes(d.id));
    const selectedImages = images.filter((img) => selectedIds.includes(img.id));
    const selectedGeometryObjects = geometryObjects.filter((obj) =>
      selectedIds.includes(obj.id),
    );

    // Collect all point IDs that are referenced by the selected geometry objects
    const referencedPointIds = new Set<string>();

    selectedGeometryObjects.forEach((obj) => {
      // Collect points from linePoints
      if (obj.linePoints) {
        referencedPointIds.add(obj.linePoints.point1Id);
        referencedPointIds.add(obj.linePoints.point2Id);
      }

      // Collect points from circleConfig
      if (obj.circleConfig) {
        if (obj.circleConfig.centerId)
          referencedPointIds.add(obj.circleConfig.centerId);
        if (obj.circleConfig.radiusPointId)
          referencedPointIds.add(obj.circleConfig.radiusPointId);
        if (obj.circleConfig.point1Id)
          referencedPointIds.add(obj.circleConfig.point1Id);
        if (obj.circleConfig.point2Id)
          referencedPointIds.add(obj.circleConfig.point2Id);
        if (obj.circleConfig.point3Id)
          referencedPointIds.add(obj.circleConfig.point3Id);
      }

      // Collect points from dependencies
      if (obj.dependencies) {
        obj.dependencies.forEach((depId) => {
          const dep = geometryObjects.find((o) => o.id === depId);
          if (dep && dep.type === "point") {
            referencedPointIds.add(depId);
          }
        });
      }
    });

    // Get the actual point objects
    const referencedPoints = geometryObjects.filter(
      (obj) => obj.type === "point" && referencedPointIds.has(obj.id),
    );

    // Include referenced points in the geometry objects to copy
    const allGeometryObjectsToCopy = [
      ...referencedPoints,
      ...selectedGeometryObjects,
    ];

    const items = {
      drawings: selectedDrawings.map((d) => ({ ...d })),
      images: selectedImages.map((img) => ({ ...img })),
      geometryObjects: allGeometryObjectsToCopy.map((obj) => ({ ...obj })),
    };

    setCopiedItems(items);
    return items;
  }, [selectedIds, drawings, images, geometryObjects]);

  // Paste copied items
  const handlePaste = useCallback(
    (
      items?: {
        drawings: any[];
        images: any[];
        geometryObjects?: any[];
      } | null,
    ) => {
      // Use provided items or fall back to copiedItems
      const itemsToPaste = items || copiedItems;
      if (!itemsToPaste) return;

      const newIds: string[] = [];

      // Paste drawings at the same position (no offset)
      itemsToPaste.drawings.forEach((drawing) => {
        const newId = addDrawing({
          points: drawing.points,
          color: drawing.color,
          width: drawing.width,
          tool: drawing.tool,
        });
        newIds.push(newId);
      });

      // Paste images at the same position (no offset)
      itemsToPaste.images.forEach((image) => {
        if (image.graphPosition) {
          const newId = addImage({
            src: image.src,
            opacity: image.opacity,
            graphPosition: {
              x: image.graphPosition.x,
              y: image.graphPosition.y,
              width: image.graphPosition.width,
              height: image.graphPosition.height,
              rotation: image.graphPosition.rotation,
            },
          });
          newIds.push(newId);
        }
      });

      // Paste geometry objects - need to handle point dependencies
      if (itemsToPaste.geometryObjects) {
        // Separate points and other geometry objects
        const pointObjects = itemsToPaste.geometryObjects.filter(
          (obj: any) => obj.type === "point",
        );
        const otherObjects = itemsToPaste.geometryObjects.filter(
          (obj: any) => obj.type !== "point",
        );

        // Create a mapping from old IDs to new IDs
        const idMapping = new Map<string, string>();

        // First, create all point objects and build ID mapping
        pointObjects.forEach((obj: any) => {
          const newId = addGeometryObject({
            type: obj.type,
            subType: obj.subType,
            label: obj.label,
            color: obj.color,
            strokeWidth: obj.strokeWidth,
            fillColor: obj.fillColor,
            visible: obj.visible,
            selected: false,
            scale: obj.scale,
            points: obj.points
              ? obj.points.map((p: any) => ({ ...p }))
              : undefined,
            sliderConfig: obj.sliderConfig
              ? { ...obj.sliderConfig }
              : undefined,
            constraint: obj.constraint ? { ...obj.constraint } : undefined,
            ratio: obj.ratio ? { ...obj.ratio } : undefined,
            dependencies: obj.dependencies ? [...obj.dependencies] : undefined,
          });
          idMapping.set(obj.id, newId);
          newIds.push(newId);
        });

        // Then, create other geometry objects with updated point references
        otherObjects.forEach((obj: any) => {
          // Remap linePoints references
          let linePoints = obj.linePoints;
          if (linePoints) {
            linePoints = {
              point1Id:
                idMapping.get(linePoints.point1Id) || linePoints.point1Id,
              point2Id:
                idMapping.get(linePoints.point2Id) || linePoints.point2Id,
            };
          }

          // Remap circleConfig references
          let circleConfig = obj.circleConfig;
          if (circleConfig) {
            circleConfig = {
              centerId: circleConfig.centerId
                ? idMapping.get(circleConfig.centerId) || circleConfig.centerId
                : undefined,
              radiusPointId: circleConfig.radiusPointId
                ? idMapping.get(circleConfig.radiusPointId) ||
                  circleConfig.radiusPointId
                : undefined,
              point1Id: circleConfig.point1Id
                ? idMapping.get(circleConfig.point1Id) || circleConfig.point1Id
                : undefined,
              point2Id: circleConfig.point2Id
                ? idMapping.get(circleConfig.point2Id) || circleConfig.point2Id
                : undefined,
              point3Id: circleConfig.point3Id
                ? idMapping.get(circleConfig.point3Id) || circleConfig.point3Id
                : undefined,
            };
          }

          // Remap dependencies
          let dependencies = obj.dependencies;
          if (dependencies) {
            dependencies = dependencies.map(
              (depId: string) => idMapping.get(depId) || depId,
            );
          }

          const newId = addGeometryObject({
            type: obj.type,
            subType: obj.subType,
            label: obj.label,
            color: obj.color,
            strokeWidth: obj.strokeWidth,
            fillColor: obj.fillColor,
            visible: obj.visible,
            selected: false,
            scale: obj.scale,
            points: obj.points
              ? obj.points.map((p: any) => ({ ...p }))
              : undefined,
            sliderConfig: obj.sliderConfig
              ? { ...obj.sliderConfig }
              : undefined,
            constraint: obj.constraint ? { ...obj.constraint } : undefined,
            ratio: obj.ratio ? { ...obj.ratio } : undefined,
            linePoints,
            circleConfig,
            center: obj.center ? { ...obj.center } : undefined,
            radius: obj.radius,
            point1: obj.point1 ? { ...obj.point1 } : undefined,
            point2: obj.point2 ? { ...obj.point2 } : undefined,
            sides: obj.sides,
            dependencies,
          });
          newIds.push(newId);
        });
      }

      // Select newly pasted items immediately using the actual IDs
      setTimeout(() => {
        setSelectedIds(newIds);
      }, 50);
    },
    [copiedItems, addDrawing, addImage, addGeometryObject],
  );

  // Expose functions to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      copy: handleCopy,
      paste: handlePaste,
      hasSelection: () => selectedIds.length > 0,
      hasCopiedItems: () =>
        copiedItems !== null &&
        (copiedItems.drawings.length > 0 ||
          copiedItems.images.length > 0 ||
          copiedItems.geometryObjects.length > 0),
      clearSelection: () => setSelectedIds([]),
    }),
    [handleCopy, handlePaste, selectedIds, copiedItems],
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape - cancel lasso selection
      if (e.key === "Escape" && isLassoSelecting) {
        e.preventDefault();
        setIsLassoSelecting(false);
        setSelectionPath(null);
        return;
      }

      // Copy (Ctrl/Cmd + C)
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedIds.length > 0) {
        e.preventDefault();
        handleCopy();
      }

      // Paste (Ctrl/Cmd + V)
      // Note: Don't handle paste here - let the paste event handle it
      // This allows system clipboard images to be pasted first
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        // Don't preventDefault - let paste event fire
        // The paste event handler will check for images first,
        // then fall back to copiedItems if no image is found
        return;
      }

      // Delete selected items (drawings, images, geometry objects)
      if (e.key === "Delete" && selectedIds.length > 0) {
        selectedIds.forEach((id) => {
          // Try to delete as drawing
          if (drawings.find((d) => d.id === id)) {
            removeDrawing(id);
          }
          // Try to delete as image
          if (images.find((img) => img.id === id)) {
            removeImage(id);
          }
          // Try to delete as geometry object
          if (geometryObjects.find((obj) => obj.id === id)) {
            removeGeometryObject(id);
          }
        });
        setSelectedIds([]);
      }

      // Bring to front (Ctrl/Cmd + ])
      if ((e.ctrlKey || e.metaKey) && e.key === "]" && selectedIds.length > 0) {
        e.preventDefault();
        const layer = layerRef.current;
        if (layer) {
          selectedIds.forEach((id) => {
            const node = layer.findOne(`#${id}`);
            if (node) {
              node.moveToTop();
            }
          });
          layer.batchDraw();
        }
      }

      // Send to back (Ctrl/Cmd + [)
      if ((e.ctrlKey || e.metaKey) && e.key === "[" && selectedIds.length > 0) {
        e.preventDefault();
        const layer = layerRef.current;
        if (layer) {
          selectedIds.forEach((id) => {
            const node = layer.findOne(`#${id}`);
            if (node) {
              node.moveToBottom();
            }
          });
          layer.batchDraw();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedIds,
    removeDrawing,
    removeImage,
    drawings,
    images,
    handleCopy,
    handlePaste,
    copiedItems,
    isLassoSelecting,
  ]);

  // Handle transform end - update drawing in store
  const handleTransformEnd = (drawingId: string) => {
    const layer = layerRef.current;
    if (!layer) return;

    const node = layer.findOne(`#${drawingId}`);
    if (!node) return;

    // Get transformation matrix
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();
    const x = node.x();
    const y = node.y();

    // Reset node transform
    node.scaleX(1);
    node.scaleY(1);
    node.rotation(0);
    node.position({ x: 0, y: 0 });

    // Find the drawing
    const drawing = drawings.find((d) => d.id === drawingId);
    if (!drawing) return;

    // Transform all points
    const transformedPoints = drawing.points.map((p) => {
      // Convert to screen coordinates
      const screen = graphToScreen(p.x, p.y, width, height, view);

      // Apply transformation
      const rotRad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);

      // Scale, rotate, translate
      const scaledX = screen.x * scaleX;
      const scaledY = screen.y * scaleY;
      const rotatedX = scaledX * cos - scaledY * sin;
      const rotatedY = scaledX * sin + scaledY * cos;
      const finalX = rotatedX + x;
      const finalY = rotatedY + y;

      // Convert back to graph coordinates
      return screenToGraph(finalX, finalY, width, height, view);
    });

    // Update drawing with transformed points
    updateDrawing(drawingId, { points: transformedPoints });
  };

  // Handle image transform end - update image in store
  const handleImageTransformEnd = (imageId: string) => {
    const layer = layerRef.current;
    if (!layer) return;

    const node = layer.findOne(`#${imageId}`);
    if (!node) return;

    // Get transformation
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotationDegrees = node.rotation();
    const x = node.x();
    const y = node.y();

    // Find the image
    const image = images.find((img) => img.id === imageId);
    if (!image || !image.graphPosition) return;

    // Convert new screen position to graph coordinates
    const newCenterGraph = screenToGraph(x, y, width, height, view);

    // Update size (apply scale to current size)
    const newWidth = image.graphPosition.width * scaleX;
    const newHeight = image.graphPosition.height * scaleY;

    // Node rotation is already the total rotation in degrees
    const newRotation = rotationDegrees * (Math.PI / 180); // Convert to radians

    updateImage(imageId, {
      graphPosition: {
        x: newCenterGraph.x,
        y: newCenterGraph.y,
        width: newWidth,
        height: newHeight,
        rotation: newRotation,
      },
    });

    // Note: We don't reset rotation because it's managed by the Group rotation property
    // Reset only scale
    node.scaleX(1);
    node.scaleY(1);
  };

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 3,
        touchAction: "none", // Prevent browser scroll/zoom on touch for drawing
        pointerEvents:
          (drawingTool === "pen" ||
            drawingTool === "highlighter" ||
            drawingTool === "eraser" ||
            drawingTool === "select") &&
          !creationState.active
            ? "auto"
            : "none",
        cursor: drawingTool === "eraser" ? "none"
          : drawingTool === "pen" || drawingTool === "highlighter" ? "default"
          : drawingTool === "select" ? "pointer"
          : creationState.active ? "crosshair"
          : "grab",
      }}
      onClick={handleStageClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={(e) => {
        const nativeEvt = e.evt as TouchEvent;
        if (nativeEvt.touches && nativeEvt.touches.length >= 2) {
          // Second finger added — cancel any in-progress drawing
          if (isDrawing) {
            setIsDrawing(false);
            currentStrokePoints.current = [];
            setTempStrokeData(null);
            if (tempStrokeRef.current) {
              tempStrokeRef.current.points([]);
              tempStrokeRef.current.getLayer()?.batchDraw();
            }
            if (drawingRenderFrameRef.current !== null) {
              cancelAnimationFrame(drawingRenderFrameRef.current);
              drawingRenderFrameRef.current = null;
              pendingDrawingUpdateRef.current = false;
            }
          }
          // Cancel any Konva drag in progress — prevents objects flying to top-left
          const stage = stageRef.current;
          if (stage) {
            // Stop all active drags
            stage.find('Group, Circle, Line, Rect, Image').forEach((node: any) => {
              if (node.isDragging && node.isDragging()) {
                node.stopDrag();
              }
            });
          }
          // Mark that we're in a pinch gesture so subsequent events are ignored
          pinchActiveRef.current = true;
          return;
        }
        // Skip if pinch just ended — wait for a clean new touch
        if (pinchActiveRef.current) return;
        handleMouseDown(e);
      }}
      onTouchMove={(e) => {
        const nativeEvt = e.evt as TouchEvent;
        if (nativeEvt.touches && nativeEvt.touches.length >= 2) return;
        if (pinchActiveRef.current) return;
        handleMouseMove(e);
      }}
      onTouchEnd={(e) => {
        const nativeEvt = e.evt as TouchEvent;
        const remainingTouches = nativeEvt.touches ? nativeEvt.touches.length : 0;

        // If pinch was active, reset when all fingers are lifted
        if (pinchActiveRef.current) {
          if (remainingTouches === 0) {
            pinchActiveRef.current = false;
          }
          return; // Always skip handleMouseUp during/after pinch
        }

        // Normal single-finger end
        if (remainingTouches >= 1) return;
        handleMouseUp(e);
      }}
    >
      <Layer ref={layerRef}>
        {/* Render all images first (so they appear behind everything) */}
        {images.map((image) => {
          const htmlImage = loadedImages[image.id];
          if (!htmlImage) return null;

          const isSelected = selectedIds.includes(image.id);
          const isHovered = hoveredId === image.id;

          // Only render graphPosition-based images for now
          if (!image.graphPosition) return null;

          // Convert graph position to screen coordinates
          const centerScreen = graphToScreen(
            image.graphPosition.x,
            image.graphPosition.y,
            width,
            height,
            view,
          );

          // Calculate screen dimensions
          const widthScreen =
            image.graphPosition.width * view.scale * view.scaleX;
          const heightScreen =
            image.graphPosition.height * view.scale * view.scaleY;

          return (
            <Group
              key={image.id}
              id={image.id}
              x={centerScreen.x}
              y={centerScreen.y}
              rotation={(image.graphPosition.rotation || 0) * (180 / Math.PI)}
              draggable={drawingTool === "select" && !isLassoSelecting}
              listening={true}
              onDragEnd={() => {
                const node = layerRef.current?.findOne(`#${image.id}`);
                if (!node) return;

                const x = node.x();
                const y = node.y();

                // Convert new screen position to graph coordinates
                const newCenterGraph = screenToGraph(x, y, width, height, view);

                // Update image position
                if (image.graphPosition) {
                  updateImage(image.id, {
                    graphPosition: {
                      ...image.graphPosition,
                      x: newCenterGraph.x,
                      y: newCenterGraph.y,
                    },
                  });
                }
              }}
              onTransformEnd={() => handleImageTransformEnd(image.id)}
            >
              {/* Eraser hover highlight (red border) */}
              {isHovered && drawingTool === "eraser" && (
                <KonvaImage
                  x={0}
                  y={0}
                  width={widthScreen}
                  height={heightScreen}
                  image={htmlImage}
                  offsetX={widthScreen / 2}
                  offsetY={heightScreen / 2}
                  stroke="#ff4444"
                  strokeWidth={4}
                  opacity={0.5}
                  listening={false}
                />
              )}

              {/* Selection highlight (cyan border) */}
              {isSelected && drawingTool === "select" && (
                <KonvaImage
                  x={0}
                  y={0}
                  width={widthScreen}
                  height={heightScreen}
                  image={htmlImage}
                  offsetX={widthScreen / 2}
                  offsetY={heightScreen / 2}
                  stroke="#4ecdc4"
                  strokeWidth={4}
                  opacity={0.3}
                  listening={false}
                />
              )}

              {/* Actual image */}
              <KonvaImage
                x={0}
                y={0}
                width={widthScreen}
                height={heightScreen}
                image={htmlImage}
                offsetX={widthScreen / 2}
                offsetY={heightScreen / 2}
                opacity={image.opacity}
                listening={
                  !isLassoSelecting &&
                  (drawingTool === "select" || drawingTool === "eraser")
                }
              />
            </Group>
          );
        })}

        {/* Render all lines FIRST (so they appear below points) */}
        {geometryObjects.map((obj) => {
          if (!obj.visible) return null;
          if (!["segment", "line", "ray"].includes(obj.type)) return null;
          if (!obj.linePoints || !obj.points || obj.points.length < 2)
            return null;

          // Get the two defining points from dependencies
          const point1 = geometryObjects.find(
            (o) => o.id === obj.linePoints!.point1Id,
          );
          const point2 = geometryObjects.find(
            (o) => o.id === obj.linePoints!.point2Id,
          );

          if (!point1 || !point2 || !point1.points[0] || !point2.points[0])
            return null;

          const p1 = point1.points[0];
          const p2 = point2.points[0];

          // Convert to screen coordinates
          const screenP1 = graphToScreen(p1.x, p1.y, width, height, view);
          const screenP2 = graphToScreen(p2.x, p2.y, width, height, view);

          // Calculate line points based on type
          let linePoints: number[] = [];

          if (obj.type === "segment") {
            // Segment: just draw between the two points
            linePoints = [screenP1.x, screenP1.y, screenP2.x, screenP2.y];
          } else {
            // For infinite lines and rays, extend beyond the canvas
            const dx = screenP2.x - screenP1.x;
            const dy = screenP2.y - screenP1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const dirX = dx / length;
            const dirY = dy / length;

            // Calculate a very long extension (canvas diagonal * 2)
            const extension = Math.sqrt(width * width + height * height) * 2;

            if (obj.type === "line") {
              // Infinite line: extend in both directions
              const startX = screenP1.x - dirX * extension;
              const startY = screenP1.y - dirY * extension;
              const endX = screenP2.x + dirX * extension;
              const endY = screenP2.y + dirY * extension;
              linePoints = [startX, startY, endX, endY];
            } else if (obj.type === "ray") {
              // Ray: start at point1, extend through point2
              const endX = screenP2.x + dirX * extension;
              const endY = screenP2.y + dirY * extension;
              linePoints = [screenP1.x, screenP1.y, endX, endY];
            }
          }

          const isSelected = selectedIds.includes(obj.id);

          return (
            <Group
              key={obj.id}
              id={obj.id}
              draggable={
                drawingTool === "select" && isSelected && !isLassoSelecting
              }
              onDragStart={(e) => {
                const group = e.target;
                // Store original positions at drag start
                group.setAttr('_origP1', { x: p1.x, y: p1.y });
                group.setAttr('_origP2', { x: p2.x, y: p2.y });
              }}
              onDragMove={(e) => {
                const group = e.target;
                const dx = group.x();
                const dy = group.y();

                // Move the endpoint nodes visually to follow the line during drag
                const point1Node = layerRef.current?.findOne(`#${obj.linePoints!.point1Id}`);
                const point2Node = layerRef.current?.findOne(`#${obj.linePoints!.point2Id}`);

                const origP1 = group.getAttr('_origP1');
                const origP2 = group.getAttr('_origP2');

                if (point1Node && origP1) {
                  const origP1Screen = graphToScreen(origP1.x, origP1.y, width, height, view);
                  point1Node.position({ x: origP1Screen.x + dx, y: origP1Screen.y + dy });
                }

                if (point2Node && origP2) {
                  const origP2Screen = graphToScreen(origP2.x, origP2.y, width, height, view);
                  point2Node.position({ x: origP2Screen.x + dx, y: origP2Screen.y + dy });
                }

                // Move midpoint nodes visually as well
                geometryObjects.forEach((midpoint) => {
                  if (
                    midpoint.subType === "point-midpoint" &&
                    midpoint.dependencies &&
                    midpoint.dependencies.includes(obj.linePoints!.point1Id) &&
                    midpoint.dependencies.includes(obj.linePoints!.point2Id)
                  ) {
                    const midpointNode = layerRef.current?.findOne(`#${midpoint.id}`);
                    if (midpointNode && midpoint.points[0]) {
                      const origMidScreen = graphToScreen(midpoint.points[0].x, midpoint.points[0].y, width, height, view);
                      midpointNode.position({ x: origMidScreen.x + dx, y: origMidScreen.y + dy });
                    }
                  }
                });
              }}
              onDragEnd={(e) => {
                const group = e.target;
                const dx = group.x();
                const dy = group.y();

                // Get original positions
                const origP1 = group.getAttr('_origP1');
                const origP2 = group.getAttr('_origP2');

                if (origP1 && origP2) {
                  // Convert drag offset to graph coordinates
                  const offsetStart = screenToGraph(0, 0, width, height, view);
                  const offsetEnd = screenToGraph(dx, dy, width, height, view);
                  const graphDx = offsetEnd.x - offsetStart.x;
                  const graphDy = offsetEnd.y - offsetStart.y;

                  // Calculate final positions
                  const newP1 = { x: origP1.x + graphDx, y: origP1.y + graphDy };
                  const newP2 = { x: origP2.x + graphDx, y: origP2.y + graphDy };

                  // Update the two points that define this line
                  updateGeometryObject(obj.linePoints!.point1Id, {
                    points: [newP1],
                  });
                  updateGeometryObject(obj.linePoints!.point2Id, {
                    points: [newP2],
                  });

                  // Update midpoint(s) if they exist
                  geometryObjects.forEach((midpoint) => {
                    if (
                      midpoint.subType === "point-midpoint" &&
                      midpoint.dependencies &&
                      midpoint.dependencies.includes(obj.linePoints!.point1Id) &&
                      midpoint.dependencies.includes(obj.linePoints!.point2Id)
                    ) {
                      // Get ratio (default to 1:1 midpoint if not specified)
                      const ratio = midpoint.ratio || { m: 1, n: 1 };

                      // Calculate division point using formula: (n*P1 + m*P2) / (m+n)
                      const divX =
                        (ratio.n * newP1.x + ratio.m * newP2.x) /
                        (ratio.m + ratio.n);
                      const divY =
                        (ratio.n * newP1.y + ratio.m * newP2.y) /
                        (ratio.m + ratio.n);

                      updateGeometryObject(midpoint.id, {
                        points: [{ x: divX, y: divY }],
                      });
                    }
                  });
                }

                // Clean up stored attributes
                group.setAttr('_origP1', null);
                group.setAttr('_origP2', null);
                // Reset group position
                group.position({ x: 0, y: 0 });
              }}
            >
              <Line
                points={linePoints}
                stroke={obj.color}
                strokeWidth={isSelected ? 6 : 4}
                opacity={1}
                listening={
                  !isLassoSelecting &&
                  (drawingTool === "select" || drawingTool === "eraser")
                }
                hitStrokeWidth={10}
                onClick={(e) => {
                  if (drawingTool === "select" && !isLassoSelecting) {
                    e.cancelBubble = true;
                    // Toggle selection with Shift key
                    if (e.evt.shiftKey) {
                      if (selectedIds.includes(obj.id)) {
                        setSelectedIds(
                          selectedIds.filter((id) => id !== obj.id),
                        );
                      } else {
                        setSelectedIds([...selectedIds, obj.id]);
                      }
                    } else {
                      // Single selection
                      setSelectedIds([obj.id]);
                    }
                  }
                }}
                onTap={(e) => {
                  if (drawingTool === "select" && !isLassoSelecting) {
                    e.cancelBubble = true;
                    setSelectedIds([obj.id]);
                  }
                }}
              />
            </Group>
          );
        })}

        {/* Render all polygons (after lines, before circles) */}
        {geometryObjects.map((obj) => {
          if (!obj.visible) return null;
          if (obj.type !== "polygon") return null;
          if (!obj.points || obj.points.length < 3) return null;

          // Convert polygon points to screen coordinates
          const screenPoints: number[] = [];
          obj.points.forEach((point) => {
            const screenPoint = graphToScreen(
              point.x,
              point.y,
              width,
              height,
              view,
            );
            screenPoints.push(screenPoint.x, screenPoint.y);
          });

          const isSelected = selectedIds.includes(obj.id);

          return (
            <Group
              key={obj.id}
              id={obj.id}
              name="polygon-group"
              draggable={drawingTool === "select" && isSelected}
              onDragStart={(e) => {
                const group = e.target;
                // Store original points at drag start
                group.setAttr(
                  "_origPoints",
                  JSON.parse(JSON.stringify(obj.points)),
                );

                // Store original positions of dependencies if they exist
                if (obj.dependencies && obj.dependencies.length > 0) {
                  const origDeps: Record<string, { x: number; y: number }> = {};
                  obj.dependencies.forEach(depId => {
                    const depObj = geometryObjects.find(o => o.id === depId);
                    if (depObj && depObj.points && depObj.points[0]) {
                      origDeps[depId] = { x: depObj.points[0].x, y: depObj.points[0].y };
                    }
                  });
                  group.setAttr('_origDeps', origDeps);
                }
              }}
              onTransformStart={(e) => {
                const group = e.target;
                // Store original points at transform start
                group.setAttr(
                  "_origPoints",
                  JSON.parse(JSON.stringify(obj.points)),
                );
              }}
              onDragMove={(e) => {
                const node = e.target;
                const dx = node.x();
                const dy = node.y();

                // Get original points
                const origPoints = node.getAttr('_origPoints');
                const origDeps = node.getAttr('_origDeps');
                if (!origPoints) return;

                // Convert the drag offset from screen to graph coordinates
                const offsetStart = screenToGraph(0, 0, width, height, view);
                const offsetEnd = screenToGraph(dx, dy, width, height, view);
                const graphDx = offsetEnd.x - offsetStart.x;
                const graphDy = offsetEnd.y - offsetStart.y;

                // Update dependency point nodes visually only (don't call updateGeometryObject)
                if (origDeps && obj.dependencies && obj.dependencies.length > 0) {
                  obj.dependencies.forEach(depId => {
                    const origDepPoint = origDeps[depId];
                    if (origDepPoint) {
                      const newDepGraphPos = {
                        x: origDepPoint.x + graphDx,
                        y: origDepPoint.y + graphDy,
                      };

                      // Update node visual position only
                      const depNode = layerRef.current?.findOne(`#${depId}`);
                      if (depNode) {
                        const newDepScreen = graphToScreen(newDepGraphPos.x, newDepGraphPos.y, width, height, view);
                        depNode.position({ x: newDepScreen.x, y: newDepScreen.y });
                        // Reset scale to prevent scaling issues
                        depNode.scaleX(1);
                        depNode.scaleY(1);
                      }
                    }
                  });
                }
              }}
              onDragEnd={(e) => {
                const node = e.target;
                const dx = node.x();
                const dy = node.y();

                // Get original points and dependencies
                const origPoints = node.getAttr('_origPoints');
                const origDeps = node.getAttr('_origDeps');

                if (origPoints) {
                  // Convert the final drag offset from screen to graph coordinates
                  const offsetStart = screenToGraph(0, 0, width, height, view);
                  const offsetEnd = screenToGraph(dx, dy, width, height, view);
                  const graphDx = offsetEnd.x - offsetStart.x;
                  const graphDy = offsetEnd.y - offsetStart.y;

                  // Update dependency points first
                  if (origDeps && obj.dependencies && obj.dependencies.length > 0) {
                    obj.dependencies.forEach(depId => {
                      const origDepPoint = origDeps[depId];
                      if (origDepPoint) {
                        const newDepPoint = {
                          x: origDepPoint.x + graphDx,
                          y: origDepPoint.y + graphDy,
                        };
                        updateGeometryObject(depId, { points: [newDepPoint] });
                      }
                    });
                  }

                  // Calculate final points
                  const finalPoints = origPoints.map((p: GeometryPoint) => ({
                    x: p.x + graphDx,
                    y: p.y + graphDy,
                  }));

                  // Update the polygon with final points
                  updateGeometryObject(obj.id, { points: finalPoints });
                }

                // Clean up stored attributes
                node.setAttr('_origPoints', null);
                node.setAttr('_origDeps', null);
                // Reset node position
                node.position({ x: 0, y: 0 });
              }}
              onTransform={(e) => {
                const group = e.target;
                const line = group.findOne(".polygon-line") as Konva.Line;
                if (!line) return;

                // Get the absolute transform matrix
                const transform = line.getAbsoluteTransform();
                const localPoints = line.points();

                // Convert each transformed screen point back to graph coordinates
                const newGraphPoints: GeometryPoint[] = [];
                for (let i = 0; i < localPoints.length; i += 2) {
                  // Apply transform to get absolute screen position
                  const absPos = transform.point({
                    x: localPoints[i],
                    y: localPoints[i + 1],
                  });
                  // Convert to graph coordinates
                  const graphPos = screenToGraph(
                    absPos.x,
                    absPos.y,
                    width,
                    height,
                    view,
                  );
                  newGraphPoints.push(graphPos);
                }

                // Handle regular polygons differently - update center and radius points in real-time
                if (
                  obj.subType === "polygon-regular" &&
                  obj.dependencies &&
                  obj.dependencies.length >= 2
                ) {
                  const [centerPointId, radiusPointId] = obj.dependencies;

                  // Calculate new center from transformed vertices
                  const newCenter = {
                    x:
                      newGraphPoints.reduce((sum, p) => sum + p.x, 0) /
                      newGraphPoints.length,
                    y:
                      newGraphPoints.reduce((sum, p) => sum + p.y, 0) /
                      newGraphPoints.length,
                  };

                  // Calculate new radius point position (first vertex direction from center)
                  const firstVertex = newGraphPoints[0];
                  const newRadius = {
                    x: firstVertex.x,
                    y: firstVertex.y,
                  };

                  // Update center point
                  updateGeometryObject(centerPointId, {
                    points: [newCenter],
                  });

                  // Update radius point
                  updateGeometryObject(radiusPointId, {
                    points: [newRadius],
                  });
                }
                // Update dependent points (vertices) in real-time
                else if (obj.dependencies && obj.dependencies.length > 0) {
                  obj.dependencies.forEach((depId, index) => {
                    if (index < newGraphPoints.length) {
                      const depPoint = geometryObjects.find(
                        (o) => o.id === depId,
                      );
                      if (depPoint && depPoint.type === "point") {
                        updateGeometryObject(depId, {
                          points: [newGraphPoints[index]],
                        });

                        // Update dependents of this vertex in real-time (e.g., midpoints)
                        if (
                          depPoint.dependents &&
                          depPoint.dependents.length > 0
                        ) {
                          depPoint.dependents.forEach((dependentId) => {
                            const dependent = geometryObjects.find(
                              (o) => o.id === dependentId,
                            );
                            if (!dependent) return;

                            // Update midpoints
                            if (
                              dependent.subType === "point-midpoint" &&
                              dependent.dependencies
                            ) {
                              const dep1 = geometryObjects.find(
                                (o) => o.id === dependent.dependencies![0],
                              );
                              const dep2 = geometryObjects.find(
                                (o) => o.id === dependent.dependencies![1],
                              );

                              if (
                                dep1 &&
                                dep2 &&
                                dep1.points[0] &&
                                dep2.points[0]
                              ) {
                                const point1 =
                                  dep1.id === depId
                                    ? newGraphPoints[index]
                                    : dep1.points[0];
                                const point2 =
                                  dep2.id === depId
                                    ? newGraphPoints[index]
                                    : dep2.points[0];

                                // Get ratio (default to 1:1 midpoint if not specified)
                                const ratio = dependent.ratio || { m: 1, n: 1 };

                                // Calculate division point using formula: (n*P1 + m*P2) / (m+n)
                                const divX =
                                  (ratio.n * point1.x + ratio.m * point2.x) /
                                  (ratio.m + ratio.n);
                                const divY =
                                  (ratio.n * point1.y + ratio.m * point2.y) /
                                  (ratio.m + ratio.n);

                                updateGeometryObject(dependentId, {
                                  points: [{ x: divX, y: divY }],
                                });
                              }
                            }
                          });
                        }
                      }
                    }
                  });
                }
              }}
              onTransformEnd={(e) => {
                const group = e.target;
                const line = group.findOne(".polygon-line") as Konva.Line;
                if (!line) return;

                // Get the absolute transform matrix
                const transform = line.getAbsoluteTransform();
                const localPoints = line.points();

                // Convert each transformed screen point back to graph coordinates
                const newGraphPoints: GeometryPoint[] = [];
                for (let i = 0; i < localPoints.length; i += 2) {
                  // Apply transform to get absolute screen position
                  const absPos = transform.point({
                    x: localPoints[i],
                    y: localPoints[i + 1],
                  });
                  // Convert to graph coordinates
                  const graphPos = screenToGraph(
                    absPos.x,
                    absPos.y,
                    width,
                    height,
                    view,
                  );
                  newGraphPoints.push(graphPos);
                }

                // Update polygon
                updateGeometryObject(obj.id, { points: newGraphPoints });

                // Handle regular polygons differently - update center and radius points
                if (
                  obj.subType === "polygon-regular" &&
                  obj.dependencies &&
                  obj.dependencies.length >= 2
                ) {
                  const [centerPointId, radiusPointId] = obj.dependencies;

                  // Calculate new center from transformed vertices
                  const newCenter = {
                    x:
                      newGraphPoints.reduce((sum, p) => sum + p.x, 0) /
                      newGraphPoints.length,
                    y:
                      newGraphPoints.reduce((sum, p) => sum + p.y, 0) /
                      newGraphPoints.length,
                  };

                  // Calculate new radius point position (first vertex direction from center)
                  const firstVertex = newGraphPoints[0];
                  const newRadius = {
                    x: firstVertex.x,
                    y: firstVertex.y,
                  };

                  // Update center point
                  updateGeometryObject(centerPointId, {
                    points: [newCenter],
                  });

                  // Update radius point
                  updateGeometryObject(radiusPointId, {
                    points: [newRadius],
                  });
                }
                // Update dependent points (vertices) for regular polygons
                else if (obj.dependencies && obj.dependencies.length > 0) {
                  obj.dependencies.forEach((depId, index) => {
                    if (index < newGraphPoints.length) {
                      const depPoint = geometryObjects.find(
                        (o) => o.id === depId,
                      );
                      if (depPoint && depPoint.type === "point") {
                        // Update vertex position
                        updateGeometryObject(depId, {
                          points: [newGraphPoints[index]],
                        });

                        // Update dependents of this vertex (e.g., midpoints, lines)
                        if (
                          depPoint.dependents &&
                          depPoint.dependents.length > 0
                        ) {
                          depPoint.dependents.forEach((dependentId) => {
                            const dependent = geometryObjects.find(
                              (o) => o.id === dependentId,
                            );
                            if (!dependent) return;

                            // Update midpoints
                            if (
                              dependent.subType === "point-midpoint" &&
                              dependent.dependencies
                            ) {
                              const dep1 = geometryObjects.find(
                                (o) => o.id === dependent.dependencies![0],
                              );
                              const dep2 = geometryObjects.find(
                                (o) => o.id === dependent.dependencies![1],
                              );

                              if (
                                dep1 &&
                                dep2 &&
                                dep1.points[0] &&
                                dep2.points[0]
                              ) {
                                const point1 =
                                  dep1.id === depId
                                    ? newGraphPoints[index]
                                    : dep1.points[0];
                                const point2 =
                                  dep2.id === depId
                                    ? newGraphPoints[index]
                                    : dep2.points[0];

                                // Get ratio (default to 1:1 midpoint if not specified)
                                const ratio = dependent.ratio || { m: 1, n: 1 };

                                // Calculate division point using formula: (n*P1 + m*P2) / (m+n)
                                const divX =
                                  (ratio.n * point1.x + ratio.m * point2.x) /
                                  (ratio.m + ratio.n);
                                const divY =
                                  (ratio.n * point1.y + ratio.m * point2.y) /
                                  (ratio.m + ratio.n);

                                updateGeometryObject(dependentId, {
                                  points: [{ x: divX, y: divY }],
                                });
                              }
                            }
                          });
                        }
                      }
                    }
                  });
                }

                // Reset group transformation
                group.position({ x: 0, y: 0 });
                group.rotation(0);
                group.scaleX(1);
                group.scaleY(1);

                // Clear stored original points
                group.setAttr("_origPoints", null);
              }}
            >
              <Line
                name="polygon-line"
                points={screenPoints}
                stroke={shapeRenderMode === 'fill' ? undefined : obj.color}
                strokeWidth={shapeRenderMode === 'fill' ? 0 : (isSelected ? 6 : 4)}
                fill={shapeRenderMode === 'stroke' ? undefined : (obj.fillColor || PASTEL_COLORS[geometryObjects.filter(o => o.type === 'polygon' || o.type === 'circle').indexOf(obj) % PASTEL_COLORS.length])}
                fillOpacity={shapeRenderMode === 'stroke' ? 0 : 0.6}
                opacity={isSelected ? 1 : 0.8}
                closed={true}
                listening={
                  !isLassoSelecting &&
                  (drawingTool === "select" || drawingTool === "eraser")
                }
                hitStrokeWidth={10}
                globalCompositeOperation={shapeRenderMode === 'stroke' ? 'source-over' : 'multiply'}
              />
            </Group>
          );
        })}

        {/* Render all circles (after polygons, before points) */}
        {geometryObjects.map((obj) => {
          if (!obj.visible) return null;
          if (obj.type !== "circle") return null;
          if (!obj.points || obj.points.length === 0) return null;
          if (obj.radius === undefined) return null;

          // Use the circle's center point and radius directly
          const centerPoint = obj.points[0];
          const radiusInGraph = obj.radius;

          // Convert center to screen coordinates
          const centerScreen = graphToScreen(
            centerPoint.x,
            centerPoint.y,
            width,
            height,
            view,
          );

          // Convert radius to screen coordinates (scale with view)
          const radiusInScreen = radiusInGraph * view.scale;

          const isSelected = selectedIds.includes(obj.id);

          return (
            <Group
              key={obj.id}
              id={obj.id}
              x={centerScreen.x}
              y={centerScreen.y}
              draggable={
                drawingTool === "select" && isSelected && !isLassoSelecting
              }
              onDragStart={(e) => {
                const group = e.target;
                // Store original positions at drag start
                group.setAttr('_origCenter', { x: centerPoint.x, y: centerPoint.y });

                // Store original positions of dependencies
                if (obj.dependencies && obj.dependencies.length > 0) {
                  const origDeps: Record<string, { x: number; y: number }> = {};
                  obj.dependencies.forEach(depId => {
                    const depObj = geometryObjects.find(o => o.id === depId);
                    if (depObj && depObj.points && depObj.points[0]) {
                      origDeps[depId] = { x: depObj.points[0].x, y: depObj.points[0].y };
                    }
                  });
                  group.setAttr('_origDeps', origDeps);
                }
              }}
              onDragMove={(e) => {
                const group = e.target;
                const dx = group.x() - centerScreen.x;
                const dy = group.y() - centerScreen.y;

                // Get original positions
                const origCenter = group.getAttr('_origCenter');
                const origDeps = group.getAttr('_origDeps');

                if (!origCenter) return;

                // Convert drag offset to graph coordinates
                const offsetStart = screenToGraph(0, 0, width, height, view);
                const offsetEnd = screenToGraph(dx, dy, width, height, view);
                const graphDx = offsetEnd.x - offsetStart.x;
                const graphDy = offsetEnd.y - offsetStart.y;

                // Update dependency point nodes visually (don't call updateGeometryObject)
                if (origDeps && obj.dependencies && obj.dependencies.length > 0) {
                  obj.dependencies.forEach(depId => {
                    const origDepPoint = origDeps[depId];
                    if (origDepPoint) {
                      const newDepGraphPos = {
                        x: origDepPoint.x + graphDx,
                        y: origDepPoint.y + graphDy,
                      };

                      // Update node visual position only
                      const depNode = layerRef.current?.findOne(`#${depId}`);
                      if (depNode) {
                        const newDepScreen = graphToScreen(newDepGraphPos.x, newDepGraphPos.y, width, height, view);
                        depNode.position({ x: newDepScreen.x, y: newDepScreen.y });
                        // Reset scale to prevent scaling issues
                        depNode.scaleX(1);
                        depNode.scaleY(1);
                      }
                    }
                  });
                }
              }}
              onDragEnd={(e) => {
                const group = e.target;
                const dx = group.x() - centerScreen.x;
                const dy = group.y() - centerScreen.y;

                // Get original positions
                const origCenter = group.getAttr('_origCenter');
                const origDeps = group.getAttr('_origDeps');

                if (!origCenter) return;

                // Convert drag offset to graph coordinates
                const offsetStart = screenToGraph(0, 0, width, height, view);
                const offsetEnd = screenToGraph(dx, dy, width, height, view);
                const graphDx = offsetEnd.x - offsetStart.x;
                const graphDy = offsetEnd.y - offsetStart.y;

                // Update dependency points
                if (origDeps && obj.dependencies && obj.dependencies.length > 0) {
                  obj.dependencies.forEach(depId => {
                    const origDepPoint = origDeps[depId];
                    if (origDepPoint) {
                      const newDepPoint = {
                        x: origDepPoint.x + graphDx,
                        y: origDepPoint.y + graphDy,
                      };
                      updateGeometryObject(depId, { points: [newDepPoint] });
                    }
                  });
                }

                // Update the circle's center point at drag end
                const newCenter = {
                  x: origCenter.x + graphDx,
                  y: origCenter.y + graphDy,
                };
                updateGeometryObject(obj.id, { points: [newCenter] });

                // Reset group position
                group.position({ x: 0, y: 0 });

                // Clean up stored attributes
                group.setAttr('_origCenter', null);
                group.setAttr('_origDeps', null);
              }}
              onTransformStart={(e) => {
                const group = e.target;

                // Check if this is a diameter circle or center-radius circle
                if (obj.subType === 'circle-diameter' && obj.dependencies && obj.dependencies.length >= 2) {
                  // For diameter circles: store angles from center to BOTH endpoints
                  const point1Obj = geometryObjects.find(o => o.id === obj.dependencies![0]);
                  const point2Obj = geometryObjects.find(o => o.id === obj.dependencies![1]);

                  if (point1Obj && point2Obj && point1Obj.points[0] && point2Obj.points[0]) {
                    // Calculate current center (midpoint of diameter)
                    const center = {
                      x: (point1Obj.points[0].x + point2Obj.points[0].x) / 2,
                      y: (point1Obj.points[0].y + point2Obj.points[0].y) / 2
                    };

                    // Store angles from center to both endpoints
                    const angle1 = Math.atan2(
                      point1Obj.points[0].y - center.y,
                      point1Obj.points[0].x - center.x
                    );
                    const angle2 = Math.atan2(
                      point2Obj.points[0].y - center.y,
                      point2Obj.points[0].x - center.x
                    );

                    group.setAttr('_origAngle1', angle1);
                    group.setAttr('_origAngle2', angle2);
                  }
                } else if (obj.dependencies && obj.dependencies.length >= 2) {
                  // For center-radius circles: store angle from center to radius point
                  const centerPointObj = geometryObjects.find(o => o.id === obj.dependencies![0]);
                  const radiusPointObj = geometryObjects.find(o => o.id === obj.dependencies![1]);

                  if (centerPointObj && radiusPointObj &&
                      centerPointObj.points[0] && radiusPointObj.points[0]) {
                    const angle = Math.atan2(
                      radiusPointObj.points[0].y - centerPointObj.points[0].y,
                      radiusPointObj.points[0].x - centerPointObj.points[0].x
                    );
                    group.setAttr('_origAngle', angle);
                  }
                }
              }}
              onTransform={(e) => {
                const group = e.target;
                const circle = group.findOne('Circle') as Konva.Circle;
                if (!circle) return;

                // Get the absolute transform matrix
                const transform = circle.getAbsoluteTransform();

                // Circle is at (0, 0) in local coordinates, edge is at (radius, 0)
                const localCenter = { x: 0, y: 0 };
                const localEdgePoint = { x: circle.radius(), y: 0 };

                // Transform to absolute screen positions
                const absCenter = transform.point(localCenter);
                const absEdgePoint = transform.point(localEdgePoint);

                // Calculate new radius from transformed points
                const dx = absEdgePoint.x - absCenter.x;
                const dy = absEdgePoint.y - absCenter.y;
                const newRadiusScreen = Math.sqrt(dx * dx + dy * dy);

                // Convert to graph coordinates
                const newCenter = screenToGraph(absCenter.x, absCenter.y, width, height, view);
                const newRadius = newRadiusScreen / view.scale;

                // DON'T update circle object itself during transform
                // Only update dependency points in real-time

                if (obj.subType === 'circle-diameter' && obj.dependencies && obj.dependencies.length >= 2) {
                  // For diameter circles: update both endpoints maintaining their angles
                  const angle1 = group.getAttr('_origAngle1');
                  const angle2 = group.getAttr('_origAngle2');

                  if (angle1 !== undefined && angle2 !== undefined) {
                    // Calculate new positions for both diameter endpoints
                    const point1 = {
                      x: newCenter.x + newRadius * Math.cos(angle1),
                      y: newCenter.y + newRadius * Math.sin(angle1)
                    };
                    const point2 = {
                      x: newCenter.x + newRadius * Math.cos(angle2),
                      y: newCenter.y + newRadius * Math.sin(angle2)
                    };

                    updateGeometryObject(obj.dependencies[0], { points: [point1] });
                    updateGeometryObject(obj.dependencies[1], { points: [point2] });
                  }
                } else if (obj.dependencies && obj.dependencies.length >= 1) {
                  // For center-radius circles: update center and radius point
                  // Update center point
                  updateGeometryObject(obj.dependencies[0], {
                    points: [newCenter]
                  });

                  // Update radius point if it exists
                  if (obj.dependencies.length >= 2) {
                    // Use the stored original angle
                    const angle = group.getAttr('_origAngle');
                    if (angle !== undefined) {
                      // Calculate new radius point maintaining the original angle
                      const radiusPoint = {
                        x: newCenter.x + newRadius * Math.cos(angle),
                        y: newCenter.y + newRadius * Math.sin(angle)
                      };
                      updateGeometryObject(obj.dependencies[1], {
                        points: [radiusPoint]
                      });
                    }
                  }
                }
              }}
              onTransformEnd={(e) => {
                const group = e.target;
                const circle = group.findOne('Circle') as Konva.Circle;
                if (!circle) return;

                // Get the absolute transform matrix
                const transform = circle.getAbsoluteTransform();

                // Circle is at (0, 0) in local coordinates, edge is at (radius, 0)
                const localCenter = { x: 0, y: 0 };
                const localEdgePoint = { x: circle.radius(), y: 0 };

                // Transform to absolute screen positions
                const absCenter = transform.point(localCenter);
                const absEdgePoint = transform.point(localEdgePoint);

                // Calculate new radius from transformed points
                const dx = absEdgePoint.x - absCenter.x;
                const dy = absEdgePoint.y - absCenter.y;
                const newRadiusScreen = Math.sqrt(dx * dx + dy * dy);

                // Convert to graph coordinates
                const newCenter = screenToGraph(absCenter.x, absCenter.y, width, height, view);
                const newRadius = newRadiusScreen / view.scale;

                // NOW update circle object (only at the end)
                updateGeometryObject(obj.id, {
                  points: [newCenter],
                  radius: newRadius
                });

                // Dependencies were already updated in onTransform, but update them again for consistency
                if (obj.subType === 'circle-diameter' && obj.dependencies && obj.dependencies.length >= 2) {
                  // For diameter circles: update both endpoints
                  const angle1 = group.getAttr('_origAngle1');
                  const angle2 = group.getAttr('_origAngle2');

                  if (angle1 !== undefined && angle2 !== undefined) {
                    const point1 = {
                      x: newCenter.x + newRadius * Math.cos(angle1),
                      y: newCenter.y + newRadius * Math.sin(angle1)
                    };
                    const point2 = {
                      x: newCenter.x + newRadius * Math.cos(angle2),
                      y: newCenter.y + newRadius * Math.sin(angle2)
                    };

                    updateGeometryObject(obj.dependencies[0], { points: [point1] });
                    updateGeometryObject(obj.dependencies[1], { points: [point2] });
                  }

                  // Clean up stored angles
                  group.setAttr('_origAngle1', null);
                  group.setAttr('_origAngle2', null);
                } else if (obj.dependencies && obj.dependencies.length >= 1) {
                  // For center-radius circles: update center and radius point
                  updateGeometryObject(obj.dependencies[0], {
                    points: [newCenter]
                  });

                  if (obj.dependencies.length >= 2) {
                    // Use the stored original angle
                    const angle = group.getAttr('_origAngle');
                    if (angle !== undefined) {
                      const radiusPoint = {
                        x: newCenter.x + newRadius * Math.cos(angle),
                        y: newCenter.y + newRadius * Math.sin(angle)
                      };
                      updateGeometryObject(obj.dependencies[1], {
                        points: [radiusPoint]
                      });
                    }
                  }

                  // Clean up stored angle
                  group.setAttr('_origAngle', null);
                }

                // Reset group transformation
                group.position({ x: centerScreen.x, y: centerScreen.y });
                group.rotation(0);
                group.scaleX(1);
                group.scaleY(1);
              }}
            >
              <Circle
                x={0}
                y={0}
                radius={radiusInScreen}
                stroke={shapeRenderMode === 'fill' ? undefined : obj.color}
                strokeWidth={shapeRenderMode === 'fill' ? 0 : (isSelected ? 6 : 4)}
                fill={shapeRenderMode === 'stroke' ? undefined : (obj.fillColor || PASTEL_COLORS[geometryObjects.filter(o => o.type === 'polygon' || o.type === 'circle').indexOf(obj) % PASTEL_COLORS.length])}
                fillOpacity={shapeRenderMode === 'stroke' ? 0 : 0.3}
                opacity={isSelected ? 1 : 0.8}
                listening={
                  !isLassoSelecting &&
                  (drawingTool === "select" || drawingTool === "eraser")
                }
                hitStrokeWidth={20}
                perfectDrawEnabled={false}
                globalCompositeOperation={shapeRenderMode === 'stroke' ? 'source-over' : 'multiply'}
                onClick={(e) => {
                  if (drawingTool === "select" && !isLassoSelecting) {
                    e.cancelBubble = true;
                    // Toggle selection with Shift key
                    if (e.evt.shiftKey) {
                      if (selectedIds.includes(obj.id)) {
                        setSelectedIds(
                          selectedIds.filter((id) => id !== obj.id),
                        );
                      } else {
                        setSelectedIds([...selectedIds, obj.id]);
                      }
                    } else {
                      // Single selection
                      setSelectedIds([obj.id]);
                    }
                  }
                }}
                onTap={(e) => {
                  if (drawingTool === "select" && !isLassoSelecting) {
                    e.cancelBubble = true;
                    setSelectedIds([obj.id]);
                  }
                }}
              />
            </Group>
          );
        })}

        {/* Render preview while dragging to create line/circle */}
        {creationState.preview &&
          (() => {
            const { start: firstPointId, end: endPos } = creationState.preview;
            const firstPoint = geometryObjects.find(
              (o) => o.id === firstPointId,
            );

            if (!firstPoint || !firstPoint.points[0]) return null;

            const startPos = firstPoint.points[0];
            const startScreen = graphToScreen(
              startPos.x,
              startPos.y,
              width,
              height,
              view,
            );
            const endScreen = graphToScreen(
              endPos.x,
              endPos.y,
              width,
              height,
              view,
            );

            // Render based on tool type
            if (
              creationState.toolType === "line-segment" ||
              creationState.toolType === "line-infinite" ||
              creationState.toolType === "line-ray"
            ) {
              // Render preview line
              let lineColor = "#4ecdc4"; // Sky blue

              // Calculate line direction
              const dx = endScreen.x - startScreen.x;
              const dy = endScreen.y - startScreen.y;
              const length = Math.sqrt(dx * dx + dy * dy);

              if (length < 0.01) {
                // Too short to draw
                return null;
              }

              const dirX = dx / length;
              const dirY = dy / length;

              // Extend line to canvas boundaries
              const canvasSize = Math.max(width, height) * 2; // Sufficient length

              let points: number[];

              if (creationState.toolType === "line-infinite") {
                // Infinite line: extend in both directions
                const extendedStart = {
                  x: startScreen.x - dirX * canvasSize,
                  y: startScreen.y - dirY * canvasSize,
                };
                const extendedEnd = {
                  x: startScreen.x + dirX * canvasSize,
                  y: startScreen.y + dirY * canvasSize,
                };
                points = [
                  extendedStart.x,
                  extendedStart.y,
                  extendedEnd.x,
                  extendedEnd.y,
                ];
              } else if (creationState.toolType === "line-ray") {
                // Ray: extend from start point through end point
                const extendedEnd = {
                  x: startScreen.x + dirX * canvasSize,
                  y: startScreen.y + dirY * canvasSize,
                };
                points = [
                  startScreen.x,
                  startScreen.y,
                  extendedEnd.x,
                  extendedEnd.y,
                ];
              } else {
                // Segment: just between two points
                points = [
                  startScreen.x,
                  startScreen.y,
                  endScreen.x,
                  endScreen.y,
                ];
              }

              return (
                <Line
                  key="preview-line"
                  points={points}
                  stroke={lineColor}
                  strokeWidth={4}
                  opacity={0.7}
                  listening={false}
                />
              );
            } else if (creationState.toolType === "circle-center-radius") {
              // Render preview circle
              const dx = endPos.x - startPos.x;
              const dy = endPos.y - startPos.y;
              const radiusInGraph = Math.sqrt(dx * dx + dy * dy);
              const radiusInScreen = radiusInGraph * view.scale;

              return (
                <Circle
                  key="preview-circle"
                  x={startScreen.x}
                  y={startScreen.y}
                  radius={radiusInScreen}
                  stroke="#808080"
                  strokeWidth={4}
                  opacity={0.7}
                  listening={false}
                />
              );
            } else if (creationState.toolType === "circle-diameter") {
              // Render preview circle with center at midpoint
              const centerX = (startPos.x + endPos.x) / 2;
              const centerY = (startPos.y + endPos.y) / 2;
              const centerScreen = graphToScreen(
                centerX,
                centerY,
                width,
                height,
                view,
              );

              const dx = endPos.x - startPos.x;
              const dy = endPos.y - startPos.y;
              const diameter = Math.sqrt(dx * dx + dy * dy);
              const radiusInGraph = diameter / 2;
              const radiusInScreen = radiusInGraph * view.scale;

              return (
                <Circle
                  key="preview-circle-diameter"
                  x={centerScreen.x}
                  y={centerScreen.y}
                  radius={radiusInScreen}
                  stroke="#808080"
                  strokeWidth={4}
                  opacity={0.7}
                  listening={false}
                />
              );
            } else if (creationState.toolType === "circle-three-points") {
              // Render preview circle through three points (two fixed + one dragging)
              if (
                creationState.tempPoints &&
                creationState.tempPoints.length === 2 &&
                creationState.preview
              ) {
                const p1 = geometryObjects.find(
                  (o) => o.id === creationState.tempPoints[0],
                );
                const p2 = geometryObjects.find(
                  (o) => o.id === creationState.tempPoints[1],
                );
                // Third point is at the mouse position (endPos)

                if (p1 && p2 && p1.points[0] && p2.points[0]) {
                  const ax = p1.points[0].x,
                    ay = p1.points[0].y;
                  const bx = p2.points[0].x,
                    by = p2.points[0].y;
                  const cx = endPos.x,
                    cy = endPos.y;

                  const thirdPointScreen = graphToScreen(
                    cx,
                    cy,
                    width,
                    height,
                    view,
                  );

                  // Calculate D (determinant)
                  const D =
                    2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

                  if (Math.abs(D) > 0.0001) {
                    // Calculate circumcenter
                    const aSq = ax * ax + ay * ay;
                    const bSq = bx * bx + by * by;
                    const cSq = cx * cx + cy * cy;

                    const centerX =
                      (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / D;
                    const centerY =
                      (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / D;

                    // Calculate radius
                    const dx = ax - centerX;
                    const dy = ay - centerY;
                    const radiusInGraph = Math.sqrt(dx * dx + dy * dy);
                    const radiusInScreen = radiusInGraph * view.scale;

                    const centerScreen = graphToScreen(
                      centerX,
                      centerY,
                      width,
                      height,
                      view,
                    );

                    return (
                      <>
                        <Circle
                          key="preview-circle-three-points"
                          x={centerScreen.x}
                          y={centerScreen.y}
                          radius={radiusInScreen}
                          stroke="#808080"
                          strokeWidth={4}
                          opacity={0.7}
                          listening={false}
                        />
                        <Circle
                          key="preview-third-point"
                          x={thirdPointScreen.x}
                          y={thirdPointScreen.y}
                          radius={5}
                          fill="#4ecdc4"
                          stroke="#4ecdc4"
                          strokeWidth={4}
                          opacity={0.7}
                          listening={false}
                        />
                      </>
                    );
                  }
                }
              }
            } else if (creationState.toolType === "polygon-regular") {
              // Render preview for regular polygon during drag (before dialog opens)
              const sides = 3; // Default to triangle during drag

              const dx = endPos.x - startPos.x;
              const dy = endPos.y - startPos.y;
              const radius = Math.sqrt(dx * dx + dy * dy);
              // Start angle from center to mouse position (first vertex will be at mouse position)
              const startAngle = Math.atan2(dy, dx);

              // Calculate vertices
              const vertices: number[] = [];
              for (let i = 0; i < sides; i++) {
                const angle = startAngle + (i * 2 * Math.PI) / sides;
                const vertexX = startPos.x + radius * Math.cos(angle);
                const vertexY = startPos.y + radius * Math.sin(angle);
                const vertexScreen = graphToScreen(
                  vertexX,
                  vertexY,
                  width,
                  height,
                  view,
                );
                vertices.push(vertexScreen.x, vertexScreen.y);
              }

              return (
                <>
                  <Line
                    key="preview-regular-polygon-fill"
                    points={vertices}
                    fill="#ABD5B1"
                    fillOpacity={0.2}
                    closed={true}
                    listening={false}
                  />
                  <Line
                    key="preview-regular-polygon"
                    points={vertices}
                    stroke="#ABD5B1"
                    strokeWidth={4}
                    opacity={0.7}
                    closed={true}
                    listening={false}
                  />
                </>
              );
            } else if (creationState.toolType === "polygon-rectangle") {
              // Rectangle preview
              const vertices = [
                startPos.x, startPos.y,
                endPos.x, startPos.y,
                endPos.x, endPos.y,
                startPos.x, endPos.y,
              ];
              const screenVertices = [];
              for (let i = 0; i < vertices.length; i += 2) {
                const screen = graphToScreen(vertices[i], vertices[i + 1], width, height, view);
                screenVertices.push(screen.x, screen.y);
              }

              return (
                <>
                  <Line
                    key="preview-rectangle-fill"
                    points={screenVertices}
                    fill="#ABD5B1"
                    fillOpacity={0.2}
                    closed={true}
                    listening={false}
                  />
                  <Line
                    key="preview-rectangle"
                    points={screenVertices}
                    stroke="#ABD5B1"
                    strokeWidth={4}
                    opacity={0.7}
                    closed={true}
                    listening={false}
                  />
                </>
              );
            } else if (creationState.toolType === "polygon-square") {
              // Square preview
              const dx = endPos.x - startPos.x;
              const dy = endPos.y - startPos.y;
              const perpX = -dy;
              const perpY = dx;

              const vertices = [
                startPos.x, startPos.y,
                endPos.x, endPos.y,
                endPos.x + perpX, endPos.y + perpY,
                startPos.x + perpX, startPos.y + perpY,
              ];
              const screenVertices = [];
              for (let i = 0; i < vertices.length; i += 2) {
                const screen = graphToScreen(vertices[i], vertices[i + 1], width, height, view);
                screenVertices.push(screen.x, screen.y);
              }

              return (
                <>
                  <Line
                    key="preview-square-fill"
                    points={screenVertices}
                    fill="#ABD5B1"
                    fillOpacity={0.2}
                    closed={true}
                    listening={false}
                  />
                  <Line
                    key="preview-square"
                    points={screenVertices}
                    stroke="#ABD5B1"
                    strokeWidth={4}
                    opacity={0.7}
                    closed={true}
                    listening={false}
                  />
                </>
              );
            } else if (creationState.toolType === "polygon-parallelogram") {
              // Parallelogram preview
              const dx = endPos.x - startPos.x;
              const dy = endPos.y - startPos.y;
              const angle = Math.PI / 3; // 60 degrees
              const offsetX = dx * Math.cos(angle) - dy * Math.sin(angle);
              const offsetY = dx * Math.sin(angle) + dy * Math.cos(angle);

              const vertices = [
                startPos.x, startPos.y,
                endPos.x, endPos.y,
                endPos.x + offsetX, endPos.y + offsetY,
                startPos.x + offsetX, startPos.y + offsetY,
              ];
              const screenVertices = [];
              for (let i = 0; i < vertices.length; i += 2) {
                const screen = graphToScreen(vertices[i], vertices[i + 1], width, height, view);
                screenVertices.push(screen.x, screen.y);
              }

              return (
                <>
                  <Line
                    key="preview-parallelogram-fill"
                    points={screenVertices}
                    fill="#ABD5B1"
                    fillOpacity={0.2}
                    closed={true}
                    listening={false}
                  />
                  <Line
                    key="preview-parallelogram"
                    points={screenVertices}
                    stroke="#ABD5B1"
                    strokeWidth={4}
                    opacity={0.7}
                    closed={true}
                    listening={false}
                  />
                </>
              );
            } else if (creationState.toolType === "polygon-rhombus") {
              // Rhombus preview
              const centerX = (startPos.x + endPos.x) / 2;
              const centerY = (startPos.y + endPos.y) / 2;
              const diag1Length = Math.sqrt(
                Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2)
              );
              const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
              const perpAngle = angle + Math.PI / 2;
              const diag2HalfLength = diag1Length / 4;

              const p3x = centerX + diag2HalfLength * Math.cos(perpAngle);
              const p3y = centerY + diag2HalfLength * Math.sin(perpAngle);
              const p4x = centerX - diag2HalfLength * Math.cos(perpAngle);
              const p4y = centerY - diag2HalfLength * Math.sin(perpAngle);

              const vertices = [
                startPos.x, startPos.y,
                p3x, p3y,
                endPos.x, endPos.y,
                p4x, p4y,
              ];
              const screenVertices = [];
              for (let i = 0; i < vertices.length; i += 2) {
                const screen = graphToScreen(vertices[i], vertices[i + 1], width, height, view);
                screenVertices.push(screen.x, screen.y);
              }

              return (
                <>
                  <Line
                    key="preview-rhombus-fill"
                    points={screenVertices}
                    fill="#ABD5B1"
                    fillOpacity={0.2}
                    closed={true}
                    listening={false}
                  />
                  <Line
                    key="preview-rhombus"
                    points={screenVertices}
                    stroke="#ABD5B1"
                    strokeWidth={4}
                    opacity={0.7}
                    closed={true}
                    listening={false}
                  />
                </>
              );
            } else if (creationState.toolType === "polygon-kite") {
              // Kite preview
              const dx = endPos.x - startPos.x;
              const dy = endPos.y - startPos.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const perpX = -dy / length * length * 0.3;
              const perpY = dx / length * length * 0.3;
              const wing1X = startPos.x + dx * 0.3;
              const wing1Y = startPos.y + dy * 0.3;

              const vertices = [
                startPos.x, startPos.y,
                wing1X + perpX, wing1Y + perpY,
                endPos.x, endPos.y,
                wing1X - perpX, wing1Y - perpY,
              ];
              const screenVertices = [];
              for (let i = 0; i < vertices.length; i += 2) {
                const screen = graphToScreen(vertices[i], vertices[i + 1], width, height, view);
                screenVertices.push(screen.x, screen.y);
              }

              return (
                <>
                  <Line
                    key="preview-kite-fill"
                    points={screenVertices}
                    fill="#ABD5B1"
                    fillOpacity={0.2}
                    closed={true}
                    listening={false}
                  />
                  <Line
                    key="preview-kite"
                    points={screenVertices}
                    stroke="#ABD5B1"
                    strokeWidth={4}
                    opacity={0.7}
                    closed={true}
                    listening={false}
                  />
                </>
              );
            } else if (creationState.toolType === "polygon-right-triangle") {
              // Right triangle preview
              const dx = endPos.x - startPos.x;
              const dy = endPos.y - startPos.y;
              const p3x = startPos.x - dy;
              const p3y = startPos.y + dx;

              const vertices = [
                startPos.x, startPos.y,
                endPos.x, endPos.y,
                p3x, p3y,
              ];
              const screenVertices = [];
              for (let i = 0; i < vertices.length; i += 2) {
                const screen = graphToScreen(vertices[i], vertices[i + 1], width, height, view);
                screenVertices.push(screen.x, screen.y);
              }

              return (
                <>
                  <Line
                    key="preview-right-triangle-fill"
                    points={screenVertices}
                    fill="#ABD5B1"
                    fillOpacity={0.2}
                    closed={true}
                    listening={false}
                  />
                  <Line
                    key="preview-right-triangle"
                    points={screenVertices}
                    stroke="#ABD5B1"
                    strokeWidth={4}
                    opacity={0.7}
                    closed={true}
                    listening={false}
                  />
                </>
              );
            }

            return null;
          })()}

        {/* Render polygon preview while creating */}
        {geometryTool === "polygon" &&
          creationState.tempPoints &&
          creationState.tempPoints.length > 0 &&
          (() => {
            // Get all temp points
            const tempPoints = creationState.tempPoints
              .map((pointId) => {
                const point = geometryObjects.find((o) => o.id === pointId);
                return point?.points[0];
              })
              .filter((p) => p !== undefined) as GeometryPoint[];

            if (tempPoints.length === 0) return null;

            // Convert to screen coordinates
            const screenPoints: number[] = [];
            tempPoints.forEach((point) => {
              const screenPoint = graphToScreen(
                point.x,
                point.y,
                width,
                height,
                view,
              );
              screenPoints.push(screenPoint.x, screenPoint.y);
            });

            // Add current mouse position if preview exists
            let mouseScreen = null;
            if (creationState.preview) {
              const { end: mousePos } = creationState.preview;
              mouseScreen = graphToScreen(
                mousePos.x,
                mousePos.y,
                width,
                height,
                view,
              );
              screenPoints.push(mouseScreen.x, mouseScreen.y);
            }

            // If we have at least 3 points, also show closing line back to first point
            const closingLinePoints =
              tempPoints.length >= 2 && mouseScreen
                ? [
                    mouseScreen.x,
                    mouseScreen.y,
                    screenPoints[0],
                    screenPoints[1],
                  ]
                : [];

            // Points for filled polygon preview (just use screenPoints, closed=true will auto-close)
            const fillPoints = [...screenPoints];

            return (
              <>
                {/* Filled polygon preview */}
                {tempPoints.length >= 2 && fillPoints.length >= 4 && (
                  <Line
                    key="polygon-preview-fill"
                    points={fillPoints}
                    fill="#ABD5B1"
                    fillOpacity={0.2}
                    closed={true}
                    listening={false}
                  />
                )}
                {/* Polygon outline */}
                <Line
                  key="polygon-preview"
                  points={screenPoints}
                  stroke="#ABD5B1"
                  strokeWidth={4}
                  opacity={0.7}
                  listening={false}
                />
                {/* Closing line (dashed) */}
                {closingLinePoints.length > 0 && (
                  <Line
                    key="polygon-preview-closing"
                    points={closingLinePoints}
                    stroke="#4ecdc4"
                    strokeWidth={4}
                    opacity={0.3}
                    dash={[5, 5]}
                    listening={false}
                  />
                )}
                {/* Start point indicator (orange) */}
                {tempPoints.length > 0 && (
                  <Circle
                    key="polygon-start-point"
                    x={screenPoints[0]}
                    y={screenPoints[1]}
                    radius={8}
                    fill="#ff9800"
                    opacity={0.8}
                    listening={false}
                  />
                )}
              </>
            );
          })()}

        {/* Render regular polygon dialog preview with dashed circle */}
        {regularPolygonDialog.visible &&
          (() => {
            const centerPoint = geometryObjects.find(
              (o) => o.id === regularPolygonDialog.centerPointId,
            );
            const radiusPoint = geometryObjects.find(
              (o) => o.id === regularPolygonDialog.radiusPointId,
            );

            if (
              !centerPoint ||
              !radiusPoint ||
              !centerPoint.points[0] ||
              !radiusPoint.points[0]
            ) {
              return null;
            }

            const center = centerPoint.points[0];
            const radiusPos = radiusPoint.points[0];

            const dx = radiusPos.x - center.x;
            const dy = radiusPos.y - center.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            const radiusInScreen = radius * view.scale;

            const centerScreen = graphToScreen(
              center.x,
              center.y,
              width,
              height,
              view,
            );

            // Calculate polygon vertices
            const sides = regularPolygonDialog.sides;
            const vertices: number[] = [];
            // Start angle from center to radius point (first vertex will be at radius point)
            const startAngle = Math.atan2(
              radiusPos.y - center.y,
              radiusPos.x - center.x,
            );

            for (let i = 0; i < sides; i++) {
              const angle = startAngle + (i * 2 * Math.PI) / sides;
              const vertexX = center.x + radius * Math.cos(angle);
              const vertexY = center.y + radius * Math.sin(angle);
              const vertexScreen = graphToScreen(
                vertexX,
                vertexY,
                width,
                height,
                view,
              );
              vertices.push(vertexScreen.x, vertexScreen.y);
            }

            return (
              <>
                {/* Dashed circumscribed circle */}
                <Circle
                  key="dialog-preview-circle"
                  x={centerScreen.x}
                  y={centerScreen.y}
                  radius={radiusInScreen}
                  stroke="#888"
                  strokeWidth={1}
                  opacity={0.5}
                  dash={[5, 5]}
                  listening={false}
                />
                {/* Polygon fill */}
                <Line
                  key="dialog-preview-polygon-fill"
                  points={vertices}
                  fill="#ABD5B1"
                  fillOpacity={0.15}
                  closed={true}
                  listening={false}
                />
                {/* Polygon stroke */}
                <Line
                  key="dialog-preview-polygon"
                  points={vertices}
                  stroke="#ABD5B1"
                  strokeWidth={4}
                  opacity={0.8}
                  closed={true}
                  listening={false}
                />
              </>
            );
          })()}

        {/* Render all points LAST (so they appear on top) */}
        {geometryObjects.map((obj) => {
          if (!obj.visible) return null;
          if (obj.type !== "point" || !obj.points || obj.points.length === 0)
            return null;

          // Hide points based on visibility mode
          if (pointVisibilityMode === "hide") return null;

          const point = obj.points[0];
          const screenPos = graphToScreen(
            point.x,
            point.y,
            width,
            height,
            view,
          );
          const isSelected = selectedIds.includes(obj.id);

          // Calculate radius based on scale to maintain constant visual size
          const scale = obj.scale || 1;
          const baseRadius = isSelected ? 7 : 5;
          const radius = baseRadius / scale;
          const strokeWidth = (isSelected ? 3 : 2) / scale;

          // Helper function to update dependent objects (midpoints, lines, etc.)
          const updateDependentObjects = (newGraphPos: {
            x: number;
            y: number;
          }) => {
            if (obj.dependents && obj.dependents.length > 0) {
              obj.dependents.forEach((dependentId) => {
                const dependent = geometryObjects.find(
                  (o) => o.id === dependentId,
                );
                if (!dependent) return;

                // Update midpoints
                if (
                  dependent.subType === "point-midpoint" &&
                  dependent.dependencies
                ) {
                  const dep1 = geometryObjects.find(
                    (o) => o.id === dependent.dependencies![0],
                  );
                  const dep2 = geometryObjects.find(
                    (o) => o.id === dependent.dependencies![1],
                  );

                  if (dep1 && dep2 && dep1.points[0] && dep2.points[0]) {
                    // Use updated position if this is one of the dependencies
                    const point1 =
                      dep1.id === obj.id ? newGraphPos : dep1.points[0];
                    const point2 =
                      dep2.id === obj.id ? newGraphPos : dep2.points[0];

                    // Get ratio (default to 1:1 midpoint if not specified)
                    const ratio = dependent.ratio || { m: 1, n: 1 };

                    // Calculate division point using formula: (n*P1 + m*P2) / (m+n)
                    const divX =
                      (ratio.n * point1.x + ratio.m * point2.x) /
                      (ratio.m + ratio.n);
                    const divY =
                      (ratio.n * point1.y + ratio.m * point2.y) /
                      (ratio.m + ratio.n);

                    updateGeometryObject(dependentId, {
                      points: [{ x: divX, y: divY }],
                    });
                  }
                }

                // Update lines (segment, infinite line, ray)
                if (
                  ["segment", "line", "ray"].includes(dependent.type) &&
                  dependent.linePoints
                ) {
                  const dep1 = geometryObjects.find(
                    (o) => o.id === dependent.linePoints!.point1Id,
                  );
                  const dep2 = geometryObjects.find(
                    (o) => o.id === dependent.linePoints!.point2Id,
                  );

                  if (dep1 && dep2 && dep1.points[0] && dep2.points[0]) {
                    // Use updated position if this is one of the dependencies
                    const point1 =
                      dep1.id === obj.id ? newGraphPos : dep1.points[0];
                    const point2 =
                      dep2.id === obj.id ? newGraphPos : dep2.points[0];

                    updateGeometryObject(dependentId, {
                      points: [point1, point2],
                    });
                  }
                }

                // Update circles
                if (dependent.type === "circle" && dependent.circleConfig) {
                  // Handle circle-center-radius
                  if (
                    dependent.circleConfig.centerId &&
                    dependent.circleConfig.radiusPointId
                  ) {
                    const centerPoint = geometryObjects.find(
                      (o) => o.id === dependent.circleConfig!.centerId,
                    );
                    const radiusPoint = geometryObjects.find(
                      (o) => o.id === dependent.circleConfig!.radiusPointId,
                    );

                    if (
                      centerPoint &&
                      radiusPoint &&
                      centerPoint.points[0] &&
                      radiusPoint.points[0]
                    ) {
                      // Use updated position if this is one of the dependencies
                      const center =
                        centerPoint.id === obj.id
                          ? newGraphPos
                          : centerPoint.points[0];
                      const radius =
                        radiusPoint.id === obj.id
                          ? newGraphPos
                          : radiusPoint.points[0];

                      // Calculate new radius
                      const dx = radius.x - center.x;
                      const dy = radius.y - center.y;
                      const newRadius = Math.sqrt(dx * dx + dy * dy);

                      // Update circle object in store
                      updateGeometryObject(dependentId, {
                        points: [center],
                        radius: newRadius,
                      });
                    }
                  }
                  // Handle circle-diameter
                  else if (
                    dependent.circleConfig.point1Id &&
                    dependent.circleConfig.point2Id &&
                    !dependent.circleConfig.point3Id
                  ) {
                    const point1 = geometryObjects.find(
                      (o) => o.id === dependent.circleConfig!.point1Id,
                    );
                    const point2 = geometryObjects.find(
                      (o) => o.id === dependent.circleConfig!.point2Id,
                    );

                    if (
                      point1 &&
                      point2 &&
                      point1.points[0] &&
                      point2.points[0]
                    ) {
                      // Use updated position if this is one of the dependencies
                      const p1 =
                        point1.id === obj.id ? newGraphPos : point1.points[0];
                      const p2 =
                        point2.id === obj.id ? newGraphPos : point2.points[0];

                      // Calculate center (midpoint)
                      const centerX = (p1.x + p2.x) / 2;
                      const centerY = (p1.y + p2.y) / 2;

                      // Calculate radius (half distance)
                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const diameter = Math.sqrt(dx * dx + dy * dy);
                      const newRadius = diameter / 2;

                      // Update circle object in store
                      updateGeometryObject(dependentId, {
                        points: [{ x: centerX, y: centerY }],
                        radius: newRadius,
                      });
                    }
                  }
                  // Handle circle-three-points
                  else if (
                    dependent.circleConfig.point1Id &&
                    dependent.circleConfig.point2Id &&
                    dependent.circleConfig.point3Id
                  ) {
                    const point1 = geometryObjects.find(
                      (o) => o.id === dependent.circleConfig!.point1Id,
                    );
                    const point2 = geometryObjects.find(
                      (o) => o.id === dependent.circleConfig!.point2Id,
                    );
                    const point3 = geometryObjects.find(
                      (o) => o.id === dependent.circleConfig!.point3Id,
                    );

                    if (
                      point1 &&
                      point2 &&
                      point3 &&
                      point1.points[0] &&
                      point2.points[0] &&
                      point3.points[0]
                    ) {
                      // Use updated position if this is one of the dependencies
                      const p1 =
                        point1.id === obj.id ? newGraphPos : point1.points[0];
                      const p2 =
                        point2.id === obj.id ? newGraphPos : point2.points[0];
                      const p3 =
                        point3.id === obj.id ? newGraphPos : point3.points[0];

                      // Calculate circumcircle center and radius
                      const ax = p1.x,
                        ay = p1.y;
                      const bx = p2.x,
                        by = p2.y;
                      const cx = p3.x,
                        cy = p3.y;

                      // Calculate D (determinant) to check if points are collinear
                      const D =
                        2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

                      if (Math.abs(D) > 0.0001) {
                        // Calculate circumcenter
                        const aSq = ax * ax + ay * ay;
                        const bSq = bx * bx + by * by;
                        const cSq = cx * cx + cy * cy;

                        const centerX =
                          (aSq * (by - cy) +
                            bSq * (cy - ay) +
                            cSq * (ay - by)) /
                          D;
                        const centerY =
                          (aSq * (cx - bx) +
                            bSq * (ax - cx) +
                            cSq * (bx - ax)) /
                          D;

                        // Calculate radius
                        const dx = ax - centerX;
                        const dy = ay - centerY;
                        const newRadius = Math.sqrt(dx * dx + dy * dy);

                        // Update circle object in store
                        updateGeometryObject(dependentId, {
                          points: [{ x: centerX, y: centerY }],
                          radius: newRadius,
                        });
                      }
                    }
                  }
                }

                // Update polygons
                if (dependent.type === "polygon" && dependent.dependencies) {
                  // Check if it's a regular polygon
                  if (
                    dependent.subType === "polygon-regular" &&
                    dependent.sides
                  ) {
                    // Regular polygon: recalculate based on center and radius point
                    const sides = dependent.sides;

                    if (dependent.dependencies.length === 2) {
                      const centerPoint = geometryObjects.find(
                        (o) => o.id === dependent.dependencies[0],
                      );
                      const vertexPoint = geometryObjects.find(
                        (o) => o.id === dependent.dependencies[1],
                      );

                      if (
                        centerPoint &&
                        vertexPoint &&
                        centerPoint.points[0] &&
                        vertexPoint.points[0]
                      ) {
                        let center: GeometryPoint;
                        let vertex: GeometryPoint;

                        // If center point moved: translate entire polygon (keep radius and rotation)
                        if (centerPoint.id === obj.id) {
                          center = newGraphPos;
                          // Move vertex point by the same offset to maintain relative position
                          const dx = newGraphPos.x - centerPoint.points[0].x;
                          const dy = newGraphPos.y - centerPoint.points[0].y;
                          vertex = {
                            x: vertexPoint.points[0].x + dx,
                            y: vertexPoint.points[0].y + dy,
                          };
                          // Update the vertex point position
                          updateGeometryObject(vertexPoint.id, {
                            points: [vertex],
                          });
                        }
                        // If vertex point moved: rotate and scale polygon
                        else if (vertexPoint.id === obj.id) {
                          center = centerPoint.points[0];
                          vertex = newGraphPos;
                        }
                        // Neither point moved (shouldn't happen in this context)
                        else {
                          center = centerPoint.points[0];
                          vertex = vertexPoint.points[0];
                        }

                        const dx = vertex.x - center.x;
                        const dy = vertex.y - center.y;
                        const radius = Math.sqrt(dx * dx + dy * dy);
                        const startAngle = Math.atan2(dy, dx);

                        const vertices: GeometryPoint[] = [];
                        for (let i = 0; i < sides; i++) {
                          const angle = startAngle + (i * 2 * Math.PI) / sides;
                          vertices.push({
                            x: center.x + radius * Math.cos(angle),
                            y: center.y + radius * Math.sin(angle),
                          });
                        }

                        updateGeometryObject(dependentId, {
                          points: vertices,
                        });
                      }
                    }
                  } else if (dependent.subType === "polygon-rhombus" && dependent.dependencies.length === 2) {
                    // Rhombus: two points define one diagonal
                    const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                    const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                    if (point1 && point2 && point1.points[0] && point2.points[0]) {
                      const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                      const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                      const centerX = (p1.x + p2.x) / 2;
                      const centerY = (p1.y + p2.y) / 2;
                      const diag1Length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                      const perpAngle = angle + Math.PI / 2;
                      const diag2HalfLength = diag1Length / 4;

                      const vertices = [
                        { x: p1.x, y: p1.y },
                        { x: centerX + diag2HalfLength * Math.cos(perpAngle), y: centerY + diag2HalfLength * Math.sin(perpAngle) },
                        { x: p2.x, y: p2.y },
                        { x: centerX - diag2HalfLength * Math.cos(perpAngle), y: centerY - diag2HalfLength * Math.sin(perpAngle) },
                      ];

                      updateGeometryObject(dependentId, { points: vertices });
                    }
                  } else if (dependent.subType === "polygon-square" && dependent.dependencies.length === 2) {
                    // Square: two points define one side
                    const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                    const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                    if (point1 && point2 && point1.points[0] && point2.points[0]) {
                      const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                      const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const perpX = -dy;
                      const perpY = dx;

                      const vertices = [
                        { x: p1.x, y: p1.y },
                        { x: p2.x, y: p2.y },
                        { x: p2.x + perpX, y: p2.y + perpY },
                        { x: p1.x + perpX, y: p1.y + perpY },
                      ];

                      updateGeometryObject(dependentId, { points: vertices });
                    }
                  } else if (dependent.subType === "polygon-parallelogram" && dependent.dependencies.length === 2) {
                    // Parallelogram: two points define one side
                    const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                    const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                    if (point1 && point2 && point1.points[0] && point2.points[0]) {
                      const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                      const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const angle = Math.PI / 3;
                      const offsetX = dx * Math.cos(angle) - dy * Math.sin(angle);
                      const offsetY = dx * Math.sin(angle) + dy * Math.cos(angle);

                      const vertices = [
                        { x: p1.x, y: p1.y },
                        { x: p2.x, y: p2.y },
                        { x: p2.x + offsetX, y: p2.y + offsetY },
                        { x: p1.x + offsetX, y: p1.y + offsetY },
                      ];

                      updateGeometryObject(dependentId, { points: vertices });
                    }
                  } else if (dependent.subType === "polygon-rectangle" && dependent.dependencies.length === 2) {
                    // Rectangle: two points define the diagonal
                    const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                    const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                    if (point1 && point2 && point1.points[0] && point2.points[0]) {
                      const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                      const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                      const vertices = [
                        { x: p1.x, y: p1.y },
                        { x: p2.x, y: p1.y },
                        { x: p2.x, y: p2.y },
                        { x: p1.x, y: p2.y },
                      ];

                      updateGeometryObject(dependentId, { points: vertices });
                    }
                  } else if (dependent.subType === "polygon-kite" && dependent.dependencies.length === 2) {
                    // Kite: two points define the axis of symmetry
                    const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                    const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                    if (point1 && point2 && point1.points[0] && point2.points[0]) {
                      const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                      const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const length = Math.sqrt(dx * dx + dy * dy);
                      const perpX = -dy / length * length * 0.3;
                      const perpY = dx / length * length * 0.3;
                      const wing1X = p1.x + dx * 0.3;
                      const wing1Y = p1.y + dy * 0.3;

                      const vertices = [
                        { x: p1.x, y: p1.y },
                        { x: wing1X + perpX, y: wing1Y + perpY },
                        { x: p2.x, y: p2.y },
                        { x: wing1X - perpX, y: wing1Y - perpY },
                      ];

                      updateGeometryObject(dependentId, { points: vertices });
                    }
                  } else if (dependent.subType === "polygon-right-triangle" && dependent.dependencies.length === 2) {
                    // Right triangle: two points define the hypotenuse
                    const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                    const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                    if (point1 && point2 && point1.points[0] && point2.points[0]) {
                      const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                      const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const p3x = p1.x - dy;
                      const p3y = p1.y + dx;

                      const vertices = [
                        { x: p1.x, y: p1.y },
                        { x: p2.x, y: p2.y },
                        { x: p3x, y: p3y },
                      ];

                      updateGeometryObject(dependentId, { points: vertices });
                    }
                  } else {
                    // Regular polygon: update based on all dependency points
                    const polygonPoints = dependent.dependencies
                      .map((depId) => {
                        const depPoint = geometryObjects.find(
                          (o) => o.id === depId,
                        );
                        if (!depPoint || !depPoint.points[0]) return null;

                        // Use updated position if this is the moved point
                        return depPoint.id === obj.id
                          ? newGraphPos
                          : depPoint.points[0];
                      })
                      .filter((p) => p !== null) as GeometryPoint[];

                    if (polygonPoints.length >= 3) {
                      updateGeometryObject(dependentId, {
                        points: polygonPoints,
                      });
                    }
                  }
                }
              });
            }
          };

          return (
            <Group
              key={obj.id}
              id={obj.id}
              x={screenPos.x}
              y={screenPos.y}
              draggable={
                drawingTool === "select" &&
                !isLassoSelecting &&
                obj.subType !== "point-midpoint"
              }
              listening={true}
              onDragStart={(e) => {
                const node = e.target;
                // Store original graph position at drag start
                node.setAttr('_origGraphPos', { x: obj.points[0].x, y: obj.points[0].y });
              }}
              onDragMove={(e) => {
                const node = e.target;

                const x = node.x();
                const y = node.y();

                // Convert new screen position to graph coordinates
                let newGraphPos = screenToGraph(x, y, width, height, view);

                // If point is constrained, project it onto the constraint object
                if (obj.constraint) {
                  const constraintObj = geometryObjects.find(
                    (o) => o.id === obj.constraint!.objectId,
                  );

                  if (constraintObj) {
                    if (
                      obj.constraint.type === "line" &&
                      constraintObj.points &&
                      constraintObj.points.length >= 2
                    ) {
                      // Project onto line
                      const p1 = constraintObj.points[0];
                      const p2 = constraintObj.points[1];
                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const lengthSq = dx * dx + dy * dy;

                      if (lengthSq > 0) {
                        let t =
                          ((newGraphPos.x - p1.x) * dx +
                            (newGraphPos.y - p1.y) * dy) /
                          lengthSq;

                        // Constrain t based on line type
                        if (constraintObj.type === "segment") {
                          t = Math.max(0, Math.min(1, t));
                        } else if (constraintObj.type === "ray") {
                          t = Math.max(0, t);
                        }

                        newGraphPos = {
                          x: p1.x + t * dx,
                          y: p1.y + t * dy,
                        };
                      }
                    } else if (
                      obj.constraint.type === "circle" &&
                      constraintObj.points &&
                      constraintObj.radius !== undefined
                    ) {
                      // Project onto circle
                      const center = constraintObj.points[0];
                      const angle = Math.atan2(
                        newGraphPos.y - center.y,
                        newGraphPos.x - center.x,
                      );

                      newGraphPos = {
                        x: center.x + constraintObj.radius * Math.cos(angle),
                        y: center.y + constraintObj.radius * Math.sin(angle),
                      };
                    } else if (
                      obj.constraint.type === "polygon" &&
                      constraintObj.points &&
                      constraintObj.points.length >= 3
                    ) {
                      // Project onto polygon edge
                      let closestDist = Infinity;
                      let closestEdge = 0;
                      let closestT = 0;
                      let closestPoint = newGraphPos;

                      // Find closest edge
                      for (let i = 0; i < constraintObj.points.length; i++) {
                        const p1 = constraintObj.points[i];
                        const p2 =
                          constraintObj.points[
                            (i + 1) % constraintObj.points.length
                          ];
                        const dx = p2.x - p1.x;
                        const dy = p2.y - p1.y;
                        const lengthSq = dx * dx + dy * dy;

                        if (lengthSq > 0) {
                          let t =
                            ((newGraphPos.x - p1.x) * dx +
                              (newGraphPos.y - p1.y) * dy) /
                            lengthSq;
                          t = Math.max(0, Math.min(1, t));

                          const projX = p1.x + t * dx;
                          const projY = p1.y + t * dy;
                          const dist = Math.sqrt(
                            Math.pow(newGraphPos.x - projX, 2) +
                              Math.pow(newGraphPos.y - projY, 2),
                          );

                          if (dist < closestDist) {
                            closestDist = dist;
                            closestEdge = i;
                            closestT = t;
                            closestPoint = { x: projX, y: projY };
                          }
                        }
                      }

                      newGraphPos = closestPoint;
                    }
                  }
                }

                // Store the calculated position for onDragEnd
                node.setAttr('_newGraphPos', newGraphPos);

                // If constrained, update node position to the constrained position
                if (obj.constraint) {
                  const constrainedScreenPos = graphToScreen(newGraphPos.x, newGraphPos.y, width, height, view);
                  node.position({ x: constrainedScreenPos.x, y: constrainedScreenPos.y });
                }

                // Update dependent objects visually during drag
                if (obj.dependents && obj.dependents.length > 0) {
                  obj.dependents.forEach((dependentId) => {
                    const dependent = geometryObjects.find(
                      (o) => o.id === dependentId,
                    );
                    if (!dependent) return;

                    // Update midpoints
                    if (
                      dependent.subType === "point-midpoint" &&
                      dependent.dependencies
                    ) {
                      const dep1 = geometryObjects.find(
                        (o) => o.id === dependent.dependencies![0],
                      );
                      const dep2 = geometryObjects.find(
                        (o) => o.id === dependent.dependencies![1],
                      );

                      if (dep1 && dep2 && dep1.points[0] && dep2.points[0]) {
                        // Use updated position if this is one of the dependencies
                        const point1 =
                          dep1.id === obj.id ? newGraphPos : dep1.points[0];
                        const point2 =
                          dep2.id === obj.id ? newGraphPos : dep2.points[0];

                        // Get ratio (default to 1:1 midpoint if not specified)
                        const ratio = dependent.ratio || { m: 1, n: 1 };

                        // Calculate division point using formula: (n*P1 + m*P2) / (m+n)
                        const divX =
                          (ratio.n * point1.x + ratio.m * point2.x) /
                          (ratio.m + ratio.n);
                        const divY =
                          (ratio.n * point1.y + ratio.m * point2.y) /
                          (ratio.m + ratio.n);

                        // Update the midpoint's visual position immediately
                        const midpointNode = layerRef.current?.findOne(`#${dependentId}`);
                        if (midpointNode) {
                          const newMidpointScreen = graphToScreen(divX, divY, width, height, view);
                          midpointNode.position({ x: newMidpointScreen.x, y: newMidpointScreen.y });
                        }
                      }
                    }

                    // Update circles
                    if (dependent.type === "circle" && dependent.circleConfig) {
                      // Handle circle-center-radius
                      if (
                        dependent.circleConfig.centerId &&
                        dependent.circleConfig.radiusPointId
                      ) {
                        const centerPoint = geometryObjects.find(
                          (o) => o.id === dependent.circleConfig!.centerId,
                        );
                        const radiusPoint = geometryObjects.find(
                          (o) => o.id === dependent.circleConfig!.radiusPointId,
                        );

                        if (
                          centerPoint &&
                          radiusPoint &&
                          centerPoint.points[0] &&
                          radiusPoint.points[0]
                        ) {
                          // Use updated position if this is one of the dependencies
                          const center =
                            centerPoint.id === obj.id
                              ? newGraphPos
                              : centerPoint.points[0];
                          const radiusPos =
                            radiusPoint.id === obj.id
                              ? newGraphPos
                              : radiusPoint.points[0];

                          // Calculate new radius
                          const dx = radiusPos.x - center.x;
                          const dy = radiusPos.y - center.y;
                          const newRadius = Math.sqrt(dx * dx + dy * dy);

                          // Update circle visual
                          const circleGroup = layerRef.current?.findOne(`#${dependentId}`);
                          if (circleGroup) {
                            const circleElement = circleGroup.findOne((node: any) => node.getClassName() === 'Circle');
                            if (circleElement) {
                              const centerScreen = graphToScreen(center.x, center.y, width, height, view);
                              const radiusScreen = newRadius * view.scale;

                              circleGroup.position({ x: centerScreen.x, y: centerScreen.y });
                              circleElement.radius(radiusScreen);

                              // Reset center point scale if it exists
                              if (dependent.circleConfig && dependent.circleConfig.centerId) {
                                const centerNode = layerRef.current?.findOne(`#${dependent.circleConfig.centerId}`);
                                if (centerNode) {
                                  centerNode.scaleX(1);
                                  centerNode.scaleY(1);
                                }
                              }

                              circleElement.getLayer()?.batchDraw();
                            }
                          }
                        }
                      }
                      // Handle circle-diameter
                      else if (
                        dependent.circleConfig.point1Id &&
                        dependent.circleConfig.point2Id &&
                        !dependent.circleConfig.point3Id
                      ) {
                        const point1 = geometryObjects.find(
                          (o) => o.id === dependent.circleConfig!.point1Id,
                        );
                        const point2 = geometryObjects.find(
                          (o) => o.id === dependent.circleConfig!.point2Id,
                        );

                        if (
                          point1 &&
                          point2 &&
                          point1.points[0] &&
                          point2.points[0]
                        ) {
                          // Use updated position if this is one of the dependencies
                          const p1 =
                            point1.id === obj.id ? newGraphPos : point1.points[0];
                          const p2 =
                            point2.id === obj.id ? newGraphPos : point2.points[0];

                          // Calculate center (midpoint)
                          const centerX = (p1.x + p2.x) / 2;
                          const centerY = (p1.y + p2.y) / 2;

                          // Calculate radius (half distance)
                          const dx = p2.x - p1.x;
                          const dy = p2.y - p1.y;
                          const diameter = Math.sqrt(dx * dx + dy * dy);
                          const newRadius = diameter / 2;

                          // Update circle visual
                          const circleGroup = layerRef.current?.findOne(`#${dependentId}`);
                          if (circleGroup) {
                            const circleElement = circleGroup.findOne((node: any) => node.getClassName() === 'Circle');
                            if (circleElement) {
                              const centerScreen = graphToScreen(centerX, centerY, width, height, view);
                              const radiusScreen = newRadius * view.scale;

                              circleGroup.position({ x: centerScreen.x, y: centerScreen.y });
                              circleElement.radius(radiusScreen);

                              // Reset diameter endpoint scales
                              if (dependent.circleConfig && dependent.circleConfig.point1Id && dependent.circleConfig.point2Id) {
                                const point1Node = layerRef.current?.findOne(`#${dependent.circleConfig.point1Id}`);
                                const point2Node = layerRef.current?.findOne(`#${dependent.circleConfig.point2Id}`);
                                if (point1Node) {
                                  point1Node.scaleX(1);
                                  point1Node.scaleY(1);
                                }
                                if (point2Node) {
                                  point2Node.scaleX(1);
                                  point2Node.scaleY(1);
                                }
                              }

                              circleElement.getLayer()?.batchDraw();
                            }
                          }
                        }
                      }
                      // Handle circle-3points
                      else if (
                        dependent.circleConfig.point1Id &&
                        dependent.circleConfig.point2Id &&
                        dependent.circleConfig.point3Id
                      ) {
                        const point1 = geometryObjects.find(
                          (o) => o.id === dependent.circleConfig!.point1Id,
                        );
                        const point2 = geometryObjects.find(
                          (o) => o.id === dependent.circleConfig!.point2Id,
                        );
                        const point3 = geometryObjects.find(
                          (o) => o.id === dependent.circleConfig!.point3Id,
                        );

                        if (
                          point1 &&
                          point2 &&
                          point3 &&
                          point1.points[0] &&
                          point2.points[0] &&
                          point3.points[0]
                        ) {
                          // Use updated position if this is one of the dependencies
                          const p1 =
                            point1.id === obj.id ? newGraphPos : point1.points[0];
                          const p2 =
                            point2.id === obj.id ? newGraphPos : point2.points[0];
                          const p3 =
                            point3.id === obj.id ? newGraphPos : point3.points[0];

                          // Calculate circumcircle (same formula as in updateDependentObjects)
                          const ax = p1.x;
                          const ay = p1.y;
                          const bx = p2.x;
                          const by = p2.y;
                          const cx = p3.x;
                          const cy = p3.y;

                          const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
                          if (Math.abs(d) > 0.0001) {
                            const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
                            const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

                            const dx = p1.x - ux;
                            const dy = p1.y - uy;
                            const newRadius = Math.sqrt(dx * dx + dy * dy);

                            // Update circle visual
                            const circleGroup = layerRef.current?.findOne(`#${dependentId}`);
                            if (circleGroup) {
                              const circleElement = circleGroup.findOne((node: any) => node.getClassName() === 'Circle');
                              if (circleElement) {
                                const centerScreen = graphToScreen(ux, uy, width, height, view);
                                const radiusScreen = newRadius * view.scale;

                                circleGroup.position({ x: centerScreen.x, y: centerScreen.y });
                                circleElement.radius(radiusScreen);

                                // Reset 3-point scales
                                if (dependent.circleConfig && dependent.circleConfig.point1Id && dependent.circleConfig.point2Id && dependent.circleConfig.point3Id) {
                                  const point1Node = layerRef.current?.findOne(`#${dependent.circleConfig.point1Id}`);
                                  const point2Node = layerRef.current?.findOne(`#${dependent.circleConfig.point2Id}`);
                                  const point3Node = layerRef.current?.findOne(`#${dependent.circleConfig.point3Id}`);
                                  if (point1Node) {
                                    point1Node.scaleX(1);
                                    point1Node.scaleY(1);
                                  }
                                  if (point2Node) {
                                    point2Node.scaleX(1);
                                    point2Node.scaleY(1);
                                  }
                                  if (point3Node) {
                                    point3Node.scaleX(1);
                                    point3Node.scaleY(1);
                                  }
                                }

                                circleElement.getLayer()?.batchDraw();
                              }
                            }
                          }
                        }
                      }
                    }

                    // Update polygons
                    if (dependent.type === "polygon" && dependent.dependencies) {
                      let polygonPoints: GeometryPoint[] = [];
                      let allPointsFound = true;

                      // Check if it's a regular polygon
                      if (
                        dependent.subType === "polygon-regular" &&
                        dependent.sides &&
                        dependent.dependencies.length === 2
                      ) {
                        // Regular polygon: recalculate based on center and radius point
                        const centerPoint = geometryObjects.find(
                          (o) => o.id === dependent.dependencies[0],
                        );
                        const vertexPoint = geometryObjects.find(
                          (o) => o.id === dependent.dependencies[1],
                        );

                        if (
                          centerPoint &&
                          vertexPoint &&
                          centerPoint.points[0] &&
                          vertexPoint.points[0]
                        ) {
                          let center: GeometryPoint;
                          let vertex: GeometryPoint;

                          // Use updated position if this is one of the dependencies
                          if (centerPoint.id === obj.id) {
                            center = newGraphPos;
                            // Move vertex point by the same offset to maintain relative position
                            const dx = newGraphPos.x - centerPoint.points[0].x;
                            const dy = newGraphPos.y - centerPoint.points[0].y;
                            vertex = {
                              x: vertexPoint.points[0].x + dx,
                              y: vertexPoint.points[0].y + dy,
                            };

                            // Update vertex point's visual position immediately
                            const vertexNode = layerRef.current?.findOne(`#${vertexPoint.id}`);
                            if (vertexNode) {
                              const newVertexScreen = graphToScreen(vertex.x, vertex.y, width, height, view);
                              vertexNode.position({ x: newVertexScreen.x, y: newVertexScreen.y });
                            }
                          } else if (vertexPoint.id === obj.id) {
                            center = centerPoint.points[0];
                            vertex = newGraphPos;
                          } else {
                            center = centerPoint.points[0];
                            vertex = vertexPoint.points[0];
                          }

                          const dx = vertex.x - center.x;
                          const dy = vertex.y - center.y;
                          const radius = Math.sqrt(dx * dx + dy * dy);
                          const startAngle = Math.atan2(dy, dx);

                          // Calculate vertices
                          for (let i = 0; i < dependent.sides; i++) {
                            const angle = startAngle + (i * 2 * Math.PI) / dependent.sides;
                            polygonPoints.push({
                              x: center.x + radius * Math.cos(angle),
                              y: center.y + radius * Math.sin(angle),
                            });
                          }
                        } else {
                          allPointsFound = false;
                        }
                      } else if (dependent.subType === "polygon-rhombus" && dependent.dependencies.length === 2) {
                        // Rhombus: two points define one diagonal
                        const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                        const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                        if (point1 && point2 && point1.points[0] && point2.points[0]) {
                          const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                          const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                          // Center of the rhombus
                          const centerX = (p1.x + p2.x) / 2;
                          const centerY = (p1.y + p2.y) / 2;

                          // Length of first diagonal
                          const diag1Length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

                          // Create perpendicular diagonal
                          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                          const perpAngle = angle + Math.PI / 2;
                          const diag2HalfLength = diag1Length / 4;

                          const p3x = centerX + diag2HalfLength * Math.cos(perpAngle);
                          const p3y = centerY + diag2HalfLength * Math.sin(perpAngle);
                          const p4x = centerX - diag2HalfLength * Math.cos(perpAngle);
                          const p4y = centerY - diag2HalfLength * Math.sin(perpAngle);

                          polygonPoints = [
                            { x: p1.x, y: p1.y },
                            { x: p3x, y: p3y },
                            { x: p2.x, y: p2.y },
                            { x: p4x, y: p4y },
                          ];
                        } else {
                          allPointsFound = false;
                        }
                      } else if (dependent.subType === "polygon-square" && dependent.dependencies.length === 2) {
                        // Square: two points define one side
                        const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                        const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                        if (point1 && point2 && point1.points[0] && point2.points[0]) {
                          const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                          const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                          // Calculate perpendicular vector
                          const dx = p2.x - p1.x;
                          const dy = p2.y - p1.y;
                          const perpX = -dy;
                          const perpY = dx;

                          polygonPoints = [
                            { x: p1.x, y: p1.y },
                            { x: p2.x, y: p2.y },
                            { x: p2.x + perpX, y: p2.y + perpY },
                            { x: p1.x + perpX, y: p1.y + perpY },
                          ];
                        } else {
                          allPointsFound = false;
                        }
                      } else if (dependent.subType === "polygon-parallelogram" && dependent.dependencies.length === 2) {
                        // Parallelogram: two points define one side
                        const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                        const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                        if (point1 && point2 && point1.points[0] && point2.points[0]) {
                          const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                          const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                          const dx = p2.x - p1.x;
                          const dy = p2.y - p1.y;

                          // Create offset vector at 60 degrees from the base
                          const angle = Math.PI / 3; // 60 degrees
                          const offsetX = dx * Math.cos(angle) - dy * Math.sin(angle);
                          const offsetY = dx * Math.sin(angle) + dy * Math.cos(angle);

                          polygonPoints = [
                            { x: p1.x, y: p1.y },
                            { x: p2.x, y: p2.y },
                            { x: p2.x + offsetX, y: p2.y + offsetY },
                            { x: p1.x + offsetX, y: p1.y + offsetY },
                          ];
                        } else {
                          allPointsFound = false;
                        }
                      } else if (dependent.subType === "polygon-rectangle" && dependent.dependencies.length === 2) {
                        // Rectangle: two points define the diagonal
                        const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                        const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                        if (point1 && point2 && point1.points[0] && point2.points[0]) {
                          const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                          const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                          polygonPoints = [
                            { x: p1.x, y: p1.y },
                            { x: p2.x, y: p1.y },
                            { x: p2.x, y: p2.y },
                            { x: p1.x, y: p2.y },
                          ];
                        } else {
                          allPointsFound = false;
                        }
                      } else if (dependent.subType === "polygon-kite" && dependent.dependencies.length === 2) {
                        // Kite: two points define the axis of symmetry
                        const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                        const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                        if (point1 && point2 && point1.points[0] && point2.points[0]) {
                          const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                          const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                          const dx = p2.x - p1.x;
                          const dy = p2.y - p1.y;
                          const length = Math.sqrt(dx * dx + dy * dy);
                          const perpX = -dy / length * length * 0.3;
                          const perpY = dx / length * length * 0.3;
                          const wing1X = p1.x + dx * 0.3;
                          const wing1Y = p1.y + dy * 0.3;

                          polygonPoints = [
                            { x: p1.x, y: p1.y },
                            { x: wing1X + perpX, y: wing1Y + perpY },
                            { x: p2.x, y: p2.y },
                            { x: wing1X - perpX, y: wing1Y - perpY },
                          ];
                        } else {
                          allPointsFound = false;
                        }
                      } else if (dependent.subType === "polygon-right-triangle" && dependent.dependencies.length === 2) {
                        // Right triangle: two points define the hypotenuse
                        const point1 = geometryObjects.find((o) => o.id === dependent.dependencies[0]);
                        const point2 = geometryObjects.find((o) => o.id === dependent.dependencies[1]);

                        if (point1 && point2 && point1.points[0] && point2.points[0]) {
                          const p1 = point1.id === obj.id ? newGraphPos : point1.points[0];
                          const p2 = point2.id === obj.id ? newGraphPos : point2.points[0];

                          const dx = p2.x - p1.x;
                          const dy = p2.y - p1.y;
                          const p3x = p1.x - dy;
                          const p3y = p1.y + dx;

                          polygonPoints = [
                            { x: p1.x, y: p1.y },
                            { x: p2.x, y: p2.y },
                            { x: p3x, y: p3y },
                          ];
                        } else {
                          allPointsFound = false;
                        }
                      } else {
                        // Regular polygon: update based on all dependency points
                        dependent.dependencies.forEach(depId => {
                          const depPoint = geometryObjects.find(o => o.id === depId);
                          if (depPoint && depPoint.points && depPoint.points[0]) {
                            // Use updated position if this is the current dragging point
                            const point = depPoint.id === obj.id ? newGraphPos : depPoint.points[0];
                            polygonPoints.push(point);
                          } else {
                            allPointsFound = false;
                          }
                        });
                      }

                      if (allPointsFound && polygonPoints.length >= 3) {
                        // Find polygon group and update its line points
                        const polygonGroup = layerRef.current?.findOne(`#${dependentId}`);
                        if (polygonGroup) {
                          const lineElement = polygonGroup.findOne('.polygon-line');
                          if (lineElement) {
                            const screenPoints: number[] = [];
                            polygonPoints.forEach(pt => {
                              const screenPt = graphToScreen(pt.x, pt.y, width, height, view);
                              screenPoints.push(screenPt.x, screenPt.y);
                            });
                            lineElement.points(screenPoints);
                            layerRef.current?.batchDraw();
                          }
                        }
                      }
                    }

                    // Update lines (segment, infinite line, ray)
                    if (
                      ["segment", "line", "ray"].includes(dependent.type) &&
                      dependent.linePoints
                    ) {
                      const dep1 = geometryObjects.find(
                        (o) => o.id === dependent.linePoints!.point1Id,
                      );
                      const dep2 = geometryObjects.find(
                        (o) => o.id === dependent.linePoints!.point2Id,
                      );

                      if (dep1 && dep2 && dep1.points[0] && dep2.points[0]) {
                        // Use updated position if this is one of the dependencies
                        const point1 =
                          dep1.id === obj.id ? newGraphPos : dep1.points[0];
                        const point2 =
                          dep2.id === obj.id ? newGraphPos : dep2.points[0];

                        // Convert to screen coordinates
                        const screenP1 = graphToScreen(point1.x, point1.y, width, height, view);
                        const screenP2 = graphToScreen(point2.x, point2.y, width, height, view);

                        // Find the line's Group and Line element
                        const lineGroup = layerRef.current?.findOne(`#${dependentId}`);
                        if (lineGroup) {
                          const lineElement = lineGroup.findOne('Line');
                          if (lineElement) {
                            // Update line points based on type
                            let linePoints: number[];

                            if (dependent.type === "segment") {
                              linePoints = [screenP1.x, screenP1.y, screenP2.x, screenP2.y];
                            } else {
                              // For infinite lines and rays, calculate extension
                              const extension = Math.max(width, height) * 2;
                              const length = Math.sqrt(
                                Math.pow(screenP2.x - screenP1.x, 2) +
                                  Math.pow(screenP2.y - screenP1.y, 2),
                              );
                              const dirX = length > 0 ? (screenP2.x - screenP1.x) / length : 0;
                              const dirY = length > 0 ? (screenP2.y - screenP1.y) / length : 0;

                              if (dependent.type === "line") {
                                // Infinite line: extend in both directions
                                const startX = screenP1.x - dirX * extension;
                                const startY = screenP1.y - dirY * extension;
                                const endX = screenP2.x + dirX * extension;
                                const endY = screenP2.y + dirY * extension;
                                linePoints = [startX, startY, endX, endY];
                              } else {
                                // Ray: start at point1, extend through point2
                                const endX = screenP2.x + dirX * extension;
                                const endY = screenP2.y + dirY * extension;
                                linePoints = [screenP1.x, screenP1.y, endX, endY];
                              }
                            }

                            lineElement.points(linePoints);
                          }
                        }
                      }
                    }
                  });
                }
              }}
              onDragEnd={(e) => {
                const node = e.target;

                // Get the position calculated in onDragMove
                let newGraphPos = node.getAttr('_newGraphPos');

                // If not available (shouldn't happen), calculate from current position
                if (!newGraphPos) {
                  const x = node.x();
                  const y = node.y();
                  newGraphPos = screenToGraph(x, y, width, height, view);
                }

                // If point is constrained, project it onto the constraint object
                if (obj.constraint) {
                  const constraintObj = geometryObjects.find(
                    (o) => o.id === obj.constraint!.objectId,
                  );

                  if (constraintObj) {
                    if (
                      obj.constraint.type === "line" &&
                      constraintObj.points &&
                      constraintObj.points.length >= 2
                    ) {
                      // Project onto line
                      const p1 = constraintObj.points[0];
                      const p2 = constraintObj.points[1];
                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const lengthSq = dx * dx + dy * dy;

                      if (lengthSq > 0) {
                        let t =
                          ((newGraphPos.x - p1.x) * dx +
                            (newGraphPos.y - p1.y) * dy) /
                          lengthSq;

                        // Constrain t based on line type
                        if (constraintObj.type === "segment") {
                          t = Math.max(0, Math.min(1, t));
                        } else if (constraintObj.type === "ray") {
                          t = Math.max(0, t);
                        }

                        newGraphPos = {
                          x: p1.x + t * dx,
                          y: p1.y + t * dy,
                        };

                        // Update constraint parameter
                        updateGeometryObject(obj.id, {
                          constraint: { ...obj.constraint, param: t },
                        });
                      }
                    } else if (
                      obj.constraint.type === "circle" &&
                      constraintObj.points &&
                      constraintObj.radius !== undefined
                    ) {
                      // Project onto circle
                      const center = constraintObj.points[0];
                      const angle = Math.atan2(
                        newGraphPos.y - center.y,
                        newGraphPos.x - center.x,
                      );

                      newGraphPos = {
                        x: center.x + constraintObj.radius * Math.cos(angle),
                        y: center.y + constraintObj.radius * Math.sin(angle),
                      };

                      // Update constraint parameter
                      updateGeometryObject(obj.id, {
                        constraint: { ...obj.constraint, param: angle },
                      });
                    } else if (
                      obj.constraint.type === "polygon" &&
                      constraintObj.points &&
                      constraintObj.points.length >= 3
                    ) {
                      // Project onto polygon edge
                      let closestDist = Infinity;
                      let closestEdge = 0;
                      let closestT = 0;
                      let closestPoint = newGraphPos;

                      // Find closest edge
                      for (let i = 0; i < constraintObj.points.length; i++) {
                        const p1 = constraintObj.points[i];
                        const p2 =
                          constraintObj.points[
                            (i + 1) % constraintObj.points.length
                          ];
                        const dx = p2.x - p1.x;
                        const dy = p2.y - p1.y;
                        const lengthSq = dx * dx + dy * dy;

                        if (lengthSq > 0) {
                          let t =
                            ((newGraphPos.x - p1.x) * dx +
                              (newGraphPos.y - p1.y) * dy) /
                            lengthSq;
                          t = Math.max(0, Math.min(1, t));

                          const projX = p1.x + t * dx;
                          const projY = p1.y + t * dy;
                          const dist = Math.sqrt(
                            Math.pow(newGraphPos.x - projX, 2) +
                              Math.pow(newGraphPos.y - projY, 2),
                          );

                          if (dist < closestDist) {
                            closestDist = dist;
                            closestEdge = i;
                            closestT = t;
                            closestPoint = { x: projX, y: projY };
                          }
                        }
                      }

                      newGraphPos = closestPoint;

                      // Update constraint parameter
                      updateGeometryObject(obj.id, {
                        constraint: {
                          ...obj.constraint,
                          param: { edgeIndex: closestEdge, t: closestT },
                        },
                      });
                    }
                  }
                }

                // Update geometry object position
                updateGeometryObject(obj.id, {
                  points: [{ x: newGraphPos.x, y: newGraphPos.y }],
                });

                // Update dependent objects (midpoints, lines, etc.)
                updateDependentObjects(newGraphPos);

                // Clean up stored attributes
                node.setAttr('_origGraphPos', null);
                node.setAttr('_newGraphPos', null);

                // Reset node to new position
                const newScreenPos = graphToScreen(newGraphPos.x, newGraphPos.y, width, height, view);
                node.position({ x: newScreenPos.x, y: newScreenPos.y });
              }}
              onTransformEnd={() => {
                const node = layerRef.current?.findOne(`#${obj.id}`);
                if (!node) return;

                const x = node.x();
                const y = node.y();
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // Calculate average scale
                const newScale = (scaleX + scaleY) / 2;

                // Convert new screen position to graph coordinates
                const newGraphPos = screenToGraph(x, y, width, height, view);

                // Update geometry object with new position and accumulated scale
                const currentScale = obj.scale || 1;
                updateGeometryObject(obj.id, {
                  points: [{ x: newGraphPos.x, y: newGraphPos.y }],
                  scale: currentScale * newScale,
                });

                // Update dependent objects (midpoints, lines, etc.)
                updateDependentObjects(newGraphPos);

                // Reset transform
                node.scaleX(1);
                node.scaleY(1);
                node.position({ x: screenPos.x, y: screenPos.y });
              }}
            >
              {/* Point circle */}
              <Circle
                ref={(node) => {
                  // Ensure points always render on top of circles and polygons
                  if (node) {
                    node.moveToTop();
                  }
                }}
                radius={radius}
                fill={
                  isSelected
                    ? "#ff8c00"
                    : obj.constraint
                      ? "#FFD700"
                      : obj.subType === "point-midpoint"
                        ? obj.color
                        : "#000000"
                }
                stroke={isSelected ? "#888888" : "#888888"}
                strokeWidth={strokeWidth}
                strokeEnabled={true}
                perfectDrawEnabled={false}
                shadowEnabled={isSelected}
                shadowColor={isSelected ? "#ff8c00" : undefined}
                shadowBlur={isSelected ? 20 / scale : 0}
                shadowOpacity={isSelected ? 0.8 : 0}
                listening={
                  !isLassoSelecting &&
                  (drawingTool === "select" || drawingTool === "eraser")
                }
              />

              {/* Label - only show in 'show-with-labels' mode */}
              {obj.label && pointVisibilityMode === "show-with-labels" && (
                <>
                  {/* White outline for visibility */}
                  <Text
                    x={10}
                    y={-10}
                    text={obj.label}
                    fontSize={14 / scale}
                    fontFamily="Arial"
                    fontStyle="bold"
                    fill="#ffffff"
                    stroke="#ffffff"
                    strokeWidth={3 / scale}
                    listening={false}
                  />
                  {/* Black label */}
                  <Text
                    x={10}
                    y={-10}
                    text={obj.label}
                    fontSize={14 / scale}
                    fontFamily="Arial"
                    fontStyle="bold"
                    fill="#000000"
                    listening={false}
                  />
                </>
              )}
            </Group>
          );
        })}

        {/* Hybrid rendering: Vector mode for selection, Raster mode for drawing */}
        {drawingTool === "select" ? (
          // Vector mode: Render each drawing as a separate Konva Group for selection
          // Filter out eraser strokes - they should not be visible or selectable
          drawings.filter(drawing => drawing.tool !== 'eraser').map((drawing) => {
            if (drawing.points.length < 2) return null;

            // Convert graph coordinates to screen coordinates
            const screenPoints = drawing.points.map((p) => {
              const screen = graphToScreen(p.x, p.y, width, height, view);
              return [screen.x, screen.y];
            });

            const isSelected = selectedIds.includes(drawing.id);
            const isHovered = hoveredId === drawing.id;

            return (
              <MemoizedStroke
                key={drawing.id}
                drawing={drawing}
                screenPoints={screenPoints}
                isSelected={isSelected}
                isHovered={isHovered}
                drawingTool={drawingTool}
                isLassoSelecting={isLassoSelecting}
                onDragEnd={() => {
                  const node = layerRef.current?.findOne(`#${drawing.id}`);
                  if (!node) return;

                  const x = node.x();
                  const y = node.y();

                  // Skip if no movement
                  if (x === 0 && y === 0) return;

                  // Convert drag offset to graph coordinates
                  const dragOffsetGraph = screenToGraph(x, y, width, height, view);
                  const originGraph = screenToGraph(0, 0, width, height, view);
                  const deltaX = dragOffsetGraph.x - originGraph.x;
                  const deltaY = dragOffsetGraph.y - originGraph.y;

                  // Update all points
                  const newPoints = drawing.points.map((p) => ({
                    x: p.x + deltaX,
                    y: p.y + deltaY,
                  }));

                  updateDrawing(drawing.id, { points: newPoints });

                  // Reset node position immediately (before state update completes)
                  node.position({ x: 0, y: 0 });

                  // Force layer redraw to show updated position
                  layerRef.current?.batchDraw();
                }}
                onTransformEnd={() => {
                  // Transform is handled by Transformer
                }}
              />
            );
          })
        ) : (
          // Raster mode: Render all drawings on a single canvas for performance
          globalRasterCanvasRef.current && (
            <Shape
              sceneFunc={rasterSceneFunc}
              listening={false}
              perfectDrawEnabled={false}
            />
          )
        )}

        {/* Render temporary drawing stroke */}
        {isDrawing && tempStrokeData && (
          <Line
            ref={tempStrokeRef}
            points={tempStrokeData}
            stroke={drawingTool === "pen" ? penColor : highlighterColor}
            strokeWidth={0}
            lineCap="round"
            lineJoin="round"
            fill={drawingTool === "pen" ? penColor : highlighterColor}
            closed={true}
            opacity={drawingTool === "highlighter" ? 0.3 : 1}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}

        {/* Render lasso selection path */}
        {isLassoSelecting && selectionPath && selectionPath.length > 1 && (
          <Line
            points={selectionPath.flatMap((p) => [p.x, p.y])}
            stroke="#4ecdc4"
            strokeWidth={4}
            dash={[5, 5]}
            fill="rgba(78, 205, 196, 0.2)"
            closed={true}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}

        {/* Render rectangle selection box */}
        {isSelecting && selectionRect && (
          <Rect
            x={Math.min(selectionRect.x1, selectionRect.x2)}
            y={Math.min(selectionRect.y1, selectionRect.y2)}
            width={Math.abs(selectionRect.x2 - selectionRect.x1)}
            height={Math.abs(selectionRect.y2 - selectionRect.y1)}
            fill="rgba(78, 205, 196, 0.2)"
            stroke="#4ecdc4"
            strokeWidth={2}
            dash={[5, 5]}
            listening={false}
          />
        )}

        {/* Transformer for selected shapes */}
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Check if all selected items are geometry points
            const allGeometryPoints = selectedIds.every((id) => {
              const obj = geometryObjects.find((o) => o.id === id);
              return obj && obj.type === "point";
            });

            // If all are geometry points, disable transformation (only allow dragging)
            if (allGeometryPoints) {
              return oldBox;
            }

            // Limit resize to prevent negative dimensions
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={(() => {
            // Check if all selected items are geometry points
            const allGeometryPoints = selectedIds.every((id) => {
              const obj = geometryObjects.find((o) => o.id === id);
              return obj && obj.type === "point";
            });

            // If all are geometry points, disable all anchors (no resize/rotate handles)
            if (allGeometryPoints) {
              return [];
            }

            // Otherwise, enable all anchors
            return [
              "top-left",
              "top-center",
              "top-right",
              "middle-left",
              "middle-right",
              "bottom-left",
              "bottom-center",
              "bottom-right",
            ];
          })()}
          rotateEnabled={(() => {
            // Check if all selected items are geometry points
            const allGeometryPoints = selectedIds.every((id) => {
              const obj = geometryObjects.find((o) => o.id === id);
              return obj && obj.type === "point";
            });

            // If all are geometry points, disable rotation
            return !allGeometryPoints;
          })()}
          rotateAnchorOffset={30}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          borderStroke="#4ecdc4"
          borderStrokeWidth={2}
          anchorFill="#4ecdc4"
          anchorStroke="#ffffff"
          anchorStrokeWidth={2}
          anchorSize={8}
          anchorCornerRadius={4}
          onDragEnd={() => {
            // Handle group drag for multiple selected items
            const layer = layerRef.current;
            const transformer = transformerRef.current;
            if (!layer || selectedIds.length === 0) return;

            let hasMovement = false;

            selectedIds.forEach((id) => {
              const node = layer.findOne(`#${id}`);
              if (!node) return;

              const x = node.x();
              const y = node.y();

              // Skip if no movement
              if (x === 0 && y === 0) return;

              hasMovement = true;

              // Check if it's a drawing, image, or geometry object
              const drawing = drawings.find((d) => d.id === id);
              const image = images.find((img) => img.id === id);
              const geometryObj = geometryObjects.find((obj) => obj.id === id);

              if (drawing) {
                // Convert drag offset to graph coordinates
                const dragOffsetGraph = screenToGraph(
                  x,
                  y,
                  width,
                  height,
                  view,
                );
                const originGraph = screenToGraph(0, 0, width, height, view);
                const deltaX = dragOffsetGraph.x - originGraph.x;
                const deltaY = dragOffsetGraph.y - originGraph.y;

                // Update all points
                const newPoints = drawing.points.map((p) => ({
                  x: p.x + deltaX,
                  y: p.y + deltaY,
                }));

                updateDrawing(id, { points: newPoints });

                // Reset node position to prevent offset accumulation
                node.position({ x: 0, y: 0 });
              } else if (image && image.graphPosition) {
                // Convert new screen position to graph coordinates
                const newCenterGraph = screenToGraph(x, y, width, height, view);

                updateImage(id, {
                  graphPosition: {
                    ...image.graphPosition,
                    x: newCenterGraph.x,
                    y: newCenterGraph.y,
                  },
                });

                // Reset node position to prevent offset accumulation
                node.position({ x: 0, y: 0 });
              } else if (
                geometryObj &&
                geometryObj.type === "point" &&
                geometryObj.points &&
                geometryObj.points.length > 0
              ) {
                // Convert new screen position to graph coordinates
                const newGraphPos = screenToGraph(x, y, width, height, view);

                updateGeometryObject(id, {
                  points: [{ x: newGraphPos.x, y: newGraphPos.y }],
                });

                // Reset node position to prevent offset accumulation
                node.position({ x: 0, y: 0 });
              }
            });

            // Force update Transformer and redraw layer
            if (hasMovement) {
              if (transformer) {
                transformer.forceUpdate();
              }
              layer.batchDraw();
            }
          }}
        />

        {/* Delete button removed - use the × button in GraphCanvas instead */}

        {/* Eraser cursor - show water droplet style cursor for eraser tool */}
        {eraserCursorPos && drawingTool === "eraser" && (
          <Group x={eraserCursorPos.x} y={eraserCursorPos.y} listening={false}>
            {/* Main droplet body - transparent with gradient effect */}
            <Circle
              x={0}
              y={0}
              radius={eraserThickness / 2}
              fill="rgba(100, 200, 255, 0.15)"
              stroke="rgba(100, 200, 255, 0.4)"
              strokeWidth={2}
              listening={false}
            />
            {/* Inner glow */}
            <Circle
              x={0}
              y={0}
              radius={eraserThickness / 2 - 4}
              fill="rgba(180, 230, 255, 0.2)"
              listening={false}
            />
            {/* Highlight - top left */}
            <Circle
              x={-eraserThickness / 6}
              y={-eraserThickness / 6}
              radius={eraserThickness / 8}
              fill="rgba(255, 255, 255, 0.6)"
              listening={false}
            />
            {/* Smaller highlight */}
            <Circle
              x={eraserThickness / 5}
              y={-eraserThickness / 8}
              radius={eraserThickness / 12}
              fill="rgba(255, 255, 255, 0.4)"
              listening={false}
            />
          </Group>
        )}
      </Layer>
    </Stage>
  );
};

export const KonvaDrawingLayer = forwardRef<
  KonvaDrawingLayerHandle,
  KonvaDrawingLayerProps
>(KonvaDrawingLayerComponent);
