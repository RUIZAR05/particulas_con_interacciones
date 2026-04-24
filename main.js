import * as THREE from 'three';

// 1. ESCENA Y RENDER (Optimizado para Samsung A55)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#bg'), antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 80;

// 2. ADN DE PARTÍCULAS
const count = 3000; 
const geometry = new THREE.BufferGeometry();
const origPos = new Float32Array(count * 3); 
const currPos = new Float32Array(count * 3); 
const colArray = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
    const strand = i < count / 2 ? 1 : 2;
    const angle = (i % (count/2)) * 0.1;
    const offset = strand === 1 ? 0 : Math.PI;
    const x = 12 * Math.cos(angle + offset);
    const y = (i % (count/2)) * 0.8 - (count/4)*0.8;
    const z = 12 * Math.sin(angle + offset);
    origPos[i*3] = x; origPos[i*3+1] = y; origPos[i*3+2] = z;
    currPos[i*3] = x; currPos[i*3+1] = y; currPos[i*3+2] = z;
    if (strand === 1) { colArray[i*3]=0; colArray[i*3+1]=0.9; colArray[i*3+2]=1; }
    else { colArray[i*3]=1; colArray[i*3+1]=0.1; colArray[i*3+2]=0.6; }
}
geometry.setAttribute('position', new THREE.BufferAttribute(currPos, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3));
const dnaMesh = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.6, vertexColors: true, transparent: true, opacity: 0.8 }));
scene.add(dnaMesh);

// 3. ESQUELETO VISUAL (Soporta 2 manos = 42 puntos)
const handGeometry = new THREE.BufferGeometry();
const handVertices = new Float32Array(42 * 3); // 21 puntos * 2 manos
handGeometry.setAttribute('position', new THREE.BufferAttribute(handVertices, 3));
// Usamos un material que ignore la profundidad para que siempre se vea al frente
const handMaterial = new THREE.PointsMaterial({ size: 1.5, color: 0x00ff00, depthTest: false }); 
const handMesh = new THREE.Points(handGeometry, handMaterial);
scene.add(handMesh);

// 4. LÓGICA DE INTERACCIÓN
let handsState = [
    { pos: new THREE.Vector3(), active: false, fist: false },
    { pos: new THREE.Vector3(), active: false, fist: false }
];

function onResults(results) {
    // Limpiar posiciones del esqueleto
    handVertices.fill(0);
    handsState[0].active = false; handsState[1].active = false;

    if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            if (handIndex > 1) return; // Solo 2 manos
            
            handsState[handIndex].active = true;
            
            // Actualizar los 21 puntos para el dibujo en pantalla
            for (let i = 0; i < 21; i++) {
                const idx = (handIndex * 21 + i) * 3;
                handVertices[idx] = (landmarks[i].x - 0.5) * -120;
                handVertices[idx + 1] = (landmarks[i].y - 0.5) * -90;
                handVertices[idx + 2] = landmarks[i].z * -40;
            }

            // Guardar posición de la palma para el imán
            handsState[handIndex].pos.set(
                (landmarks[0].x - 0.5) * -120,
                (landmarks[0].y - 0.5) * -90,
                landmarks[0].z * -100
            );

            // Detección de puño: Distancia Muñeca(0) a Punta Índice(8)
            const dist = Math.sqrt(
                Math.pow(landmarks[0].x - landmarks[8].x, 2) +
                Math.pow(landmarks[0].y - landmarks[8].y, 2)
            );
            handsState[handIndex].fist = dist < 0.12;
        });
    }
    handGeometry.attributes.position.needsUpdate = true;
    
    // Cambio de color visual si hay un puño cerrado (Feedback)
    handMaterial.color.setHex( (handsState[0].fist || handsState[1].fist) ? 0xff0000 : 0x00ff00 );
}

// 5. CONFIGURACIÓN MEDIAPIPE (Usa las globales del HTML)
const hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.5 });
hands.onResults(onResults);

const cam = new window.Camera(document.getElementById('input_video'), {
    onFrame: async () => { await hands.send({ image: document.getElementById('input_video') }); },
    width: 480, height: 360
});

document.getElementById('start-btn').addEventListener('click', () => {
    cam.start().then(() => {
        document.getElementById('overlay').style.display = 'none';
        console.log("IA de manos lista");
    });
});

// 6. ANIMACIÓN (Física de partículas)
function animate() {
    requestAnimationFrame(animate);
    const posAttr = geometry.attributes.position;
    
    for (let i = 0; i < count; i++) {
        let tx = origPos[i*3], ty = origPos[i*3+1], tz = origPos[i*3+2];

        // Si una mano tiene puño, esa posición se convierte en el objetivo
        for (let h = 0; h < 2; h++) {
            if (handsState[h].active && handsState[h].fist) {
                tx = handsState[h].pos.x; ty = handsState[h].pos.y; tz = handsState[h].pos.z;
                break; 
            }
        }

        // Suavizado (Lerp)
        posAttr.array[i*3] += (tx - posAttr.array[i*3]) * 0.08;
        posAttr.array[i*3+1] += (ty - posAttr.array[i*3+1]) * 0.08;
        posAttr.array[i*3+2] += (tz - posAttr.array[i*3+2]) * 0.08;
    }
    posAttr.needsUpdate = true;
    dnaMesh.rotation.y += 0.005;
    renderer.render(scene, camera);
}
animate();