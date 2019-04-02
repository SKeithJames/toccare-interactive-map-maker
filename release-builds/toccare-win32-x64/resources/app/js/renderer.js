const s = require('./shared');

const {
  Menu,
  MenuItem
} = s.remote;

var tool_select = require('./tool_select');
var tool_landmark_draw = require('./tool_landmark_draw');
var tool_road_draw = require('./tool_road_draw');
var tool_smart_road_draw = require('./tool_smart_road_draw');
var tool_region_draw = require('./tool_region_draw');
var tool_text = require('./tool_text');

exports.initializeMap = function() {
  grid = new s.fabric.Canvas('mapgrid', {
    top: 0,
    left: 0,
    width: s.mapWidth,
    height: s.mapHeight,
    preserveObjectStacking: true
  });

  // initialize layer objects
  var i;
  for (i = 0; i < s.numberOfMapLayers * 2; i++) {
    s.layerTemplateObjects[i] = new s.fabric.Line([0, 0, 1, 1], {
      opacity: 0,
      selectable: false,
      hoverCursor: 'default'
    });
    grid.add(s.layerTemplateObjects[i]);
  }

  // draw grid
  var i;
  for (i = 0; i <= s.mapHeight; i += 80) {
    var verticalLine = new s.fabric.Line([i, 0, i, s.mapWidth], {
      stroke: '#aaa',
      strokeWidth: 2,
      selectable: false,
      hoverCursor: "default",
      class: "gridline"
    });
    addToMap(verticalLine);
  }

  var i;
  for (i = 0; i <= s.mapWidth; i += 80) {
    var horizontalLine = new fabric.Line([0, i, s.mapHeight, i], {
      stroke: '#aaa',
      strokeWidth: 2,
      selectable: false,
      hoverCursor: "default",
      class: "gridline"
    })
    addToMap(horizontalLine);
  }

  zoomMap();
}

function testOn() {
  console.log("szfsd.");
}

exports.dragMap = function(e) {
  if (e.button != 2) {
    return;
  }

  var xInitial = event.clientX;
  var yInitial = event.clientY;

  function repositionMap(event) {
    var xFinal = event.clientX;
    var yFinal = event.clientY;
    grid.relativePan({
      x: xFinal - xInitial,
      y: yFinal - yInitial
    });
    xInitial = xFinal;
    yInitial = yFinal;
  }

  function endDrag(event) {
    window.removeEventListener("mousemove", repositionMap);
    window.removeEventListener("mouseup", endDrag);
  }

  window.addEventListener("mousemove", repositionMap);
  window.addEventListener("mouseup", endDrag);
}

exports.loadDatabase = function() {
  mapdb = new s.sqlite3.Database(':memory:', (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Map database loaded.');
  });

  mapdb.run("CREATE TABLE image (image_id INTEGER PRIMARY KEY NOT NULL UNIQUE, image_description TEXT, filepath TEXT NOT NULL)");
  mapdb.run("CREATE TABLE background (background_id INTEGER PRIMARY KEY NOT NULL UNIQUE, background_pos_x INTEGER NOT NULL, background_pos_y INTEGER NOT NULL, background_rotation INTEGER NOT NULL, image_id TEXT REFERENCES image (image_id) NOT NULL, background_scale_x DOUBLE NOT NULL DEFAULT (1), background_scale_y DOUBLE NOT NULL DEFAULT (1));");
  mapdb.run("CREATE TABLE landmark (landmark_id INTEGER PRIMARY KEY UNIQUE NOT NULL, landmark_name TEXT, landmark_description TEXT, landmark_pos_x INTEGER NOT NULL, landmark_pos_y INTEGER NOT NULL, image_id INTEGER REFERENCES image (image_id) NOT NULL, landmark_rotation DOUBLE NOT NULL DEFAULT (0), landmark_scale_x DOUBLE NOT NULL DEFAULT (1), landmark_scale_y DOUBLE NOT NULL DEFAULT (1));");
  mapdb.run("CREATE TABLE landmark_drawn (landmark_drawn_id INTEGER PRIMARY KEY UNIQUE NOT NULL, landmark_drawn_name TEXT, landmark_drawn_description TEXT, landmark_drawn_pos_x INTEGER NOT NULL, landmark_drawn_pos_y INTEGER NOT NULL, path_json TEXT NOT NULL, landmark_drawn_rotation DOUBLE NOT NULL DEFAULT (0), landmark_drawn_scale_x DOUBLE NOT NULL DEFAULT (1), landmark_drawn_scale_y DOUBLE NOT NULL DEFAULT (1));");
  mapdb.run("CREATE TABLE image_shows_landmark (image_id INTEGER REFERENCES image (image_id) NOT NULL, landmark_id INTEGER REFERENCES landmark (landmark_id) NOT NULL);");
  mapdb.run("CREATE TABLE image_shows_landmark_drawn (image_id INTEGER REFERENCES image (image_id) NOT NULL, landmark_drawn_id INTEGER REFERENCES landmark_drawn (landmark_drawn_id) NOT NULL);");
  mapdb.run("CREATE TABLE region (region_id INTEGER PRIMARY KEY NOT NULL UNIQUE, region_id_super INTEGER REFERENCES region (region_id), region_name TEXT, region_description TEXT);");
  mapdb.run("CREATE TABLE region_node (region_node_id INTEGER NOT NULL UNIQUE, region_node_pos_x INTEGER NOT NULL, region_node_pos_y INTEGER NOT NULL, PRIMARY KEY (region_node_id));");
  mapdb.run("CREATE TABLE region_edge (region_node_id_1 INTEGER REFERENCES region_node (region_node_id) NOT NULL, region_node_id_2 INTEGER REFERENCES region_node (region_node_id) NOT NULL, region_id INTEGER REFERENCES region (region_id));");
  mapdb.run("CREATE TABLE road (road_id INTEGER NOT NULL UNIQUE, road_name TEXT, road_description TEXT);");
  mapdb.run("CREATE TABLE road_node (road_node_id INTEGER NOT NULL UNIQUE, road_node_pos_x INTEGER NOT NULL, road_node_pos_y INTEGER NOT NULL, PRIMARY KEY (road_node_id));");
  mapdb.run("CREATE TABLE road_edge (road_node_id_1 INTEGER REFERENCES road_node (road_node_id) NOT NULL, road_node_id_2 INTEGER REFERENCES road_node (road_node_id) NOT NULL, road_id INTEGER REFERENCES road (road_id));");
  mapdb.run("CREATE TABLE text (text_id INTEGER PRIMARY KEY NOT NULL UNIQUE, text_pos_x INTEGER NOT NULL, text_pos_y INTEGER NOT NULL, text_rotation DOUBLE NOT NULL DEFAULT (0), content TEXT REFERENCES image (image_id) NOT NULL, text_scale_x DOUBLE NOT NULL DEFAULT (1), text_scale_y DOUBLE NOT NULL DEFAULT (1));");

  console.log('Tables created.');
}

exports.addImageToBank = function(selectedFiles) {
  var max_id;
  var new_id;
  var description = "No description.";

  console.log(selectedFiles);

  if (!selectedFiles || !selectedFiles[0]) {
    console.log("File is null.");
    return;
  }
  var reader = new FileReader();
  //reader.readAsDataURL(selectedFiles[0]);
  //var filepath = reader.result;
  var filepath = selectedFiles[0].path;
  filepath = filepath.replace(/\\/g, "/");

  mapdb.serialize(function() {
    mapdb.get("SELECT MAX(image_id) AS max FROM image", function(err, row) {
      max_id = row.max;
      console.log("max_id is " + max_id);

      if (!max_id) { // If there are no rows in the image table
        new_id = 1;
        document.getElementById("imagebank-text").innerHTML = "<br>"; // Remove the "No images to display." text in the imagebank.
      } else {
        new_id = max_id + 1;
      }

      mapdb.run("INSERT INTO image (filepath, image_description, image_id) VALUES (?, ?, ?)", [filepath, description, new_id], function(err) {
        if (err) {
          return console.log(err.message);
        } else {
          displayImageInBank(new_id);
          console.log("Image " + filepath + " added to database.");
        }
      });
    });
  });
}

function displayImageInBank(id) {
  var filepath;
  var selectStatement = "SELECT filepath FROM image WHERE image_id = " + id;
  mapdb.get(selectStatement, function(err, row) {
    filepath = row.filepath;
    var htmlToAdd = "<div class=\"imagebank-grid-item\" draggable=\"true\" ondragstart=\"renderer.dragFromBank(event, " + id + ")\" oncontextmenu=\"renderer.imagebankContextMenu(event, " + id + ")\"><img src=\"" + filepath + "\" width=\"150\" id=\"imagebank-" + id + "\" draggable=\"false\"></div>";
    var imagegrid = document.getElementById("imagebank-grid");
    imagegrid.innerHTML = imagegrid.innerHTML + htmlToAdd;
    console.log(htmlToAdd);
  });

}

exports.dragFromBank = function(e, id) {
  e.dataTransfer.setData("text", id);
}

exports.setActiveLayer = function(layer) {
  if (activeTool != "select") {
    document.getElementById("button_" + activeLayer + "_layer").disabled = false;
    document.getElementById("button_" + layer + "_layer").disabled = true;

    activeLayer = layer;
    return;
  }

  if (layer == activeLayer) {
    return;
  }

  setSelectableByTable(activeLayer);
  setUnselectableByTable(layer);
  if (layer == 'landmark') {
    setSelectableByTable('landmark_drawn');
  } else {
    setUnselectableByTable('landmark_drawn');
  }

  document.getElementById("button_" + activeLayer + "_layer").disabled = false;
  document.getElementById("button_" + layer + "_layer").disabled = true;

  activeLayer = layer;
  grid.discardActiveObject();
  grid.renderAll();

  console.log("Set active layer to " + activeLayer);
}

function getObjectLayer(obj) {
  var objType;
  if (obj.databaseTable) {
    objType = obj.databaseTable;
  } else {
    objType = obj.class;
  }
  return objType;
}

function moveToLayer(obj) {
  var layerToMoveTo;
  switch (getObjectLayer(obj)) {
    case 'backgroundTile':
      layerToMoveTo = 1;
      break;
    case 'gridline':
      layerToMoveTo = 3;
      break;
    case 'background':
      layerToMoveTo = 5;
      break;
    case 'region_edge':
      layerToMoveTo = 7;
      break;
    case 'region_node':
      layerToMoveTo = 9;
      break;
    case 'road_edge':
      layerToMoveTo = 11;
      break;
    case 'road_node':
      layerToMoveTo = 13;
      break;
    case 'landmark':
      layerToMoveTo = 15;
      break;
    case 'landmark_drawn':
      layerToMoveTo = 17;
      break;
    case 'text':
      layerToMoveTo = 19;
      break;
    default:
      layerToMoveTo = 0;
  }

  if (layerToMoveTo === -1) {
    console.log("Could not find layer.");
    return;
  }

  // Even though the code should send the tiled background objects below the grid, they're placed above the grid lines. This sends them directly to the bottom of the canvas stack.
  if (layerToMoveTo === 0) {
    grid.sendToBack(obj);
    return;
  }

  var layerIndex = grid.getObjects().indexOf(s.layerTemplateObjects[layerToMoveTo]);
  grid.moveTo(obj, layerIndex - 1);
}

function addToMap(obj) {
  grid.add(obj);
  moveToLayer(obj);
}

exports.addImageToMap = function(e) {
  e.preventDefault();
  if (activeTool != 'select') {
    exports.setActiveTool('select');
  }

  var new_id;
  var max_id;

  var data = e.dataTransfer.getData("text");
  console.log("Image ID is " + data);

  mapdb.serialize(function() {
    mapdb.get("SELECT MAX(" + activeLayer + "_id) AS max FROM " + activeLayer, function(err, row) {
      max_id = row.max;
      console.log("max_id is " + max_id);

      if (!max_id) { // If there are no rows in the background table
        new_id = 1;
      } else {
        new_id = max_id + 1;
      }

      mapdb.run("INSERT INTO " + activeLayer + " (" + activeLayer + "_id, " + activeLayer + "_pos_x, " + activeLayer + "_pos_y, " + activeLayer + "_rotation, image_id) VALUES (?, ?, ?, ?, ?)", [new_id, s.getRelativeCursorX(e), s.getRelativeCursorY(e), 0, data], function(err) {
        if (err) {
          return console.log(err.message);
        } else {
          displayImageInMap(new_id);
          console.log("Element " + new_id + " added to map in " + activeLayer + " layer at position (" + s.getRelativeCursorX(e) + ", " + s.getRelativeCursorY(e) + ").");
        }
      });
    });
  });
}

function displayImageInMap(id) {
  var selectStatement = "SELECT " + activeLayer + "_pos_x AS pos_x, " + activeLayer + "_pos_y AS pos_y, " + activeLayer + "_rotation AS rotation, image_id, " + activeLayer + "_scale_x AS scale_x, " + activeLayer + "_scale_y AS scale_y FROM " + activeLayer + " WHERE " + activeLayer + "_id = " + id;

  mapdb.get(selectStatement, function(err, row) {
    console.log("image_id is " + row.image_id);
    var imageSelectStatement = "SELECT filepath FROM image WHERE image_id = " + row.image_id;
    mapdb.get(imageSelectStatement, function(err, imageRow) {
      fabric.Image.fromURL(imageRow.filepath, function(img) {
        img.left = row.pos_x;
        img.top = row.pos_y;
        img.originX = 'center';
        img.originY = 'center';
        img.scaleX = row.scale_x;
        img.scaleY = row.scale_y;
        img.angle = row.rotation;
        img.databaseTable = activeLayer;
        img.databaseID = id;
        addToMap(img);
      });
    });
  });
}

exports.pressKey = function(e) {
  switch (e.keyCode) {
    case 27: // Esc
      grid.discardActiveObject();
      grid.renderAll();
      s.previousRoadNode = null;
      break;
    case 46: // Delete
      deleteSelectedElements();
      break;
    default:
  }
}

exports.allowDrop = function(e) {
  e.preventDefault();
}

exports.closeDatabase = function() {
  mapdb.close((err) => {
    if (err) {
      return console.log(err.message);
    }
    console.log('Database closed.');
  })
}

function zoomMap() {
  grid.on('mouse:wheel', function(opt) {
    var scrollDistance = -1 * opt.e.deltaY;
    var mapZoom = grid.getZoom();
    mapZoom = mapZoom + scrollDistance / 500;
    if (mapZoom > 5) {
      mapZoom = 5;
    }
    if (mapZoom < 0.3) {
      mapZoom = 0.3;
    }
    grid.zoomToPoint({
      x: opt.e.offsetX,
      y: opt.e.offsetY
    }, mapZoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
  });
}

function updateMapElement(opt) {
  for (let item of grid.getActiveObjects()) {
    if (!item.databaseTable) {
      console.log("Selected object is not in the database.");
      continue;
    }
    var data = [item.left, item.top, item.angle, item.scaleX, item.scaleY, item.databaseID];

    var sql = 'UPDATE ' + item.databaseTable + ' SET ' + item.databaseTable + '_pos_x = ?, ' + item.databaseTable + '_pos_y = ?, ' + item.databaseTable + '_rotation = ?, ' + item.databaseTable + '_scale_x = ?, ' + item.databaseTable + '_scale_y = ? ' +
      'WHERE ' + item.databaseTable + '_id = ?';
    var selectStatement = 'SELECT ' + item.databaseTable + '_pos_x AS pos_x, ' + item.databaseTable + '_pos_y AS pos_y, ' + item.databaseTable + '_rotation AS rotation, ' + item.databaseTable + '_scale_x AS scale_x, ' + item.databaseTable + '_scale_y AS scale_y FROM ' + item.databaseTable + ' WHERE ' + item.databaseTable + '_id = ' + item.databaseID;

    mapdb.serialize(() => {
      mapdb.run(sql, data, function(err) {
        if (err) {
          return console.log(err.message);
        }
        console.log('Row ' + item.databaseID + ' updated in table ' + item.databaseTable + '.');
      });

      mapdb.get(selectStatement, function(err, row) {
        if (err) {
          return console.log(err.message);
        }
        console.log('pos_x = ' + row.pos_x);
        console.log('pos_y = ' + row.pos_y);
        console.log('rotation = ' + row.rotation);
        console.log('scale_x = ' + row.scale_x);
        console.log('scale_y = ' + row.scale_y);
      });
    });
  }
}

function deleteSelectedElements() {
  if (!grid.getActiveObjects()) {
    return;
  }
  if (activeTool == 'road_draw') {
    for (let item of grid.getActiveObjects()) {
      tool_road_draw.deleteRoadNode(item);
      s.previousRoadNode = null;
    }
  } else {
    for (let item of grid.getActiveObjects()) {
      s.removeElementFromDatabase(item);
      grid.remove(item);
    }
  }
  grid.discardActiveObject();
  grid.renderAll();
}

exports.imagebankContextMenu = function(e, id) {
  e.preventDefault();
  var menu = new Menu();
  menu.append(new MenuItem({
    label: 'Set as background image',
    click() {
      console.log('Set background image with image ' + id + '.');
      openFormBackgroundImage(id);
    }
  }));
  menu.popup({
    window: s.remote.getCurrentWindow()
  });
}

function openFormBackgroundImage(id) {
  document.getElementById("form_background_tile").style.display = "block";

  document.getElementById("buttons_background_tiles").innerHTML = "<button onclick=\"renderer.setBackgroundImage(" + id + ")\">OK</button>" + "<button onclick=\"renderer.closeFormBackgroundImage()\">Cancel</button>";
}

exports.closeFormBackgroundImage = function() {
  document.getElementById("form_background_tile").style.display = "none";
  document.getElementById("buttons_background_tiles").innerHTML = "";

  document.getElementById("text_background_tiles_horizontal").value = "";
  document.getElementById("text_background_tiles_vertical").value = "";
}

exports.setBackgroundImage = function(id) {
  var horizontalTiles = document.getElementById("text_background_tiles_horizontal").value;
  var verticalTiles = document.getElementById("text_background_tiles_vertical").value;

  if (horizontalTiles == "" || verticalTiles == "") {
    return;
  }
  var tileX = s.mapWidth / parseInt(horizontalTiles);
  var tileY = s.mapHeight / parseInt(verticalTiles);
  var imageSelectStatement = "SELECT filepath FROM image WHERE image_id = " + id;

  exports.removeBackgroundImage();

  mapdb.get(imageSelectStatement, function(err, row) {

    var i, j;
    for (i = 0; i < s.mapWidth; i += tileX) {
      for (j = 0; j < s.mapHeight; j += tileY) {
        fabric.Image.fromURL(row.filepath, function(img) {
          img.scaleX = tileX / img.width;
          img.scaleY = tileY / img.height;
          console.log(img.class);
          addToMap(img);
        }, {
          left: i,
          top: j,
          selectable: false,
          hoverCursor: "default",
          class: "backgroundTile"
        });

      }
    }
  });

  exports.closeFormBackgroundImage();
}

exports.removeBackgroundImage = function() {
  grid.forEachObject(function(obj) {
    if (obj.class == "backgroundTile") {
      grid.remove(obj);
    }
  });
}

exports.toggleHideGrid = function() {
  grid.forEachObject(function(obj) {
    if (obj.class == "gridline") {
      obj.opacity = !obj.opacity;
    }
  });
  grid.renderAll();
}

exports.setActiveTool = function(tool) {
  grid.discardActiveObject();
  grid.renderAll();

  document.getElementById("button_" + activeTool).disabled = false;
  document.getElementById("button_" + tool).disabled = true;
  deactivateActiveTool();
  activeTool = tool;

  switch (tool) {
    case "select":
      grid.on('object:modified', updateMapElement);
      setSelectableByTable(activeLayer);
      setSelectableByTable('text');
      if (activeLayer == 'landmark') {
        setSelectableByTable('landmark_drawn');
      } else {
        setUnselectableByTable('landmark_drawn');
      }
      grid.on('mouse:dblclick', openFormLandmarkInformation);
      break;
    case "landmark_draw":
      grid.isDrawingMode = true;
      grid.on('path:created', tool_landmark_draw.addDrawnLandmark);
      break;
    case "road_draw":
      grid.on('mouse:down', tool_road_draw.placeRoadNode);
      grid.on('object:modified', tool_road_draw.updateRoadNode);
      setSelectableByTable('road_node');
      break;
    case "smart_road_draw":
      break;
    case "region_draw":
      break;
    case "text":
      setSelectableByTable('text');
      grid.off('text:editing:entered');
      grid.on('mouse:down', tool_text.addTextToMap);
      grid.on('object:modified', tool_text.addOrUpdateText);
      grid.on('text:editing:exited', tool_text.cleanUpEmptyITexts);
      break;
    default:
  }
}

function deactivateActiveTool() {
  grid.off('mouse:down');
  grid.off('object:modified');
  switch (activeTool) {
    case "select":
      setUnselectableByTable(activeLayer);
      setUnselectableByTable('text');
      setUnselectableByTable('landmark_drawn');
      grid.off('mouse:dblclick');
      break;
    case "landmark_draw":
      grid.off('path:created');
      grid.isDrawingMode = false;
      break;
    case "road_draw":
      s.previousRoadNode = null;
      setUnselectableByTable('road_node');
      break;
    case "smart_road_draw":
      break;
    case "region_draw":
      break;
    case "text":
      setUnselectableByTable('text');
      grid.on('text:editing:entered', function(e) {
        exports.setActiveTool('text');
        grid.setActiveObject(e.target);
        e.target.enterEditing();
        e.target.hiddenTextarea.focus();
      });
      break;
    default:
  }
}

function setUnselectableByTable(table) {
  grid.forEachObject(function(obj) {
    if (obj.databaseTable == table) {
      obj.selectable = false;
      obj.hoverCursor = "default";
    }
  });
}

function setSelectableByTable(table) {
  grid.forEachObject(function(obj) {
    if (obj.databaseTable == table) {
      obj.selectable = true;
      obj.hoverCursor = "move";
    }
  });
}

// Landmark Information Storage

function openFormLandmarkInformation(e) {
  var landmark = grid.getActiveObjects()[0];

  if (!landmark) {
    return;
  }

  if (landmark.databaseTable != 'landmark' && landmark.databaseTable != 'landmark_drawn') {
    return;
  }
  grid.setActiveObject(landmark);
  grid.renderAll();

  document.getElementById("form_landmark").style.display = "block";

  document.getElementById("buttons_landmark").innerHTML = "<button onclick=\"renderer.storeLandmarkInformation(\'" + landmark.databaseID + "\', \'" + landmark.databaseTable + "\')\">OK</button>" + "<button onclick=\"renderer.closeFormLandmarkInformation()\">Cancel</button>";
  document.getElementById("form_landmark_images").setAttribute("data-databaseID", landmark.databaseID);
  document.getElementById("form_landmark_images").setAttribute("data-databaseTable", landmark.databaseTable);

  loadLandmarkInformation(landmark.databaseID, landmark.databaseTable);
  loadLandmarkImages(landmark.databaseID, landmark.databaseTable);
}

exports.addImageToLandmark = function(e) {
  e.preventDefault();
  var new_id;
  var max_id;

  var landmarkimagegrid = document.getElementById("form_landmark_images");
  var landmarkID = landmarkimagegrid.getAttribute("data-databaseID");
  var landmarkTable = landmarkimagegrid.getAttribute("data-databaseTable");
  var data = e.dataTransfer.getData("text");

  console.log("Image ID is " + data);

  mapdb.serialize(function() {
    var insertStatement = "INSERT INTO image_shows_" + landmarkTable + " (image_id, " + landmarkTable + "_id) VALUES (?, ?)";
    mapdb.run(insertStatement, [data, landmarkID], function(err) {
      if (err) {
        return console.log(err.message);
      } else {
        displayImageInLandmarkImages(data);
        console.log("Image " + data + " added to landmark.");
      }
    });
  });
}

function displayImageInLandmarkImages(id) {
  var filepath;
  var selectStatement = "SELECT filepath FROM image WHERE image_id = " + id;
  mapdb.get(selectStatement, function(err, row) {
    filepath = row.filepath;
    var htmlToAdd = "<img src=\"" + filepath + "\" class=\"form_landmark_images_item\">";
    var landmarkimagegrid = document.getElementById("form_landmark_images");
    landmarkimagegrid.innerHTML = landmarkimagegrid.innerHTML + htmlToAdd;
    console.log(htmlToAdd);
  });
}

function loadLandmarkInformation(id, table) {
  var selectStatement = "SELECT " + table + "_name AS name, " + table + "_description AS description FROM " + table + " WHERE " + table + "_id = " + id;
  mapdb.get(selectStatement, function(err, row) {
    if (err) {
      return console.log(err.message);
    } else {
      document.getElementById("text_landmark_name").value = row.name;
      document.getElementById("text_area_landmark_description").value = row.description;
    }
  });
}

function loadLandmarkImages(id, table) {
  var selectStatement = "SELECT image_id FROM image_shows_" + table + " WHERE " + table + "_id = " + id;
  mapdb.each(selectStatement, function(err, row) {
    if (err) {
      return console.log(err.message);
    } else {
      displayImageInLandmarkImages(row.image_id);
    }
  });
}

exports.storeLandmarkInformation = function(id, table) {
  var sql = 'UPDATE ' + table + ' SET ' + table + '_name = ?, ' + table + '_description = ? WHERE ' + table + '_id = ?';
  var data = [document.getElementById("text_landmark_name").value, document.getElementById("text_area_landmark_description").value, id];
  var selectStatement = "SELECT " + table + "_name AS name, " + table + "_description AS description FROM " + table + " WHERE " + table + "_id = " + id;
  mapdb.serialize(function() {
    mapdb.run(sql, data, function(err) {
      if (err) {
        return console.log(err.message);
      }
      console.log('Row ' + id + ' updated in table ' + table + '.');
    });

    mapdb.get(selectStatement, function(err, row) {
      if (err) {
        return console.log(err.message);
      } else {
        console.log(table + "_name = " + row.name);
        console.log(table + "_description = " + row.description);
      }
    });
  });

  exports.closeFormLandmarkInformation();
}

exports.closeFormLandmarkInformation = function() {
  document.getElementById("form_landmark").style.display = "none";
  document.getElementById("buttons_landmark").innerHTML = "";
  document.getElementById("form_landmark_images").innerHTML = "";
  document.getElementById("form_landmark_images").setAttribute("data-databaseID", "");
  document.getElementById("form_landmark_images").setAttribute("data-databaseTable", "");

  document.getElementById("text_landmark_name").value = "";
  document.getElementById("text_area_landmark_description").value = "";
}