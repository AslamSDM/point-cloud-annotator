/**
 * Point Cloud Annotator - Main Application
 *
 * This application uses Potree to display a 3D point cloud and
 * allows users to create, edit, and delete annotations.
 */

// Global state
let viewer = null;
let annotations = new Map();
let currentAnnotation = null;
let isEditMode = false;

// DOM elements
let loadingEl, sidebarEl, toggleSidebarBtn, showSidebarBtn;
let annotationListEl, annotationCountEl, annotationModal;
let annotationTextEl, byteCountEl, modalTitleEl;
let saveBtn, cancelBtn, closeModalX, deleteBtn, statusMessageEl;
let btnGrid, btnAxes, btnViewTop, btnViewFront, btnViewLeft, btnFit;

// Helpers
let gridHelper = null;
let axesHelper = null;
let byteCountDebounceTimer = null;

/**
 * Initialize DOM references
 */
function initDOMReferences() {
  loadingEl = document.getElementById('loading');
  sidebarEl = document.getElementById('sidebar');
  toggleSidebarBtn = document.getElementById('toggle-sidebar');
  showSidebarBtn = document.getElementById('show-sidebar-btn');
  annotationListEl = document.getElementById('annotation-list');
  annotationCountEl = document.getElementById('annotation-count');
  annotationModal = document.getElementById('annotation-modal');
  annotationTextEl = document.getElementById('annotation-text');
  byteCountEl = document.getElementById('byte-count');
  modalTitleEl = document.getElementById('modal-title');
  saveBtn = document.getElementById('save-annotation');
  cancelBtn = document.getElementById('cancel-annotation');
  closeModalX = document.getElementById('close-modal-x');
  deleteBtn = document.getElementById('delete-annotation');
  statusMessageEl = document.getElementById('status-message');
  btnGrid = document.getElementById('btn-grid');
  btnAxes = document.getElementById('btn-axes');
  btnViewTop = document.getElementById('btn-view-top');
  btnViewFront = document.getElementById('btn-view-front');
  btnViewLeft = document.getElementById('btn-view-left');
  btnFit = document.getElementById('btn-fit');
}

/**
 * Initialize the application
 */
async function init() {
  initDOMReferences();

  try {
    await initPotreeViewer();
    initHelpers();
    await loadAnnotations();
    setupEventListeners();
    setupAnnotationClickHandler();

    // Hide loading
    loadingEl.style.opacity = '0';
    setTimeout(() => {
      loadingEl.classList.add('hidden');
    }, 500);

    showStatus('Point cloud loaded successfully!', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    showStatus('Failed to initialize: ' + error.message, 'error');
    const safeMessage = escapeHtml(error.message);
    loadingEl.innerHTML = `
      <div class="loader-content">
        <p style="color: #ef4444;">Failed to load point cloud</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">${safeMessage}</p>
      </div>
    `;
  }
}

/**
 * Initialize Potree viewer
 */
async function initPotreeViewer() {
  return new Promise((resolve, reject) => {
    try {
      viewer = new Potree.Viewer(document.getElementById('potree_render_area'));

      viewer.setEDLEnabled(true);
      viewer.setFOV(60);
      viewer.setPointBudget(1_000_000);
      viewer.setMinNodeSize(30);
      viewer.setBackground("gradient");

      Potree.loadPointCloud(CONFIG.POINT_CLOUD_URL + 'cloud.js', 'lion', (e) => {
        if (e.pointcloud) {
          const pointcloud = e.pointcloud;
          const material = pointcloud.material;

          material.size = 1;
          material.pointSizeType = Potree.PointSizeType.ADAPTIVE;
          material.shape = Potree.PointShape.CIRCLE;

          viewer.scene.addPointCloud(pointcloud);
          viewer.fitToScreen();

          console.log('Point cloud loaded successfully');
          resolve();
        } else {
          reject(new Error('Failed to load point cloud'));
        }
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Initialize 3D Helpers
 */
function initHelpers() {
  if (!viewer) return;

  gridHelper = new THREE.GridHelper(CONFIG.GRID_SIZE, CONFIG.GRID_DIVISIONS, 0x444444, 0x222222);
  gridHelper.rotation.x = Math.PI / 2;
  gridHelper.visible = false;
  viewer.scene.scene.add(gridHelper);

  axesHelper = new THREE.AxesHelper(CONFIG.AXES_SIZE);
  axesHelper.visible = false;
  viewer.scene.scene.add(axesHelper);
}

/**
 * Set up click handler for creating annotations using Potree's picking
 */
function setupAnnotationClickHandler() {
  const renderArea = document.getElementById('potree_render_area');

  renderArea.addEventListener('dblclick', (event) => {
    // Get mouse position relative to the render area
    const rect = renderArea.getBoundingClientRect();
    const mouse = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Use Potree's point cloud intersection
    const camera = viewer.scene.getActiveCamera();
    const pointclouds = viewer.scene.pointclouds;

    const intersection = Potree.Utils.getMousePointCloudIntersection(
      mouse,
      camera,
      viewer,
      pointclouds,
      { pickClipped: true }
    );

    if (intersection) {
      const position = intersection.location;
      console.log('Picked point:', position);

      // Store camera position for navigation
      const cameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      };

      openAnnotationModal(null, position, cameraPosition);
    } else {
      console.log('No intersection found');
      showStatus('Click directly on the point cloud to add annotation', 'error');
    }
  });
}

/**
 * Load annotations from backend
 */
async function loadAnnotations() {
  try {
    const savedAnnotations = await annotationAPI.getAnnotations();
    for (const annotation of savedAnnotations) {
      addAnnotationToViewer(annotation);
    }
    updateAnnotationList();
  } catch (error) {
    console.error('Error loading annotations:', error);
    showStatus('Could not load saved annotations. Backend may be offline.', 'error');
  }
}

/**
 * Add an annotation to the Potree viewer
 */
function addAnnotationToViewer(annotation) {
  annotations.set(annotation.id, annotation);

  const position = new THREE.Vector3(
    annotation.position.x,
    annotation.position.y,
    annotation.position.z
  );

  const potreeAnnotation = new Potree.Annotation({
    position: position,
    title: annotation.text || 'Annotation',
    cameraPosition: annotation.cameraPosition
      ? new THREE.Vector3(
          annotation.cameraPosition.x,
          annotation.cameraPosition.y,
          annotation.cameraPosition.z
        )
      : null,
    cameraTarget: position
  });

  potreeAnnotation.userData = { id: annotation.id };

  // Click handler using Potree's event system
  potreeAnnotation.addEventListener('click', () => {
    openAnnotationModal(annotation);
  });

  viewer.scene.annotations.add(potreeAnnotation);
  annotation.potreeAnnotation = potreeAnnotation;
}

/**
 * Remove annotation from viewer
 */
function removeAnnotationFromViewer(annotationId) {
  const annotation = annotations.get(annotationId);
  if (annotation && annotation.potreeAnnotation) {
    viewer.scene.annotations.remove(annotation.potreeAnnotation);
  }
  annotations.delete(annotationId);
}

/**
 * Update annotation list in sidebar
 */
function updateAnnotationList() {
  annotationListEl.innerHTML = '';
  annotationCountEl.textContent = annotations.size;

  if (annotations.size === 0) {
    annotationListEl.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 20px; color: var(--text-secondary);">
        <p>No annotations yet.</p>
      </div>
    `;
    return;
  }

  const sortedAnnotations = Array.from(annotations.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  for (const annotation of sortedAnnotations) {
    const item = document.createElement('div');
    item.className = 'annotation-item';

    const textPreview = (annotation.text || 'No text').substring(0, 50) +
      (annotation.text && annotation.text.length > 50 ? '...' : '');

    item.innerHTML = `
      <div class="annotation-text">${escapeHtml(textPreview)}</div>
      <div class="annotation-meta">
        <span>${formatDate(annotation.createdAt)}</span>
      </div>
      <div class="annotation-actions">
        <button class="btn-small goto" data-id="${annotation.id}">View</button>
        <button class="btn-small edit" data-id="${annotation.id}">Edit</button>
        <button class="btn-small delete" data-id="${annotation.id}">Delete</button>
      </div>
    `;

    item.querySelector('.goto').addEventListener('click', (e) => {
      e.stopPropagation();
      goToAnnotation(annotation);
    });

    item.querySelector('.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openAnnotationModal(annotation);
    });

    item.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAnnotation(annotation.id);
    });

    item.addEventListener('click', () => goToAnnotation(annotation));

    annotationListEl.appendChild(item);
  }
}

/**
 * Navigate to annotation
 */
function goToAnnotation(annotation) {
  if (annotation.potreeAnnotation) {
    annotation.potreeAnnotation.moveHere(viewer.scene.getActiveCamera());
  } else {
    const position = new THREE.Vector3(
      annotation.position.x,
      annotation.position.y,
      annotation.position.z
    );
    viewer.scene.view.position.copy(position.clone().add(new THREE.Vector3(5, 5, 5)));
    viewer.scene.view.lookAt(position);
  }
}

/**
 * Open annotation modal
 */
function openAnnotationModal(annotation, position = null, cameraPosition = null) {
  if (annotation) {
    isEditMode = true;
    currentAnnotation = annotation;
    modalTitleEl.textContent = 'Edit Note';
    annotationTextEl.value = annotation.text || '';
    deleteBtn.classList.remove('hidden');
  } else {
    isEditMode = false;
    currentAnnotation = {
      position: { x: position.x, y: position.y, z: position.z },
      cameraPosition: cameraPosition
    };
    modalTitleEl.textContent = 'New Observation';
    annotationTextEl.value = '';
    deleteBtn.classList.add('hidden');
  }

  updateByteCount();
  annotationModal.classList.remove('hidden');
  annotationTextEl.focus();
}

/**
 * Close annotation modal
 */
function closeAnnotationModal() {
  annotationModal.classList.add('hidden');
  currentAnnotation = null;
  isEditMode = false;
  annotationTextEl.value = '';
}

/**
 * Save annotation
 */
async function saveAnnotation() {
  const text = annotationTextEl.value.trim();

  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > CONFIG.MAX_TEXT_BYTES) {
    showStatus(`Text exceeds ${CONFIG.MAX_TEXT_BYTES} bytes limit`, 'error');
    return;
  }

  try {
    if (isEditMode && currentAnnotation.id) {
      const updated = await annotationAPI.updateAnnotation(currentAnnotation.id, { text });
      const existing = annotations.get(currentAnnotation.id);
      
      // Create new object instead of mutating existing
      const updatedAnnotation = {
        ...existing,
        text: text,
        updatedAt: updated.updatedAt
      };
      annotations.set(currentAnnotation.id, updatedAnnotation);

      if (updatedAnnotation.potreeAnnotation) {
        updatedAnnotation.potreeAnnotation.title = text || 'Annotation';
      }

      showStatus('Note updated', 'success');
    } else {
      const newAnnotation = await annotationAPI.createAnnotation({
        position: currentAnnotation.position,
        text: text,
        cameraPosition: currentAnnotation.cameraPosition,
        cameraTarget: currentAnnotation.position
      });

      addAnnotationToViewer(newAnnotation);
      showStatus('Note saved', 'success');
    }

    updateAnnotationList();
    closeAnnotationModal();
  } catch (error) {
    console.error('Error saving annotation:', error);
    showStatus('Failed to save: ' + error.message, 'error');
  }
}

/**
 * Delete annotation
 */
async function deleteAnnotation(annotationId) {
  const id = annotationId || (currentAnnotation && currentAnnotation.id);
  if (!id) return;

  if (!confirm('Delete this note?')) return;

  try {
    await annotationAPI.deleteAnnotation(id);
    removeAnnotationFromViewer(id);
    updateAnnotationList();
    closeAnnotationModal();
    showStatus('Note deleted', 'success');
  } catch (error) {
    console.error('Error deleting:', error);
    showStatus('Failed to delete: ' + error.message, 'error');
  }
}

/**
 * Update byte counter
 */
function updateByteCount() {
  const text = annotationTextEl.value;
  const byteLength = new TextEncoder().encode(text).length;
  byteCountEl.textContent = byteLength;

  if (byteLength > CONFIG.MAX_TEXT_BYTES) {
    byteCountEl.style.color = 'var(--danger)';
  } else {
    byteCountEl.style.color = 'var(--text-secondary)';
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Sidebar
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebarEl.classList.add('closed');
      showSidebarBtn.classList.remove('hidden');
    });
  }

  if (showSidebarBtn) {
    showSidebarBtn.addEventListener('click', () => {
      sidebarEl.classList.remove('closed');
      showSidebarBtn.classList.add('hidden');
    });
  }

  // Toolbar
  if (btnGrid) {
    btnGrid.addEventListener('click', () => {
      if (gridHelper) {
        gridHelper.visible = !gridHelper.visible;
        btnGrid.classList.toggle('active', gridHelper.visible);
      }
    });
  }

  if (btnAxes) {
    btnAxes.addEventListener('click', () => {
      if (axesHelper) {
        axesHelper.visible = !axesHelper.visible;
        btnAxes.classList.toggle('active', axesHelper.visible);
      }
    });
  }

  if (btnViewTop) {
    btnViewTop.addEventListener('click', () => {
      viewer.scene.view.setView([0, 0, CONFIG.CAMERA_DISTANCE], [0, 0, 0]);
      viewer.fitToScreen();
    });
  }

  if (btnViewFront) {
    btnViewFront.addEventListener('click', () => {
      viewer.scene.view.setView([0, -CONFIG.CAMERA_DISTANCE, 5], [0, 0, 5]);
      viewer.fitToScreen();
    });
  }

  if (btnViewLeft) {
    btnViewLeft.addEventListener('click', () => {
      viewer.scene.view.setView([-CONFIG.CAMERA_DISTANCE, 0, 5], [0, 0, 5]);
      viewer.fitToScreen();
    });
  }

  if (btnFit) {
    btnFit.addEventListener('click', () => {
      viewer.fitToScreen();
    });
  }

  // Modal
  if (saveBtn) saveBtn.addEventListener('click', saveAnnotation);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAnnotationModal);
  if (closeModalX) closeModalX.addEventListener('click', closeAnnotationModal);
  if (deleteBtn) deleteBtn.addEventListener('click', () => deleteAnnotation());

  if (annotationTextEl) {
    annotationTextEl.addEventListener('input', () => {
      // Debounce byte count updates for performance
      clearTimeout(byteCountDebounceTimer);
      byteCountDebounceTimer = setTimeout(updateByteCount, 100);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && annotationModal && !annotationModal.classList.contains('hidden')) {
      closeAnnotationModal();
    }
  });

  if (annotationModal) {
    annotationModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        closeAnnotationModal();
      }
    });
  }
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  if (!statusMessageEl) return;
  statusMessageEl.textContent = message;
  statusMessageEl.className = `status-toast ${type}`;
  statusMessageEl.classList.remove('hidden');

  setTimeout(() => {
    statusMessageEl.classList.add('hidden');
  }, CONFIG.STATUS_MESSAGE_DURATION);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
