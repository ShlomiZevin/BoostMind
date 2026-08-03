import { useState, useRef, useEffect, useCallback } from 'react'
import { Icon } from './Icons.jsx'
import { loadModels, detectFace } from '../lib/faceEngine.js'
import { analyzeHumility } from '../lib/scoring.js'
import { drawOverlay } from '../lib/draw.js'
import Result from './Result.jsx'

const BASE = import.meta.env.BASE_URL

const STEPS = [
  'Locating facial region…',
  'Mapping 68 anatomical landmarks…',
  'Reading micro-expression channels…',
  'Measuring chin-elevation vector…',
  'Computing ego saturation…',
  'Cross-referencing Humility Neural Layer™…',
  'Finalizing your Humblo Score™…',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default function Analyzer({ onPricing, below }) {
  const [phase, setPhase] = useState('idle') // idle | analyzing | result | noface | error
  const [logIdx, setLogIdx] = useState(0)
  const [imgUrl, setImgUrl] = useState(null)
  const [payload, setPayload] = useState(null) // {det, analysis}
  const [drag, setDrag] = useState(false)
  const [cam, setCam] = useState(false)

  const imgRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const reset = useCallback(() => {
    setPhase('idle'); setPayload(null); setLogIdx(0)
    if (imgUrl) URL.revokeObjectURL(imgUrl)
    setImgUrl(null)
  }, [imgUrl])

  const stopCam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCam(false)
  }, [])

  useEffect(() => () => stopCam(), [stopCam])

  // load an image URL and kick off analysis once it's decoded
  const analyzeUrl = useCallback(async (url) => {
    setImgUrl(url)
    setPhase('analyzing')
    setLogIdx(0)
    const img = new Image()
    img.onload = async () => {
      imgRef.current = img
      const t0 = performance.now()
      let i = 0
      const iv = setInterval(() => { i = Math.min(i + 1, STEPS.length - 1); setLogIdx(i) }, 620)
      try {
        await loadModels()
        const det = await detectFace(img)
        const elapsed = performance.now() - t0
        if (elapsed < 3600) await sleep(3600 - elapsed)
        clearInterval(iv)
        if (!det) { setPhase('noface'); return }
        const analysis = analyzeHumility(det)
        setPayload({ det, analysis })
        setPhase('result')
      } catch (e) {
        clearInterval(iv)
        console.error(e)
        setPhase('error')
      }
    }
    img.onerror = () => setPhase('error')
    img.src = url
  }, [])

  const onFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    stopCam()
    analyzeUrl(URL.createObjectURL(file))
  }, [analyzeUrl, stopCam])

  // draw overlay once we have a result
  useEffect(() => {
    if (phase === 'result' && payload && canvasRef.current && imgRef.current) {
      drawOverlay(canvasRef.current, imgRef.current, payload.det, payload.analysis.notes, 1)
    }
  }, [phase, payload])

  // ---- webcam ----
  const startCam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 720, height: 720 } })
      streamRef.current = stream
      setCam(true)
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() } }, 50)
    } catch (e) {
      alert('Could not access the camera. Try uploading a photo instead.')
    }
  }, [])

  const capture = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    stopCam()
    c.toBlob((blob) => analyzeUrl(URL.createObjectURL(blob)), 'image/jpeg', 0.92)
  }, [analyzeUrl, stopCam])

  // ================= render =================
  if (phase === 'result' && payload) {
    return (
      <Result
        analysis={payload.analysis}
        imgUrl={imgUrl}
        canvasRef={canvasRef}
        onPricing={onPricing}
        onRetry={reset}
      />
    )
  }

  return (
    <section className="tool">
      <div className="appcol">
        {phase === 'idle' && !cam && (
          <div className="tool-head fade-in">
            <img className="tool-mascot" src={BASE + 'behumble.jpg'} alt="Humblo" />
            <div className="tool-kicker">Be humble.</div>
            <h1>How humble is your face?</h1>
            <p>Upload a photo, get your Humblo Score™ in seconds. 100% private.</p>
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="fade-in">
            <div className="stage">
              <img className="stage-src" src={imgUrl} alt="analyzing" />
              <div className="scanline" />
            </div>
            <div className="analyzing-bar">
              <div className="spinner" />
              <div className="analyzing-log"><b>{STEPS[logIdx]}</b></div>
            </div>
          </div>
        )}

        {cam && (
          <div className="fade-in cam-wrap">
            <div className="cam-stage">
              <video ref={videoRef} className="cam-video" playsInline muted style={{ transform: 'scaleX(-1)' }} />
              <div className="scanline" />
              <div className="cam-guide" />
            </div>
            <div className="cam-hint">Line up your face inside the circle</div>
            <div className="dz-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-lg" onClick={capture}><Icon.Camera />Capture &amp; analyze</button>
              <button className="btn btn-ghost btn-lg" onClick={stopCam}>Cancel</button>
            </div>
          </div>
        )}

        {phase === 'idle' && !cam && (
          <div
            className={'dropzone' + (drag ? ' drag' : '')}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]) }}
          >
            <div className="dropzone-ico"><Icon.Upload /></div>
            <h3>Drop a photo here</h3>
            <p>PNG or JPG · analyzed locally, never uploaded</p>
            <div className="dz-actions">
              <button className="btn btn-primary btn-lg" onClick={() => fileRef.current.click()}><Icon.Upload width="18" height="18" />Choose photo</button>
              <button className="btn btn-ghost btn-lg" onClick={startCam}><Icon.Camera />Use camera</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
            <div className="dz-privacy"><Icon.Shield />100% on-device · your face stays in the browser</div>
          </div>
        )}

        {phase === 'idle' && !cam && below}

        {phase === 'noface' && (
          <div className="dropzone fade-in">
            <div className="dropzone-ico"><Icon.Scan /></div>
            <h3>No face detected</h3>
            <p>Ironically, that may be the most humble result possible. Try a clearer, front-facing photo.</p>
            <div className="dz-actions">
              <button className="btn btn-primary btn-lg" onClick={reset}><Icon.Refresh />Try another photo</button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="dropzone fade-in">
            <div className="dropzone-ico"><Icon.Scan /></div>
            <h3>Something went wrong</h3>
            <p>The Humility Neural Layer™ had a moment of self-doubt. Please try again.</p>
            <div className="dz-actions">
              <button className="btn btn-primary btn-lg" onClick={reset}><Icon.Refresh />Restart</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
