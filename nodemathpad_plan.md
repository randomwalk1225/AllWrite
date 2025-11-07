# NodeMathPad Development Plan (Desmos-like Features)

## 1. Overview
NodeMathPad aims to replicate key Desmos functionalities — real-time **math expression input**, **2D graph visualization**, and **image paste integration** — for a desktop environment using npm-based development. The system will focus on modularity, precision, and extensibility.

---

## 2. Gap Analysis (Improvements Needed)

| Area | Current Status | Enhancement Needed |
|------|----------------|--------------------|
| Expression Input | Simple LaTeX/KaTeX plan | MathLive or CodeMirror integration for better UX, error display |
| Graph Plotting | Uniform sampling | Adaptive sampling (curvature-based), discontinuity handling |
| Coordinate System | Basic grid only | Smart tick labels, axis scaling, HiDPI support |
| Events | Zoom/pan basics | Kinetic pan, throttling, keyboard shortcuts |
| Image Paste | Simple paste handler | EXIF rotation, memory cleanup, resize/opacity tools |
| Math Evaluation | math.js only | Secure sandbox, context whitelist |
| Performance | Direct draw | Offscreen canvas, dirty-rect optimization |
| Persistence | None | Project save/load with versioned JSON |
| Testing | Not planned | Vitest + Playwright integration |

---

## 3. Tech Stack

**Frontend:** React 18 + TypeScript + Vite  
**Math Rendering:** KaTeX + react-katex (or MathJax alternative)  
**Math Input:** MathLive (WYSIWYG), or CodeMirror (LaTeX mode)  
**Computation:** math.js (+ nerdamer optional for symbolic calc)  
**State Management:** Zustand + Immer  
**Color/Theme:** culori (oklab/oklch color support)  
**Testing & Quality:** Vitest, Playwright, ESLint, Prettier, Husky, Lint-Staged  

---

## 4. Architecture
```
src/
├─ core/
│  ├─ math/        # Parser, sandboxed evaluator, adaptive sampler
│  ├─ geo/         # Coordinate transforms, ticks, clipping
│  └─ render/      # Layer engine (Offscreen + Canvas)
├─ features/
│  ├─ editor/      # Expression input, syntax checking
│  ├─ graph2d/     # 2D graph rendering, parametric/polar/inequality
│  └─ image/       # Clipboard & drag-drop image management
├─ store/          # Zustand store (expressions, layers, viewport)
├─ ui/             # Toolbar, Sidebar, Sliders, ColorPicker
└─ app/            # Entry point, routing, persistence
```

**Rendering Layers:**  
1️⃣ Background Image  
2️⃣ Grid/Axes  
3️⃣ Graph Plots  
4️⃣ Overlays (crosshair, tooltips, etc.)

---

## 5. Algorithm Design

### Adaptive Sampling
- Recursively refine interval [x₁, x₂] when curvature error > ε.
- Split segments near discontinuities (NaN/∞ or large Δy/Δx).

### Inequality Plotting
- Fill area above/below function using polygon mask.
- Support `y ≥ f(x)`, `f(x) ≥ g(x)` (as h(x)=f-g≥0).

### Parametric / Polar Graphs
- `x(t), y(t)` for parametric; adaptive sampling by curvature.
- `r(θ)` polar → `(r cosθ, r sinθ)` transformation.

### Tick / Label Generation
- Use "nice numbers" algorithm (1–2–5 sequence).
- Automatic SI-prefix and scientific formatting.

---

## 6. Interaction & Events

| Event | Action | Notes |
|--------|---------|-------|
| Wheel | Zoom | Centered on cursor, throttled (16ms) |
| Drag | Pan | Inertial motion, grid snapping |
| Keyboard | Zoom/Reset | Ctrl+/-, 0 = reset, arrow keys pan |
| Paste/Drop | Image import | Clipboard API, EXIF rotation |
| Resize | Redraw | HiDPI and devicePixelRatio aware |
| PointerMove | Crosshair | Real-time coordinate display |

---

## 7. Safe Evaluation Sandbox
```ts
import { create, all } from 'mathjs';
const math = create(all, { predictable: true });
const ALLOWED = ['x', 't', 'theta', 'pi', 'e'];

export function compileExpression(expr: string) {
  const node = math.parse(expr);
  node.traverse(n => {
    if (n.isSymbolNode && !ALLOWED.includes(n.name))
      throw new Error(`Unauthorized symbol: ${n.name}`);
  });
  return node.compile();
}
```

---

## 8. Data Models
```ts
type ExprKind = 'cartesian'|'parametric'|'polar'|'inequality';
interface Expression {
  id: string;
  kind: ExprKind;
  input: string;
  latex: string;
  color: string;
  params?: Record<string, number>;
  visible: boolean;
  domain?: { x?: [number, number]; t?: [number, number]; theta?: [number, number] };
}

interface ViewState {
  center: { x: number; y: number };
  scale: number;
  grid: boolean;
  axis: boolean;
}

interface ImageLayer {
  id: string;
  src: string;
  transform: DOMMatrix;
  opacity: number;
  locked: boolean;
}
```

---

## 9. Performance Optimization
- Use **OffscreenCanvas** for heavy plot rendering.
- **Dirty Rectangles**: Only repaint changed areas.
- Throttle: `wheel` 16ms, `mousemove` 16ms, `resize` 100ms.
- Free image URLs with `URL.revokeObjectURL`.
- Downscale large images before display.

---

## 10. Implementation Phases

| Phase | Description | Deliverable (DoD) |
|--------|--------------|------------------|
| **1. Setup** | Initialize React+Vite, Zustand, layout | App loads <200ms, base canvas visible |
| **2. Math Input** | MathLive editor + KaTeX preview | Syntax highlight + LaTeX sync |
| **3. Graph Core** | Grid, axes, adaptive sampler | Handles discontinuities (tan, 1/x) |
| **4. Interaction** | Zoom, pan, coordinate readout | 60fps stable, centered zoom |
| **5. Advanced Graphs** | Parametric, polar, inequalities | 10+ verified test cases |
| **6. Image Paste** | Paste/drop + transform tools | 10MB image safe load, no leak |
| **7. Export/Storage** | PNG/SVG export, JSON save/load | Restores full graph state |

---

## 11. Testing Plan
- **Unit Tests:** sampler precision, math evaluator, coordinate conversion.
- **Snapshot Tests:** canvas image comparison (±1px tolerance).
- **E2E Tests:** input → plot → zoom → export flow.
- **Performance Tests:** average FPS, memory leak checks.

---

## 12. Accessibility & Localization
- Keyboard navigation, ARIA labels for toolbar.
- OKLCH color palette (colorblind-friendly).
- Multi-language (ko/en) support.

---

## 13. Risk Management
| Risk | Mitigation |
|-------|-------------|
| Floating point instability | Predictable math mode, log-scale fallback |
| Complex inequalities | MVP: boundary-based only |
| Large image memory | Worker-based downscale, cleanup URLs |

---

## 14. Example Code Snippet (Image Paste)
```ts
useEffect(() => {
  const onPaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items ?? [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        const url = URL.createObjectURL(file);
        addImageLayer({ src: url, transform: new DOMMatrix(), opacity: 0.8, locked: false });
      }
    }
  };
  window.addEventListener('paste', onPaste);
  return () => window.removeEventListener('paste', onPaste);
}, []);
```

---

## 15. npm Package Setup
```bash
npm create vite@latest nodemathpad -- --template react-ts
cd nodemathpad
npm i mathjs katex react-katex zustand culori
npm i -D vitest @testing-library/react playwright eslint prettier husky lint-staged
```

---

### ✅ Summary
This enhanced plan solidifies the **NodeMathPad** roadmap with a modular, scalable structure — covering evaluation safety, adaptive rendering, robust event handling, and clear delivery criteria. It’s ready for incremental development and future 3D/physics-based graph expansion.

