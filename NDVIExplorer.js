// Author : R. Gimenez
// Goal: The purpose is to create NDVI time series plots for
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

// add satellite time series: MODIS NDVI 250m 16 day -------------
var collectionModNDVI = ee.ImageCollection('MODIS/006/MOD13Q1')
    .filterDate('2000-02-18','2024-05-08')
    .filterBounds(setExtent)
    .select("NDVI", "SummaryQA");
    
var collectionModAquaNDVI = ee.ImageCollection("MODIS/061/MYD13Q1")
    .filterDate('2002-07-04','2024-04-30')
    .filterBounds(setExtent)
    .select("NDVI", "SummaryQA");

// Fonction pour diviser les valeurs par 10000
var scale = function(image) {
  return image.divide(10000).copyProperties(image, image.propertyNames());
};

// Function to mask pixels with QA value less than 3 (cloudy pixels) on bits 0-1
function maskLowQuality(image) {
  var qa = image.select('SummaryQA');
  var qualityBits = ee.Number(3).int(); // This is binary '11', which is 3 in decimal
  var mask = qa.bitwiseAnd(qualityBits).lt(3);
  return image.updateMask(mask);
}

// Appliquer la fonction à la collection d'images
var scaledCollectionModNDVI = collectionModNDVI.map(maskLowQuality).map(scale).select('NDVI');
var scaledCollectionModAquaNDVI = collectionModAquaNDVI.map(maskLowQuality).map(scale).select('NDVI');

var MODISmerged = scaledCollectionModNDVI.select(['NDVI'],['MODIS-Terra']).merge(scaledCollectionModAquaNDVI.select(['NDVI'],['MODIS-Aqua']));

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

// Function to calculate NDVI
function S2calculateNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi)
}

var S2ndviCollection = collectionS2.map(S2calculateNDVI);

var S2MODISmerged = MODISmerged.merge(S2ndviCollection.select(['NDVI'],['Sentinel-2']));

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

// NDVI
// In Landsat 4-7, NDVI = (Band 4 – Band 3) / (Band 4 + Band 3).
// In Landsat 8-9, NDVI = (Band 5 – Band 4) / (Band 5 + Band 4).

// Function to calculate NDVI
function L57calculateNDVI(image) {
  var ndvi = image.normalizedDifference(['SR_B4', 'SR_B3']).rename('NDVI');
  return image.addBands(ndvi)
}
function L89calculateNDVI(image) {
  var ndvi = image.normalizedDifference(['SR_B5', 'SR_B3']).rename('NDVI');
  return image.addBands(ndvi)
}

// Calculate NDVI for each image in the collection
var L5ndviCollection = collectionL5.map(L57calculateNDVI);
var L7ndviCollection = collectionL7.map(L57calculateNDVI);
var L8ndviCollection = collectionL8.map(L89calculateNDVI);
var L9ndviCollection = collectionL9.map(L89calculateNDVI);

var AllMerged = S2MODISmerged.merge(L5ndviCollection.select(['NDVI'],['Landsat-5']))
  .merge(L7ndviCollection.select(['NDVI'],['Landsat-7']))
  .merge(L8ndviCollection.select(['NDVI'],['Landsat-8']))
  .merge(L9ndviCollection.select(['NDVI'],['Landsat-9']));
// ----------------------------------------------------------------------------------------
// Visualize
// ----------------------------------------------------------------------------------------

var paletteNDVI = [
  'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
  '74A901', '66A000', '529400', '3E8601', '207401', '056201',
  '004C00', '023B01', '012E01', '011D01', '011301'];

//Map.centerObject(setExtent);

// Landsat 5 
Map.addLayer(L5ndviCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDVI'),
{min:0, max: 1, palette: paletteNDVI}, 'Landsat-5 NDVI');

// MODIS Terra --------------------------------------------------------------------------------------
Map.addLayer(collectionModNDVI.filterDate("2005-06-10").filterBounds(setExtent).select('NDVI'),
{min:0, max: 10000, palette: paletteNDVI}, 'MODIS-Terra NDVI');

// MODIS Aqua --------------------------------------------------------------------------------------
Map.addLayer(collectionModAquaNDVI.filterDate("2005-06-10").filterBounds(setExtent).select('NDVI'),
{min:0, max: 10000, palette: paletteNDVI}, 'MODIS-Aqua NDVI');

// Landsat - autres  --------------------------------------------------------------------------------------

Map.addLayer(L7ndviCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDVI'),
{min:0, max: 1, palette: paletteNDVI}, 'Landsat-7 NDVI');

Map.addLayer(L8ndviCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDVI'),
{min:0, max: 1, palette: paletteNDVI}, 'Landsat-8 NDVI');

Map.addLayer(S2ndviCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDVI'),
{min:0, max: 1, palette: paletteNDVI}, 'Sentinel-2 NDVI');

Map.addLayer(L9ndviCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDVI'),
{min:0, max: 1, palette: paletteNDVI}, 'Landsat-9 NDVI');

// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'NDVI chart Inspector',
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

// ----------------------------------------------------------
// Panel drawing Tools ---------------------------------------
// ----------------------------------------------------------

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
  
  var L5ndviChart = ui.Chart.image.series(L5ndviCollection.select('NDVI'), geometry, ee.Reducer.mean(), 30);
  L5ndviChart.setOptions({
    title: 'Landsat-5',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(3, L5ndviChart);

  // Create an MODIS NDVI chart.
  var MODISndviChart = ui.Chart.image.series(scaledCollectionModNDVI, geometry, ee.Reducer.mean(), 250);
  MODISndviChart.setOptions({
    title: 'MODIS-Terra',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(4, MODISndviChart);
  
  var MODISAquandviChart = ui.Chart.image.series(scaledCollectionModAquaNDVI, geometry, ee.Reducer.mean(), 250);
  MODISAquandviChart.setOptions({
    title: 'MODIS-Aqua',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(5, MODISAquandviChart);

  var L7ndviChart = ui.Chart.image.series(L7ndviCollection.select('NDVI'), geometry, ee.Reducer.mean(), 30);
  L7ndviChart.setOptions({
    title: 'Landsat-7',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(6, L7ndviChart);

  var L8ndviChart = ui.Chart.image.series(L8ndviCollection.select('NDVI'), geometry, ee.Reducer.mean(), 30);
  L8ndviChart.setOptions({
    title: 'Landsat-8',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(7, L8ndviChart);
  
  var S2ndviChart = ui.Chart.image.series(S2ndviCollection.select('NDVI'), geometry, ee.Reducer.mean(), 10);
  S2ndviChart.setOptions({
    title: 'Sentinel-2',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(8, S2ndviChart);
  
  var L9ndviChart = ui.Chart.image.series(L9ndviCollection.select('NDVI'), geometry, ee.Reducer.mean(), 30);
  L9ndviChart.setOptions({
    title: 'Landsat-9',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(9, L9ndviChart);
  
  var Merged = ui.Chart.image.series(AllMerged, geometry, ee.Reducer.mean(), 250);
  Merged.setOptions({
    title: 'All',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 3, pointShape: 'diamond', lineWidth: 1, color: 'green'},
    1: {pointSize: 3, pointShape: 'circle', lineWidth: 1, color: 'green'},
    2: {pointSize: 3, pointShape: 'triangle', lineWidth: 1, color: 'green'},
    3: {pointSize: 3, pointShape: 'square', lineWidth: 1, color: 'green'},
    4: {pointSize: 3, pointShape: 'star', lineWidth: 1, color: 'green'},
    5: {pointSize: 3, pointShape: 'polygon', lineWidth: 1, color: 'green'},
    6: {pointSize: 3, pointShape:{ type: 'star', sides: 4, dent: 0.5 }, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(10, Merged);
}

//  --------------------------------------------------------------------------
// Fonctions associées au dessin ---------------------------------------------
//  --------------------------------------------------------------------------

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
    
    Map.addLayer(L5ndviCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDVI'),
    {min:0, max: 1, palette: paletteNDVI}, 'Landsat-5 NDVI');
    
    Map.addLayer(collectionModNDVI.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDVI'),
    {min:0, max: 10000, palette: paletteNDVI}, 'MODIS-Terra NDVI');
    
    Map.addLayer(collectionModAquaNDVI.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDVI'),
    {min:0, max: 10000, palette: paletteNDVI}, 'MODIS-Aqua NDVI');
    
    Map.addLayer(L7ndviCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDVI'),
    {min:0, max: 1, palette: paletteNDVI}, 'Landsat-7 NDVI');
    
    Map.addLayer(L8ndviCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDVI'),
    {min:0, max: 1, palette: paletteNDVI}, 'Landsat-8 NDVI');
    
    Map.addLayer(S2ndviCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDVI'),
    {min:0, max: 1, palette: paletteNDVI}, 'Sentinel-2 NDVI');
    
    Map.addLayer(L9ndviCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDVI'),
    {min:0, max: 10000, palette: paletteNDVI}, 'Landsat-9 NDVI');

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
    palette: paletteNDVI,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(paletteNDVI),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(0, {margin: '4px 8px'}), // 0 vis min
    ui.Label(((1) / 2),{margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}), // (vis min + vis max)/2
    ui.Label(1, {margin: '4px 8px'}) //vis max
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
  value: 'NDVI',
  style: {fontWeight: 'bold', textAlign:'center', stretch: 'horizontal'}
});

// Add the legendPanel to the map.
var legendPanel = ui.Panel({
  widgets: [legendTitle, colorBar, legendLabels],
  style: {position: 'bottom-right'}
});
Map.add(legendPanel);

