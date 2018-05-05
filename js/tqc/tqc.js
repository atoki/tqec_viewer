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

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  changeAxis() {
    this.x = [this.z, this.z = this.x][0];
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
  constructor(pos, type) {
    this.pos = pos;
    this.type = type;
  }
}

class Cube extends Rectangler {
  constructor(pos, type, color = 0) {
    pos.changeAxis();
    super(pos, type);
    this.ghost = false;
    this.opacity = 1.0;
    this.color = (color == 0) ? colors[type] : color;
  }

  apply(scene) {
    const cubeGeometry = new THREE.BoxGeometry(scale, scale, scale);
    const cubeMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: this.opacity, transparent: this.ghost});
    let cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(this.pos.x, this.pos.y, this.pos.z);

    let edge = new THREE.BoxHelper(cube, colors.edge);
    edge.material.linewidth = line_width;
    edge.visible = showEdges;

    scene.add(edge);
    scene.add(cube);
  }
}

class Edge extends Rectangler {
  constructor(cube1, cube2, color = 0) {
    const axis = Edge.getAxis_(cube1, cube2);
    const pos = Edge.getPos_(cube1, cube2);
    const size = Edge.getSize_(cube1, cube2, axis);
    super(pos, cube1.type);
    this.ghost = false;
    this.opacity = 1.0;
    this.color = (color == 0) ? cube1.color : color
    this.axis = axis;
    this.size = size;
  }

  apply(scene) {
    const cubeGeometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    const cubeMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: this.opacity, transparent: this.ghost});
    let cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(this.pos.x, this.pos.y, this.pos.z);

    let edge = new THREE.BoxHelper(cube, colors.edge);
    edge.material.linewidth = line_width;
    edge.visible = showEdges;

    scene.add(edge);
    scene.add(cube);
  }

  static getAxis_(cube1, cube2) {
    if (cube1.pos.x != cube2.pos.x) return 'x';
    if (cube1.pos.y != cube2.pos.y) return 'y';
    if (cube1.pos.z != cube2.pos.z) return 'z';
    console.assert(false, "invalid asis");
  }

  static getPos_(cube1, cube2) {
    const x =  (cube2.pos.x + cube1.pos.x) / 2;
    const y =  (cube2.pos.y + cube1.pos.y) / 2;
    const z =  (cube2.pos.z + cube1.pos.z) / 2;
    return new Vector3D(x, y, z);
  }

  static getSize_(cube1, cube2, axis) {
    const scale_x = axis == 'x' ? Math.abs(cube1.pos.x - cube2.pos.x) - 1.0 : scale;
    const scale_y = axis == 'y' ? Math.abs(cube1.pos.y - cube2.pos.y) - 1.0 : scale;
    const scale_z = axis == 'z' ? Math.abs(cube1.pos.z - cube2.pos.z) - 1.0 : scale;
    return new Size(scale_x, scale_y, scale_z);
  }
}

class AerialCube extends Cube {
  constructor(pos, type) {
    super(pos, type);
    this.ghost = true;
    this.opacity = 0.5;
  }
}

class AerialEdge extends Edge {
  constructor(cube1, cube2) {
    super(cube1, cube2);
    this.ghost = true;
    this.opacity = 0.5;
  }
}

class SingleBitLine  {
  constructor(z, range, y, cbits) {
    this.z = z;
    this.range = range;
    this.y = y;
    this.cbits = cbits;
    this.type = "primal";
    // line array is LogicalQubits and Edges
    this.line = [];
  }

  createBits_() {
    for(let x = this.range[0]; x <= this.range[1]; x += graph_intarval) {
      const pos = new Vector3D(x * space, this.y * space, this.z * space);
      const qubit = new Cube(pos, this.type);
      this.line.push(qubit);
    }
  }

  createEdges_() {
    for(let x = this.range[0]; x <= this.range[1] - graph_intarval; x += graph_intarval) {
      let skip = false;
      for (let cbit of this.cbits) {
        if (this.z == cbit.control && x + 1 == cbit.column) {
          skip = true;
        }
      }
      if (skip) continue;

      const pos1 = new Vector3D(x * space, this.y * space, this.z * space);
      const pos2 = new Vector3D((x + graph_intarval) * space, this.y * space, this.z * space);
      const qubit1 = new Cube(pos1, this.type);
      const qubit2 = new Cube(pos2, this.type);
      const edge = new Edge(qubit1, qubit2);
      this.line.push(edge);
    }
  }

  create() {
      this.createBits_();
      this.createEdges_();
      return this.line;
  }
}

class BitLine {
  constructor(z, range, cbits) {
    this.z = z;
    this.range = range;
    this.cbits = cbits;
    this.lines = [];

    const upper_line = new SingleBitLine(z, range, graph_intarval, this.cbits);
    const lower_line = new SingleBitLine(z, range, 0, this.cbits);
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
  constructor(cube1, cube2) {
    this.cube1 = cube1;
    this.cube2 = cube2;
    this.color = cube1.color;
    this.angles = {1: 'none', 2: 'none'};
    // distance between two cubees
    this.distance = 0.0;
    this.ghost = false;

    // calc agnle and distance
    this.calcAngle_();
  }

  calcAngle_() {
    // diff x
    if (Math.abs(this.cube1.pos.x - this.cube2.pos.x) > 0) {
      this.distance = Math.abs(this.cube1.pos.x - this.cube2.pos.x);
      if (this.cube1.pos.x > this.cube2.pos.x) {
        this.angles[1] = 'left';
        this.angles[2] = 'right';
      }
      else {
        this.angles[1] = 'right';
        this.angles[2] = 'left';
      }
    }
    // diff y
    else if (Math.abs(this.cube1.pos.y - this.cube2.pos.y) > 0) {
      this.distance = Math.abs(this.cube1.pos.y - this.cube2.pos.y);
      if (this.cube1.pos.y > this.cube2.pos.y) {
        this.angles[1] = 'back';
        this.angles[2] = 'front';
      }
      else {
        this.angles[1] = 'front';
        this.angles[2] = 'back';
      }
    }
    // diff z
    else {
      this.distance = Math.abs(this.cube1.pos.z - this.cube2.pos.z);
      if (this.cube1.pos.z > this.cube2.pos.z) {
        this.angles[1] = 'down';
        this.angles[2] = 'up';
      }
      else {
        this.angles[1] = 'up';
        this.angles[2] = 'down';
      }
    }
  }

  apply(scene) {
    for(let mesh of this.createBoxes_()) {
      let edge = new THREE.BoxHelper(mesh, colors.edge);
      edge.material.linewidth = line_width;
      edge.visible = showEdges;

      scene.add(edge);
      scene.add(mesh)
    }

    for(let mesh of this.createCones_()) {
      scene.add(mesh)
    }
  }

  createCones_() {
    const cone1 = this.createConeMesh_(this.cube1, 1);
    const cone2 = this.createConeMesh_(this.cube2, 2);

    return [cone1, cone2];
  }

  createBoxes_() {
    const cube1 = this.createBoxMesh_(this.cube1, 1);
    const cube2 = this.createBoxMesh_(this.cube2, 2);

    return [cube1, cube2];
  }

  createBoxMesh_(cube, id) {
    const boxGeometry = new THREE.BoxGeometry(scale, scale, scale);
    const boxMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: 0.1, transparent: this.ghost});
    let box = new THREE.Mesh(boxGeometry, boxMaterial);

    const nx = {'right': scale, 'left': -scale, 'front': 0, 'back': 0, 'up': 0, 'down': 0 };
    const ny = {'right': 0, 'left': 0, 'front': scale, 'back': -scale, 'up': 0, 'down': 0 };
    const nz = {'right': 0, 'left': 0, 'front': 0, 'back': 0, 'up': scale, 'down': -scale };

    box.position.set(cube.pos.x + nx[this.angles[id]], cube.pos.y 
                      + ny[this.angles[id]], cube.pos.z + nz[this.angles[id]]);

    return box;
  }

  createConeMesh_(cube, id) {
    const height = (this.distance - scale * 2.0 - 1.0) / 2.0;
    const coneGeometry = new THREE.ConeGeometry(scale/ Math.SQRT2, height, 4);
    const meshMat = new THREE.MeshPhongMaterial({color: this.color, opacity: 0.1, transparent: this.ghost});
    let wireFrameMat = new THREE.MeshPhongMaterial({color: colors.edge, wireframe: true});
    wireFrameMat.wireframeLinewidth = line_width;
    wireFrameMat.visible = showEdges;
    let cone = THREE.SceneUtils.createMultiMaterialObject(coneGeometry, [meshMat, wireFrameMat]);
    //let cone = new THREE.Mesh(coneGeometry, wireFrameMat);

    const diff = ((this.distance * 0.5) - (scale * 1.5)) / 2.0 + scale * 1.5;
    const nx = {'right': diff, 'left': -diff, 'front': 0, 'back': 0, 'up': 0, 'down': 0 };
    const ny = {'right': 0, 'left': 0, 'front': diff, 'back': -diff, 'up': 0, 'down': 0 };
    const nz = {'right': 0, 'left': 0, 'front': 0, 'back': 0, 'up': diff, 'down': -diff };

    const rx = {'right': 0.25, 'left': 0.25, 'front': 0, 'back': -1, 'up': 0.5, 'down': -0.5 };
    const ry = {'right': 0, 'left': 0, 'front': 0.25, 'back': 0.25, 'up': 0.25, 'down': 0.25 };
    const rz = {'right': -0.5, 'left': 0.5, 'front': 0, 'back': 0, 'up': 0, 'down': 0 };

    cone.position.set(cube.pos.x + nx[this.angles[id]], cube.pos.y + ny[this.angles[id]], 
                      cube.pos.z + nz[this.angles[id]]);
    cone.rotation.set(Math.PI * rx[this.angles[id]], Math.PI * ry[this.angles[id]], 
                      Math.PI * rz[this.angles[id]]);
    
    return cone;
  }
}

class Pin extends Injector {
  constructor(cube1, cube2, color = colors.pin) {
    super(cube1, cube2);
    this.color = color;
  }
}

class Cap extends Injector {
  constructor(cube1, cube2) {
    super(cube1, cube2);
    this.ghost = true;
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
      this.bits.push(new Cube(pos, type, this.color));
    }

    // add bridge
    let upper = new Vector3D(this.col - space, pitch, this.cbitNo * space);
    let lower = new Vector3D(this.col - space, 0, this.cbitNo * space);
    let qubit1 = new Cube(upper, "primal");
    let qubit2 = new Cube(lower, "primal");
    let edge = new Edge(qubit1, qubit2);
    this.edges.push(edge);

    upper = new Vector3D(this.col + space, pitch, this.cbitNo * space);
    lower = new Vector3D(this.col + space, 0, this.cbitNo * space);
    qubit1 = new Cube(upper, "primal");
    qubit2 = new Cube(lower, "primal");
    edge = new Edge(qubit1, qubit2);
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
    this.edges.push(new Edge(prev_qubit, last_qubit, this.color));
    let first = true;
    for(let qubit of this.bits) {
      if (first) {
        first = false;
        continue;
      }
      let edge = new Edge(prev_qubit, qubit, this.color);
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
      this.bits.push(new Cube(pos, type));
    }

    // add bridge
    const upper = new Vector3D(this.col, pitch, this.cbitNo * space);
    const lower = new Vector3D(this.col, 0, this.cbitNo * space);
    this.push(upper, "primal");
    this.push(lower, "primal");
    const edge = new Edge(this.bits[0], this.bits[1]);
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
    this.edges.push(new Edge(prev_qubit, last_qubit));
    let first = true;
    for(let qubit of this.bits) {
      if (first) {
        first = false;
        continue;
      }
      let edge = new Edge(prev_qubit, qubit);
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
    for (let block of blocks) {
      const pos1 = this.correctPos_(block[0], space);
      const pos2 = this.correctPos_(block[1], space);
      const cube1 = new Cube(pos1, type);
      const cube2 = new Cube(pos2, type);
      const edge = new Edge(cube1, cube2);
      this.circuit.addCube(cube1);
      this.circuit.addCube(cube2);
      this.circuit.addEdge(edge);
    }
  }

  createInjectorsInLogicalQubit_(type, injectors = []) {
    for (let injector of injectors) {
      const pos1 = this.correctPos_(injector.vertices[0], space);
      const pos2 = this.correctPos_(injector.vertices[1], space);
      const cube1 = new Cube(pos1, type);
      const cube2 = new Cube(pos2, type);
      const color = injector.color ? injector.color : colors.pin;
      const pin = new Pin(cube1, cube2, color);
      this.circuit.addInjector(pin);
    }
  }

  createCapsInLogicalQubit_(type, caps = []) {
    for (let injector of caps) {
      const pos1 = this.correctPos_(injector.vertices[0], space);
      const pos2 = this.correctPos_(injector.vertices[1], space);
      const cube1 = new Cube(pos1, type);
      const cube2 = new Cube(pos2, type);
      const cap = new Cap(cube1, cube2);
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
      const color = cube.color ? cube.color : 0;
      const c = new Cube(pos, type, color);
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
      const cube1 = new Cube(pos1, type);
      const cube2 = new Cube(pos2, type);
      const color = edge.color ? edge.color : 0;
      const e = new Edge(cube1, cube2, color);
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
      const cube1 = new Cube(pos1, type);
      const cube2 = new Cube(pos2, type);
      const e = new AerialEdge(cube1, cube2);
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
      for(let x of line.bridges) {
        const pos1 = new Vector3D(x * space, 0 * space, line.row * space);
        const pos2 = new Vector3D(x * space, 2 * space, line.row * space);
        const cube1 = new Cube(pos1, type);
        const cube2 = new Cube(pos2, type);
        const e = new Edge(cube1, cube2);
        this.circuit.addEdge(e);
      }

      // pins
      if (!line.pins) {
        line.pins = [];
      }
      for(let x of line.pins) {
        const pos1 = new Vector3D(x * space, 0 * space, line.row * space);
        const pos2 = new Vector3D(x * space, 2 * space, line.row * space);
        const cube1 = new Cube(pos1, type);
        const cube2 = new Cube(pos2, type);
        const pin = new Pin(cube1, cube2);
        this.circuit.addInjector(pin);
      }

      // caps
      if (!line.caps) {
        line.caps = [];
      }
      for(let x of line.caps) {
        const pos1 = new Vector3D(x * space, 0 * space, line.row * space);
        const pos2 = new Vector3D(x * space, 2 * space, line.row * space);
        const cube1 = new Cube(pos1, type);
        const cube2 = new Cube(pos2, type);
        const cap = new Cap(cube1, cube2);
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
      const cube1 = new Cube(pos1, type);
      const cube2 = new Cube(pos2, type);

      if (injector.category == "pin") {
        const pin = new Pin(cube1, cube2);
        this.circuit.addInjector(pin);
      }
      else {
        const cap = new Cap(cube1, cube2);
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
    return corrected_pos;
  }
}