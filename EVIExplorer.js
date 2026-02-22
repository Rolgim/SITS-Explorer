// Author : R. Gimenez
// Goal: The purpose is to create EVI time series plots for
// dynamically defined points, and to visualize corresponding images

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
// MODIS                          ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// add satellite time series: MODIS EVI 250m 16 day -------------
var collectionModEVI = ee.ImageCollection('MODIS/006/MOD13Q1')
    .filterDate('2000-02-18','2024-05-08')
    .filterBounds(setExtent)
    .select("EVI", "SummaryQA");
    
var collectionModAquaEVI = ee.ImageCollection("MODIS/061/MYD13Q1")
    .filterDate('2002-07-04','2024-04-30')
    .filterBounds(setExtent)
    .select("EVI", "SummaryQA");

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
var scaledCollectionModEVI = collectionModEVI.map(maskLowQuality).map(scale).select('EVI');
var scaledCollectionModAquaEVI = collectionModAquaEVI.map(maskLowQuality).map(scale).select('EVI');

var MODISmerged = scaledCollectionModEVI.select(['EVI'],['MODIS-Terra']).merge(scaledCollectionModAquaEVI.select(['EVI'],['MODIS-Aqua']));

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
function S2calculateEVI(image) {
  var EVI = image.expression(
      '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR' : image.select('B8'),
      'RED' : image.select('B4'),
      'BLUE': image.select('B2')}).rename('EVI');
      return image.addBands(EVI);
}

var S2EVICollection = collectionS2.map(S2calculateEVI);

var S2MODISmerged = MODISmerged.merge(S2EVICollection.select(['EVI'],['Sentinel-2']));

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

// EVI
//In Landsat 4-7, EVI = 2.5 * ((Band 4 – Band 3) / (Band 4 + 6 * Band 3 – 7.5 * Band 1 + 1)).
//In Landsat 8-9, EVI = 2.5 * ((Band 5 – Band 4) / (Band 5 + 6 * Band 4 – 7.5 * Band 2 + 1)).

function L57calculateEVI(image) {
  var EVI = image.expression(
      '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR' : image.select('SR_B4'),
      'RED' : image.select('SR_B3'),
      'BLUE': image.select('SR_B1')}).rename('EVI');
      return image.addBands(EVI);
}

function L89calculateEVI(image) {
  var EVI = image.expression(
      '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR' : image.select('SR_B5'),
      'RED' : image.select('SR_B4'),
      'BLUE': image.select('SR_B2')}).rename('EVI');
      return image.addBands(EVI);
}

// Calculate NDVI for each image in the collection
var L5EVICollection = collectionL5.map(L57calculateEVI);
var L7EVICollection = collectionL7.map(L57calculateEVI);
var L8EVICollection = collectionL8.map(L89calculateEVI);
var L9EVICollection = collectionL9.map(L89calculateEVI);

var AllMerged = S2MODISmerged.merge(L5EVICollection.select(['EVI'],['Landsat-5']))
  .merge(L7EVICollection.select(['EVI'],['Landsat-7']))
  .merge(L8EVICollection.select(['EVI'],['Landsat-8']))
  .merge(L9EVICollection.select(['EVI'],['Landsat-9']));
// ----------------------------------------------------------------------------------------
// Visualize
// ----------------------------------------------------------------------------------------

var paletteEVI = [
  'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
  '74A901', '66A000', '529400', '3E8601', '207401', '056201',
  '004C00', '023B01', '012E01', '011D01', '011301'];
  
//Map.centerObject(setExtent);

// Landsat 5 
Map.addLayer(L5EVICollection.filterDate("2005-06-10").filterBounds(setExtent).select('EVI'),
{min:0, max: 1, palette: paletteEVI}, 'Landsat-5 EVI');

// MODIS Terra --------------------------------------------------------------------------------------
Map.addLayer(collectionModEVI.filterDate("2005-06-10").filterBounds(setExtent).select('EVI'),
{min:0, max: 10000, palette: paletteEVI}, 'MODIS-Terra EVI');

// MODIS Aqua --------------------------------------------------------------------------------------
Map.addLayer(collectionModAquaEVI.filterDate("2005-06-10").filterBounds(setExtent).select('EVI'),
{min:0, max: 10000, palette: paletteEVI}, 'MODIS-Aqua EVI');

// Landsat - autres  --------------------------------------------------------------------------------------

Map.addLayer(L7EVICollection.filterDate("2005-06-10").filterBounds(setExtent).select('EVI'),
{min:0, max: 1, palette: paletteEVI}, 'Landsat-7 EVI');

Map.addLayer(L8EVICollection.filterDate("2005-06-10").filterBounds(setExtent).select('EVI'),
{min:0, max: 1, palette: paletteEVI}, 'Landsat-8 EVI');

Map.addLayer(S2EVICollection.filterDate("2005-06-10").filterBounds(setExtent).select('EVI'),
{min:0, max: 1, palette: paletteEVI}, 'Sentinel-2 EVI');

Map.addLayer(L9EVICollection.filterDate("2005-06-10").filterBounds(setExtent).select('EVI'),
{min:0, max: 1, palette: paletteEVI}, 'Landsat-9 EVI');

// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'EVI chart Inspector',
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
  
  var L5ndviChart = ui.Chart.image.series(L5EVICollection.select('EVI'), geometry, ee.Reducer.mean(), 30);
  L5ndviChart.setOptions({
    title: 'Landsat-5',
    vAxis: { title: 'EVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(3, L5ndviChart);

  // Create an MODIS EVI chart.
  var MODISEVIChart = ui.Chart.image.series(scaledCollectionModEVI, geometry, ee.Reducer.mean(), 250);
  MODISEVIChart.setOptions({
    title: 'MODIS-Terra',
    vAxis: { title: 'EVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(4, MODISEVIChart);
  
  var MODISAquaEVIChart = ui.Chart.image.series(scaledCollectionModAquaEVI, geometry, ee.Reducer.mean(), 250);
  MODISAquaEVIChart.setOptions({
    title: 'MODIS-Aqua',
    vAxis: { title: 'EVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(5, MODISAquaEVIChart);

  var L7EVIChart = ui.Chart.image.series(L7EVICollection.select('EVI'), geometry, ee.Reducer.mean(), 30);
  L7EVIChart.setOptions({
    title: 'Landsat-7',
    vAxis: { title: 'EVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(6, L7EVIChart);

  var L8EVIChart = ui.Chart.image.series(L8EVICollection.select('EVI'), geometry, ee.Reducer.mean(), 30);
  L8EVIChart.setOptions({
    title: 'Landsat-8',
    vAxis: { title: 'EVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(7, L8EVIChart);
  
  var S2EVIChart = ui.Chart.image.series(S2EVICollection.select('EVI'), geometry, ee.Reducer.mean(), 10);
  S2EVIChart.setOptions({
    title: 'Sentinel-2',
    vAxis: { title: 'EVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(8, S2EVIChart);
  
  var L9EVIChart = ui.Chart.image.series(L9EVICollection.select('EVI'), geometry, ee.Reducer.mean(), 30);
  L9EVIChart.setOptions({
    title: 'Landsat-9',
    vAxis: { title: 'EVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'green'}}
  });
  panel.widgets().set(9, L9EVIChart);
  
  var Merged = ui.Chart.image.series(AllMerged, geometry, ee.Reducer.mean(), 250);
  Merged.setOptions({
    title: 'All',
    vAxis: { title: 'EVI', maxValue: 1 },
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
    
    Map.addLayer(L5EVICollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('EVI'),
    {min:0, max: 1, palette: paletteEVI}, 'Landsat-5 EVI');
    
    Map.addLayer(collectionModEVI.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('EVI'),
    {min:0, max: 10000, palette: paletteEVI}, 'MODIS-Terra EVI');
    
    Map.addLayer(collectionModAquaEVI.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('EVI'),
    {min:0, max: 10000, palette: paletteEVI}, 'MODIS-Aqua EVI');
    
    Map.addLayer(L7EVICollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('EVI'),
    {min:0, max: 1, palette: paletteEVI}, 'Landsat-7 EVI');
    
    Map.addLayer(L8EVICollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('EVI'),
    {min:0, max: 1, palette: paletteEVI}, 'Landsat-8 EVI');
    
    Map.addLayer(S2EVICollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('EVI'),
    {min:0, max: 1, palette: paletteEVI}, 'Sentinel-2 EVI');
    
    Map.addLayer(L9EVICollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('EVI'),
    {min:0, max: 10000, palette: paletteEVI}, 'Landsat-9 EVI');

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
    palette: paletteEVI,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(paletteEVI),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(0, {margin: '4px 8px'}), // vis min
    ui.Label(0.5, {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}), // (vis min + vis max)/2
    ui.Label(1, {margin: '4px 8px'}) //vis max
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
  value: 'EVI',
  style: {fontWeight: 'bold', textAlign:'center', stretch: 'horizontal'}
});

// Add the legendPanel to the map.
var legendPanel = ui.Panel({
  widgets: [legendTitle, colorBar, legendLabels],
  style: {position: 'bottom-right'}
});
Map.add(legendPanel);


