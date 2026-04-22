# SITS-Explorer 🌍

<p align="center">
  <img src="https://img.shields.io/badge/Earth_Observation-🌍-blue" />
  <img src="https://img.shields.io/badge/Remote_Sensing-🛰️-green"/> 
  <img src="https://img.shields.io/badge/Time_Series_Analysis-📈-purple" />
  <img src="https://img.shields.io/badge/Powered_by-Google_Earth_Engine-lightgreen" />
</p>

<p align="center">
Source code for the SITS-Explorer app, developed as part of a post-doctoral fellowship at CEREMA, on the SCO EO4Wetlands project.
The app is available at: https://ee-sitsexplorer.projects.earthengine.app/view/sits-explorer
</p>

## Overview

### Landing page

<img width="1852" height="962" alt="image" src="https://github.com/user-attachments/assets/85971271-caaf-4bd3-8db7-8080ccbe0fc0" />

### Select an index to explore

<img width="1852" height="962" alt="image" src="https://github.com/user-attachments/assets/e966a7f5-fb01-4d70-a55b-a1a56f9efa27" />

### Select a pixel/polygon to explore

<img width="1852" height="962" alt="image" src="https://github.com/user-attachments/assets/1ea56451-adf7-4115-a3cd-b54e31c39bdc" />

### Explore

Time charts corresponding to the values taken by the pixel or the average for the polygon are displayed on the left panel.
The right panel can be used to select the date displayed on the center panel. The layer button permits selection of the layers displayed.

<img width="1852" height="962" alt="image" src="https://github.com/user-attachments/assets/c5c7b0b6-63e8-46eb-bc34-37b18030d005" />

## Structure

### Overview

This project consists of a main launcher (`Launcher.js`) that provides access to various data explorers. Each explorer (`DEMExplorer.js`, `ERA5Explorer.js`, `EVIExplorer.js`, etc.) is designed to process and visualize specific types of datasets. The launcher serves as the central hub, allowing users to navigate between different explorers.

### Structure 

- **Launcher.js (Main Hub)** : The main entry point of the project. It provides links to the various data explorers.
- **Data Explorers** : Each explorer contains specific code to process and visualize different types of datasets. They can also link back to the main launcher.

Here's a simple diagram to illustrate the structure:
```
Launcher.js (Main Hub)
│
├── DEMExplorer.js (Digital Elevation Model Explorer)
├── ERA5Explorer.js (ERA5 Data Explorer)
├── EVIExplorer.js (Enhanced Vegetation Index Explorer)
├── GRACEExplorer.js (GRACE Data Explorer)
├── LSTExplorer.js (Land Surface Temperature Explorer)
├── NDVIExplorer.js (Normalized Difference Vegetation Index Explorer)
├── NDWIExplorer.js (Normalized Difference Water Index Explorer)
├── RGBExplorer.js (RGB Image Explorer)
├── SARExplorer.js (Synthetic Aperture Radar Explorer)
└── SSTExplorer.js (Sea Surface Temperature Explorer)
````

## Why This Structure?

- **Modularity** : Each explorer is independent and can be updated without affecting the others.
- **Reusability** : The similar code structure allows for easy maintenance and updates.
- **Flexibility** : The ability to navigate between different explorers provides a seamless user experience.

## EO4Wetlands

CNES/Cerema/Geomatys project aiming at monitoring wetlands using remote sensing.

- Project overview: https://www.spaceclimateobservatory.org/eo4wetlands
- Storymaps: https://cartagene.cerema.fr/portal/apps/storymaps/stories/37d978633b7548d6bd758bd65b50aaaf

## Acknowledgements

Thanks to Teodolina Lopez and CEREMA for their hospitality, assistance and support during my time working on the EO4Wetlands project. 
