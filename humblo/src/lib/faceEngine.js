import * as faceapi from '@vladmandic/face-api'

const MODEL_URL = import.meta.env.BASE_URL + 'models'
let loaded = false

export async function loadModels() {
  if (loaded) return
  // The bundled TF.js prioritises the 'wasm' backend, which needs external .wasm
  // binaries we don't ship. Force WebGL (fast, GPU) with a CPU fallback.
  const tf = faceapi.tf
  try {
    if (!(await tf.setBackend('webgl'))) await tf.setBackend('cpu')
  } catch {
    await tf.setBackend('cpu')
  }
  await tf.ready()
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
  ])
  loaded = true
}

/**
 * Runs the full detection pipeline on an <img> element.
 * Returns null when no face is found.
 */
export async function detectFace(imgEl) {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 })
  const result = await faceapi
    .detectSingleFace(imgEl, options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender()
  return result || null
}

// Convenience: pull the raw landmark points as {x,y}
export function positions(landmarks) {
  return landmarks.positions.map((p) => ({ x: p.x, y: p.y }))
}
