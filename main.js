let scene, camera, renderer;

// Inicializar la escena
function init() {
    // Crear escena
    scene = new THREE.Scene();

    // Configurar cámara
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);

    // Configurar renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    // Agregar renderer al DOM **antes** de makeXRCompatible
    document.body.appendChild(renderer.domElement);

    // Marcar contexto como XR compatible
    renderer.getContext().makeXRCompatible().then(() => {
        console.log("Contexto WebGL listo para XR");
    });

    // Añadir luz
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Cubo de prueba
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, -0.5);
    scene.add(cube);

    // Verificar soporte de WebXR
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            const button = document.getElementById('enter-ar');
            if (supported) {
                console.log('WebXR AR soportado');
                button.style.display = 'block';
            } else {
                console.log('WebXR AR NO soportado');
                alert('La realidad aumentada no está soportada en este dispositivo');
            }
        });
    }

    // Botón para entrar en AR
    const button = document.getElementById('enter-ar');
    button.addEventListener('click', onStartAR);

    // Redimensionado
    window.addEventListener('resize', onWindowResize, false);
}

async function onStartAR() {
    try {
        console.log("Iniciando sesión AR...");

        // Ensure WebGL context is XR compatible
        await renderer.getContext().makeXRCompatible();

        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['local', 'hit-test']
        });

        // Create and configure WebGL layer for WebXR
        const gl = renderer.getContext();
        const xrLayer = new XRWebGLLayer(session, gl, {
            alpha: true,
            antialias: false,
            depth: true,
            stencil: false
        });
        
        // Update session with the WebGL layer
        await session.updateRenderState({
            baseLayer: xrLayer
        });

        renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(session);

        renderer.setAnimationLoop(render);
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

function render() {
    renderer.render(scene, camera);
}

// Inicializar cuando el documento esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
