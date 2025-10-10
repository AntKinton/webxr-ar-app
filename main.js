let scene, camera, renderer, controller, reticle;
let placedObjects = [];
let xrSession = null;
let xrReferenceSpace = null;

// Configuración seleccionada
let selectedShape = 'cube';
let selectedColor = 0x00ff00;

// Inicializar la escena
function init() {
  // Crear escena
  scene = new THREE.Scene();

  // Configurar cámara
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    10
  );

  // Configurar renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Agregar renderer al DOM
  document.body.appendChild(renderer.domElement);

  // Configurar luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Crear retícula mejorada
  const reticleGeometry = new THREE.RingGeometry(0.05, 0.08, 32).rotateX(-Math.PI / 2);
  const reticleMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  });
  reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
  reticle.visible = false;
  scene.add(reticle);

  // Verificar soporte de WebXR
  checkXRSupport();

  // Event listeners para los controles
  setupControlListeners();

  // Redimensionado
  window.addEventListener("resize", onWindowResize, false);
}

function checkXRSupport() {
  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-ar')
      .then((supported) => {
        const button = document.getElementById("enter-ar");
        if (supported) {
          console.log("WebXR AR soportado");
          button.style.display = "block";
          button.textContent = "INICIAR REALIDAD AUMENTADA";
        } else {
          console.log("WebXR AR NO soportado");
          button.style.display = "block";
          button.textContent = "AR NO DISPONIBLE";
          button.disabled = true;
        }
      })
      .catch(console.error);
  } else {
    const button = document.getElementById("enter-ar");
    button.style.display = "block";
    button.textContent = "WEBXR NO SOPORTADO";
    button.disabled = true;
    alert("WebXR no está soportado en este navegador. Prueba con Chrome en Android.");
  }
}

function setupControlListeners() {
  // Botones de forma
  document.querySelectorAll('.shape-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedShape = e.target.dataset.shape;
      console.log("Forma seleccionada:", selectedShape);
    });
  });

  // Botones de color
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedColor = parseInt(e.target.dataset.color);
      console.log("Color seleccionado:", selectedColor.toString(16));
    });
  });

  // Botón de borrar todos
  document.getElementById('clear-all').addEventListener('click', () => {
    clearAllObjects();
  });

  // Botón para entrar en AR
  document.getElementById("enter-ar").addEventListener("click", onStartAR);
}

function clearAllObjects() {
  placedObjects.forEach(obj => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(material => material.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  placedObjects = [];
  updateInstructions('Todos los objetos eliminados');
  setTimeout(() => {
    updateInstructions('Toca la pantalla para colocar objetos');
  }, 2000);
}

function updateInstructions(text) {
  const instructionText = document.getElementById('instruction-text');
  if (instructionText) {
    instructionText.textContent = text;
  }
}

async function onStartAR() {
  try {
    console.log("Solicitando sesión AR...");
    document.getElementById('enter-ar').style.display = 'none';

    // Solicitar sesión AR con características mínimas
    xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local'], // Característica más básica
      optionalFeatures: ['hit-test', 'dom-overlay'],
      domOverlay: { root: document.body }
    });

    console.log("Sesión AR iniciada, configurando renderer...");

    // Configurar el renderer para XR
    await renderer.xr.setSession(xrSession);

    // Obtener espacio de referencia básico
    xrReferenceSpace = await xrSession.requestReferenceSpace('local');
    console.log("Espacio de referencia obtenido:", xrReferenceSpace);

    // Configurar controlador
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Inicializar hit-test si está disponible
    initializeHitTest();

    // Iniciar bucle de renderizado
    renderer.setAnimationLoop(onXRFrame);
    
    // Mostrar UI
    document.getElementById('controls').classList.remove('hidden');
    document.getElementById('instructions').classList.remove('hidden');
    updateInstructions('Mueve el dispositivo para detectar superficies');
    
    console.log("AR completamente inicializado");

  } catch (error) {
    console.error("Error crítico al iniciar AR:", error);
    alert("No se pudo iniciar la realidad aumentada: " + error.message);
    document.getElementById('enter-ar').style.display = 'block';
  }
}

async function initializeHitTest() {
  if (!xrSession) return;

  try {
    // Intentar obtener hit-test source
    const viewerSpace = await xrSession.requestReferenceSpace('viewer');
    const hitTestSource = await xrSession.requestHitTestSource({ 
      space: viewerSpace 
    });
    
    console.log("Hit-test inicializado correctamente");
    
    // Guardar para usar en el frame loop
    xrSession.hitTestSource = hitTestSource;
    
  } catch (error) {
    console.warn("Hit-test no disponible:", error);
    updateInstructions('Modo básico: Toca para colocar objetos frente a ti');
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createObject(shape, color) {
  let geometry;
  
  switch(shape) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.1, 16, 16);
      break;
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 16);
      break;
    case 'cube':
    default:
      geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      break;
  }
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.3,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

function onSelect() {
  if (reticle.visible) {
    placeObjectAtReticle();
  } else {
    // Si no hay retícula visible, colocar objeto frente al usuario
    placeObjectInFront();
  }
}

function placeObjectAtReticle() {
  const newObject = createObject(selectedShape, selectedColor);
  newObject.position.copy(reticle.position);
  newObject.quaternion.copy(reticle.quaternion);
  scene.add(newObject);
  placedObjects.push(newObject);
  animateObjectAppearance(newObject);
  
  updateInstructions(`${getShapeName(selectedShape)} colocado. Total: ${placedObjects.length}`);
}

function placeObjectInFront() {
  const newObject = createObject(selectedShape, selectedColor);
  
  // Colocar objeto 1 metro frente a la cámara
  const camera = renderer.xr.getCamera();
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  newObject.position.copy(camera.position);
  newObject.position.add(direction.multiplyScalar(1));
  
  scene.add(newObject);
  placedObjects.push(newObject);
  animateObjectAppearance(newObject);
  
  updateInstructions(`${getShapeName(selectedShape)} colocado frente a ti. Total: ${placedObjects.length}`);
}

function getShapeName(shape) {
  const names = {
    'cube': 'Cubo',
    'sphere': 'Esfera', 
    'cylinder': 'Cilindro'
  };
  return names[shape] || 'Objeto';
}

function animateObjectAppearance(object) {
  const startScale = 0.01;
  const endScale = 1.0;
  const duration = 300;
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const scale = startScale + (endScale - startScale) * eased;
    
    object.scale.set(scale, scale, scale);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  animate();
}

function onXRFrame(time, frame) {
  if (!frame || !xrSession) return;
  
  // Intentar hit-test si está disponible
  if (xrSession.hitTestSource) {
    const hitTestResults = frame.getHitTestResults(xrSession.hitTestSource);
    
    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(xrReferenceSpace);
      
      if (pose) {
        reticle.visible = true;
        reticle.position.setFromMatrixPosition(pose.transform.matrix);
        reticle.updateMatrix();
      }
    } else {
      reticle.visible = false;
    }
  } else {
    // Sin hit-test, mantener retícula oculta
    reticle.visible = false;
  }
  
  renderer.render(scene, camera);
}

// Inicializar cuando esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}