# TQEC Viewer
TQEC Viewer is TQEC (Topologically Quantum Error Corrected) geometory circuit viewer.

<img width="1677" alt="2018-06-30 14 13 24" src="https://user-images.githubusercontent.com/8393357/42121771-4a007f28-7c70-11e8-8398-1eb23f94d49a.png">

## Usage
1. Open and properly display index.html in any web browser (Internet Explorer, Chrome, FireFox).
2. You can display the circuit by dragging and dropping a file or selecting it from the dialog.

You can download stl format of the circuit by selecting Export STL button.

## Project layout
```
.
├── css             css files
├── index.html      main html file
├── index.js        main js file
├── js              javascript library
│   ├── bootstrap   
│   ├── jquery      
│   ├── tether      
│   ├── three       
│   └── tqc         
└── samples         sample circuit data
```

## Format
The following is the TQEC (Topologically Quantum Error Corrected) geometory circuit format.
```
{
    "logical_qubits": [
        {
            "id": <logical qubit id>,
            "type": "<primal or dual>",
            "blocks": [
                [[<x>, <y>, <z>], ...], ...
            ],
            "injectors": [
                [[<x>, <y>, <z>], ...], ...
            ]
            "caps": [
                [[<x>, <y>, <z>], ...], ...
            ]
        }, ...
    ],
    "modules": [
        {
            "id"      : "<module circuit id>",
            "size"    : [<x>, <y>, <z>],
            "position": [<x>, <y>, <z>],
            "rotation": [<axis>, <axis>, <axis>]
        }, ...
    ]
}
```