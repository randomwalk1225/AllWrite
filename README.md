# AllWrite 2.0

**[한국어](README.ko.md)** | English

> Interactive geometry and graphing tool for math education

**AllWrite 2.0** is a powerful interactive geometry and graphing tool for math education. It provides real-time geometry construction, formula input, and graphing capabilities with perfect point-shape synchronization for an intuitive math learning experience.

## Key Features

### Geometry Tools

#### Points
- **Fixed Point**: Freely placeable independent points
- **Midpoint**: Auto-calculated midpoint between two points
- **Division Point**: Point dividing two points in ratio m:n
- **Constrained Point**: Points constrained to lines, circles, or polygons

#### Lines
- **Segment**: Line segment connecting two points
- **Ray**: Extends infinitely in one direction from a point
- **Line**: Extends infinitely in both directions
- Drag points to transform lines in real-time

#### Circles
- **Center-Radius**: Defined by center and radius point
- **Diameter**: Defined by two endpoints of diameter
- **Three-Point Circle**: Circumscribed circle through three points
- Real-time resizing by dragging control points

#### Polygons

**Regular Polygons**
- Supports 3 to 12 sided polygons
- Defined by center and radius point
- Drag center to move entire shape
- Drag radius point to resize and rotate

**Special Polygons**
All special polygons are defined by 2 control points and maintain geometric properties during transformation:

- **Rectangle**: Defined by diagonal endpoints
- **Square**: Defined by one side's endpoints
- **Parallelogram**: Defined by one side's endpoints (60° fixed)
- **Rhombus**: Defined by diagonal endpoints
- **Kite**: Defined by axis of symmetry endpoints
- **Right Triangle**: Defined by hypotenuse endpoints

**Free Polygon**
- Click to add vertices
- Click first point again to complete
- Each vertex can be dragged individually

### Real-time Synchronization

**Perfect one-to-one correspondence between points and shapes** is the core feature of AllWrite 2.0:

- Drag a point and **all connected shapes transform in real-time**
- Move polygon center → **entire shape moves** (radius point follows)
- Move radius point → **size and rotation change**
- Drag rhombus diagonal endpoint → **maintains rhombus properties**
- All transformations show **real-time animation while dragging**

### Canvas Features

- **Infinite Canvas**: Work without limits
- **Pan/Zoom**: Mouse wheel to zoom, drag to pan
- **Coordinate Plane**: Grid and axis display
- **Freehand Drawing**: Pen tool for free drawing
- **Eraser**: Selective deletion
- **Selection Tools**: Click, rectangle, lasso selection
- **Copy/Paste**: Ctrl+C / Ctrl+V

### Rendering Modes

- **Stroke**: Display shape outlines only
- **Fill**: Fill shapes with color
- **Multiply**: Blend overlapping colors

## Download

### Platform Downloads

Download installation files for your OS from the **[Releases](https://github.com/randomwalk1225/AllWrite/releases)** page.

#### Windows

1. Go to **[Releases](https://github.com/randomwalk1225/AllWrite/releases)**
2. Download latest **`AllWrite2-Setup-{version}.exe`**
3. Run the downloaded file to install
4. Launch **AllWrite 2.0** from desktop or Start menu

#### macOS

1. Go to **[Releases](https://github.com/randomwalk1225/AllWrite/releases)**
2. Download latest **`AllWrite2-{version}.dmg`**
3. Open DMG and drag AllWrite2 to Applications folder
4. Launch **AllWrite 2.0** from Applications

> **Note**: If you see "unidentified developer" warning on macOS:
> 1. Go to System Settings > Privacy & Security
> 2. Click "Open Anyway" button

## Usage

### Basic Controls

| Action | Method |
|--------|--------|
| **Zoom In/Out** | Mouse wheel |
| **Pan Canvas** | Spacebar + Drag |
| **Select Tool** | Click left tool panel |
| **Select Shape** | Click or drag with selection tool |
| **Multi-select** | Shift + Click |
| **Copy** | Ctrl + C |
| **Paste** | Ctrl + V |
| **Delete** | Delete key |
| **Undo** | Ctrl + Z |
| **Redo** | Ctrl + Y |

### Drawing Workflows

#### Regular Polygon (e.g., Hexagon)
1. Click **Shapes** tab
2. Click **Regular Polygon**
3. Click canvas for center position
4. Drag to set size and rotation
5. Enter **6** in dialog (for hexagon)
6. Click **OK**

#### Circle (Center-Radius)
1. **Shapes** tab → **Circle** → **Center-Radius**
2. Click for center position
3. Drag to set radius
4. Release mouse

#### Free Polygon
1. **Shapes** tab → **Polygon**
2. Click for first vertex
3. Click to add more vertices
4. Click first point again or press **Enter** to complete

### Advanced Features

#### Creating Midpoints
1. Create two points A, B
2. **Shapes** tab → **Point** → **Midpoint**
3. Click A → Click B
4. Midpoint M is created and follows when A or B moves

#### Creating Division Points
1. Create two points A, B
2. **Shapes** tab → **Point** → **Division Point**
3. Click A → Click B
4. Enter ratio (e.g., m=2, n=3)
5. Division point is created at 2:3 ratio position

## Development

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Access `http://localhost:5173` in browser

### Build

#### Windows (.exe)

```bash
npm run build
```

Output in `release/` folder:
- `AllWrite2-Setup-{version}.exe`

#### macOS (.dmg)

```bash
# Run on macOS only
npm run build
```

Output in `release/` folder:
- `AllWrite2-{version}.dmg`
- `AllWrite2-{version}-mac.zip`

## Tech Stack

### Frameworks
- **Electron** - Desktop application
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool

### Graphics
- **Konva / React-Konva** - 2D canvas rendering
- **Perfect Freehand** - Natural pen strokes

### Math
- **Math.js** - Math computation engine
- **Algebrite** - Algebraic operations
- **KaTeX / MathLive** - Math formula rendering

### State Management
- **Zustand** - Lightweight state management

### Utilities
- **html2canvas** - Screenshots
- **jsPDF** - PDF export
- **culori** - Color processing
- **immer** - Immutable state updates

## Educational Value

AllWrite 2.0 supports these educational goals:

- **Intuitive Understanding**: Real-time feedback helps understand geometric relationships
- **Exploratory Learning**: Discover patterns by freely transforming shapes
- **Precise Construction**: Accurate geometry construction using constraints
- **Visualization**: Express complex math concepts visually

## License

MIT License

## Contributing

Issues and pull requests are welcome!

1. Fork this repository
2. Create new branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Create Pull Request

## Support

- **Issues & Feature Requests**: [GitHub Issues](https://github.com/randomwalk1225/AllWrite/issues)
- **Developer Contact**: Binary (randomwalk1225@gmail.com)

---

**AllWrite 2.0** - Make math intuitive and fun!

*Experience the beauty of geometry with perfect point-shape synchronization.*
