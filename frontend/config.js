/**
 * Configuration for Point Cloud Annotator
 *
 * For local development, set USE_LOCAL_API to true.
 * For production with AWS Lambda, set USE_LOCAL_API to false
 * and update AWS_API_ENDPOINT with your API Gateway URL.
 */

const CONFIG = {
  // Set to true to use local Express server, false for AWS Lambda
  USE_LOCAL_API: false,

  // Local development API endpoint
  LOCAL_API_ENDPOINT: 'http://localhost:3001',

  // AWS API Gateway endpoint (update after deploying with SAM)
  AWS_API_ENDPOINT: 'https://6f5pi0039b.execute-api.us-east-1.amazonaws.com/prod',

  // Default point cloud URL
  POINT_CLOUD_URL: 'libs/potree/pointclouds/lion_takanawa/',

  // Available point clouds for gallery
  AVAILABLE_POINT_CLOUDS: [
    { name: 'Lion Takanawa', path: 'libs/potree/pointclouds/lion_takanawa/' },
    { name: 'Vol Total', path: 'libs/potree/pointclouds/vol_total/' },
    { name: 'Lion (LAS)', path: 'libs/potree/pointclouds/lion_takanawa_las/' },
    { name: 'Lion (LAZ)', path: 'libs/potree/pointclouds/lion_takanawa_laz/' },
    { name: 'Lion (Normals)', path: 'libs/potree/pointclouds/lion_takanawa_normals/' }
  ],

  // Maximum annotation text length in bytes
  MAX_TEXT_BYTES: 256,

  // Annotation marker color
  ANNOTATION_COLOR: [0.29, 0.56, 0.85], // RGB normalized (4a90d9)

  // Auto-hide status messages after this many milliseconds
  STATUS_MESSAGE_DURATION: 3000,

  // Grid helper configuration
  GRID_SIZE: 20,
  GRID_DIVISIONS: 20,

  // Axes helper size
  AXES_SIZE: 5,

  // Camera distance for preset views
  CAMERA_DISTANCE: 20
};

// Get the active API endpoint based on configuration
function getApiEndpoint() {
  return CONFIG.USE_LOCAL_API ? CONFIG.LOCAL_API_ENDPOINT : CONFIG.AWS_API_ENDPOINT;
}

// Export for use in other modules
window.CONFIG = CONFIG;
window.getApiEndpoint = getApiEndpoint;
