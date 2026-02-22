// Author : R. Gimenez
// Goal: The purpose is to visualize ERA5 

// ----------------------------------------------------------------------------------------
// Loading vector and raster data ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// Load the regional bounds of interest (only for loading).
var setExtent = Map.getBounds(true);
Map.clear()
Map.add(ui.Button('Reset', function () {
  Map.clear()
  var widgs = ui.root.widgets();
  widgs.forEach(function(widg){
    if (widg instanceof ui.Panel){
      ui.root.remove(widg);
    }
  });
  require('users/GimenezRollin/SITSExplorer:Launcher');
}));

// ----------------------------------------------------------------------------------------
// DEM                          ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// add SRTM DEM -------------
var SRTM_DEM = ee.Image("CGIAR/SRTM90_V4").clip(setExtent).select('elevation');

// ----------------------------------------------------------------------------------------
// Visualize
// ----------------------------------------------------------------------------------------
// Calculer les statistiques locales du DEM
var minMax = SRTM_DEM.reduceRegion({reducer: ee.Reducer.minMax(), 
                               geometry: setExtent, 
                               scale: SRTM_DEM.projection().nominalScale(),
                               bestEffort: true,
                               maxPixels: 1e9})
                               
// Rename keys
var minMax = minMax.rename(minMax.keys(), ['max','min']);  

// Retrieve dictionary values and pass to visParam settings
minMax.evaluate(function(val){
  var min = val.min;
  var max = val.max;
  var visParam = {
        min: min,
        max: max,
        palette: ['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff']
        };
// Définir la palette en fonction des valeurs minimales et maximales locales
//var palette_DEM =  ['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff'];

Map.addLayer(SRTM_DEM, visParam, "SRTM DEM");

// -----------------------------------------------------------------
// Color bar -------------------------------------------------------
// -----------------------------------------------------------------

function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '100x10',
    format: 'png',
    min: 0,
    max: 1,
    palette: visParam.palette,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(visParam.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(visParam.min, {margin: '4px 8px'}), // vis min
    ui.Label(((visParam.max-visParam.min) / 2+visParam.min), {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}), // (vis min + vis max)/2
    ui.Label(visParam.max, {margin: '4px 8px'}) //vis max
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
  value: 'Elevation (m)',
  style: {fontWeight: 'bold', textAlign:'center', stretch: 'horizontal'}
});

// Add the legendPanel to the map.
var legendPanel = ui.Panel({
  widgets: [legendTitle, colorBar, legendLabels],
  style: {position: 'bottom-right'}
});
Map.add(legendPanel);
})
//Map.addLayer(SRTM_DEM, { min: localMin, max: 5, palette: palette_DEM}, 'SRTM DEM');

// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'DEM Inspector',
    style: { fontSize: '20px', fontWeight: 'bold' }
  }),
  ui.Label('Select a point or draw a polygon (mean charts) on the map to inspect.')
]);
panel.add(intro);

// Créer les widgets lon et lat
var lon = ui.Label('');
var lat = ui.Label('');

// Créer un panneau horizontal pour lon et lat
var coordPanel = ui.Panel({
  widgets: [lon, lat],
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {stretch: 'horizontal'}
});

// Appliquer les styles pour centrer les widgets
lon.style().set('margin', '10px auto');
lat.style().set('margin', '10px auto');

// Ajouter le panneau coordPanel à l'interface utilisateur
panel.add(coordPanel);


// Créer un panneau horizontal pour valeurs
// Créer les widgets lon et lat
var SRTM_DEM_v = ui.Label('');
var valPanel = ui.Panel({
  widgets: [SRTM_DEM_v],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {stretch: 'horizontal'}
});

var drawnGeometry = null;

// Create a drawing tools control panel
var drawingTools = Map.drawingTools();
drawingTools.setShown(false);
drawingTools.setDrawModes(['polygon']);
// Créer un panneau vertical pour le titre
var titlePanel = ui.Panel([
  ui.Label({
    value: 'Drawing Tools:',
    style: { fontSize: '15px', fontWeight: 'bold' }
  })
]);

// Créer un panneau horizontal pour les boutons
var buttonPanel = ui.Panel([
  ui.Button({
    label: 'Draw Polygon',
    onClick: function () {
      drawingTools.setShape('polygon');
      drawingTools.draw();
    }
  }),
  ui.Button({
    label: 'Clear',
    onClick: function () {
      drawingTools.layers().forEach(function (layer) {
        drawingTools.layers().remove(layer);
      drawnGeometry = null;
      });
    }
  }),
  ui.Button({
    label: 'Export',
    onClick: function() {
      if (drawnGeometry) {
        var geoJson = JSON.stringify(drawnGeometry.toGeoJSON());
        var url = 'data:application/json;charset=utf-8,' + encodeURIComponent(geoJson);
        var link = ui.Label({
          value: 'Download geometry',
          style: {color: 'blue', textDecoration: 'underline'},
          targetUrl: url
        });
        Map.add(link);
      } else {
        ui.alert('Please, draw a geometry.');
      }
    }
  })
], ui.Panel.Layout.flow('horizontal'));
buttonPanel.style().set('margin', '5px auto');

// Créer un panneau principal pour contenir les deux panneaux
var drawingControlPanel = ui.Panel([
  titlePanel,
  buttonPanel
], ui.Panel.Layout.flow('vertical'));

// Ajouter le panneau principal à l'interface utilisateur
panel.add(drawingControlPanel);

panel.add(valPanel);

function updateValue(image, geometry) {
  // Calculer la moyenne de la bande 'EVI' dans la région définie par geometry
  var meanDict = image.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
  });
}
// Register a callback on the drawing tools to be invoked when a polygon is completed
function updateValue(image, geometry, callback) {
  var meanDict = image.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  });

  // Utiliser evaluate pour gérer l'opération asynchrone
  meanDict.evaluate(function(result) {
    var meanValue = result ? result.elevation : 'N/A';
    callback(meanValue);
  });
}

// Callback pour les outils de dessin
drawingTools.onDraw(function(geometry) {
  drawnGeometry = geometry;
  // Calculer le centroïde du polygone dessiné et mettre à jour les valeurs lon/lat
  var centroid = geometry.centroid();
  var lonLat = centroid.coordinates().getInfo();
  var lonVal = lonLat[0].toFixed(2);
  var latVal = lonLat[1].toFixed(2);

  // Mettre à jour les valeurs des panneaux de texte
  lon.setValue('lon: ' + lonVal);
  lat.setValue('lat: ' + latVal);

  updateValue(SRTM_DEM, geometry, function(meanValue) {
    SRTM_DEM_v.setValue('DEM (SRTM): ' + meanValue);
  });
});

// Callback pour les clics sur la carte
Map.onClick(function(coords) {
  // Mettre à jour les valeurs lon/lat du panneau de texte
  lon.setValue('lon: ' + coords.lon.toFixed(2));
  lat.setValue('lat: ' + coords.lat.toFixed(2));
  
  var point = ee.Geometry.Point([coords.lon, coords.lat]);
  
  updateValue(SRTM_DEM, point, function(meanValue) {
    SRTM_DEM_v.setValue('DEM (SRTM): ' + meanValue);
  });
});
Map.style().set('cursor', 'crosshair');

// Create author information
var author = ui.Panel([
  ui.Label({
    value: 'Authors : Rollin Gimenez - Teodolina Lopez | please write to gimenez.rollin@gmail.com or teodolina.lopez@cerema.fr for suggestions.',
    style: { fontSize: '9px'}
  }),
]);
author.style().set('margin', '5% auto');

// Ajouter le contenu principal au panneau datePanel
panel.add(author);

// Add the panel to the ui.root.
ui.root.insert(0, panel);




