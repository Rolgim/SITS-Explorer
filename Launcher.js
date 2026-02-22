// Author : R. Gimenez 

// ----------------------------------------------------------------------------------------
// Launcher used to choose the location and indices  --------------------------------------
// ----------------------------------------------------------------------------------------

// Create a panel to select an index
var selectorPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      position: 'top-center',
      textAlign: 'center',
      stretch: 'horizontal',
      width: '300px',
      padding: '8px',
      backgroundColor: 'rgba(255, 255, 255, 1)'
    }
  });
  
  // Text of the widget
  var title = ui.Label('Select to inspect', {
    fontWeight: 'bold',
    textAlign: 'center',
    stretch: 'horizontal',
    fontSize: '20px',
    margin: '0 0 0 0',
    backgroundColor: 'rgba(255, 255, 255, 1)'
  });
  // Add the text
  selectorPanel.add(title);
  
  // Create a list to select an index 
  // when an indew is selected
  var indicesSelect = ui.Select({
    items: ['Optical - RGB', 'Optical - NDVI', 'Optical - EVI', 'Optical - NDWI', 'Thermal - LST', 'Thermal - SST', 'RaDAR - SAR' ,'Gravity - GRACE' ,'Climate - ERA5', 'Topography - DEM', 'In Situ Data', 'Meteorological Data'],
    placeholder: 'Choose an index',
    onChange: function(selectedIndex) {
      if (selectedIndex) {
        // when an indew is selected - remove the selector panel
        // remove all widgets
        Map.remove(selectorPanel)
        Map.add(ui.Button('Reset', function () {
          Map.clear()
          Map.add(selectorPanel)
          var widgs = ui.root.widgets();
          widgs.forEach(function(widg){
            if (widg instanceof ui.Panel){
              ui.root.remove(widg);
            }
          indicesSelect.setValue(null);
          })
        }))
        // and redirect to the code corresponding to the selected index
        if (selectedIndex === 'Optical - RGB') {
          require('users/GimenezRollin/SITSExplorer:RGBExplorer');
        } else if (selectedIndex === 'Optical - NDVI') {
          require('users/GimenezRollin/SITSExplorer:NDVIExplorer');
        } else if (selectedIndex === 'Optical - EVI') {
          require('users/GimenezRollin/SITSExplorer:EVIExplorer');
        }  else if (selectedIndex=='Optical - NDWI') {
          require('users/GimenezRollin/SITSExplorer:NDWIExplorer'); 
        } else if (selectedIndex === 'Thermal - LST') {
          require('users/GimenezRollin/SITSExplorer:LSTExplorer');
        } else if (selectedIndex === 'Thermal - SST') {
          require('users/GimenezRollin/SITSExplorer:SSTExplorer');
        } else if (selectedIndex=='Topography - DEM') {
          require('users/GimenezRollin/SITSExplorer:DEMExplorer');
        } else if (selectedIndex=='RaDAR - SAR') {
          require('users/GimenezRollin/SITSExplorer:SARExplorer');
        } else if (selectedIndex=='Gravity - GRACE') {
          require('users/GimenezRollin/SITSExplorer:GRACEExplorer');
        }  else if (selectedIndex=='Climate - ERA5') {
          require('users/GimenezRollin/SITSExplorer:ERA5Explorer'); 
        }  else if (selectedIndex=='In Situ Data') {
          require('users/GimenezRollin/SITSExplorer:insituCharts'); 
        }  else if (selectedIndex=='Meteorological Data') {
          require('users/GimenezRollin/SITSExplorer:meteoCharts'); 
        } else {
          // if it is not defined - error
          ui.Label('Unavailable');
        }
      }
    },
    style: {width: '95%', stretch: 'horizontal', position: 'bottom-center'}
    
  });
  selectorPanel.add(indicesSelect);
  
  // Center in SCO EO4 Wetlands Station
  var lat = 51.35721239192727;
  var lon = 4.216592031847348;
  
  Map.setCenter(lon, lat, 12.3);
  
  // Add the selector panel to the user interface
  Map.add(selectorPanel);
  
  
  
  