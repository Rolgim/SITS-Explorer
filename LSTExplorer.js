// Author : R. Gimenez
// Goal: The purpose is to visualize GRACE 

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

// add ERA5 -------------
var GRACEland = ee.ImageCollection("NASA/GRACE/MASS_GRIDS_V04/LAND").filterBounds(setExtent)
var GRACEglobal = ee.ImageCollection("NASA/GRACE/MASS_GRIDS_V03/MASCON").filterBounds(setExtent)

var Gvisualization = {
  min: -25.0,
  max: 25.0,
  palette: ['001137', '01abab', 'e7eb05', '620500']
};

// ----------------------------------------------------------------------------------------
// Visualize
// ----------------------------------------------------------------------------------------

Map.addLayer(GRACEland.filterDate("2005-06-10").select("lwe_thickness_csr").filterBounds(setExtent),
Gvisualization, 'GRACE - land - CSR');
    
Map.addLayer(GRACEland.filterDate("2005-06-10").select("lwe_thickness_gfz").filterBounds(setExtent),
Gvisualization, 'GRACE - land - GFZ');
    
Map.addLayer(GRACEland.filterDate("2005-06-10").select("lwe_thickness_jpl").filterBounds(setExtent),
Gvisualization, 'GRACE - land - JPL');

Map.addLayer(GRACEglobal.filterDate("2005-06-10").filterBounds(setExtent),
Gvisualization, 'Grace - global - Mascons');


// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'GRACE chart Inspector',
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
  
  var GlandChartMonth = ui.Chart.image.series(GRACEland.select("lwe_thickness_csr", "lwe_thickness_gfz", "lwe_thickness_jpl"), geometry, ee.Reducer.mean(), 111320);
  GlandChartMonth.setOptions({
    title: 'GRACE monthly land',
    vAxis: { title: 'Equivalent liquid water thickness (m)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 }},
    series : {0: {lineWidth: 1, color: 'red', lineDashStyle: [4, 4]},
    1: {color: 'black'},
    2: {lineWidth: 1, color: 'blue', lineDashStyle: [4, 4]}}
  });
  panel.widgets().set(3, GlandChartMonth);

  var GglobalChartMonth = ui.Chart.image.series(GRACEglobal.select("lwe_thickness"), geometry, ee.Reducer.mean(), 55660);
  GglobalChartMonth.setOptions({
    title: 'GRACE monthly global - Mascons',
    vAxis: { title: 'Equivalent liquid water thickness (cm)'},
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
  });
  panel.widgets().set(4, GglobalChartMonth);
  
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
  start: '2002-04-01',
  end: '2023-10-31',
  value: initialDate,
  period: 1,
  onChange: function(dateRange) {
    var selectedDate = ee.Date(dateRange.start());
  
    // Boucle à travers les couches et suppression des couches
    while (Map.layers().length() > 0) {
        Map.layers().remove(Map.layers().get(0));
    }
    Map.addLayer(GRACEland.filterDate(selectedDate, selectedDate.advance(1, 'day')).select("lwe_thickness_csr").filterBounds(setExtent),
    Gvisualization, 'GRACE - land - CSR');
    
    Map.addLayer(GRACEland.filterDate(selectedDate, selectedDate.advance(1, 'day')).select("lwe_thickness_gfz").filterBounds(setExtent),
    Gvisualization, 'GRACE - land - GFZ');
    
    Map.addLayer(GRACEland.filterDate(selectedDate, selectedDate.advance(1, 'day')).select("lwe_thickness_jpl").filterBounds(setExtent),
    Gvisualization, 'GRACE - land - JPL');
    
    Map.addLayer(GRACEglobal.filterDate(selectedDate, selectedDate.advance(1, 'day')).select("lwe_thickness").filterBounds(setExtent),
    Gvisualization, 'Grace - global - Mascons');
    
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
    palette: Gvisualization.palette,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(Gvisualization.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(Gvisualization.min, {margin: '4px 8px'}), // vis min
    ui.Label(((Gvisualization.max-Gvisualization.min) / 2+Gvisualization.min), {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}), // (vis min + vis max)/2
    ui.Label(Gvisualization.max, {margin: '4px 8px'}) //vis max
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
  value: 'Equivalent liquid water thickness (cm)',
  style: {fontWeight: 'bold', textAlign:'center', stretch: 'horizontal'}
});

// Add the legendPanel to the map.
var legendPanel = ui.Panel({
  widgets: [legendTitle, colorBar, legendLabels],
  style: {position: 'bottom-right'}
});
Map.add(legendPanel);




