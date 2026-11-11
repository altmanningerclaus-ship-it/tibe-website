/** Dunkler Kartenstil für Google Maps (Android). iOS nutzt userInterfaceStyle. */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2024' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa1ac' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2024' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a3f46' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c3036' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3f46' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a26' }] },
];
