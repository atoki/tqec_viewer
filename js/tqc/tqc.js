'use strict'

var colors = {primal: 0xed1010, dual: 0x180cf7, module: 0xffefd5, pin: 0xffffe0, edge: 0x000000, aerial: 0x008b8b};
var scale = 1;
var margin = 4;         // >= 4
var pitch = margin + 1;
var space = pitch / 2;  // 論理量子ビットの間隔
var graph_intarval = 2; // グラフ表現におけるprimal型, dual型の間隔
var showEdges = true;   // 境界線を見せるか否か
var line_width = 2;     // 境界線の太さ

class Vector3D {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new Vector3D(...this.toArray());
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(n = 1, base) {
    let vector3d = this.clone();
    if (base == 'x') vector3d.x += n;
    if (base == 'y') vector3d.y += n;
    if (base == 'z') vector3d.z += n;
    return vector3d;
  }

  sub(n = 1, base) {
    let vector3d = this.clone();
    if (base == 'x') vector3d.x -= n;
    if (base == 'y') vector3d.y -= n;
    if (base == 'z') vector3d.z -= n;
    return vector3d;
  }

  changeAxis() {
    this.x = [this.z, this.z = this.x][0];
    return this;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}

class Size extends Vector3D {
  constructor(w = 0, h = 0, d = 0) {
    super(w, h, d);
  }

  toArray() {
    return [this.w, this.h, this.d];
  }
}

class Rectangler {
  constructor(pos, size, type, color = 0, opacity = 1.0, ghost = false) {
    this.pos = pos;
    this.size = size;
    this.type = type;
    this.color = (color == 0) ? colors[type] : color;
    this.opacity = opacity;
    this.ghost = ghost;
  }

  apply(scene) {
    const boxGeometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    const boxMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: this.opacity, transparent: this.ghost});
    let box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(this.pos.x, this.pos.y, this.pos.z);

    let edge = new THREE.BoxHelper(box, colors.edge);
    edge.material.linewidth = line_width;
    edge.visible = showEdges;

    scene.add(box);
    scene.add(edge);
  }
}

class Cube extends Rectangler {
  constructor(pos, type, ...visual) {
    super(pos, new Size(scale, scale, scale), type, ...visual);
  }
}

class Edge extends Rectangler {
  constructor(vertex_a, vertex_b, type, ...visual) {
    const axis = Edge.getAxis_(vertex_a, vertex_b);
    const pos = Edge.getPos_(vertex_a, vertex_b);
    const size = Edge.getSize_(vertex_a, vertex_b, axis);
    super(pos, size, type, ...visual);
    this.axis = axis;
  }

  static getAxis_(vertex_a, vertex_b) {
    if (vertex_a.x != vertex_b.x) return 'x';
    if (vertex_a.y != vertex_b.y) return 'y';
    if (vertex_a.z != vertex_b.z) return 'z';
    console.assert(false, "invalid asis");
  }

  static getPos_(vertex_a, vertex_b) {
    const x =  (vertex_b.x + vertex_a.x) / 2;
    const y =  (vertex_b.y + vertex_a.y) / 2;
    const z =  (vertex_b.z + vertex_a.z) / 2;
    return new Vector3D(x, y, z);
  }

  static getSize_(vertex_a, vertex_b, axis) {
    const scale_x = axis == 'x' ? Math.abs(vertex_a.x - vertex_b.x) - 1.0 : scale;
    const scale_y = axis == 'y' ? Math.abs(vertex_a.y - vertex_b.y) - 1.0 : scale;
    const scale_z = axis == 'z' ? Math.abs(vertex_a.z - vertex_b.z) - 1.0 : scale;
    return new Size(scale_x, scale_y, scale_z);
  }
}

class AerialCube extends Cube {
  constructor(pos, type) {
    super(pos, type, 0, true, 0.5);
  }
}

class AerialEdge extends Edge {
  constructor(vertex_a, vertex_b, type) {
    super(vertex_a, vertex_b, type, 0, true, 0.5);
  }
}

class SquarePyramid {
  constructor(pos, height, axis, reverse, type, color = 0, opacity = 1.0, ghost = false) {
    this.pos = pos;
    this.height = height;
    this.axis = axis;
    this.size = new Size(scale / Math.SQRT2, height, 4);
    this.reverse = reverse;
    this.type = type;
    this.color = (color == 0) ? colors[type] : color;
    this.opacity = opacity;
    this.ghost = ghost;
  }

  apply(scene) {
    const coneGeometry = new THREE.ConeGeometry(this.size.x, this.size.y, this.size.z);
    const meshMat = new THREE.MeshPhongMaterial({color: this.color, opacity: this.opacity, transparent: this.ghost});
    let wireFrameMat = new THREE.MeshPhongMaterial({color: colors.edge, wireframe: true});
    wireFrameMat.wireframeLinewidth = line_width;
    wireFrameMat.visible = showEdges;
    let cone = THREE.SceneUtils.createMultiMaterialObject(coneGeometry, [meshMat, wireFrameMat]);
    cone.position.set(this.pos.x, this.pos.y, this.pos.z);

    const r = this.reverse ? Math.PI : 0;
    if(this.axis === 'x')      cone.rotation.set(Math.PI / 4, 0, Math.PI / 2 - r);
    else if(this.axis === 'y') cone.rotation.set(r + Math.PI, Math.PI / 4, 0);
    else if(this.axis === 'z') cone.rotation.set(r - Math.PI / 2, Math.PI / 4, 0);
    
    scene.add(cone);
  }
}

class SingleBitLine  {
  constructor(x, range, y, cbits) {
    this.x = x;
    this.range = range;
    this.y = y;
    this.cbits = cbits;
    this.type = "primal";
    // line array is LogicalQubits and Edges
    this.line = [];
  }

  createBits_() {
    for(let z = this.range[0]; z <= this.range[1]; z += graph_intarval) {
      const pos = this.correctPos_([this.x, this.y, z], space);
      const qubit = new Cube(pos, this.type);
      this.line.push(qubit);
    }
  }

  createEdges_() {
    for(let z = this.range[0]; z <= this.range[1] - graph_intarval; z += graph_intarval) {
      let skip = false;
      for (let cbit of this.cbits) {
        if (this.x == cbit.control && z + 1 == cbit.column) {
          skip = true;
        }
      }
      if (skip) continue;

      const pos1 = this.correctPos_([this.x, this.y, z], space);
      const pos2 = this.correctPos_([this.x, this.y, z + graph_intarval], space);
      const edge = new Edge(pos1, pos2, this.type);
      this.line.push(edge);
    }
  }

  correctPos_(pos, space) {
    const corrected_pos = new Vector3D();
    corrected_pos.x = pos[0] * space;
    corrected_pos.y = pos[1] * space;
    corrected_pos.z = pos[2] * space;
    corrected_pos.changeAxis(); // 軸変更
    return corrected_pos;
  }

  create() {
      this.createBits_();
      this.createEdges_();
      return this.line;
  }
}

class BitLine {
  constructor(x, range, cbits) {
    this.x = x;
    this.range = range;
    this.cbits = cbits;
    this.lines = [];

    const upper_line = new SingleBitLine(x, range, graph_intarval, this.cbits);
    const lower_line = new SingleBitLine(x, range, 0, this.cbits);
    this.lines.push(upper_line.create());
    this.lines.push(lower_line.create());
  }

  apply(scene) {
    for(let elements of this.lines) {
      for(let element of elements) {
        element.apply(scene);
      }
    }
  }
}

class Injector {
  constructor(vertex_a, vertex_b, type, color = 0, opacity = 0.1, ghost = false) {
    let vertices = [vertex_a, vertex_b].sort(function(a, b) {
      if(a.z < b.z) return -1;
      if(a.z > b.z) return 1;
      if(a.y < b.y) return -1;
      if(a.y > b.y) return 1;
      if(a.x < b.x) return -1;
      if(a.x > b.x) return 1;
      return 0;
    });
    this.vertices = vertices;
    // distance between two cubees
    this.distance = Math.max(Math.abs(this.vertices[0].x - this.vertices[1].x),
                            Math.abs(this.vertices[0].y - this.vertices[1].y),
                            Math.abs(this.vertices[0].z - this.vertices[1].z))
    this.axis = this.getAxis_();
    this.type = type;
    this.color = color;
    this.opacity = opacity;
    this.ghost = ghost;
  }

  getAxis_() {
    if (this.vertices[0].x != this.vertices[1].x) return 'x';
    if (this.vertices[0].y != this.vertices[1].y) return 'y';
    if (this.vertices[0].z != this.vertices[1].z) return 'z';
    console.assert(false, "invalid asis");
  }

  getVisual() {
    return [this.color, this.opacity, this.ghost];
  }

  apply(scene) {
    for(let cube of this.createCubes_()) {
      cube.apply(scene);
    }

    for(let cone of this.createCones_()) {
      cone.apply(scene)
    }
  }

  createCubes_() {
    const pos1 = this.vertices[0].add(1, this.axis);
    const pos2 = this.vertices[1].sub(1, this.axis);
    const cube1 = new Cube(pos1, this.type, ...this.getVisual());
    const cube2 = new Cube(pos2, this.type, ...this.getVisual());

    return [cube1, cube2];
  }

  createCones_() {
    const height = (this.distance - scale * 2.0 - 1.0) / 2.0;
    const diff = ((this.distance * 0.5) - (scale * 1.5)) / 2.0 + scale * 1.5;
    let pos1 = this.vertices[1].sub(diff, this.axis);
    let pos2 = this.vertices[0].add(diff, this.axis);

    const cone1 = new SquarePyramid(pos1, height, this.axis, false, this.type, ...this.getVisual());
    const cone2 = new SquarePyramid(pos2, height, this.axis, true, this.type, ...this.getVisual());

    return [cone1, cone2];
  }
}

class Pin extends Injector {
  constructor(vertex_a, vertex_b, type, color = colors.pin) {
    super(vertex_a, vertex_b, type, color);
  }
}

class Cap extends Injector {
  constructor(vertex_a, vertex_b, type) {
    super(vertex_a, vertex_b, type, colors[type], 0.1, true);
  }
}

// 左回りで作る
class Braiding {
  // cbit = z, tbitNoArray = z, col = x (0, 2, 4...)
  constructor(cbitNo, tbitNoArray, col, color) {
    this.cbitNo = cbitNo;
    this.tbitNoArray = tbitNoArray;
    this.col = col * space;
    this.height = 1 * space;
    this.type = "dual";
    this.color = color
    this.bits = [];
    this.edges = [];

    this.create_();
  }

  create_() {
    const bitNoArray = this.tbitNoArray.concat([this.cbitNo]);
    const mintBitNo = Math.min.apply(null, bitNoArray);
    const maxtBitNo = Math.max.apply(null, bitNoArray);
    const d = (this.cbitNo < this.tbitNoArray[0]) ? 1.0 : -1.0;

    this.push = function(pos, type = this.type) {
      this.bits.push(new Cube(pos.clone(), type, this.color));
    }

    // add bridge
    let upper = new Vector3D(this.col - space, pitch, this.cbitNo * space);
    let lower = new Vector3D(this.col - space, 0, this.cbitNo * space);
    let edge = new Edge(upper, lower, "primal");
    this.edges.push(edge);

    upper = new Vector3D(this.col + space, pitch, this.cbitNo * space);
    lower = new Vector3D(this.col + space, 0, this.cbitNo * space);
    edge = new Edge(upper, lower, "primal");
    this.edges.push(edge);

    // add qubit
    let pos = new Vector3D(this.col - space * d * 2, 
                           this.height, 
                           this.cbitNo * space  - space * d);
    this.push(pos);
    pos.z += pitch * d;
    this.push(pos);
    
    let start = (this.cbitNo < this.tbitNoArray[0]) ? mintBitNo : maxtBitNo;
    const range = (this.cbitNo < this.tbitNoArray[0]) ? maxtBitNo : mintBitNo;
    for (let z = start + graph_intarval * d; 
         z != range + graph_intarval * d; 
         z += graph_intarval * d){
        // find tbit
        if (this.tbitNoArray.indexOf(z) != -1) {
          if (pos.y != this.height) {
              pos.y -= pitch;
              this.push(pos)
          }
          pos.z += pitch * d;
          this.push(pos)
        }
        else {
          if (pos.y == this.height) {
              pos.y += pitch;
              this.push(pos)
          }

          pos.z += pitch * d;
          this.push(pos)
        }
    }

    pos.y += pitch
    this.push(pos)
    pos.x += pitch * d
    this.push(pos)
    pos.x += pitch * d
    this.push(pos)

    start = (this.cbitNo < this.tbitNoArray[0]) ? maxtBitNo : mintBitNo;
    for (let z = start; z != this.cbitNo; z -= graph_intarval * d) {
        pos.z -= pitch * d;
        this.push(pos)
    }

    pos.y -= pitch;
    this.push(pos)
    pos.z -= pitch * d;
    this.push(pos)
    pos.x -= pitch * d
    this.push(pos)

    // add edge
    let prev_qubit = this.bits[0];
    const last_qubit = this.bits[this.bits.length-1];
    this.edges.push(new Edge(prev_qubit.pos, last_qubit.pos, this.type, this.color));
    let first = true;
    for(let qubit of this.bits) {
      if (first) {
        first = false;
        continue;
      }
      let edge = new Edge(prev_qubit.pos, qubit.pos, this.type, this.color);
      this.edges.push(edge);
      prev_qubit = qubit;
    }
  }

  apply(scene) {
    for(let elements of [this.bits, this.edges]) {
      for(let element of elements) {
        element.apply(scene);
      }
    }
  }
}

// 左回りで作る
class BraidingWithBridge {
  // cbit = z, tbitNoArray = z, col = x (0, 2, 4...)
  constructor(cbitNo, tbitNoArray, col) {
    this.cbitNo = cbitNo;
    this.tbitNoArray = tbitNoArray;
    this.col = col * space;
    this.height = 1 * space;
    this.type = "dual";
    this.bits = [];
    this.edges = [];

    this.create_();
  }

  create_() {
    const bitNoArray = this.tbitNoArray.concat([this.cbitNo]);
    const mintBitNo = Math.min.apply(null, bitNoArray);
    const maxtBitNo = Math.max.apply(null, bitNoArray);
    const d = (this.cbitNo < this.tbitNoArray[0]) ? 1.0 : -1.0;

    this.push = function(pos, type = this.type) {
      this.bits.push(new Cube(pos.clone(), type));
    }

    // add bridge
    const upper = new Vector3D(this.col, pitch, this.cbitNo * space);
    const lower = new Vector3D(this.col, 0, this.cbitNo * space);
    this.push(upper, "primal");
    this.push(lower, "primal");
    const edge = new Edge(this.bits[0].pos, this.bits[1].pos, "primal");
    this.edges.push(edge);
    this.bits = [];

    // add qubit
    let pos = new Vector3D(this.col - space * d, this.height, this.cbitNo * space  - space * d);
    this.push(pos);
    pos.z += pitch * d;
    this.push(pos);
    
    let start = (this.cbitNo < this.tbitNoArray[0]) ? mintBitNo : maxtBitNo;
    const range = (this.cbitNo < this.tbitNoArray[0]) ? maxtBitNo : mintBitNo;
    for (let z = start + graph_intarval * d; 
         z != range + graph_intarval * d; 
         z += graph_intarval * d){
        // find tbit
        if (this.tbitNoArray.indexOf(z) != -1) {
          if (pos.y != this.height) {
              pos.y -= pitch;
              this.push(pos)
          }
          pos.z += pitch * d;
          this.push(pos)
        }
        else {
          if (pos.y == this.height) {
              pos.y += pitch;
              this.push(pos)
          }

          pos.z += pitch * d;
          this.push(pos)
        }
    }

    pos.y += pitch
    this.push(pos)
    pos.x += pitch * d
    this.push(pos)

    start = (this.cbitNo < this.tbitNoArray[0]) ? maxtBitNo : mintBitNo;
    for (let z = start; z != this.cbitNo; z -= graph_intarval * d) {
        pos.z -= pitch * d;
        this.push(pos)
    }

    pos.y -= pitch;
    this.push(pos)
    pos.z -= pitch * d;
    this.push(pos)

    // add edge
    let prev_qubit = this.bits[0];
    const last_qubit = this.bits[this.bits.length-1];
    this.edges.push(new Edge(prev_qubit.pos, last_qubit.pos, this.type));
    let first = true;
    for(let qubit of this.bits) {
      if (first) {
        first = false;
        continue;
      }
      let edge = new Edge(prev_qubit.pos, qubit.pos, this.type);
      this.edges.push(edge);
      prev_qubit = qubit;
    }
  }

  apply(scene) {
    for(let elements of [this.bits, this.edges]) {
      for(let element of elements) {
        element.apply(scene);
      }
    }
  }
}

class Module {
  constructor(pos, size, ghost) {
    this.pos = pos;
    this.size = size;
    this.ghost = ghost;
    this.color = colors.aerial;
  }

  apply(scene) {
    const cube = this.createMesh_();
    let edge = new THREE.BoxHelper(cube, colors.edge);
    edge.material.linewidth = line_width;

    scene.add(cube);
    scene.add(edge)
  }

  createMesh_() {
    const w = this.size.w * scale;
    const h = this.size.h * scale;
    const d = this.size.d * scale;
    const cubeGeometry = new THREE.BoxGeometry(w, h, d);
    const cubeMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: 0.3, transparent: this.ghost});
    let cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(this.pos.x, this.pos.y, this.pos.z);

    return cube;
  }
}

class Circuit {
  constructor() {
    this.logical_qubits = [];
    this.cubes = [];
    this.edges = [];
    this.aerial_cubes = [];
    this.aerial_edges = [];
    this.bit_lines = [];
    this.injectors = [];
    this.braidings = [];
    this.modules = [];
  }

  addCube(cube) {
    this.cubes.push(cube);
  }

  addEdge(edge) {
    this.edges.push(edge);
  }

  addAerialCube(aerial_qubit) {
    this.aerial_cubes.push(aerial_cube);
  }

  addAerialEdge(aerial_edge) {
    this.aerial_edges.push(aerial_edge);
  }

  addBitLine(bit_line) {
    this.bit_lines.push(bit_line);
  }

  addInjector(injector) {
    this.injectors.push(injector);
  }

  addBraiding(braiding) {
    this.braidings.push(braiding);
  }

  addModule(module) {
    this.modules.push(module);
  }

  apply(scene) {
    for(let elements of [this.cubes, this.edges, this.aerial_cubes, this.aerial_edges, this.injectors, this.bit_lines, this.braidings, this.modules]) {
      for(let element of elements) {
        element.apply(scene);
      }
    }
  }
}

class CircuitFactory {
  constructor(data) {
    this.data = data;
  }

  create() {
    this.circuit = new Circuit();
    this.createLogicalQubits_();
    this.createCubes_();
    this.createEdges_();
    this.createBitLines_();
    this.createInjectors_();
    this.createBraidings_();
    this.createAerialCubes_();
    this.createAerialEdges_();
    this.createModules_();

    return this.circuit;
  }

  createLogicalQubits_(){
    if (!this.data.logical_qubits) {
      return;
    };
    for (let logical_qubit of this.data.logical_qubits) {
      const id = logical_qubit.id;
      const type = logical_qubit.type;
      this.createBlocks_(type, logical_qubit.blocks);
      this.createInjectorsInLogicalQubit_(type, logical_qubit.injectors);
      this.createCapsInLogicalQubit_(type, logical_qubit.caps);
    }
  }

  createBlocks_(type, blocks = []) {
    let vertices = [];
    let visual = [];
    for (let block of blocks) {
      if (Array.isArray(block)) vertices.push(block);
      if ("visual" in block) visual = this.parseVisual_(block.visual);
    }
    for (let vertex of vertices) {
      const pos1 = this.correctPos_(vertex[0], space);
      const pos2 = this.correctPos_(vertex[1], space);
      const cube1 = new Cube(pos1, type, ...visual);
      const cube2 = new Cube(pos2, type, ...visual);
      const edge = new Edge(pos1, pos2, type, ...visual);
      this.circuit.addCube(cube1);
      this.circuit.addCube(cube2);
      this.circuit.addEdge(edge);
    }
  }

  createInjectorsInLogicalQubit_(type, injectors = []) {
    for (let injector of injectors) {
      const pos1 = this.correctPos_(injector.vertices[0], space);
      const pos2 = this.correctPos_(injector.vertices[1], space);
      const visual = injector.visual ? this.parseVisual_(injector.visual) : [];
      const pin = new Pin(pos1, pos2, type, ...visual);
      this.circuit.addInjector(pin);
    }
  }

  createCapsInLogicalQubit_(type, caps = []) {
    for (let injector of caps) {
      const pos1 = this.correctPos_(injector.vertices[0], space);
      const pos2 = this.correctPos_(injector.vertices[1], space);
      const visual = injector.visual ? this.parseVisual_(injector.visual) : [];
      const cap = new Cap(pos1, pos2, type, ...visual);
      this.circuit.addInjector(cap);
    }
  }

  createCubes_() {
    if(!this.data.cubes) {
      return;
    }
    for(let cube of this.data.cubes) {
      const pos = this.correctPos_(cube.pos, space);
      const type = cube.type;
      const visual = cube.visual ? this.parseVisual_(cube.visual) : [];
      const c = new Cube(pos, type, ...visual);
      this.circuit.addCube(c);
    }
  }

  createEdges_() {
    if(!this.data.edges) {
      return;
    }
    for(let edge of this.data.edges) {
      const pos1 = this.correctPos_(edge.pos1, space);
      const pos2 = this.correctPos_(edge.pos2, space);
      const type = edge.type;
      const visual = edge.visual ? this.parseVisual_(edge.visual) : [];
      const e = new Edge(pos1, pos2, type, ...visual);
      this.circuit.addEdge(e);
    }
  }

  createAerialCubes_() {
    if(!this.data.aerial_cubes) {
      return;
    }
    const type = "aerial"
    for(let cube of this.data.aerial_cubes) {
      const pos = this.correctPos_(cube, space);
      const c = new AerialCube(pos, type);
      this.circuit.addAerialCube(c);
    }
  }

  createAerialEdges_() {
    if(!this.data.aerial_edges) {
      return;
    }
    const type = "aerial"
    for(let edge of this.data.aerial_edges) {
      const pos1 = this.correctPos_(edge.pos1, space);
      const pos2 = this.correctPos_(edge.pos2, space);
      const e = new AerialEdge(pos1, pos2, type);
      this.circuit.addAerialEdge(e);
    }
  }

  /*
    "row": x,
    "range": [z min, z max],
    "caps": [z, ...],
    "pins": [z, ...],
    "bridges": [z, ...]
  */
  createBitLines_() {
    if(!this.data.bit_lines) {
      return;
    }
    const type = "primal";
    for(let line of this.data.bit_lines) {
      // bit line
      let cbits = []
      if(this.data.braidings) {
        for (let braiding of this.data.braidings) {
          cbits.push({'control': braiding.control, 'column': braiding.column});
        }  
      }
      
      const l = new BitLine(line.row, line.range, cbits);
      this.circuit.addBitLine(l);

      // bridges
      if (!line.bridges) {
        line.bridges = [];
      }
      for(let z of line.bridges) {
        const pos1 = new Vector3D(line.row * space, 0 * space, z * space).changeAxis();
        const pos2 = new Vector3D(line.row * space, 2 * space, z * space).changeAxis();
        const e = new Edge(pos1, pos2, type);
        this.circuit.addEdge(e);
      }

      // pins
      if (!line.pins) {
        line.pins = [];
      }
      for(let z of line.pins) {
        const pos1 = new Vector3D(line.row  * space, 0 * space, z * space).changeAxis();
        const pos2 = new Vector3D(line.row  * space, 2 * space, z * space).changeAxis();
        const pin = new Pin(pos1, pos2, type);
        this.circuit.addInjector(pin);
      }

      // caps
      if (!line.caps) {
        line.caps = [];
      }
      for(let z of line.caps) {
        const pos1 = new Vector3D(line.row  * space, 0 * space, z * space).changeAxis();
        const pos2 = new Vector3D(line.row  * space, 2 * space, z * space).changeAxis();
        const cap = new Cap(pos1, pos2, type);
        this.circuit.addInjector(cap);
      }
    }
  }

  createInjectors_() {
    if(!this.data.injectors) {
      return;
    }
    for(let injector of this.data.injectors) {
      const pos1 = this.correctPos_(injector.pos1, space);
      const pos2 = this.correctPos_(injector.pos2, space);
      const type = injector.type;
      const visual = injector.visual ? this.parseVisual_(injector.visual) : [];

      if (injector.category == "pin") {
        const pin = new Pin(pos1, pos2, type, ...visual);
        this.circuit.addInjector(pin);
      }
      else {
        const cap = new Cap(pos1, pos2, type, ...visual);
        this.circuit.addInjector(cap);
      }
    }
  }

  createBraidings_() {
    if (!this.data.braidings) {
      return;
    }
    for (let braiding of this.data.braidings) {
      const color = braiding.color ? braiding.color : 0;
      // const b = new Braiding(braiding.control, braiding.targets, braiding.column, color);
      const b = new BraidingWithBridge (braiding.control, braiding.targets, braiding.column, color);
      this.circuit.addBraiding(b);
    }
  }

  createModules_() {
    if (!this.data.modules) {
      return;
    }
    for (let module of this.data.modules) {
      const size = new Size(module.size[0] * space, module.size[1] * space, module.size[2] * space);
      const x = module.pos[0] * space + (size.w / 2); 
      const y = module.pos[1] * space + (size.h / 2);
      const z = module.pos[2] * space + (size.d / 2);
      const pos = new Vector3D(x, y, z);

      size.w += 1;
      size.h += 1;
      size.d += 1;

      const m = new Module(pos, size, module.ghost);
      this.circuit.addModule(m);
    }
  }

  correctPos_(pos, space) {
    const corrected_pos = new Vector3D();
    corrected_pos.x = pos[0] * space;
    corrected_pos.y = pos[1] * space;
    corrected_pos.z = pos[2] * space;
    corrected_pos.changeAxis(); // 軸変更
    return corrected_pos;
  }

  parseVisual_(data) {
    let visual = [];
    if ("color" in data) visual.push(data["color"]);
    if ("opacity" in data) visual.push(data["opacity"]);
    if ("ghost" in data) visual.push(data["ghost"]);
    return visual;
  }
}