/**
 * API client for Point Cloud Annotator
 * Handles all communication with the backend (local or AWS Lambda)
 */

class AnnotationAPI {
  constructor() {
    this.baseUrl = getApiEndpoint();
  }

  /**
   * Update the base URL (useful when switching between local and AWS)
   */
  updateBaseUrl() {
    this.baseUrl = getApiEndpoint();
  }

  /**
   * Fetch all annotations from the backend
   * @returns {Promise<Array>} Array of annotation objects
   */
  async getAnnotations() {
    try {
      const response = await fetch(`${this.baseUrl}/annotations`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching annotations:', error);
      throw error;
    }
  }

  /**
   * Create a new annotation
   * @param {Object} annotation - The annotation data
   * @param {Object} annotation.position - 3D position {x, y, z}
   * @param {string} annotation.text - Annotation text (max 256 bytes)
   * @param {Object} [annotation.cameraPosition] - Camera position for navigation
   * @param {Object} [annotation.cameraTarget] - Camera target for navigation
   * @returns {Promise<Object>} The created annotation with ID
   */
  async createAnnotation(annotation) {
    try {
      const response = await fetch(`${this.baseUrl}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(annotation)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating annotation:', error);
      throw error;
    }
  }

  /**
   * Update an existing annotation
   * @param {string} id - The annotation ID
   * @param {Object} updates - The fields to update
   * @param {string} [updates.text] - New annotation text
   * @returns {Promise<Object>} The updated annotation
   */
  async updateAnnotation(id, updates) {
    try {
      const response = await fetch(`${this.baseUrl}/annotations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating annotation:', error);
      throw error;
    }
  }

  /**
   * Delete an annotation
   * @param {string} id - The annotation ID
   * @returns {Promise<void>}
   */
  async deleteAnnotation(id) {
    try {
      const response = await fetch(`${this.baseUrl}/annotations/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok && response.status !== 204) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting annotation:', error);
      throw error;
    }
  }

  /**
   * Check if the API is reachable
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Create global instance
window.annotationAPI = new AnnotationAPI();
