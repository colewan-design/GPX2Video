// ── Vertex shader ────────────────────────────────────────────────────────────
const VERT = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  v_uv = a_uv;
}
`

// ── Fragment shader ───────────────────────────────────────────────────────────
// Operations (in order):
//   1. Unsharp mask   — 3×3 Gaussian blur at variable radius, then sharpen
//   2. Brightness     — simple multiply
//   3. Contrast       — pivot around 0.5
//   4. Saturation     — lerp to luminance
//   5. Sepia          — matrix blend
//   6. Hue shift      — RGB→HSL→RGB rotation
const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2      u_px;        // 1.0 / vec2(videoW, videoH)
uniform float     u_sharp;     // unsharp-mask strength  (0 = off)
uniform float     u_radius;    // kernel pixel radius (1 = fine, 3+ = clarity)
uniform float     u_bright;
uniform float     u_contrast;
uniform float     u_sat;
uniform float     u_sepia;
uniform float     u_hue;       // normalised 0-1 (not degrees)
varying vec2 v_uv;

// ── HSL helpers ──────────────────────────────────────────────────────────────
vec3 rgb2hsl(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float l  = (mx + mn) * 0.5;
  float s  = 0.0, h = 0.0;
  float d  = mx - mn;
  if (d > 0.0) {
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if      (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else                h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}
float h2rgb(float p, float q, float t) {
  t = fract(t);
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5)     return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}
vec3 hsl2rgb(vec3 hsl) {
  if (hsl.y == 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(h2rgb(p,q,hsl.x+1.0/3.0), h2rgb(p,q,hsl.x), h2rgb(p,q,hsl.x-1.0/3.0));
}

void main() {
  vec4 orig = texture2D(u_tex, v_uv);
  vec3 c    = orig.rgb;

  // 1. Unsharp mask (3×3 Gaussian, variable pixel radius)
  if (u_sharp > 0.0) {
    vec2 d = u_px * u_radius;
    vec3 blur =
      texture2D(u_tex, v_uv + vec2(-d.x,-d.y)).rgb * 0.0625 +
      texture2D(u_tex, v_uv + vec2( 0.0,-d.y)).rgb * 0.125  +
      texture2D(u_tex, v_uv + vec2( d.x,-d.y)).rgb * 0.0625 +
      texture2D(u_tex, v_uv + vec2(-d.x, 0.0)).rgb * 0.125  +
      c                                              * 0.25   +
      texture2D(u_tex, v_uv + vec2( d.x, 0.0)).rgb * 0.125  +
      texture2D(u_tex, v_uv + vec2(-d.x, d.y)).rgb * 0.0625 +
      texture2D(u_tex, v_uv + vec2( 0.0, d.y)).rgb * 0.125  +
      texture2D(u_tex, v_uv + vec2( d.x, d.y)).rgb * 0.0625;
    c = clamp(c + u_sharp * (c - blur), 0.0, 1.0);
  }

  // 2. Brightness
  c = clamp(c * u_bright, 0.0, 1.0);

  // 3. Contrast (pivot 0.5)
  c = clamp((c - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  // 4. Saturation
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = clamp(mix(vec3(lum), c, u_sat), 0.0, 1.0);

  // 5. Sepia
  if (u_sepia > 0.0) {
    vec3 sep = vec3(
      dot(c, vec3(0.393, 0.769, 0.189)),
      dot(c, vec3(0.349, 0.686, 0.168)),
      dot(c, vec3(0.272, 0.534, 0.131))
    );
    c = mix(c, clamp(sep, 0.0, 1.0), u_sepia);
  }

  // 6. Hue shift
  if (u_hue != 0.0) {
    vec3 hsl = rgb2hsl(c);
    hsl.x    = fract(hsl.x + u_hue);
    c        = clamp(hsl2rgb(hsl), 0.0, 1.0);
  }

  gl_FragColor = vec4(c, orig.a);
}
`

// ── GL helpers ────────────────────────────────────────────────────────────────
function compileShader(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[shader]', gl.getShaderInfoLog(s))
    gl.deleteShader(s); return null
  }
  return s
}

function createProgram(gl) {
  const vs = compileShader(gl, gl.VERTEX_SHADER,   VERT)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null
  const p = gl.createProgram()
  gl.attachShader(p, vs); gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[program]', gl.getProgramInfoLog(p)); return null
  }
  gl.deleteShader(vs); gl.deleteShader(fs)
  return p
}

// ── Cover-fit UV computation ──────────────────────────────────────────────────
// Mirrors CSS object-fit:cover in texture-coordinate space.
function coverUVs(vw, vh, cw, ch) {
  const vA = vw / vh, cA = cw / ch
  let sx = 1, sy = 1, ox = 0, oy = 0
  if (vA > cA) { sx = cA / vA; ox = (1 - sx) / 2 }
  else         { sy = vA / cA; oy = (1 - sy) / 2 }
  // WebGL UV: Y=0 is bottom → flip vertically
  const u0 = ox,      u1 = ox + sx
  const v0 = 1 - oy,  v1 = oy          // flipped
  return new Float32Array([
    u0,v0, u1,v0, u0,v1,
    u1,v0, u1,v1, u0,v1,
  ])
}

// ── Composable ────────────────────────────────────────────────────────────────
export function useVideoShader() {
  let gl = null, prog = null, tex = null
  let posBuf = null, uvBuf = null
  let rafId  = null
  let videoEl = null, canvasEl = null
  let uloc = {}
  let onContextLostCb = null

  function setup(canvas, video, { onContextLost } = {}) {
    canvasEl = canvas
    videoEl  = video
    onContextLostCb = onContextLost ?? null

    gl = canvas.getContext('webgl', { alpha: false, antialias: false })
    if (!gl) return false

    // Handle GPU context loss (e.g. Chrome reclaims context under memory pressure
    // from ONNX Runtime or too many concurrent WebGL contexts).
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()  // allow future restoration
      stopLoop()
      gl = prog = tex = posBuf = uvBuf = null
      uloc = {}
      onContextLostCb?.()
    })

    prog = createProgram(gl)
    if (!prog) return false

    gl.useProgram(prog)

    // Uniform locations
    uloc = {
      tex:      gl.getUniformLocation(prog, 'u_tex'),
      px:       gl.getUniformLocation(prog, 'u_px'),
      sharp:    gl.getUniformLocation(prog, 'u_sharp'),
      radius:   gl.getUniformLocation(prog, 'u_radius'),
      bright:   gl.getUniformLocation(prog, 'u_bright'),
      contrast: gl.getUniformLocation(prog, 'u_contrast'),
      sat:      gl.getUniformLocation(prog, 'u_sat'),
      sepia:    gl.getUniformLocation(prog, 'u_sepia'),
      hue:      gl.getUniformLocation(prog, 'u_hue'),
    }

    // Full-screen quad
    posBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,  1,-1,  -1, 1,
       1,-1,  1, 1,  -1, 1,
    ]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // UV buffer (updated on resize / video size change)
    uvBuf = gl.createBuffer()
    const aUV = gl.getAttribLocation(prog, 'a_uv')
    gl.enableVertexAttribArray(aUV)

    // Video texture
    tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.uniform1i(uloc.tex, 0)

    // Bind UV attrib once; data will be filled by updateUVs
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf)
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0)

    updateUVs()
    return true
  }

  function updateUVs() {
    if (!gl || !videoEl || !canvasEl) return
    const vw = videoEl.videoWidth  || canvasEl.width
    const vh = videoEl.videoHeight || canvasEl.height
    const cw = canvasEl.width  || 1
    const ch = canvasEl.height || 1
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf)
    gl.bufferData(gl.ARRAY_BUFFER, coverUVs(vw, vh, cw, ch), gl.DYNAMIC_DRAW)
  }

  function setFilter(params) {
    if (!gl || !prog) return
    gl.useProgram(prog)
    gl.uniform1f(uloc.sharp,    params.sharp    ?? 0)
    gl.uniform1f(uloc.radius,   params.radius   ?? 1)
    gl.uniform1f(uloc.bright,   params.bright   ?? 1)
    gl.uniform1f(uloc.contrast, params.contrast ?? 1)
    gl.uniform1f(uloc.sat,      params.sat      ?? 1)
    gl.uniform1f(uloc.sepia,    params.sepia    ?? 0)
    gl.uniform1f(uloc.hue,      params.hue      ?? 0)
    // px uniform: 1 pixel step in video texture space
    const vw = videoEl?.videoWidth  || 1920
    const vh = videoEl?.videoHeight || 1080
    gl.uniform2f(uloc.px, 1.0 / vw, 1.0 / vh)
  }

  function isContextOk() {
    return !!gl && !gl.isContextLost()
  }

  function renderFrame() {
    if (!gl || !videoEl || !prog || !canvasEl) return
    if (gl.isContextLost()) return
    gl.viewport(0, 0, canvasEl.width, canvasEl.height)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.finish()   // flush GPU before caller blits this canvas elsewhere
  }

  function startLoop() {
    stopLoop()
    // Prefer requestVideoFrameCallback so we only render on new frames
    if (videoEl && 'requestVideoFrameCallback' in videoEl) {
      const onFrame = () => {
        renderFrame()
        rafId = videoEl.requestVideoFrameCallback(onFrame)
      }
      rafId = videoEl.requestVideoFrameCallback(onFrame)
    } else {
      const loop = () => { renderFrame(); rafId = requestAnimationFrame(loop) }
      rafId = requestAnimationFrame(loop)
    }
  }

  function stopLoop() {
    if (rafId == null) return
    if (videoEl && 'cancelVideoFrameCallback' in videoEl) {
      videoEl.cancelVideoFrameCallback(rafId)
    } else {
      cancelAnimationFrame(rafId)
    }
    rafId = null
  }

  function resize(w, h) {
    if (!canvasEl) return
    canvasEl.width  = w
    canvasEl.height = h
    updateUVs()
  }

  function destroy() {
    stopLoop()
    if (gl) {
      if (tex)    gl.deleteTexture(tex)
      if (posBuf) gl.deleteBuffer(posBuf)
      if (uvBuf)  gl.deleteBuffer(uvBuf)
      if (prog)   gl.deleteProgram(prog)
    }
    gl = prog = tex = posBuf = uvBuf = null
    videoEl = canvasEl = null
    uloc = {}
  }

  return { setup, setFilter, updateUVs, startLoop, stopLoop, resize, renderFrame, isContextOk, destroy }
}
