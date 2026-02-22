// Author : R. Gimenez
// Goal: The purpose is to create SST time series plots for
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
// Data                          ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// add satellite time series: GCOM-C - 4,6383 km - 2 days ------------
// 2 bands - SST_AVE : SST (°C)
//           SST_QA_Flag : bits 0-1 terrain type (water : 0; mostly water : 1; mostly coastal : 2; land:3)
//                         bits 2-3 terrain type (day : 0; mostly day: 1; mostly night: 2; night: 3)
// Doc : https://suzaku.eorc.jaxa.jp/GCOM_C/data/product_std.html
    
var collectionGCOM2 = ee.ImageCollection("JAXA/GCOM-C/L3/OCEAN/SST/V2") 
    .filterDate('2018-01-01','2021-11-28')
    .filterBounds(setExtent).map(function(image) {
        return image.select('SST_AVE').multiply(0.0012).add(-10).copyProperties(image, image.propertyNames());
    });
    
var collectionGCOM3 = ee.ImageCollection("JAXA/GCOM-C/L3/OCEAN/SST/V3") 
    .filterDate('2021-11-29','2024-06-10')
    .filterBounds(setExtent).map(function(image) {
        return image.select('SST_AVE').multiply(0.0012).add(-10).copyProperties(image, image.propertyNames());
    });

// add time series: WHOI - 27,830 km  -------------
// bands : sea_surface_temperature (°C)
//         fill_missing_qc : bits 0-2 (ANN estimation:0; unused flag:1; snow/ice:2; over land:3; over lake:4; SST missing/unresolved: 5)
// Doc : https://www.ncei.noaa.gov/products/climate-data-records/sea-surface-temperature-whoi
var collectionWHOI = ee.ImageCollection('NOAA/CDR/SST_WHOI/V2')
    .filterDate('1988-01-01','2021-08-31')
    .filterBounds(setExtent)

// add satellite time series: NOA CDR OISST - 27,830 km 
// + interpolation in-situ -------------
// bands :  sst (°C)
//          anom (°C) : daily T - mean 30 year climatological min
//          ice : daily sea ice concentrations averaged over 7 days
//          err (°C): estimated error

var collectionOISST = ee.ImageCollection("NOAA/CDR/OISST/V2_1")
    .filterDate('1981-09-01','2024-06-10')
    .filterBounds(setExtent).map(function(image) {
        return image.select('sst').multiply(0.01).copyProperties(image, image.propertyNames());
    });
    
// MODIS Aqua 4616 m   - °C 
var collectionMODISAqua = ee.ImageCollection("NASA/OCEANDATA/MODIS-Aqua/L3SMI")
    .filterDate('2002-07-03','2022-02-28')
    .filterBounds(setExtent).select("sst")

// MODIS Terra 4616 m - °C
var collectionMODISTerra = ee.ImageCollection("NASA/OCEANDATA/MODIS-Terra/L3SMI")
    .filterDate('2000-02-24','2022-02-28')
    .filterBounds(setExtent).select("sst")

// Helper function to extract the values from specific bits
// The input parameter can be a ee.Number() or ee.Image()
// Code adapted from https://gis.stackexchange.com/a/349401/5160
var bitwiseExtract = function(input, fromBit, toBit) {
  var maskSize = ee.Number(1).add(toBit).subtract(fromBit)
  var mask = ee.Number(1).leftShift(maskSize).subtract(1)
  return input.rightShift(fromBit).bitwiseAnd(mask)
}

//function DayMODISClouds(image) {
//  var qcDay = image.select("QC_Day");
  // extract only pixels from the input image where
  // Bits 0-1 <= 1 (LST produced of both good and other quality)
  // Bits 2-3 = 0 (Good data quality)
  // Bits 4-5 Ignore, any value is ok
  // Bits 6-7 = 0 (Average LST error ≤ 1K) - lte et non eq <= 1 donc 2K
//  var qaMask = bitwiseExtract(image, 0, 1).lte(1);
//  var dataQualityMask = bitwiseExtract(qcDay, 2, 3).eq(0);
//  var lstErrorMask = bitwiseExtract(qcDay, 6, 7).lte(1);
//  var mask = qaMask.and(dataQualityMask).and(lstErrorMask);
//  return image.updateMask(mask);  
//}
// Function to calculate monthly means for a collection
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

// Calculate monthly means for each collection
var GCOM2Monthly = getMonthlyMeans(collectionGCOM2.select("SST_AVE"), 2018, 2021);
var GCOM3Monthly = getMonthlyMeans(collectionGCOM3.select("SST_AVE"), 2021, 2024);
var WHOIMonthly = getMonthlyMeans(collectionWHOI.select("sea_surface_temperature"), 1988, 2021);
var OISSTMonthly = getMonthlyMeans(collectionOISST.select("sst"), 1981, 2024);
var MODISTerraMonthly = getMonthlyMeans(collectionMODISTerra.select("sst"), 2000, 2022);
var MODISAquaMonthly = getMonthlyMeans(collectionMODISAqua.select("sst"), 2002, 2022);

// ----------------------------------------------------------------------------------------
// Visualize
// ----------------------------------------------------------------------------------------
var paletteSST = [
    '040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
    'ff0000', 'de0101', 'c21301', 'a71001', '911003'
  ];
  
// GCOM --------------------------------------------------------------------------------------
Map.addLayer(collectionGCOM2.filterDate("2005-06-10").filterBounds(setExtent).select("SST_AVE"),
{min:-20, max: 40, palette: paletteSST}, 'GCOM-C (v2)');

Map.addLayer(collectionGCOM3.filterDate("2005-06-10").filterBounds(setExtent).select("SST_AVE"),
{min:-20, max: 40, palette: paletteSST}, 'GCOM-C (v3)');

// WHOI --------------------------------------------------------------------------------------
Map.addLayer(collectionWHOI.filterDate("2005-06-10").filterBounds(setExtent).select("sea_surface_temperature"),
{min:-20, max: 40, palette: paletteSST}, 'WHOI');

// OISST --------------------------------------------------------------------------------------
Map.addLayer(collectionOISST.filterDate("2005-06-10").filterBounds(setExtent).select("sst"),
{min:-20, max: 40, palette: paletteSST}, 'OISST');

// MODIS - Terra  --------------------------------------------------------------------------------------
Map.addLayer(collectionMODISTerra.filterDate("2005-06-10").filterBounds(setExtent).select("sst"),
{min:-20, max: 40, palette: paletteSST}, 'MODIS-Terra');

Map.addLayer(collectionMODISAqua.filterDate("2005-06-10").filterBounds(setExtent).select("sst"),
{min:-20, max: 40, palette: paletteSST}, 'MODIS-Aqua');

// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'SST chart Inspector',
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
  
  var GCOM2SSTChart = ui.Chart.image.series(GCOM2Monthly, geometry, ee.Reducer.mean(), 46383.3);
  GCOM2SSTChart.setOptions({
    title: 'GCOM-C (v2) - Monthly means',
    vAxis: { title: 'SST (°C)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(3, GCOM2SSTChart);

  var GCOM3SSTChart = ui.Chart.image.series(GCOM3Monthly, geometry, ee.Reducer.mean(), 46383.3);
  GCOM3SSTChart.setOptions({
    title: 'GCOM-C (v3) - Monthly means',
    vAxis: { title: 'SST (°C)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(4, GCOM3SSTChart);
  
  var WHOISSTChart = ui.Chart.image.series(WHOIMonthly, geometry, ee.Reducer.mean(), 27830);
  WHOISSTChart.setOptions({
    title: 'WHOI - Monthly means',
    vAxis: { title: 'SST (°C)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(5, WHOISSTChart);
  
  var OISSTSSTChart = ui.Chart.image.series(OISSTMonthly, geometry, ee.Reducer.mean(), 27830);
  OISSTSSTChart.setOptions({
    title: 'OISST - Monthly means',
    vAxis: { title: 'SST (°C)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(6, OISSTSSTChart);
  
  var MODISTerraSSTChart = ui.Chart.image.series(MODISTerraMonthly, geometry, ee.Reducer.mean(), 4616);
  MODISTerraSSTChart.setOptions({
    title: 'MODIS-Terra - Monthly means',
    vAxis: { title: 'SST (°C)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(7, MODISTerraSSTChart);

  var MODISAquaSSTChart = ui.Chart.image.series(MODISAquaMonthly, geometry, ee.Reducer.mean(), 4616);
  MODISAquaSSTChart.setOptions({
    title: 'MODIS-Aqua - Monthly means',
    vAxis: { title: 'SST (°C)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series: {0: {pointSize: 2, lineWidth: 1, color: 'blue'}}
  });
  panel.widgets().set(8, MODISAquaSSTChart);
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
    
    // GCOM --------------------------------------------------------------------------------------
    Map.addLayer(collectionGCOM2.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select("SST_AVE"),
    {min:-20, max: 40, palette: paletteSST}, 'GCOM-C (v2)');

    Map.addLayer(collectionGCOM3.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select("SST_AVE"),
    {min:-20, max: 40, palette: paletteSST}, 'GCOM-C (v3)');

    // WHOI --------------------------------------------------------------------------------------
    Map.addLayer(collectionWHOI.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select("sea_surface_temperature"),
    {min:-20, max: 40, palette: paletteSST}, 'WHOI');

    // OISST --------------------------------------------------------------------------------------
    Map.addLayer(collectionOISST.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select("sst"),
    {min:-20, max: 40, palette: paletteSST}, 'OISST');

    // MODIS - Terra  --------------------------------------------------------------------------------------
    Map.addLayer(collectionMODISTerra.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select("sst"),
    {min:-20, max: 40, palette: paletteSST}, 'MODIS-Terra');
    // MODIS - Aqua
    Map.addLayer(collectionMODISAqua.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent).select("sst"),
    {min:-20, max: 40, palette: paletteSST}, 'MODIS-Aqua');
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
    palette: paletteSST,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(paletteSST),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(-20, {margin: '4px 8px'}), // vis min
    ui.Label(10,{margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}), // (vis min + vis max)/2
    ui.Label(40, {margin: '4px 8px'}) //vis max
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
  value: 'SST',
  style: {fontWeight: 'bold', textAlign:'center', stretch: 'horizontal'}
});

// Add the legendPanel to the map.
var legendPanel = ui.Panel({
  widgets: [legendTitle, colorBar, legendLabels],
  style: {position: 'bottom-right'}
});
Map.add(legendPanel);

