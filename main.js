let scene, camera, renderer;

// Inicializar la escena
function init() {
    // Crear escena
    scene = new THREE.Scene();

    // Configurar cámara
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);

    // Configurar renderer (sin crear canvas manualmente)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Añadir luz
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Añadir un cubo de prueba
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, -0.5);
    scene.add(cube);

    // Configurar soporte de WebXR
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            const button = document.getElementById('enter-ar');
            if (supported) {
                console.log('WebXR AR está soportado');
                button.style.display = 'block';
            } else {
                console.log('WebXR AR no está soportado');
                alert('La realidad aumentada no está soportada en este dispositivo');
            }
        });
    } else {
        console.log('WebXR no está disponible');
        alert('WebXR no está disponible en este navegador');
    }

    // Configurar el botón
    const button = document.getElementById('enter-ar');
    button.addEventListener('click', onStartAR);

    // Manejar redimensionado de ventana
    window.addEventListener('resize', onWindowResize, false);
}

async function onStartAR() {
    console.log('Iniciando sesión AR...');
    try {
        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['local', 'hit-test']
        });

        renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(session);

        // Three.js manejará automáticamente el fondo de cámara AR
        renderer.setAnimationLoop(render);

        console.log('Sesión AR iniciada');
    } catch (error) {
        console.error('Error al iniciar AR:', error);
        alert('Error al iniciar AR: ' + error.message);
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

// Inicializar la escena cuando el documento esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
