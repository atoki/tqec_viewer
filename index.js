'use strict'

// global
var scene = new THREE.Scene();
var fileName;

var main = function(data) {
  var clock = new THREE.Clock();

  let width  = window.innerWidth;
  let height = window.innerHeight;
  let fov    = 60;
  let aspect = width / height;
  let near   = 1;
  let far    = 1000;
  let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 50, 50);
  var orbitControls = new THREE.OrbitControls(camera);

  var renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(width, height);
  renderer.setClearColor(new THREE.Color(0xffffff));

  var ambientLight = new THREE.AmbientLight(0xffcccccc);
  var spotLight = new THREE.SpotLight(0xffffff);
  spotLight.position.set(-30, 60, 60);

  scene.add(ambientLight);
  scene.add(spotLight);

  // Axis
  var showAxis = false;
  var axis = new THREE.AxisHelper(150);
  axis.visible = showAxis;
  scene.add(axis);

  // create circuit
  var circuit = new CircuitFactory(data).create();
  circuit.apply(scene);

  // add the output of the renderer to the html element
  document.body.appendChild(renderer.domElement);

  var controls = new function () {
    this.showAxis = false;
  };

  var gui = new dat.GUI();
  gui.add(controls, 'showAxis').onChange(function (e) {
      showAxis = e;
  });
  
  var render = function() {
    axis.visible = showAxis;
    orbitControls.update()
    requestAnimationFrame(render);
    renderer.render(scene, camera);
  };
  
  // render the scene
  render();
};

// Use FileSaver.js 'saveAs' function to save the string
var exportSTL = function() {
  var exporter = new THREE.STLExporter();
  var stlString = exporter.parse(scene);
  
  var blob = new Blob([stlString], {type: 'text/plain'});

  saveAs(blob, fileName + '.stl');
};

var prepareCanvas = function() {
  $('#drop-zone').hide();
  $('#file-selector').hide();
};

// Drag and Drop
$(function() {
  let dropZone = $('#drop-zone');
  let fileSelector = $('#file-selector');

  let cancelEvent = function(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  };

  dropZone.on('dragenter', cancelEvent);
  dropZone.on('dragover', cancelEvent);

  let openFileSelectionDialog = function(event) {
    fileSelector.click();
    return cancelEvent(event);
  };

  dropZone.on('click', openFileSelectionDialog);

  let readFile = function(file) {
    var names = file.name.split('.');
    fileName = names[0];
    let fileReader = new FileReader();
    fileReader.onload = function(event) {
      prepareCanvas();
      let json = event.target.result;
      let data = JSON.parse(json);
      main(data);
    };
    fileReader.readAsText(file);
  };

  let handleDroppedFile = function(event) {
    let file = event.originalEvent.dataTransfer.files[0];
    readFile(file);
    cancelEvent(event);
    return false;
  };

  let handleSelectedFile = function(event) {
    if(event.target.value === "") return false;
    let file = event.target.files[0];
    readFile(file);
    cancelEvent(event);
    return false;
  };

  dropZone.on('drop', handleDroppedFile);
  fileSelector.on('change', handleSelectedFile);
});
