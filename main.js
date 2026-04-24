import * as THREE from 'three';

// 1. ESCENA Y RENDER
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#bg'), antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 80;

// 2. ADN DE PARTÍCULAS (Simplificado para probar)
const count = 2000; 
const geometry = new THREE.BufferGeometry();
const origPos = new Float32Array(count * 3); 
const currPos = new Float32Array(count * 3); 

for (let i = 0; i < count; i++) {
    const angle = i * 0.1;
    const x = 10 * Math.cos(angle);
    const y = i * 0.5 - 50;
    const z = 10 * Math.sin(angle);
    origPos[i*3] = x; origPos[i*3+1] = y; origPos[i*3+2] = z;
    currPos[i*3] = x; currPos[i*3+1] = y; currPos[i*3+2] = z;
}
geometry.setAttribute('position', new THREE.BufferAttribute(currPos, 3));
const dnaMesh = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.6, color: 0x00f2ff }));
scene.add(dnaMesh);

// 3. ESQUELETO VISUAL
const handVertices = new Float32Array(42 * 3);
const handGeometry = new THREE.BufferGeometry();
handGeometry.setAttribute('position', new THREE.BufferAttribute(handVertices, 3));
const handMesh = new THREE.Points(handGeometry, new THREE.PointsMaterial({ size: 2, color: 0x00ff00, depthTest: false }));
scene.add(handMesh);

// 4. ESTADO DE LAS MANOS
let handsState = [{ pos: new THREE.Vector3(), active: false, fist: false }, { pos: new THREE.Vector3(), active: false, fist: false }];

function onResults(results) {
    handVertices.fill(0);
    if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((landmarks, hIdx) => {
            if (hIdx > 1) return;
            handsState[hIdx].active = true;
            for (let i = 0; i < 21; i++) {
                const idx = (hIdx * 21 + i) * 3;
                handVertices[idx] = (landmarks[i].x - 0.5) * -120;
                handVertices[idx+1] = (landmarks[i].y - 0.5) * -90;
                handVertices[idx+2] = landmarks[i].z * -40;
            }
            // Detección simple de puño
            const dist = Math.abs(landmarks[8].y - landmarks[0].y);
            handsState[hIdx].fist = dist < 0.2; 
        });
    }
    handGeometry.attributes.position.needsUpdate = true;
}

// 5. INICIALIZACIÓN SEGURA
try {
    const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.5 });
    hands.onResults(onResults);

    const videoElement = document.getElementById('input_video');
    const cam = new Camera(videoElement, {
        onFrame: async () => { await hands.send({ image: videoElement }); },
        width: 480, height: 360
    });

    document.getElementById('start-btn').addEventListener('click', () => {
        cam.start()
            .then(() => {
                document.getElementById('overlay').style.display = 'none';
                console.log("Cámara OK");
            })
            .catch(err => alert("Error Cámara: " + err));
    });
} catch (e) {
    alert("Error de MediaPipe: " + e.message);
}

// 6. ANIMACIÓN
function animate() {
    requestAnimationFrame(animate);
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < count; i++) {
        let tx = origPos[i*3], ty = origPos[i*3+1], tz = origPos[i*3+2];
        for (let h = 0; h < 2; h++) {
            if (handsState[h].active && handsState[h].fist) {
                tx = (handVertices[h*63]) ; // Posición de la muñeca
                ty = (handVertices[h*63+1]);
                tz = (handVertices[h*63+2]);
            }
        }
        posAttr.array[i*3] += (tx - posAttr.array[i*3]) * 0.1;
        posAttr.array[i*3+1] += (ty - posAttr.array[i*3+1]) * 0.1;
        posAttr.array[i*3+2] += (tz - posAttr.array[i*3+2]) * 0.1;
    }
    posAttr.needsUpdate = true;
    dnaMesh.rotation.y += 0.01;
    renderer.render(scene, camera);
}
animate();