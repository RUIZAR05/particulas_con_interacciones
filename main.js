import * as THREE from 'three';

// 1. ESCENA Y RENDER (Totalmente optimizado para el A55)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#bg'), antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2)); // Crucial para la AMOLED del Samsung
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 80;

// 2. CREACIÓN DE LA DOBLE HÉLICE DE ADN (Partículas)
const count = 3000; // Un poco menos para compensar las 2 manos
const geometry = new THREE.BufferGeometry();
const origPos = new Float32Array(count * 3); // Guardamos la posición original
const currPos = new Float32Array(count * 3); // Posición que animaremos
const colArray = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
    // Matemática de la Hélice
    const strand = i < count / 2 ? 1 : 2; // Dos hebras separadas
    const angle = (i % (count/2)) * 0.1; // Espiral
    const offset = strand === 1 ? 0 : Math.PI; // Intercaladas por 180 grados

    const x = 12 * Math.cos(angle + offset);
    const y = (i % (count/2)) * 0.8 - (count/4)*0.8; // Vertical
    const z = 12 * Math.sin(angle + offset);

    origPos[i*3] = x; origPos[i*3+1] = y; origPos[i*3+2] = z;
    currPos[i*3] = x; currPos[i*3+1] = y; currPos[i*3+2] = z;

    // Colores: Cyan y Magenta
    if (strand === 1) { colArray[i*3]=0; colArray[i*3+1]=0.9; colArray[i*3+2]=1; }
    else { colArray[i*3]=1; colArray[i*3+1]=0.1; colArray[i*3+2]=0.6; }
}
geometry.setAttribute('position', new THREE.BufferAttribute(currPos, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3));
const dnaMesh = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.6, vertexColors: true, transparent: true, opacity: 0.8 }));
scene.add(dnaMesh);

// 3. LÓGICA DE INTERACCIÓN (Two Hands + Fist Detection)
const handsState = [ { pos: new THREE.Vector3(), active: false }, { pos: new THREE.Vector3(), active: false } ];

function onResults(results) {
    // Reset hands status
    handsState[0].active = false; handsState[1].active = false;

    if (!results.multiHandLandmarks) return;

    for (let i = 0; i < results.multiHandLandmarks.length && i < 2; i++) {
        const landmarks = results.multiHandLandmarks[i];
        handsState[i].active = true;

        // Mapear posición central de la mano (Palm base)
        handsState[i].pos.set(
            (landmarks[0].x - 0.5) * -120, // X Spiegel
            (landmarks[0].y - 0.5) * -90,  
            landmarks[0].z * -100 // Profundidad
        );

        // --- GESTO: DETECCIÓN DE PUÑO CERRADO (Fist) ---
        // Comparamos distancia del Wrist (0) a la punta del índice (8)
        const wristToIndexTip = Math.sqrt(
            Math.pow(landmarks[0].x - landmarks[8].x, 2) +
            Math.pow(landmarks[0].y - landmarks[8].y, 2)
        );
        
        // Si la punta está muy cerca de la muñeca, consideramos puño cerrado
        handsState[i].fist = wristToIndexTip < 0.15;
    }
}

// 4. INICIO Y CÁMARA (MediaPipe Setup)
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 }); // modelComplexity 0 y maxHands 2
hands.onResults(onResults);

const cam = new Camera(document.getElementById('input_video'), {
    onFrame: async () => { await hands.send({ image: document.getElementById('input_video') }); },
    width: 480, height: 360 // Cámara low-res para performance
});

document.getElementById('start-btn').addEventListener('click', () => {
    cam.start().then(() => document.getElementById('overlay').style.display = 'none');
});

// 5. BUCLE DE ANIMACIÓN (Aquí ocurre la física del "Imán")
function animate() {
    requestAnimationFrame(animate);

    const positions = geometry.attributes.position.array;
    const lerpSpeed = 0.05; // Velocidad de suavizado

    for (let i = 0; i < count; i++) {
        const origVec = new THREE.Vector3(origPos[i*3], origPos[i*3+1], origPos[i*3+2]);
        const currVec = new THREE.Vector3(currPos[i*3], currPos[i*3+1], currPos[i*3+2]);
        let targetVec = origVec.clone();

        // Aplicamos fuerza de atracción para cada mano si está activa y en puño
        for (let h = 0; h < 2; h++) {
            if (handsState[h].active && handsState[h].fist) {
                // Si cerramos el puño, las partículas quieren ir a la mano
                // Hacemos un promedio de posición si ambas manos están en puño (complejo para móvil)
                // Usamos la primera mano que detecte puño
                targetVec = handsState[h].pos.clone();
                break; // Rompemos para priorizar la primera mano detectada en puño
            }
        }

        // Suavizamos la transición (Interpolación lineal)
        currVec.lerp(targetVec, lerpSpeed);
        
        positions[i*3] = currVec.x; positions[i*3+1] = currVec.y; positions[i*3+2] = currVec.z;
    }
    geometry.attributes.position.needsUpdate = true; // Actualizar GPU

    // Pequeña rotación constante del ADN
    dnaMesh.rotation.y += 0.003;

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();