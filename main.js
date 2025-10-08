let scene, camera, renderer;
let controller1, controllerGrip1;

// Inicializar la escena
function init() {
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Configurar cámara
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
    
    // Configurar renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        canvas: document.createElement('canvas')  // Asegura que se cree un nuevo canvas
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Configurar el canal alfa para el renderizado AR
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.autoClear = false;  // Importante para el modo AR

    // Añadir luz
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Añadir un cubo de prueba
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, -0.5);
    scene.add(cube);

    // Configurar WebXR
    if ('xr' in navigator) {
        // Verificar soporte de WebXR
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                console.log('WebXR AR está soportado');
                document.getElementById('enter-ar').style.display = 'block';
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
            requiredFeatures: ['local', 'hit-test'],  // Cambiado a requiredFeatures
            optionalFeatures: ['dom-overlay']  // Opcional, para el overlay del DOM
        });
        
        console.log('Sesión AR iniciada');
        
        // Habilitar el fondo de la cámara
        session.updateRenderState({
            baseLayer: new XRWebGLLayer(session, renderer.getContext())
        });
        
        renderer.xr.setReferenceSpaceType('local');
        renderer.xr.setSession(session);
        
        // Iniciar el bucle de renderizado
        renderer.setAnimationLoop(render);
        
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
    renderer.clearDepth();  // Limpiar solo el buffer de profundidad
    renderer.render(scene, camera);
}

// Inicializar la escena cuando el documento esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}