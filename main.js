let scene, camera, renderer, controller, reticle, hitTestSource = null;
let placedObjects = []; // Array para múltiples objetos
let xrSession = null;

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

  // Agregar renderer al DOM **antes** de makeXRCompatible
  document.body.appendChild(renderer.domElement);

  // Marcar contexto como XR compatible
  renderer
    .getContext()
    .makeXRCompatible()
    .then(() => {
      console.log("Contexto WebGL listo para XR");
    });

  // Configurar luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Crear retícula para indicar superficie detectada
  const reticleGeometry = new THREE.RingGeometry(0.1, 0.11, 24).rotateX(-Math.PI / 2);
  const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Verificar soporte de WebXR
  if ("xr" in navigator) {
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      const button = document.getElementById("enter-ar");
      if (supported) {
        console.log("WebXR AR soportado");
        button.style.display = "block";
      } else {
        console.log("WebXR AR NO soportado");
        alert("La realidad aumentada no está soportada en este dispositivo");
      }
    });
  }

  // Botón para entrar en AR
  const button = document.getElementById("enter-ar");
  button.addEventListener("click", onStartAR);

  // Event listeners para los controles
  setupControlListeners();

  // Redimensionado
  window.addEventListener("resize", onWindowResize, false);
}

function setupControlListeners() {
  // Botones de forma
  document.querySelectorAll('.shape-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedShape = e.target.dataset.shape;
    });
  });

  // Botones de color
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedColor = parseInt(e.target.dataset.color);
    });
  });

  // Botón de borrar todos
  document.getElementById('clear-all').addEventListener('click', () => {
    clearAllObjects();
  });
}

function clearAllObjects() {
  placedObjects.forEach(obj => {
    scene.remove(obj);
    obj.geometry.dispose();
    obj.material.dispose();
  });
  placedObjects = [];
  updateInstructions('Todos los objetos eliminados. Toca para colocar nuevos objetos');
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
    console.log("Iniciando sesión AR...");
    document.getElementById('enter-ar').style.display = 'none';

    // Ensure WebGL context is XR compatible
    await renderer.getContext().makeXRCompatible();

    xrSession = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.body }
    });

    // Configurar la capa de renderizado WebXR
    const gl = renderer.getContext();
    await gl.makeXRCompatible();
    
    xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(xrSession, gl, {
        alpha: true,
        antialias: true,
        depth: true,
        stencil: false,
        framebufferScaleFactor: 1.0
      })
    });

    // Configurar el espacio de referencia con múltiples fallbacks
    let referenceSpace;
    const referenceSpaceTypes = ['local-floor', 'local', 'viewer', 'unbounded'];
    
    for (const type of referenceSpaceTypes) {
      try {
        referenceSpace = await xrSession.requestReferenceSpace(type);
        console.log(`Using reference space: ${type}`);
        break;
      } catch (e) {
        console.log(`${type} reference space not supported`);
      }
    }
    
    if (!referenceSpace) {
      throw new Error('No compatible reference space found');
    }
    
    // Inicializar hit test source
    hitTestSource = await xrSession.requestHitTestSource({
      space: referenceSpace
    });

    // Configurar el controlador
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Iniciar el bucle de renderizado
    await renderer.xr.setSession(xrSession);
    renderer.setAnimationLoop(onXRFrame);
    
    // Mostrar controles e instrucciones
    document.getElementById('controls').classList.remove('hidden');
    document.getElementById('instructions').classList.remove('hidden');
    updateInstructions('Mueve el dispositivo para detectar superficies');
    
    console.log("Sesión AR iniciada");
  } catch (err) {
    console.error("Error al iniciar AR:", err);
    alert("Error al iniciar AR: " + err.message);
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
      geometry = new THREE.SphereGeometry(0.1, 32, 32);
      break;
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32);
      break;
    case 'cube':
    default:
      geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      break;
  }
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.5,
    metalness: 0.5,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

function onSelect() {
  if (reticle.visible) {
    // Crear nuevo objeto con la forma y color seleccionados
    const newObject = createObject(selectedShape, selectedColor);
    newObject.position.copy(reticle.position);
    newObject.quaternion.copy(reticle.quaternion);
    
    // Añadir animación de aparición
    newObject.scale.set(0.01, 0.01, 0.01);
    scene.add(newObject);
    placedObjects.push(newObject);
    
    // Animar la aparición
    animateObjectAppearance(newObject);
    
    // Actualizar instrucciones
    updateInstructions(`${selectedShape === 'cube' ? 'Cubo' : selectedShape === 'sphere' ? 'Esfera' : 'Cilindro'} colocado. Total: ${placedObjects.length}`);
    setTimeout(() => {
      updateInstructions('Toca la pantalla para colocar más objetos');
    }, 2000);
  }
}

function animateObjectAppearance(object) {
  const startScale = 0.01;
  const endScale = 1.0;
  const duration = 300; // ms
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-out)
    const eased = 1 - Math.pow(1 - progress, 3);
    const scale = startScale + (endScale - startScale) * eased;
    
    object.scale.set(scale, scale, scale);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  animate();
}

let surfaceDetected = false;

function onXRFrame(time, frame) {
  if (!xrSession) return;
  
  const referenceSpace = renderer.xr.getReferenceSpace();
  const session = renderer.xr.getSession();
  
  if (hitTestSource && frame) {
    const hitTestResults = frame.getHitTestResults(hitTestSource);
    
    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(referenceSpace);
      
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      
      // Actualizar instrucciones cuando se detecta superficie por primera vez
      if (!surfaceDetected) {
        surfaceDetected = true;
        updateInstructions('Superficie detectada. Toca la pantalla para colocar objetos');
      }
    } else {
      reticle.visible = false;
      if (surfaceDetected) {
        surfaceDetected = false;
        updateInstructions('Buscando superficies...');
      }
    }
  }
  
  renderer.render(scene, camera);
}

// Inicializar cuando el documento esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}