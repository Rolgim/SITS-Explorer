// Author : R. Gimenez
// Goal: The purpose is to create RGB time series plots for
// dynamically defined points, and to visualize corresponding images

// ----------------------------------------------------------------------------------------
// Loading vector and raster data ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// Load the regional bounds of interest (only for loading).
var setExtent = Map.getBounds(true);
Map.clear()
Map.add(ui.Button('Reset', function () {
  Map.clear()
  var geometry = null;
  var widgs = ui.root.widgets();
  widgs.forEach(function(widg){
    if (widg instanceof ui.Panel){
      ui.root.remove(widg);
    }
  });
  require('users/GimenezRollin/SITSExplorer:Launcher');
}));
//widgs.forEach(function(widg){
//  print(widg)
//  if (widg instanceof ui.Panel){
//    print(widg); //ui.root.remove(widg);
//    }
//  });
  
// ----------------------------------------------------------------------------------------
// MODIS                          ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// add satellite time series: MODIS Refl 500m 8 day -------------
var collectionModTerra = ee.ImageCollection("MODIS/061/MOD09A1")
    .filterDate('2000-02-18','2024-05-08')
    .filterBounds(setExtent);
    
var collectionModAqua = ee.ImageCollection("MODIS/061/MYD09A1")
    .filterDate('2002-07-04','2024-04-30')
    .filterBounds(setExtent);

// Fonction pour diviser les valeurs par 10000
var scale = function(image) {
  return image.divide(10000).copyProperties(image, image.propertyNames());
};

// Appliquer la fonction à la collection d'images
var collectionModTerra = collectionModTerra.map(scale);
var collectionModAqua = collectionModAqua.map(scale);

var MODISvisualization = {
  min: 0.0,
  max: 0.3,
  bands: ['sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03'],
};


// ----------------------------------------------------------------------------------------
// Sentinel-2                      --------------------------------------------------------
// ----------------------------------------------------------------------------------------

// Sentinel 2  ----------------------------------------------------
var collectionS2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterDate("2017-03-28", "2024-05-29")
    .filterBounds(setExtent);

// fonction basé SCL - voir autres méthodes ici : https://gis.stackexchange.com/questions/445556/different-methods-for-masking-clouds-of-sentinel-2-images-in-gee
function s2ClearSky(image) {
      var scl = image.select('SCL');
      var clear_sky_pixels = scl.eq(4).or(scl.eq(5)).or(scl.eq(6)).or(scl.eq(11));
      return image.updateMask(clear_sky_pixels).divide(10000).copyProperties(image, ["system:time_start"]);
}

collectionS2 = collectionS2.map(s2ClearSky);

var S2visualization = {
  min: 0.0,
  max: 0.3,
  bands: ['B4', 'B3', 'B2'],
};

// ----------------------------------------------------------------------------------------
// Landsat                        ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// Landsat 5/7/8/9  ----------------------------------------------------

var collectionL5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
    .filterDate("1984-03-16", "2012-05-05")
    .filterBounds(setExtent);

var collectionL7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
    .filterDate("1999-05-28", "2024-01-19")
    .filterBounds(setExtent);

var collectionL8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterDate("2013-03-18", "2024-05-17")
    .filterBounds(setExtent);

var collectionL9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    .filterDate("2021-10-31", "2024-05-17")
    .filterBounds(setExtent);
    
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

// Function to mask clouds using the QA_PIXEL band
function maskClouds(image) {
  // Get the QA_PIXEL band
  var qa = image.select('QA_PIXEL');
  // Select the bits for clouds and cloud shadows
  var cloudShadowBitMask = ee.Number(2).pow(3).int();
  var cloudsBitMask = ee.Number(2).pow(5).int();
  // Create a mask that identifies cloud and shadow pixels as zero
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
               .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  // Return the masked image, scaled to top-of-atmosphere reflectance
  return image.updateMask(mask);
}

// Applies scaling factors.
collectionL5 = collectionL5.map(applyScaleFactors).map(maskClouds);
collectionL7 = collectionL7.map(applyScaleFactors).map(maskClouds);
collectionL8 = collectionL8.map(applyScaleFactors).map(maskClouds);
collectionL9 = collectionL9.map(applyScaleFactors).map(maskClouds);


var L57visualization = {
  bands: ['SR_B3', 'SR_B2', 'SR_B1'],
  min: 0.0,
  max: 0.3,
};

var L89visualization = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.3,
};


// ----------------------------------------------------------------------------------------
// Visualize
// ----------------------------------------------------------------------------------------

// Landsat 5 
Map.addLayer(collectionL5.filterDate("2005-06-10").filterBounds(setExtent),
L57visualization, 'Landsat-5 RGB');

// MODIS Terra --------------------------------------------------------------------------------------
Map.addLayer(collectionModTerra.filterDate("2005-06-10").filterBounds(setExtent),
MODISvisualization, 'MODIS-Terra RGB');

// MODIS Aqua --------------------------------------------------------------------------------------
Map.addLayer(collectionModAqua.filterDate("2005-06-10").filterBounds(setExtent),
MODISvisualization, 'MODIS-Aqua RGB');

// Landsat - autres  --------------------------------------------------------------------------------------

Map.addLayer(collectionL7.filterDate("2005-06-10").filterBounds(setExtent),
L57visualization, 'Landsat-7 RGB');

Map.addLayer(collectionL8.filterDate("2005-06-10").filterBounds(setExtent),
L89visualization, 'Landsat-8 RGB');

Map.addLayer(collectionS2.filterDate("2005-06-10").filterBounds(setExtent),
S2visualization, 'Sentinel-2 RGB');

Map.addLayer(collectionL9.filterDate("2005-06-10").filterBounds(setExtent),
L89visualization, 'Landsat-9 RGB');

// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'RGB chart Inspector',
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

// Function to update charts based on selected region
function updateCharts(geometry) {
  
  var L5RGBChart = ui.Chart.image.series(collectionL5.select('SR_B3', 'SR_B2', 'SR_B1'), geometry, ee.Reducer.mean(), 30);
  L5RGBChart.setOptions({
    title: 'Landsat-5',
    vAxis: { title: 'RGB', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'blue'},
    1: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'green'},
    2: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'red'}}
  });
  panel.widgets().set(3, L5RGBChart);

  // Create an MODIS RGB chart.
  var MODISTerraRGBChart = ui.Chart.image.series(collectionModTerra.select('sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03'), geometry, ee.Reducer.mean(), 250);
  MODISTerraRGBChart.setOptions({
    title: 'MODIS-Terra',
    vAxis: { title: 'RGB', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'blue'},
    1: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'green'},
    2: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'red'}}
  });
  panel.widgets().set(4, MODISTerraRGBChart);
  
  var MODISAquaRGBChart = ui.Chart.image.series(collectionModAqua.select('sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03'), geometry, ee.Reducer.mean(), 250);
  MODISAquaRGBChart.setOptions({
    title: 'MODIS-Aqua',
    vAxis: { title: 'RGB', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'blue'},
    1: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'green'},
    2: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'red'}}
  });
  panel.widgets().set(5, MODISAquaRGBChart);

  var L7RGBChart = ui.Chart.image.series(collectionL7.select('SR_B3', 'SR_B2', 'SR_B1'), geometry, ee.Reducer.mean(), 30);
  L7RGBChart.setOptions({
    title: 'Landsat-7',
    vAxis: { title: 'RGB', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'blue'},
    1: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'green'},
    2: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'red'}}
  });
  panel.widgets().set(6, L7RGBChart);

  var L8RGBChart = ui.Chart.image.series(collectionL8.select('SR_B4', 'SR_B3', 'SR_B2'), geometry, ee.Reducer.mean(), 30);
  L8RGBChart.setOptions({
    title: 'Landsat-8',
    vAxis: { title: 'RGB', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'blue'},
    1: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'green'},
    2: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'red'}}
  });
  panel.widgets().set(7, L8RGBChart);
  
  var S2RGBChart = ui.Chart.image.series(collectionS2.select('B4', 'B3', 'B2'), geometry, ee.Reducer.mean(), 10);
  S2RGBChart.setOptions({
    title: 'Sentinel-2',
    vAxis: { title: 'RGB', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'blue'},
    1: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'green'},
    2: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'red'}}
  });
  panel.widgets().set(8, S2RGBChart);
  
  var L9RGBChart = ui.Chart.image.series(collectionL9.select('SR_B4', 'SR_B3', 'SR_B2'), geometry, ee.Reducer.mean(), 30);
  L9RGBChart.setOptions({
    title: 'Landsat-9',
    vAxis: { title: 'RGB', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'blue'},
    1: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'green'},
    2: {pointSize: 2, pointShape: 'circle', lineWidth: 1, color: 'red'}}
  });
  panel.widgets().set(9, L9RGBChart);
}

// Register a callback on the drawing tools to be invoked when a polygon is completed
drawingTools.onDraw(function (geometry) {
  drawnGeometry = geometry;
  updateCharts(geometry);
  
  // Calculate centroid of the drawn polygon and update lon/lat values
  var centroid = geometry.centroid();
  var lonLat = centroid.coordinates().reverse();
  var lonVal = lonLat.get(0).getInfo().toFixed(2);
  var latVal = lonLat.get(1).getInfo().toFixed(2);
  lon.setValue('lon: ' +  lonVal);
  lat.setValue('lat: ' + latVal);
});

// Register a callback on the map to be invoked when the map is clicked
Map.onClick(function (coords) {
  // Update the lon/lat panel with values from the click event.
  lon.setValue('lon: ' + coords.lon.toFixed(2));
  lat.setValue('lat: ' + coords.lat.toFixed(2));
  var point = ee.Geometry.Point([coords.lon, coords.lat]);
  
  updateCharts(point);
});

Map.style().set('cursor', 'crosshair');

// Add the panel to the ui.root.
ui.root.insert(0, panel);

// ----------------------------------------------------------------------------------------
// Create Date Slider
// ----------------------------------------------------------------------------------------

var datePanel = ui.Panel();
datePanel.style().set('width', '200px');

// Ajouter une étiquette au panneau de date
var dateLabel = ui.Label({
  value: 'Select displayed date:',
  style: { fontSize: '15px', fontWeight: 'bold' }
});

datePanel.add(dateLabel);

var initialDate = ee.Date('2005-06-10');

// Select images from a collection with a silder.
var dateSlider = ui.DateSlider({
  start: '1984-03-16',
  end: '2024-05-29',
  value: initialDate,
  period: 1,
  onChange: function(dateRange) {
    var selectedDate = ee.Date(dateRange.start());
  
    // Boucle à travers les couches et suppression des couches
    while (Map.layers().length() > 0) {
        Map.layers().remove(Map.layers().get(0));
    }
    
    Map.addLayer(collectionL5.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    L57visualization, 'Landsat-5 RGB');
    
    Map.addLayer(collectionModTerra.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    MODISvisualization, 'MODIS-Terra RGB');
    
    Map.addLayer(collectionModAqua.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    MODISvisualization, 'MODIS-Aqua RGB');
    
    Map.addLayer(collectionL7.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    L57visualization, 'Landsat-7 RGB');
    
    Map.addLayer(collectionL8.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    L89visualization, 'Landsat-8 RGB');
    
    Map.addLayer(collectionS2.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    S2visualization, 'Sentinel-2 RGB');
    
    Map.addLayer(collectionL9.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    L89visualization, 'Landsat-9 RGB');

  },
  style: { width: '180px' }
});
datePanel.add(dateSlider);

// Create author information
var author = ui.Panel([
  ui.Label({
    value: 'Authors : Rollin Gimenez - Teodolina Lopez | please write to gimenez.rollin@gmail.com or teodolina.lopez@cerema.fr for suggestions.',
    style: { fontSize: '9px'}
  }),
]);
author.style().set('margin', '5% auto');

// Ajouter le contenu principal au panneau datePanel
datePanel.add(author);

// Ajouter le panneau de date à l'interface utilisateur
ui.root.insert(10, datePanel);


