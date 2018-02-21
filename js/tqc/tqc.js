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
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}

class Size {
  constructor(w, h, d) {
    this.w = w;
    this.h = h;
    this.d = d;
  }

  set(w, h, d) {
    this.w = w;
    this.h = h;
    this.d = d;
  }

  toArray() {
    return [this.w, this.h, this.d];
  }
}

class Box {
  constructor(x, y, z, type) {
    // x軸とz軸を交換してることに注意!!
    // 右手座標なので奥行きをx軸として方が扱いやすいため
    this.pos = new Vector3D(z, y, x);
    this.type = type;
    this.color = colors[type];
  }

  x() {
    return this.pos.x;
  }

  y() {
    return this.pos.y;
  }

  z() {
    return this.pos.z;
  }
}

class LogicalQubit extends Box {
  constructor(pos, type, color = 0) {
    super(pos.x, pos.y, pos.z, type);
    this.ghost = false;
    this.opacity = 1.0;
    this.color = (color == 0) ? colors[type] : color
  }

  apply(scene) {
    var cubeGeometry = new THREE.BoxGeometry(scale, scale, scale);
    var cubeMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: this.opacity, transparent: this.ghost});
    var cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(this.x(), this.y(), this.z());

    var edge = new THREE.BoxHelper(cube, colors.edge);
    edge.material.linewidth = line_width;
    edge.visible = showEdges;

    scene.add(edge)
    scene.add(cube);
  }
}

class Edge {
  constructor(box1, box2, color = 0) {
    this.box1 = box1;
    this.box2 = box2;
    this.ghost = false;
    this.opacity = 1.0;
    this.color = (color == 0) ? box1.color : color
  }

  apply(scene) {
    var scale_x = this.box1.x() != this.box2.x() ? margin : scale;
    var scale_y = this.box1.y() != this.box2.y() ? margin : scale;
    var scale_z = this.box1.z() != this.box2.z() ? margin : scale;
    var cubeGeometry = new THREE.BoxGeometry(scale_x, scale_y, scale_z);
    var cubeMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: this.opacity, transparent: this.ghost});
    var cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

    cube.position.x = this.box1.x() != this.box2.x() ? (this.box2.x() + this.box1.x()) / 2 : this.box1.x();
    cube.position.y = this.box1.y() != this.box2.y() ? (this.box2.y() + this.box1.y()) / 2 : this.box1.y();
    cube.position.z = this.box1.z() != this.box2.z() ? (this.box2.z() + this.box1.z()) / 2 : this.box1.z();

    var edge = new THREE.BoxHelper(cube, colors.edge);
    edge.material.linewidth = line_width;
    edge.visible = showEdges;

    scene.add(edge)
    scene.add(cube);
  }
}

class AerialQubit extends LogicalQubit {
  constructor(pos, type) {
    super(pos, type);
    this.ghost = true;
    this.opacity = 0.5;
  }
}

class AerialWire extends Edge {
  constructor(box1, box2) {
    super(box1, box2);
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

  _createBits() {
    for(let x = this.range[0]; x <= this.range[1]; x += graph_intarval) {
      let pos = new Vector3D(x * space, this.y * space, this.z * space);
      let qubit = new LogicalQubit(pos, this.type);
      this.line.push(qubit);
    }
  }

  _createEdges() {
    for(let x = this.range[0]; x <= this.range[1] - graph_intarval; x += graph_intarval) {
      var skip = false;
      for (let cbit of this.cbits) {
        if (this.z == cbit.control && x + 1 == cbit.column) {
          skip = true;
        }
      }
      if (skip) continue;

      let pos1 = new Vector3D(x * space, this.y * space, this.z * space);
      let pos2 = new Vector3D((x + graph_intarval) * space, this.y * space, this.z * space);
      let qubit1 = new LogicalQubit(pos1, this.type);
      let qubit2 = new LogicalQubit(pos2, this.type);
      let edge = new Edge(qubit1, qubit2);
      this.line.push(edge);
    }
  }

  create() {
      this._createBits();
      this._createEdges();
      return this.line;
  }
}

class BitLine {
  constructor(z, range, cbits) {
    this.z = z;
    this.range = range;
    this.cbits = cbits;
    this.lines = [];

    var upper_line = new SingleBitLine(z, range, graph_intarval, this.cbits);
    var lower_line = new SingleBitLine(z, range, 0, this.cbits);
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
  constructor(box1, box2) {
    this.box1 = box1;
    this.box2 = box2;
    this.color = box1.color;
    //'#'+Math.floor(Math.random()*16777215).toString(16); 
    this.angles = {1: 'none', 2: 'none'};
    // distance between two boxes
    this.distance = 0.0;
    this.ghost = false;

    // calc agnle and distance
    this._calcAngle();
  }

  _calcAngle() {
    // diff x
    if (Math.abs(this.box1.x() - this.box2.x()) > 0) {
      this.distance = Math.abs(this.box1.x() - this.box2.x());
      if (this.box1.x() > this.box2.x()) {
        this.angles[1] = 'left';
        this.angles[2] = 'right';
      }
      else {
        this.angles[1] = 'right';
        this.angles[2] = 'left';
      }
    }
    // diff y
    else if (Math.abs(this.box1.y() - this.box2.y()) > 0) {
      this.distance = Math.abs(this.box1.y() - this.box2.y());
      if (this.box1.y() > this.box2.y()) {
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
      this.distance = Math.abs(this.box1.z() - this.box2.z());
      if (this.box1.z() > this.box2.z()) {
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
    for(let mesh of this._createBoxes()) {
      var edge = new THREE.BoxHelper(mesh, colors.edge);
      edge.material.linewidth = line_width;
      edge.visible = showEdges;

      scene.add(edge);
      scene.add(mesh)
    }

    for(let mesh of this._createCones()) {
      scene.add(mesh)
    }
  }

  _createCones() {
    var cone1 = this._createConeMesh(this.box1, 1);
    var cone2 = this._createConeMesh(this.box2, 2);

    return [cone1, cone2];
  }

  _createBoxes() {
    var cube1 = this._createBoxMesh(this.box1, 1);
    var cube2 = this._createBoxMesh(this.box2, 2);

    return [cube1, cube2];
  }

  _createBoxMesh(box, id) {
    var cubeGeometry = new THREE.BoxGeometry(scale, scale, scale);
    var cubeMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: 0.1, transparent: this.ghost});
    var cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

    var nx = {'right': scale, 'left': -scale, 'front': 0, 'back': 0, 'up': 0, 'down': 0 };
    var ny = {'right': 0, 'left': 0, 'front': scale, 'back': -scale, 'up': 0, 'down': 0 };
    var nz = {'right': 0, 'left': 0, 'front': 0, 'back': 0, 'up': scale, 'down': -scale };

    cube.position.set(box.x() + nx[this.angles[id]], box.y() 
                      + ny[this.angles[id]], box.z() + nz[this.angles[id]]);

    return cube;
  }

  _createConeMesh(box, id) {
    var height = (this.distance - scale * 2.0 - 1.0) / 2.0;
    var coneGeometry = new THREE.ConeGeometry(scale/ Math.SQRT2, height, 4);
    var meshMat = new THREE.MeshPhongMaterial({color: this.color, opacity: 0.1, transparent: this.ghost});
    var wireFrameMat = new THREE.MeshPhongMaterial({color: colors.edge, wireframe: true});
    wireFrameMat.wireframeLinewidth = line_width;
    wireFrameMat.visible = showEdges;
    var cone = THREE.SceneUtils.createMultiMaterialObject(coneGeometry, [meshMat, wireFrameMat]);
    //var cone = new THREE.Mesh(coneGeometry, wireFrameMat);

    var diff = ((this.distance * 0.5) - (scale * 1.5)) / 2.0 + scale * 1.5;
    var nx = {'right': diff, 'left': -diff, 'front': 0, 'back': 0, 'up': 0, 'down': 0 };
    var ny = {'right': 0, 'left': 0, 'front': diff, 'back': -diff, 'up': 0, 'down': 0 };
    var nz = {'right': 0, 'left': 0, 'front': 0, 'back': 0, 'up': diff, 'down': -diff };

    var rx = {'right': 0.25, 'left': 0.25, 'front': 0, 'back': -1, 'up': 0.5, 'down': -0.5 };
    var ry = {'right': 0, 'left': 0, 'front': 0.25, 'back': 0.25, 'up': 0.25, 'down': 0.25 };
    var rz = {'right': -0.5, 'left': 0.5, 'front': 0, 'back': 0, 'up': 0, 'down': 0 };

    cone.position.set(box.x() + nx[this.angles[id]], box.y() + ny[this.angles[id]], 
                      box.z() + nz[this.angles[id]]);
    cone.rotation.set(Math.PI * rx[this.angles[id]], Math.PI * ry[this.angles[id]], 
                      Math.PI * rz[this.angles[id]]);
    
    return cone;
  }
}

class Cap extends Injector {
  constructor(box1, box2) {
    super(box1, box2);
    this.ghost = true;
  }
}

class Pin extends Injector {
  constructor(box1, box2) {
    super(box1, box2);
    this.color = colors.pin;
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

    this._create();
  }

  _create() {
    var bitNoArray = this.tbitNoArray.concat([this.cbitNo]);
    var mintBitNo = Math.min.apply(null, bitNoArray);
    var maxtBitNo = Math.max.apply(null, bitNoArray);
    var d = (this.cbitNo < this.tbitNoArray[0]) ? 1.0 : -1.0;

    this.push = function(pos, type = this.type) {
      this.bits.push(new LogicalQubit(pos, type, this.color));
    }

    // add bridge
    var upper = new Vector3D(this.col - space, pitch, this.cbitNo * space);
    var lower = new Vector3D(this.col - space, 0, this.cbitNo * space);
    var qubit1 = new LogicalQubit(upper, "primal");
    var qubit2 = new LogicalQubit(lower, "primal");
    var edge = new Edge(qubit1, qubit2);
    this.edges.push(edge);

    upper = new Vector3D(this.col + space, pitch, this.cbitNo * space);
    lower = new Vector3D(this.col + space, 0, this.cbitNo * space);
    qubit1 = new LogicalQubit(upper, "primal");
    qubit2 = new LogicalQubit(lower, "primal");
    edge = new Edge(qubit1, qubit2);
    this.edges.push(edge);

    // add qubit
    var pos = new Vector3D(this.col - space * d * 2, 
                      this.height, 
                      this.cbitNo * space  - space * d);
    this.push(pos);
    pos.z += pitch * d;
    this.push(pos);
    
    var start = (this.cbitNo < this.tbitNoArray[0]) ? mintBitNo : maxtBitNo;
    var range = (this.cbitNo < this.tbitNoArray[0]) ? maxtBitNo : mintBitNo;
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
    var prev_qubit = this.bits[0];
    var last_qubit = this.bits[this.bits.length-1];
    this.edges.push(new Edge(prev_qubit, last_qubit, this.color));
    var first = true;
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

    this._create();
  }

  _create() {
    var bitNoArray = this.tbitNoArray.concat([this.cbitNo]);
    var mintBitNo = Math.min.apply(null, bitNoArray);
    var maxtBitNo = Math.max.apply(null, bitNoArray);
    var d = (this.cbitNo < this.tbitNoArray[0]) ? 1.0 : -1.0;

    this.push = function(pos, type = this.type) {
      this.bits.push(new LogicalQubit(pos, type));
    }

    // add bridge
    var upper = new Vector3D(this.col, pitch, this.cbitNo * space);
    var lower = new Vector3D(this.col, 0, this.cbitNo * space);
    this.push(upper, "primal");
    this.push(lower, "primal");
    var edge = new Edge(this.bits[0], this.bits[1]);
    this.edges.push(edge);
    this.bits = [];

    // add qubit
    var pos = new Vector3D(this.col - space * d, this.height, this.cbitNo * space  - space * d);
    this.push(pos);
    pos.z += pitch * d;
    this.push(pos);
    
    var start = (this.cbitNo < this.tbitNoArray[0]) ? mintBitNo : maxtBitNo;
    var range = (this.cbitNo < this.tbitNoArray[0]) ? maxtBitNo : mintBitNo;
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
    var prev_qubit = this.bits[0];
    var last_qubit = this.bits[this.bits.length-1];
    this.edges.push(new Edge(prev_qubit, last_qubit));
    var first = true;
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
    var cube = this._createMesh();
    var edge = new THREE.BoxHelper(cube, colors.edge);
    edge.material.linewidth = line_width;

    scene.add(cube);
    scene.add(edge)
  }

  _createMesh() {
    var w = this.size.w * scale;
    var h = this.size.h * scale;
    var d = this.size.d * scale;
    var cubeGeometry = new THREE.BoxGeometry(w, h, d);
    var cubeMaterial = new THREE.MeshPhongMaterial({color: this.color, opacity: 0.3, transparent: this.ghost});
    var cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(this.pos.x, this.pos.y, this.pos.z);

    return cube;
  }
}

class Circuit {
  constructor() {
    this.logical_qubits = [];
    this.edges = [];
    this.aerial_qubits = [];
    this.aerial_wires = [];
    this.bit_lines = [];
    this.injectors = [];
    this.braidings = [];
    this.modules = [];
  }

  addLogicalQubit(logical_qubit) {
    this.logical_qubits.push(logical_qubit);
  }

  addEdge(edge) {
    this.edges.push(edge);
  }

  addAerialQubit(aerial_qubit) {
    this.aerial_qubits.push(aerial_qubit);
  }

  addAerialWire(aerial_wire) {
    this.aerial_wires.push(aerial_wire);
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
    for(let elements of [this.logical_qubits, this.edges, this.aerial_qubits, this.aerial_wires, this.injectors, this.bit_lines, this.braidings, this.modules]) {
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
    this._createLogicalQubits();
    this._createEdges();
    this._createBitLines();
    this._createInjectors();
    this._createBraidings();
    this._createAerialQubits();
    this._createAerialWires();
    this._createModules();

    return this.circuit;
  }

  _createLogicalQubits() {
    if(!this.data.logical_qubits) {
      return;
    }
    for(let qubit of this.data.logical_qubits) {
      var pos = new Vector3D(qubit.pos[0] * space, qubit.pos[1] * space, qubit.pos[2] * space);
      var type = qubit.type;
      var color = qubit.color ? qubit.color : 0;
      var lq = new LogicalQubit(pos, type, color);
      this.circuit.addLogicalQubit(lq);
    }
  }

  _createEdges() {
    if(!this.data.edges) {
      return;
    }
    for(let edge of this.data.edges) {
      var pos1 = new Vector3D(edge.pos1[0] * space, edge.pos1[1] * space, edge.pos1[2] * space);
      var pos2 = new Vector3D(edge.pos2[0] * space, edge.pos2[1] * space, edge.pos2[2] * space);
      var type = edge.type;
      var logical_qubit1 = new LogicalQubit(pos1, type);
      var logical_qubit2 = new LogicalQubit(pos2, type);
      var color = edge.color ? edge.color : 0;
      var e = new Edge(logical_qubit1, logical_qubit2, color);
      this.circuit.addEdge(e);
    }
  }

  _createAerialQubits() {
    if(!this.data.aerial_qubits) {
      return;
    }
    for(let qubit of this.data.aerial_qubits) {
      var pos = new Vector3D(qubit.pos[0] * space, qubit.pos[1] * space, qubit.pos[2] * space);
      var type = "aerial"
      var aq = new AerialQubit(pos, type);
      this.circuit.addAerialQubit(aq);
    }
  }

  _createAerialWires() {
    if(!this.data.aerial_wires) {
      return;
    }
    for(let wire of this.data.aerial_wires) {
      var pos1 = new Vector3D(wire.pos1[0] * space, wire.pos1[1] * space, wire.pos1[2] * space);
      var pos2 = new Vector3D(wire.pos2[0] * space, wire.pos2[1] * space, wire.pos2[2] * space);
      var type = "aerial"
      var logical_qubit1 = new LogicalQubit(pos1, type);
      var logical_qubit2 = new LogicalQubit(pos2, type);
      var w = new AerialWire(logical_qubit1, logical_qubit2);
      this.circuit.addAerialWire(w);
    }
  }

  /*
    "row": 0,
    "range": [0, 9],
    "caps": [0],
    "pins": [8],
    "bridges": [9]
  */
  _createBitLines() {
    if(!this.data.bit_lines) {
      return;
    }
    for(let line of this.data.bit_lines) {
      // bit line
      var cbits = []
      if(this.data.braidings) {
        for (let braiding of this.data.braidings) {
          cbits.push({'control': braiding.control, 'column': braiding.column});
        }  
      }
      
      var l = new BitLine(line.row, line.range, cbits);
      this.circuit.addBitLine(l);

      // bridges
      if (!line.bridges) {
        line.bridges = [];
      }
      for(let x of line.bridges) {
        var pos1 = new Vector3D(x * space, 0 * space, line.row * space);
        var pos2 = new Vector3D(x * space, 2 * space, line.row * space);
        var type = "primal";
        var logical_qubit1 = new LogicalQubit(pos1, type);
        var logical_qubit2 = new LogicalQubit(pos2, type);
        var e = new Edge(logical_qubit1, logical_qubit2);
        this.circuit.addEdge(e);
      }

      // caps
      if (!line.caps) {
        line.caps = [];
      }
      for(let x of line.caps) {
        var pos1 = new Vector3D(x * space, 0 * space, line.row * space);
        var pos2 = new Vector3D(x * space, 2 * space, line.row * space);
        var type = "primal";
        var logical_qubit1 = new LogicalQubit(pos1, type);
        var logical_qubit2 = new LogicalQubit(pos2, type);
        var cap = new Cap(logical_qubit1, logical_qubit2);
        this.circuit.addInjector(cap);
      }

      // pins
      if (!line.pins) {
        line.pins = [];
      }
      for(let x of line.pins) {
        var pos1 = new Vector3D(x * space, 0 * space, line.row * space);
        var pos2 = new Vector3D(x * space, 2 * space, line.row * space);
        var type = "primal";
        var logical_qubit1 = new LogicalQubit(pos1, type);
        var logical_qubit2 = new LogicalQubit(pos2, type);
        var pin = new Pin(logical_qubit1, logical_qubit2);
        this.circuit.addInjector(pin);
      }
    }
  }

  _createInjectors() {
    if(!this.data.injectors) {
      return;
    }
    for(let injector of this.data.injectors) {
      var pos1 = new Vector3D(injector.pos1[0] * space, injector.pos1[1] * space, injector.pos1[2] * space);
      var pos2 = new Vector3D(injector.pos2[0] * space, injector.pos2[1] * space, injector.pos2[2] * space);
      var type = injector.type;
      var logical_qubit1 = new LogicalQubit(pos1, type);
      var logical_qubit2 = new LogicalQubit(pos2, type);

      if (injector.category == "pin") {
        var pin = new Pin(logical_qubit1, logical_qubit2);
        this.circuit.addInjector(pin);
      }
      else {
        var cap = new Cap(logical_qubit1, logical_qubit2);
        this.circuit.addInjector(cap);
      }
    }
  }

  _createBraidings() {
    if (!this.data.braidings) {
      return;
    }
    for (let braiding of this.data.braidings) {
      var color = braiding.color ? braiding.color : 0;
      var b = new Braiding(braiding.control, braiding.targets, braiding.column, color);
      this.circuit.addBraiding(b);
    }
  }

  _createModules() {
    if (!this.data.modules) {
      return;
    }
    for (let module of this.data.modules) {
      let size = new Size(module.size[0] * space, module.size[1] * space, module.size[2] * space);
      let x = module.pos[0] * space + (size.w / 2); 
      let y = module.pos[1] * space + (size.h / 2);
      let z = module.pos[2] * space + (size.d / 2);
      let pos = new Vector3D(x, y, z);

      size.w += 1;
      size.h += 1;
      size.d += 1;

      let m = new Module(pos, size, module.ghost);
      this.circuit.addModule(m);
    }
  }
}