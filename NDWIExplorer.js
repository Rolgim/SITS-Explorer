// Author : R. Gimenez
// Goal: The purpose is to create NDWI time series plots for
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
// add satellite time series: MODIS NDWI 500m 16 day -------------
var collectionModNDWI = ee.ImageCollection('MODIS/MCD43A4_006_NDWI')
    .filterDate('2000-02-24','2023-02-10')
    .filterBounds(setExtent)
    .select("NDWI");
    
function getMonthlyMeans(collection, startYear, endYear) {
  var months = ee.List.sequence(1, 12);
  var years = ee.List.sequence(startYear, endYear);
  var monthlyMeans = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return months.map(function(m) {
        var monthlyMean = collection
          .filter(ee.Filter.calendarRange(y, y, 'year'))
          .filter(ee.Filter.calendarRange(m, m, 'month'))
          .mean()
          .set('year', y)
          .set('month', m)
          .set('system:time_start', ee.Date.fromYMD(y, m, 1));
        return monthlyMean;
      });
    }).flatten()
  );
  return monthlyMeans;
}
var collectionModNDWImonth = getMonthlyMeans(collectionModNDWI, 2000, 2022);
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

// Function to calculate NDWI
function S2calculateNDWI(image) {
  var ndwi = image.normalizedDifference(['B8', 'B11']).rename('NDWI');
  return image.addBands(ndwi)
}

var S2ndwiCollection = collectionS2.map(S2calculateNDWI);

var collectionS2NDWImonth = getMonthlyMeans(S2ndwiCollection, 2017, 2024);

var S2MODISmerged = collectionModNDWImonth.merge(collectionS2NDWImonth.select(['NDWI'],['Sentinel-2']));

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

// NDWI
// In Landsat 4-7, NDWI = (Band 4 – Band 5) / (Band 4 + Band 5).
// In Landsat 8-9, NDWI = (Band 5 – Band 6) / (Band 5 + Band 6).

// Function to calculate NDWI
function L57calculateNDWI(image) {
  var ndwi = image.normalizedDifference(['SR_B4', 'SR_B5']).rename('NDWI');
  return image.addBands(ndwi)
}
function L89calculateNDWI(image) {
  var ndwi = image.normalizedDifference(['SR_B5', 'SR_B6']).rename('NDWI');
  return image.addBands(ndwi)
}


// Calculate NDVI for each image in the collection
var L5ndwiCollection = collectionL5.map(L57calculateNDWI);
var L7ndwiCollection = collectionL7.map(L57calculateNDWI);
var L8ndwiCollection = collectionL8.map(L89calculateNDWI);
var L9ndwiCollection = collectionL9.map(L89calculateNDWI);

//
var collectionL5NDWImonth = getMonthlyMeans(L5ndwiCollection, 1984, 2012);
var collectionL7NDWImonth = getMonthlyMeans(L7ndwiCollection, 1999, 2024);
var collectionL8NDWImonth = getMonthlyMeans(L8ndwiCollection, 2013, 2024);
var collectionL9NDWImonth = getMonthlyMeans(L9ndwiCollection, 2021, 2024);

var AllMerged = S2MODISmerged.merge(collectionL5NDWImonth.select(['NDWI'],['Landsat-5']))
  .merge(collectionL7NDWImonth.select(['NDWI'],['Landsat-7']))
  .merge(collectionL8NDWImonth.select(['NDWI'],['Landsat-8']))
  .merge(collectionL9NDWImonth.select(['NDWI'],['Landsat-9']));

// ----------------------------------------------------------------------------------------
// Visualize
// ----------------------------------------------------------------------------------------

var paletteNDWI = ['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff'];


// Landsat 5 
Map.addLayer(L5ndwiCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDWI'),
{min:0, max: 1, palette: paletteNDWI}, 'Landsat-5 NDWI');

// MODIS  --------------------------------------------------------------------------------------
Map.addLayer(collectionModNDWI.filterDate("2005-06-10").filterBounds(setExtent).select('NDWI'),
{min:0, max: 1, palette: paletteNDWI}, 'MODIS NDWI');

// Landsat - autres  --------------------------------------------------------------------------------------

Map.addLayer(L7ndwiCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDWI'),
{min:0, max: 1, palette: paletteNDWI}, 'Landsat-7 NDWI');

Map.addLayer(L8ndwiCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDWI'),
{min:0, max: 1, palette: paletteNDWI}, 'Landsat-8 NDWI');

Map.addLayer(S2ndwiCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDWI'),
{min:0, max: 1, palette: paletteNDWI}, 'Sentinel-2 NDWI');

Map.addLayer(L9ndwiCollection.filterDate("2005-06-10").filterBounds(setExtent).select('NDWI'),
{min:0, max: 1, palette: paletteNDWI}, 'Landsat-9 NDWI');

// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'NDWI chart Inspector',
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
  
  var L5ndwiChart = ui.Chart.image.series(L5ndwiCollection.select('NDWI'), geometry, ee.Reducer.mean(), 30);
  L5ndwiChart.setOptions({
    title: 'Landsat-5',
    vAxis: { title: 'NDWI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(3, L5ndwiChart);

  // Create an MODIS NDWI chart.
  var MODISndwiChart = ui.Chart.image.series(collectionModNDWImonth, geometry, ee.Reducer.mean(), 500);
  MODISndwiChart.setOptions({
    title: 'MODIS',
    vAxis: { title: 'NDWI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(4, MODISndwiChart);
  

  var L7ndwiChart = ui.Chart.image.series(L7ndwiCollection.select('NDWI'), geometry, ee.Reducer.mean(), 30);
  L7ndwiChart.setOptions({
    title: 'Landsat-7',
    vAxis: { title: 'NDWI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(5, L7ndwiChart);

  var L8ndwiChart = ui.Chart.image.series(L8ndwiCollection.select('NDWI'), geometry, ee.Reducer.mean(), 30);
  L8ndwiChart.setOptions({
    title: 'Landsat-8',
    vAxis: { title: 'NDVI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(6, L8ndwiChart);
  
  var S2ndwiChart = ui.Chart.image.series(S2ndwiCollection.select('NDWI'), geometry, ee.Reducer.mean(), 20);
  S2ndwiChart.setOptions({
    title: 'Sentinel-2',
    vAxis: { title: 'NDWI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(7, S2ndwiChart);
  
  var L9ndwiChart = ui.Chart.image.series(L9ndwiCollection.select('NDWI'), geometry, ee.Reducer.mean(), 30);
  L9ndwiChart.setOptions({
    title: 'Landsat-9',
    vAxis: { title: 'NDWI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(8, L9ndwiChart);

  var Merged = ui.Chart.image.series(AllMerged, geometry, ee.Reducer.mean(), 20);
  Merged.setOptions({
    title: 'All - Monthly means',
    vAxis: { title: 'NDWI', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 3, pointShape: 'diamond', lineWidth: 1, color: 'blue'},
    1: {pointSize: 3, pointShape: 'circle', lineWidth: 1, color: 'blue'},
    2: {pointSize: 3, pointShape: 'triangle', lineWidth: 1, color: 'blue'},
    3: {pointSize: 3, pointShape: 'square', lineWidth: 1, color: 'blue'},
    4: {pointSize: 3, pointShape: 'star', lineWidth: 1, color: 'blue'},
    5: {pointSize: 3, pointShape: 'polygon', lineWidth: 1, color: 'blue'},
    6: {pointSize: 3, pointShape:{ type: 'star', sides: 4, dent: 0.5 }, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(9, Merged);
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
    
    Map.addLayer(L5ndwiCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDWI'),
    {min:0, max: 1, palette: paletteNDWI}, 'Landsat-5 NDWI');
    
    Map.addLayer(collectionModNDWI.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDWI'),
    {min:0, max: 1, palette: paletteNDWI}, 'MODIS NDWI - Monthly means');
    
    Map.addLayer(L7ndwiCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDWI'),
    {min:0, max: 1, palette: paletteNDWI}, 'Landsat-7 NDWI');
    
    Map.addLayer(L8ndwiCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDWI'),
    {min:0, max: 1, palette: paletteNDWI}, 'Landsat-8 NDWI');
    
    Map.addLayer(S2ndwiCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDWI'),
    {min:0, max: 1, palette: paletteNDWI}, 'Sentinel-2 NDWI');
    
    Map.addLayer(L9ndwiCollection.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select('NDWI'),
    {min:0, max: 1, palette: paletteNDWI}, 'Landsat-9 NDWI');

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
    palette: paletteNDWI,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(paletteNDWI),
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
  value: 'NDWI',
  style: {fontWeight: 'bold', textAlign:'center', stretch: 'horizontal'}
});

// Add the legendPanel to the map.
var legendPanel = ui.Panel({
  widgets: [legendTitle, colorBar, legendLabels],
  style: {position: 'bottom-right'}
});
Map.add(legendPanel);

