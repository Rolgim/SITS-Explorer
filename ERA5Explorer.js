// Author : R. Gimenez
// Goal: The purpose is to visualize ERA5 data

// ----------------------------------------------------------------------------------------
// Loading vector and raster data ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// Load the regional bounds of interest
// limit the computation of several variables to the area of interest
var setExtent = Map.getBounds(true);
// remove all widgets from older panels
Map.clear()
// add the 'reset' button, which conducts back to the launcher
Map.add(ui.Button('Reset', function () {
  // at click, remove all
  Map.clear()
  var widgs = ui.root.widgets();
  widgs.forEach(function(widg){
    if (widg instanceof ui.Panel){
      ui.root.remove(widg);
    }
  });
  // and load launcher
  require('users/GimenezRollin/SITSExplorer:Launcher');
}));

// ----------------------------------------------------------------------------------------
// ERA5                           ---------------------------------------------------------
// ----------------------------------------------------------------------------------------

// add ERA5 - load colections and filter them -------------
var ERA5monthlyT = ee.ImageCollection("ECMWF/ERA5/MONTHLY").select("mean_2m_air_temperature", "minimum_2m_air_temperature", "maximum_2m_air_temperature").filterBounds(setExtent)
var ERA5dailyT = ee.ImageCollection("ECMWF/ERA5/DAILY").select("mean_2m_air_temperature").filterBounds(setExtent)
var ERA5monthlyP = ee.ImageCollection("ECMWF/ERA5/MONTHLY").select("total_precipitation").filterBounds(setExtent)
var ERA5dailyP = ee.ImageCollection("ECMWF/ERA5/DAILY").select("total_precipitation").filterBounds(setExtent)
var ERA5monthlyPr = ee.ImageCollection("ECMWF/ERA5/MONTHLY").select("surface_pressure").filterBounds(setExtent)
var ERA5monthlyDT = ee.ImageCollection("ECMWF/ERA5/MONTHLY").select("dewpoint_2m_temperature", "mean_2m_air_temperature").filterBounds(setExtent)
var ERA5monthlyW = ee.ImageCollection("ECMWF/ERA5/MONTHLY").select("u_component_of_wind_10m", "v_component_of_wind_10m").filterBounds(setExtent)

// conversion function - from Kelvin to Celcius
var celcius = function(image) {
  return image.subtract(273.15).copyProperties(image, image.propertyNames());
};

// application of the conversion for air temperature collections 
var ERA5monthlyT = ERA5monthlyT.map(celcius);
var ERA5dailyT = ERA5dailyT.map(celcius);

// conversion function - from Pa to hPa
var hPa = function(image) {
  return image.divide(100).copyProperties(image, image.propertyNames());
};

// application of the conversion for air pressure collections 
var ERA5monthlyPr = ERA5monthlyPr.map(hPa);
var ERA5monthlyDT = ERA5monthlyDT.map(celcius);

// function used to calculate relative humidity from air temperature and dewpoint temperature
// based on Magnus-Tetens formula /!\ using it with average is an approximation since non linear formula
function calculateHumidity(image) {
  // Assuming 'image' has bands 'temperature' (T) and 'dewpoint' (td)
  var temperature = image.select('mean_2m_air_temperature');
  var dewpoint = image.select('dewpoint_2m_temperature');
  // Calculate humidity using the Magnus-Tetens formula
  var humidity = dewpoint.expression(
    '100 * exp(17.271 * ((td / (td + 237.7)) - (T / (T + 237.7))))',
    {'T': temperature,'td': dewpoint});
  // Copy properties from the input image to the result
  var humidityImage = humidity.copyProperties(image, image.propertyNames());
  return humidityImage;//.rename('humidity');
}

// function used to calculate dewpoint depression (difference between air temperature and dewpoint)
function calculateDewpointDepression(image) {
  // Select the relevant bands
  var dewpoint = image.select('dewpoint_2m_temperature');
  var temperature = image.select('mean_2m_air_temperature');
  // Calculate the dewpoint depression
  var dewpointDepression = temperature.subtract(dewpoint);
  // Copy properties from the input image to the result
  var result = dewpointDepression.copyProperties(image, image.propertyNames());
  return result;
}

// function used to calculate hot days - those with average T > 35°C 
function calculateHotDays(image) {
  var hotDays = image.gt(35).copyProperties(image, image.propertyNames());
  return hotDays;
}

// function used to calculate hot days - those with average T < 0°C 
function calculateFrostDays(image) {
  var frostDays = image.lt(0).copyProperties(image, image.propertyNames());
  return frostDays;
}

// function used to calculate the monthly sum of a specific variable (ex number of hot days)
function getMonthlySum(collection, startYear, endYear) {
  var months = ee.List.sequence(1, 12);
  var years = ee.List.sequence(startYear, endYear);
  var monthlySums = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return months.map(function(m) {
        var monthlySums = collection
          .filter(ee.Filter.calendarRange(y, y, 'year'))
          .filter(ee.Filter.calendarRange(m, m, 'month'))
          .sum()
          .set('year', y)
          .set('month', m)
          .set('system:time_start', ee.Date.fromYMD(y, m, 1));
        return monthlySums;
      });
    }).flatten()
  );
  return monthlySums;
}

// function used to calculate the monthly average of a specific variable (ex average daily precipitation)
function getMonthlyMeans(collection, startYear, endYear) {
  var months = ee.List.sequence(1, 12);
  var years = ee.List.sequence(startYear, endYear);
  var monthlyMeans = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return months.map(function(m) {
        var monthlyMeans = collection
          .filter(ee.Filter.calendarRange(y, y, 'year'))
          .filter(ee.Filter.calendarRange(m, m, 'month'))
          .mean()
          .set('year', y)
          .set('month', m)
          .set('system:time_start', ee.Date.fromYMD(y, m, 1));
        return monthlyMeans;
      });
    }).flatten()
  );
  return monthlyMeans;
}

// function used to calculate the yearly sum of a specific variable (ex number of hot days)
function getYearlySum(collection, startYear, endYear) {
  var years = ee.List.sequence(startYear, endYear);
  var yearlySums = ee.ImageCollection.fromImages(
    years.map(function(y) {
      var yearlySums = collection
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .sum()
        .set('year', y)
        .set('month', 1)
        .set('system:time_start', ee.Date.fromYMD(y, 1, 1));
      return yearlySums;
  }).flatten()
);
  return yearlySums;
}

// function used to calculate wind speed and direction
function calculateWindSpeedDirection(image) {
  // Select the relevant bands
  var uComponent = image.select('u_component_of_wind_10m');
  var vComponent = image.select('v_component_of_wind_10m');
  // Calculate wind speed
  var windSpeed = uComponent.hypot(vComponent);
  // Calculate wind direction
  var windDirection = vComponent.atan2(uComponent).multiply(180).divide(Math.PI);
  // Copy properties from the input image to the result
  var result = ee.Image([windSpeed, windDirection])
    .rename(['wind_speed', 'wind_direction'])
    .copyProperties(image, image.propertyNames());
  return result;
}

// application of the previous functions 
var ERA5monthlyHumidity = ERA5monthlyDT.map(calculateHumidity);
var ERA5AverageDailyP = getMonthlyMeans(ERA5dailyP, 1980, 2020);
var ERA5monthlyHotDays = getYearlySum(ERA5dailyT.map(calculateHotDays), 1980, 2020);
var ERA5monthlyFrostDays = getYearlySum(ERA5dailyT.map(calculateFrostDays), 1980, 2020);
var ERA5monthlyDepression = ERA5monthlyDT.map(calculateDewpointDepression);
var ERA5monthlyWinds = ERA5monthlyW.map(calculateWindSpeedDirection);

// --------------------------------------------------------------------------------------------

// definition of vizualization palette for temperature (from - 20 to 40°C)
var Tvisualization = {
  min: -20,
  max: 40,
  palette: [
    '000080', '0000d9', '4000ff', '8000ff', '0080ff', '00ffff',
    '00ff80', '80ff00', 'daff00', 'ffff00', 'fff500', 'ffda00',
    'ffb000', 'ffa400', 'ff4f00', 'ff2500', 'ff0a00', 'ff00ff',
  ]
};

// definition of vizualization palette for precipition (from 0 to 0.1)
var Pvisualization = {
  min: 0.0,
  max: 0.1,
  palette: ['ffffff', '00ffff', '0080ff', 'da00ff', 'ffa400', 'ff0000']
};

// ----------------------------------------------------------------------------------------
// Visualize 
// ----------------------------------------------------------------------------------------
// add maps
// add ERA5 monthly average temperature
Map.addLayer(ERA5monthlyT.filterDate("2005-06-10").select("mean_2m_air_temperature").filterBounds(setExtent),
Tvisualization, 'ERA 5 - monthly 2m temperature');

// add ERA5 monthly total precipitation
Map.addLayer(ERA5monthlyP.filterDate("2005-06-10").filterBounds(setExtent),
Pvisualization, 'ERA 5 - monthly total precipitation');

// add ERA5 daily average temperature
Map.addLayer(ERA5dailyT.filterDate("2005-06-10").filterBounds(setExtent),
Tvisualization, 'ERA 5 - daily 2m temperature');

// add ERA5 daily total precipitation
Map.addLayer(ERA5dailyP.filterDate("2005-06-10").filterBounds(setExtent),
Pvisualization, 'ERA 5 - daily total precipitation');

// ----------------------------------------------------------------------------------------
// Create User Interface
// ----------------------------------------------------------------------------------------

// Intro ----------------------------------------------------------------------------------

// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '300px');

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'ERA-5 chart Inspector',
    style: { fontSize: '20px', fontWeight: 'bold' }
  }),
  ui.Label('Select a point or draw a polygon (mean charts) on the map to inspect.')
]);
panel.add(intro);

// Create variables lon & lat
var lon = ui.Label('');
var lat = ui.Label('');

// Create a horizontal panel for printing lon & lat
var coordPanel = ui.Panel({
  widgets: [lon, lat],
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {stretch: 'horizontal'}
});

// Apply styles to center lon & lat widgets
lon.style().set('margin', '10px auto');
lat.style().set('margin', '10px auto');

// Drawing tools ----------------------------------------------------------------------------

// Add the pannel to the interface
panel.add(coordPanel);

// create a variable (with null initial value) which will be set at the drawn geometry
var drawnGeometry = null;

// Create a drawing tools control panel 
var drawingTools = Map.drawingTools();
drawingTools.setShown(false);
drawingTools.setDrawModes(['polygon']);

// Create vertical pannel with the title
var titlePanel = ui.Panel([
  ui.Label({
    value: 'Drawing Tools:',
    style: { fontSize: '15px', fontWeight: 'bold' }
  })
]);

// Create a horizontal pannel with drawing buttons 
var buttonPanel = ui.Panel([
  // first button - start drawing a polygon on click
  ui.Button({
    label: 'Draw Polygon',
    onClick: function () {
      drawingTools.setShape('polygon');
      drawingTools.draw();
    }
  }),
  // second button - clear all polygons on click
  ui.Button({
    label: 'Clear',
    onClick: function () {
      drawingTools.layers().forEach(function (layer) {
        drawingTools.layers().remove(layer);
      drawnGeometry = null;
      });
    }
  }),
  // third button - export a polygon on click
  ui.Button({
    label: 'Export',
    onClick: function() {
      // if there is a geometry - gives a link to download the geojson
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
        // else alarm
        ui.alert('Please, draw a geometry.');
      }
    }
  })
], ui.Panel.Layout.flow('horizontal'));
buttonPanel.style().set('margin', '5px auto');

// principal panel ---------------------------------------------------------------------------

// create the panel with previous ones in it
var drawingControlPanel = ui.Panel([
  titlePanel,
  buttonPanel
], ui.Panel.Layout.flow('vertical'));

// adding it to the user interface
panel.add(drawingControlPanel);

// Function to update charts based on previously selected region
function updateCharts(geometry) {
  //the mean of the geometry will be considered, according to a spatial step of 27830 m (spatial resolution of the data)
  // options specified by ee.Reducer.mean() and 27830
  var TChartMonth = ui.Chart.image.series(ERA5monthlyT, geometry, ee.Reducer.mean(), 27830);
  TChartMonth.setOptions({
    title: 'ERA-5 monthly temperature aggregate',
    vAxis: { title: '2m temperature (°C)', maxValue: 1 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 }},
    series : {0: {lineWidth: 1, color: 'red', lineDashStyle: [4, 4]},
    1: {color: 'black'},
    2: {lineWidth: 1, color: 'blue', lineDashStyle: [4, 4]}}
  });
  // on location 3 because 1 and 2 are for the previously defined widgets
  panel.widgets().set(3, TChartMonth);

  var PChartMonth = ui.Chart.image.series(ERA5monthlyP, geometry, ee.Reducer.mean(), 27830);
  PChartMonth.setOptions({
    title: 'ERA-5 monthly precipitation aggregate',
    vAxis: { title: 'Total precipitation (m)', maxValue: 0.5 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 } },
    series : {0: {lineWidth: 1, color: 'navy'}},
    legend: {position: 'none'}
  });
  panel.widgets().set(4, PChartMonth);
  
  var PrChartMonth = ui.Chart.image.series(ERA5monthlyPr, geometry, ee.Reducer.mean(), 27830);
  PrChartMonth.setOptions({
    title: 'ERA-5 monthly pressure average',
    vAxis: { title: 'Surface pressure (hPa)', minValue : 950, maxValue: 1050 },
    hAxis: { title: 'date', format: 'YYYY', gridlines: { count: 7 }},
    series : {0: {lineWidth: 1, color: 'purple'},
    legend: {position: 'none'}
    }
  });
  panel.widgets().set(5, PrChartMonth);
  
  //monthly average precipitation chart
  var AvgRainChart = ui.Chart.image.series(ERA5AverageDailyP, geometry, ee.Reducer.mean(), 27830);
  AvgRainChart.setOptions({
    title: 'Average precipitation',
    vAxis: { title: 'Average precipitation (m/day)' },
    hAxis: { title: 'Date', format: 'YYYY', gridlines: { count: 12 }},
    series : {0: {lineWidth: 1, color: 'navy'}},
    legend: {position: 'none'}
  });
  panel.widgets().set(6, AvgRainChart);
  
  var DewpointChart = ui.Chart.image.series(ERA5monthlyDT, geometry, ee.Reducer.mean(), 27830);
  DewpointChart.setOptions({
    title: 'Monthly average dewpoint 2m temperature',
    vAxis: { title: 'Dewpoint 2m temperature (°C)' },
    hAxis: { title: 'Date', format: 'YYYY', gridlines: { count: 12 }},
    series : {0: {lineWidth: 1, color: 'blue'},
    1: {color: 'black', lineDashStyle: [4, 4]}}
  });
  panel.widgets().set(7, DewpointChart);
  
  var HumidityChart = ui.Chart.image.series(ERA5monthlyHumidity, geometry, ee.Reducer.mean(), 27830);
  HumidityChart.setOptions({
    title: 'Relative humidity derived from average 2m temperatures',
    vAxis: { title: 'relative humidity (%)' },
    hAxis: { title: 'Date', format: 'YYYY', gridlines: { count: 12 }},
    series : {0: {lineWidth: 1, color: 'blue'}},
    legend: {position: 'none'}
  });
  panel.widgets().set(8, HumidityChart);
  
  var DepressionChart = ui.Chart.image.series(ERA5monthlyDepression, geometry, ee.Reducer.mean(), 27830);
  DepressionChart.setOptions({
    title: 'Dewpoint depression derived from average 2m temperatures',
    vAxis: { title: 'Dewpoint depression (°C)' },
    hAxis: { title: 'Date', format: 'YYYY', gridlines: { count: 12 }},
    series : {0: {lineWidth: 1, color: 'blue'}},
    legend: {position: 'none'}
  });
  panel.widgets().set(9, DepressionChart);
  
  var WindChart = ui.Chart.image.series(ERA5monthlyWinds.select("wind_speed"), geometry, ee.Reducer.mean(), 27830);
  WindChart.setOptions({
    title: 'Average wind speed',
    vAxis: { title: 'wind speed (m/s)' },
    hAxis: { title: 'Date', format: 'YYYY', gridlines: { count: 12 }},
    series : {0: {lineWidth: 1, color: 'palegreen'}},
    legend: {position: 'none'}
  });
  panel.widgets().set(10, WindChart);
  
  var WDirectionChart = ui.Chart.image.series(ERA5monthlyWinds.select("wind_direction"), geometry, ee.Reducer.mean(), 27830);
  WDirectionChart.setOptions({
    title: 'Average wind direction',
    vAxis: { title: 'wind direction (°)', min: -180, max: 180},
    hAxis: { title: 'Date', format: 'YYYY', gridlines: { count: 12 }},
    series : {0: {pointSize: 2, lineWidth: 0, color: 'palegreen'}},
    legend: {position: 'none'}
  });
  panel.widgets().set(11, WDirectionChart);
  
  // Hot Days Chart - /!\ reducer is max and not mean because it is the number of hot days within the extent
  var hotDaysChart = ui.Chart.image.series(ERA5monthlyHotDays, geometry, ee.Reducer.max(), 27830);
  hotDaysChart.setOptions({
    title: 'Number of Hot Days (T > 35°C)',
    vAxis: { title: 'Number of Hot Days', min: 0},
    hAxis: { title: 'Date', format: 'YYYY', gridlines: { count: 12 }},
    series : {0: {pointSize: 2, lineWidth: 0, color: 'darkred'}},
    legend: {position: 'none'}
  });
  panel.widgets().set(12, hotDaysChart);

  // Frost Days Chart - /!\ reducer is max and not mean because it is the number of hot days within the extent
  var frostDaysChart = ui.Chart.image.series(ERA5monthlyFrostDays, geometry, ee.Reducer.max(), 27830);
  frostDaysChart.setOptions({
    title: 'Number of Frost Days (T < 0°C)',
    vAxis: { title: 'Number of Frost Days' },
    hAxis: { title: 'Date', format: 'YYYY', gridlines: { count: 12 }},
    series : {0: {pointSize: 2, lineWidth: 0, color: 'paleturquoise'}},
    legend: {position: 'none'}
  });
  panel.widgets().set(13, frostDaysChart);
  
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

// Define map cursor
Map.style().set('cursor', 'crosshair');

// Add the panel to the ui.root.
ui.root.insert(0, panel);

// ----------------------------------------------------------------------------------------
// Create Date Slider
// ----------------------------------------------------------------------------------------

// initialisation of widget
var datePanel = ui.Panel();
datePanel.style().set('width', '200px');

// Add a title
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
  
    // Loop to remove all previously loaded images
    while (Map.layers().length() > 0) {
        Map.layers().remove(Map.layers().get(0));
    }
    // add the new images
    Map.addLayer(ERA5monthlyT.filterDate(selectedDate, selectedDate.advance(1, 'day')).select("mean_2m_air_temperature").filterBounds(setExtent),
    Tvisualization, 'ERA 5 - monthly 2m temperature');

    Map.addLayer(ERA5monthlyP.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    Pvisualization, 'ERA 5 - monthly total precipitation');

    Map.addLayer(ERA5dailyT.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    Tvisualization, 'ERA 5 - daily 2m temperature');

    Map.addLayer(ERA5dailyP.filterDate(selectedDate, selectedDate.advance(1, 'day')).filterBounds(setExtent),
    Pvisualization, 'ERA 5 - daily total precipitation');

  },
  style: { width: '180px' }
});
datePanel.add(dateSlider);

// Create authors information
var author = ui.Panel([
  ui.Label({
    value: 'Authors : Rollin Gimenez - Teodolina Lopez | please write to gimenez.rollin@gmail.com or teodolina.lopez@cerema.fr for suggestions.',
    style: { fontSize: '9px'}
  }),
]);
author.style().set('margin', '5% auto');

// Add it to the datePanel
datePanel.add(author);

// Add datePanel to the end of user interface (right part) 
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
    palette: Tvisualization.palette,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(Tvisualization.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(Tvisualization.min, {margin: '4px 8px'}), // vis min
    ui.Label(((Tvisualization.max-Tvisualization.min) / 2+Tvisualization.min), {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}), // (vis min + vis max)/2
    ui.Label(Tvisualization.max, {margin: '4px 8px'}) //vis max
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
  value: 'Air temperature (°C)',
  style: {fontWeight: 'bold', textAlign:'center', stretch: 'horizontal'}
});

// Add the legendPanel to the map.
var legendPanel = ui.Panel({
  widgets: [legendTitle, colorBar, legendLabels],
  style: {position: 'bottom-right'}
});
Map.add(legendPanel);


function makeColorBarParams2(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '100x10',
    format: 'png',
    min: 0,
    max: 1,
    palette: Pvisualization.palette,
  };
}

// Create the color bar for the legend.
var colorBar2 = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams2(Pvisualization.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels2 = ui.Panel({
  widgets: [
    ui.Label(Pvisualization.min, {margin: '4px 8px'}), // vis min
    ui.Label(((Pvisualization.max-Pvisualization.min) / 2+Pvisualization.min), {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}), // (vis min + vis max)/2
    ui.Label(Pvisualization.max, {margin: '4px 8px'}) //vis max
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle2 = ui.Label({
  value: 'Total precipitations (m)',
  style: {fontWeight: 'bold', textAlign:'center', stretch: 'horizontal'}
});

// Add the legendPanel to the map.
var legendPanel2 = ui.Panel({
  widgets: [legendTitle2, colorBar2, legendLabels2],
  style: {position: 'bottom-left'}
});
Map.add(legendPanel2);



