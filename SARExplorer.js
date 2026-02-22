// Author : R. Gimenez
// Goal: The purpose is to create SAR time series plots for
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
// Sentinel-1                          ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

var sentinel1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(setExtent)
  .filterDate('2014-10-01', '2024-05-01')
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('instrumentMode', 'IW'));

function calculateRatio(image) {
  var ratio = image.select('VH').subtract(image.select('VV')).rename('VH_VV_ratio');
  return image.addBands(ratio);
}

//var sentinel1WithRatios = sentinel1.map(calculateRatio);

var toDB = function (img) {
  return ee.Image(img).log10().multiply(10.0);
};

var dBmean = function(geometry, image) {
   // Calculer la moyenne de tous les pixels de l'image
  var meanDict = image.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: image.geometry(),
    scale: 10,
    maxPixels: 1e13
  });
  // Extraire la moyenne pour chaque bande
  var meanValues = ee.Image.constant(meanDict.values().toDB());
  // Remplacer chaque pixel par la moyenne correspondante
  var imageWithMean = meanValues.rename(image.bandNames()).toFloat();
  return imageWithMean.copyProperties(image, image.propertyNames());
};
  
// Implementation by Andreas Vollrath (ESA), inspired by Johannes Reiche (Wageningen)
function terrainCorrection(image) { 
  var imgGeom = image.geometry()
  var srtm = ee.Image('USGS/SRTMGL1_003').clip(imgGeom) // 30m srtm 
  var sigma0Pow = ee.Image.constant(10).pow(image.divide(10.0))

  // Article ( numbers relate to chapters) 
  // 2.1.1 Radar geometry 
  var theta_i = image.select('angle')
  var phi_i = ee.Terrain.aspect(theta_i)
    .reduceRegion(ee.Reducer.mean(), theta_i.get('system:footprint'), 1000)
    .get('aspect')

  // 2.1.2 Terrain geometry
  var alpha_s = ee.Terrain.slope(srtm).select('slope')
  var phi_s = ee.Terrain.aspect(srtm).select('aspect')

  // 2.1.3 Model geometry
  // reduce to 3 angle
  var phi_r = ee.Image.constant(phi_i).subtract(phi_s)

  // convert all to radians
  var phi_rRad = phi_r.multiply(Math.PI / 180)
  var alpha_sRad = alpha_s.multiply(Math.PI / 180)
  var theta_iRad = theta_i.multiply(Math.PI / 180)
  var ninetyRad = ee.Image.constant(90).multiply(Math.PI / 180)

  // slope steepness in range (eq. 2)
  var alpha_r = (alpha_sRad.tan().multiply(phi_rRad.cos())).atan()

  // slope steepness in azimuth (eq 3)
  var alpha_az = (alpha_sRad.tan().multiply(phi_rRad.sin())).atan()

  // local incidence angle (eq. 4)
  var theta_lia = (alpha_az.cos().multiply((theta_iRad.subtract(alpha_r)).cos())).acos()
  var theta_liaDeg = theta_lia.multiply(180 / Math.PI)
  // 2.2 
  // Gamma_nought_flat
  var gamma0 = sigma0Pow.divide(theta_iRad.cos())
  var gamma0dB = ee.Image.constant(10).multiply(gamma0.log10())
  var ratio_1 = gamma0dB.select('VV').subtract(gamma0dB.select('VH'))

  // Volumetric Model
  var nominator = (ninetyRad.subtract(theta_iRad).add(alpha_r)).tan()
  var denominator = (ninetyRad.subtract(theta_iRad)).tan()
  var volModel = (nominator.divide(denominator)).abs()

  // apply model
  var gamma0_Volume = gamma0.divide(volModel)
  var gamma0_VolumeDB = ee.Image.constant(10).multiply(gamma0_Volume.log10())

  // we add a layover/shadow maskto the original implmentation
  // layover, where slope > radar viewing angle 
  var alpha_rDeg = alpha_r.multiply(180 / Math.PI)
  var layover = alpha_rDeg.lt(theta_i);

  // shadow where LIA > 90
  var shadow = theta_liaDeg.lt(85)

  // calculate the ratio for RGB vis
  //var ratio = gamma0_VolumeDB.select('VV').subtract(gamma0_VolumeDB.select('VH')).rename('VV_VH')
  var ratio = gamma0_VolumeDB.select('VH').subtract(gamma0_VolumeDB.select('VV')).rename('VH_VV')

  var output = gamma0_VolumeDB.addBands(ratio).addBands(alpha_r).addBands(phi_s).addBands(theta_iRad)
    .addBands(layover).addBands(shadow).addBands(gamma0dB).addBands(ratio_1)

  return image.addBands(
    output.select(['VV', 'VH', 'VH_VV'], ['VV', 'VH', 'VH_VV']),
    null,
    true
  )
}

var S1RTC = sentinel1.map(terrainCorrection);
//var sentinel1RTC = S1RTC.map(calculateRatio);
//print(S1RTC)

var toDB = function (img) {
  return ee.Image(img).log10().multiply(10.0);
};

var toNatural = function(img) {
  // Convertir l'image en unités naturelles
  var imgNatural = ee.Image(10).pow(ee.Image(img).divide(10.0));
  // Copier les propriétés de l'image originale à l'image convertie
  return imgNatural.copyProperties(img, img.propertyNames());
};

var S1visualization = {
  min: -30,
  max: 1,
  bands: ['VV', 'VH', 'VH_VV'],
};

// ----------------------------------------------------------------------------------------
// Visualize
// ----------------------------------------------------------------------------------------
var initialDate = ee.Date('2015-06-13');

//Map.addLayer(palsarColor.filterDate("2015-06-10").filterBounds(setExtent), {}, 'PALSAR-2 Color');
Map.addLayer(S1RTC.filterDate(initialDate, initialDate.advance(1, 'day')).filterBounds(setExtent), S1visualization, 'Sentinel-1 - RTC');

// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'SAR chart Inspector',
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

// Function to update charts based on selected point
function updateCharts(geometry) {
  var S1Ascchart = ui.Chart.image.series(S1RTC.select("VV", "VH", "VH_VV").filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING')), geometry, ee.Reducer.mean(), 10);
  S1Ascchart.setOptions({
    title: 'Sentinel-1 - RTC - Ascending orbits',
    vAxis: { title: 'Backscattering (dB)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
  });
  panel.widgets().set(3, S1Ascchart);

  var S1Deschart = ui.Chart.image.series(S1RTC.select("VV", "VH", "VH_VV").filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING')), geometry, ee.Reducer.mean(), 10);
  S1Deschart.setOptions({
    title: 'Sentinel-1 - RTC - Descending orbits',
    vAxis: { title: 'Backscattering (dB)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
  });
  panel.widgets().set(4, S1Deschart);
  
}

// Update on polygons - need to use natural values and then convert the mean to dB
// attention - ne marche pas en l'état. Il faudrait utiliser le naturel
function updateChartsPol(geometry, collection) {
  
  var S1Ascchart = ui.Chart.image.series(collection.select("VV", "VH", "VH_VV").filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING')), geometry, ee.Reducer.mean(), 10);
  S1Ascchart.setOptions({
    title: 'Sentinel-1 - RTC - Ascending orbits',
    vAxis: { title: 'Backscattering (natural)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
  });
  panel.widgets().set(3, S1Ascchart);

  var S1Deschart = ui.Chart.image.series(collection.select("VV", "VH", "VH_VV").filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING')), geometry, ee.Reducer.mean(), 10);
  S1Deschart.setOptions({
    title: 'Sentinel-1 - RTC - Descending orbits',
    vAxis: { title: 'Backscattering (natural)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
  });
  panel.widgets().set(4, S1Deschart);
}
// Register a callback on the drawing tools to be invoked when a polygon is completed
drawingTools.onDraw(function (geometry) {
  drawnGeometry = geometry;
  var S1RTCNatural = S1RTC.map(toNatural);
  updateChartsPol(geometry, S1RTCNatural);
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

// Select images from a collection with a silder.
var dateSlider = ui.DateSlider({
  start: '2014-08-04',
  end: '2024-05-29',
  value: initialDate,
  period: 1,
  onChange: function(dateRange) {
    var selectedDate = ee.Date(dateRange.start());
  
    // Boucle à travers les couches et suppression des couches
    while (Map.layers().length() > 0) {
        Map.layers().remove(Map.layers().get(0));
    }
    Map.addLayer(S1RTC.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent), S1visualization, 'Sentinel-1 - RTC');
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




