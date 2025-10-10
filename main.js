let scene, camera, renderer, controller, reticle, hitTestSource = null;
let cube = null;
let xrSession = null;

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

  // Crear cubo (inicialmente oculto)
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    roughness: 0.5,
    metalness: 0.5,
  });
  cube = new THREE.Mesh(geometry, material);
  cube.visible = false;
  scene.add(cube);

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

  // Redimensionado
  window.addEventListener("resize", onWindowResize, false);
}

async function onStartAR() {
  try {
    console.log("Iniciando sesión AR...");
    document.getElementById('enter-ar').style.display = 'none';

    // Ensure WebGL context is XR compatible
    await renderer.getContext().makeXRCompatible();

    xrSession = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ['viewer', 'local', 'hit-test'],
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

    // Configurar el espacio de referencia
    const referenceSpace = await xrSession.requestReferenceSpace('local');
    xrSession.depthUsage = 'cpu-optimized';
    
    // Inicializar hit test source
    const viewerSpace = await xrSession.requestReferenceSpace('viewer');
    hitTestSource = await xrSession.requestHitTestSource({
      space: viewerSpace,
      entityTypes: ['plane', 'mesh']
    });

    // Configurar el controlador
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Iniciar el bucle de renderizado
    renderer.xr.setReferenceSpace(referenceSpace);
    renderer.xr.setSession(xrSession);
    renderer.setAnimationLoop(onXRFrame);
    
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

function onSelect() {
  if (reticle.visible && !cube.visible) {
    cube.position.copy(reticle.position);
    cube.quaternion.copy(reticle.quaternion);
    cube.visible = true;
  }
}

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
    } else {
      reticle.visible = false;
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