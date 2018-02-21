# TQEC Viewer
本プログラムはTQEC回路のViewerである.  
TQEC Optimizerから出力された回路情報を用いる.

<img width="1043" alt="2018-02-21 15 28 32" src="https://user-images.githubusercontent.com/8393357/36466218-412cbb64-171c-11e8-9a27-4b14a10b85dc.png">

## Usage
1. index.htmlをブラウザで表示.
2. ファイルをドラッグ＆ドロップ, もしくはダイアログから選択.

Exprot STLボタンを選択することで表示された回路のSTLがダウンロード可能.

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
