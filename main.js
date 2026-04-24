import * as THREE from 'three';

// 1. ESCENA Y RENDER (Optimizado para Samsung A55)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#bg'), antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 60;

// 2. FIGURA DE PARTÍCULAS
const count = 4000; // Bajamos a 4000 para que el A55 vuele
const geometry = new THREE.BufferGeometry();
const posArray = new Float32Array(count * 3);
const colArray = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    posArray[i*3] = 16 * Math.pow(Math.sin(t), 3);
    posArray[i*3+1] = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    posArray[i*3+2] = (Math.random() - 0.5) * 10;
    colArray[i*3] = 0; colArray[i*3+1] = 0.9; colArray[i*3+2] = 1;
}
geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3));
const heart = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.8 }));
scene.add(heart);

// 3. ESQUELETO DE LA MANO (Puntos verdes)
const handGeometry = new THREE.BufferGeometry();
const handVertices = new Float32Array(21 * 3);
handGeometry.setAttribute('position', new THREE.BufferAttribute(handVertices, 3));
const handMesh = new THREE.Points(handGeometry, new THREE.PointsMaterial({ color: 0x00ff00, size: 1.2, depthTest: false }));
scene.add(handMesh);

// 4. LÓGICA DE INTERACCIÓN
let targetScale = 1, targetZ = 0, handRotX = 0, handRotY = 0;

function onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        handMesh.visible = false; return;
    }
    handMesh.visible = true;
    const landmarks = results.multiHandLandmarks[0];

    // Actualizar esqueleto
    for (let i = 0; i < 21; i++) {
        handVertices[i*3] = (landmarks[i].x - 0.5) * -70;
        handVertices[i*3+1] = (landmarks[i].y - 0.5) * -50;
        handVertices[i*3+2] = landmarks[i].z * -40;
    }
    handGeometry.attributes.position.needsUpdate = true;

    // Pellizco (Pinch) -> Distancia Pulgar (4) a Índice (8)
    const dx = landmarks[4].x - landmarks[8].x;
    const dy = landmarks[4].y - landmarks[8].y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    targetScale = THREE.MathUtils.clamp(dist * 5, 0.5, 3.0);

    // Rotación y Zoom
    handRotY = (landmarks[8].x - 0.5) * -4;
    handRotX = (landmarks[8].y - 0.5) * -4;
    targetZ = THREE.MathUtils.mapLinear(landmarks[0].z, -0.15, 0.1, -20, 40);
}

// 5. INICIO Y CÁMARA
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5 });
hands.onResults(onResults);

const cam = new Camera(document.getElementById('input_video'), {
    onFrame: async () => { await hands.send({ image: document.getElementById('input_video') }); },
    width: 480, height: 360
});

document.getElementById('start-btn').addEventListener('click', () => {
    cam.start().then(() => document.getElementById('overlay').style.display = 'none');
});

function animate() {
    requestAnimationFrame(animate);
    heart.rotation.y += (handRotY - heart.rotation.y) * 0.1;
    heart.rotation.x += (handRotX - heart.rotation.x) * 0.1;
    heart.scale.set(targetScale, targetScale, targetScale);
    heart.position.z += (targetZ - heart.position.z) * 0.1;
    renderer.render(scene, camera);
}
animate();
