/* ===================== DIMORA 3D ENGINE (WebGL2, zero-dependency) ===================== */
const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const M4 = {
  id() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
    }
    return o;
  },
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  ortho(l, r, b, t, n, f) { const o = M4.id(); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); return o; },
  lookAt(e, c, u) {
    const z = V3.norm(V3.sub(e, c)); let x = V3.cross(u, z);
    if (V3.len(x) < 1e-6) x = V3.cross([0, 0, 1], z);
    x = V3.norm(x); const y = V3.cross(z, x);
    const o = new Float32Array(16);
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[12] = -V3.dot(x, e);
    o[1] = y[0]; o[5] = y[1]; o[9] = y[2]; o[13] = -V3.dot(y, e);
    o[2] = z[0]; o[6] = z[1]; o[10] = z[2]; o[14] = -V3.dot(z, e);
    o[15] = 1; return o;
  },
  // T * Ry * Rx * Rz * S(1,sy,1)
  trs(tx, ty, tz, ry = 0, sy = 1, rx = 0, rz = 0) {
    let m = M4.id();
    m[12] = tx; m[13] = ty; m[14] = tz;
    if (ry) { const c = Math.cos(ry), s = Math.sin(ry), r = M4.id(); r[0] = c; r[2] = -s; r[8] = s; r[10] = c; m = M4.mul(m, r); }
    if (rx) { const c = Math.cos(rx), s = Math.sin(rx), r = M4.id(); r[5] = c; r[6] = s; r[9] = -s; r[10] = c; m = M4.mul(m, r); }
    if (rz) { const c = Math.cos(rz), s = Math.sin(rz), r = M4.id(); r[0] = c; r[1] = s; r[4] = -s; r[5] = c; m = M4.mul(m, r); }
    if (sy !== 1) { const r = M4.id(); r[5] = sy; m = M4.mul(m, r); }
    return m;
  },
};
function hexToRgb(h) {
  h = (h || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join(''); }

const VS_MAIN = `#version 300 es
in vec3 aPos; in vec3 aNor;
uniform mat4 uModel, uVP, uLVP;
out vec3 vW; out vec3 vN; out vec4 vL;
void main(){ vec4 w = uModel*vec4(aPos,1.0); vW=w.xyz; vN=mat3(uModel)*aNor; vL=uLVP*w; gl_Position=uVP*w; }`;
const FS_MAIN = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec4 vL;
uniform vec3 uColor, uColor2, uEmissive, uSunDir, uSunCol, uSky, uGround, uCam, uFogCol;
uniform float uAlpha, uPatScale, uAmb, uFog, uHL;
uniform int uPattern, uShadowOn, uNL;
uniform sampler2D uShadow;
uniform vec3 uLP[16]; uniform vec3 uLC[16]; uniform float uLR[16];
out vec4 outColor;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
float shadowF(vec3 N){
  if(uShadowOn==0) return 1.0;
  vec3 p = vL.xyz/vL.w*0.5+0.5;
  if(p.z>1.0||p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0) return 1.0;
  float bias = max(0.0025*(1.0-dot(N,uSunDir)), 0.0008);
  vec2 ts = 1.0/vec2(textureSize(uShadow,0)); float s=0.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++){ float d=texture(uShadow,p.xy+vec2(x,y)*ts).r; s += (p.z-bias>d)?0.0:1.0; }
  return s/9.0;
}
void main(){
  vec3 N = normalize(vN); if(!gl_FrontFacing) N=-N;
  vec3 base = uColor; vec3 c2 = uColor2;
  vec2 uv = (abs(N.y)>0.5) ? vW.xz : vec2(vW.x+vW.z, vW.y);
  uv /= max(uPatScale,0.001);
  if(uPattern==1){ // wood planks
    float row=floor(uv.y); float along=uv.x+h21(vec2(row,7.0))*6.0; float seg=floor(along/6.0);
    float t=h21(vec2(row,seg)); base*=0.82+0.3*t;
    float grain=fbm(vec2(along*0.6, uv.y*14.0)+t*10.0); base*=0.88+0.22*grain;
    float fy=fract(uv.y), fx=fract(along/6.0);
    if(fy<0.035||fy>0.985||fx<0.004) base*=0.62;
  } else if(uPattern==2){ // tiles
    vec2 g=fract(uv); float e=min(min(g.x,1.0-g.x),min(g.y,1.0-g.y));
    base*=0.94+0.08*h21(floor(uv)); base*=0.96+0.06*fbm(uv*3.0);
    if(e<0.018) base=c2;
  } else if(uPattern==3){ // marble
    float n=fbm(uv*1.6); float v=abs(sin(uv.x*2.2+uv.y*1.3+n*7.0));
    base=mix(c2, base, smoothstep(0.0,0.12,v)); base*=0.97+0.05*fbm(uv*9.0);
    vec2 g=fract(uv*0.5); float e=min(min(g.x,1.0-g.x),min(g.y,1.0-g.y)); if(e<0.004) base*=0.9;
  } else if(uPattern==4){ // carpet
    base*=0.9+0.2*h21(floor(vW.xz*160.0)); base*=0.93+0.1*fbm(vW.xz*6.0);
  } else if(uPattern==5){ // herringbone-ish
    vec2 cell=floor(uv); vec2 f=fract(uv); float k=mod(cell.x+cell.y,2.0);
    float l = k<0.5? f.x: f.y; float stripe=floor(l*3.0);
    base*=0.84+0.28*h21(cell*3.1+stripe); if(fract(l*3.0)<0.06) base*=0.65;
    if(min(min(f.x,1.0-f.x),min(f.y,1.0-f.y))<0.02) base*=0.7;
  } else if(uPattern==6){ // kota / stone
    vec2 g=fract(uv); float e=min(min(g.x,1.0-g.x),min(g.y,1.0-g.y));
    base=mix(base, c2, fbm(uv*2.5+h21(floor(uv))*7.0)*0.7);
    if(e<0.01) base*=0.7;
  } else if(uPattern==7){ // stripes / wallpaper
    float s=step(0.5, fract(uv.x)); base=mix(base, c2, s*0.55);
  } else if(uPattern==8){ // concrete
    base*=0.86+0.22*fbm(uv*1.5); base*=0.95+0.08*h21(floor(vW.xz*90.0));
  }
  vec3 albedo = lin(base);
  float hemi = N.y*0.5+0.5;
  vec3 col = albedo*mix(lin(uGround), lin(uSky), hemi)*uAmb;
  float nl = max(dot(N,uSunDir),0.0);
  float sh = nl>0.0 ? shadowF(N) : 1.0;
  col += albedo*uSunCol*nl*sh;
  for(int i=0;i<16;i++){ if(i>=uNL) break;
    vec3 L=uLP[i]-vW; float d=length(L); float att=clamp(1.0-d/uLR[i],0.0,1.0); att*=att;
    col += albedo*uLC[i]*(0.35+0.65*max(dot(N,L/max(d,0.001)),0.0))*att;
  }
  col += lin(uEmissive);
  col += vec3(uHL)*vec3(1.0,0.75,0.35)*0.35;
  float dist=length(vW-uCam); float fog=1.0-exp(-pow(dist*uFog,2.0));
  col = mix(col, lin(uFogCol), clamp(fog,0.0,1.0));
  col = col/(col+vec3(0.75))*1.55;
  outColor = vec4(pow(col, vec3(1.0/2.2)), uAlpha);
}`;
const VS_DEPTH = `#version 300 es
in vec3 aPos; uniform mat4 uModel, uLVP; void main(){ gl_Position = uLVP*uModel*vec4(aPos,1.0); }`;
const FS_DEPTH = `#version 300 es
precision mediump float; out vec4 o; void main(){ o=vec4(1.0); }`;

class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.fixed = !!opts.fixed;
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    this.geoCache = new Map();
    this.groups = new Map();
    this.lights = [];
    this.env = { sunDir: V3.norm([0.4, 0.8, 0.3]), sunCol: [2.2, 2.05, 1.85], sky: '#cfdde6', ground: '#8a7f70', amb: 0.9, clear: '#0b0f19', fog: 0.012, shadows: true };
    this.bounds = { c: [0, 0, 0], r: 15 };
    this.cam = { pos: [10, 12, 14], target: [0, 0, 0], fov: 50 * Math.PI / 180, near: 0.05, far: 400 };
    this.progMain = this._prog(VS_MAIN, FS_MAIN);
    this.progDepth = this._prog(VS_DEPTH, FS_DEPTH);
    this.uMain = this._uniforms(this.progMain, ['uModel', 'uVP', 'uLVP', 'uColor', 'uColor2', 'uEmissive', 'uSunDir', 'uSunCol', 'uSky', 'uGround', 'uCam', 'uFogCol', 'uAlpha', 'uPatScale', 'uAmb', 'uFog', 'uHL', 'uPattern', 'uShadowOn', 'uNL', 'uShadow', 'uLP[0]', 'uLC[0]', 'uLR[0]']);
    this.uDepth = this._uniforms(this.progDepth, ['uModel', 'uLVP']);
    this.shadowSize = 2048;
    this._initShadow();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    this.dirty = true;
  }
  _prog(vs, fs) {
    const gl = this.gl;
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNor');
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  _uniforms(p, names) { const o = {}; names.forEach(n => o[n.replace('[0]', '')] = this.gl.getUniformLocation(p, n)); return o; }
  _initShadow() {
    const gl = this.gl, s = this.shadowSize;
    this.shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, s, s, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  _upload(pos, nor) {
    const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const data = new Float32Array(pos.length * 2);
    for (let i = 0; i < pos.length / 3; i++) { data.set(pos.slice(i * 3, i * 3 + 3), i * 6); data.set(nor.slice(i * 3, i * 3 + 3), i * 6 + 3); }
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    return { vao, count: pos.length / 3 };
  }
  geo(kind, a = 1, b = 1, c = 1, seg = 18) {
    const key = kind + ':' + [a, b, c, seg].map(v => (+v).toFixed(3)).join(':');
    if (this.geoCache.has(key)) return this.geoCache.get(key);
    let g;
    if (kind === 'box') g = this._box(a, b, c);
    else if (kind === 'cyl') g = this._cyl(a, b, seg, c);
    else if (kind === 'sph') g = this._sph(a, seg);
    this.geoCache.set(key, g); return g;
  }
  // box: width a (x), height b (y, from 0), depth c (z), centered on x/z
  _box(w, h, d) {
    const x = w / 2, z = d / 2, P = [], N = [];
    const f = (v, n) => { [0, 1, 2, 0, 2, 3].forEach(i => { P.push(...v[i]); N.push(...n); }); };
    f([[-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z]], [0, 0, 1]);
    f([[x, 0, -z], [-x, 0, -z], [-x, h, -z], [x, h, -z]], [0, 0, -1]);
    f([[x, 0, z], [x, 0, -z], [x, h, -z], [x, h, z]], [1, 0, 0]);
    f([[-x, 0, -z], [-x, 0, z], [-x, h, z], [-x, h, -z]], [-1, 0, 0]);
    f([[-x, h, z], [x, h, z], [x, h, -z], [-x, h, -z]], [0, 1, 0]);
    f([[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]], [0, -1, 0]);
    return this._upload(P, N);
  }
  // cylinder: radius r, height h from 0; r2 = top radius ratio (c)
  _cyl(r, h, seg, topRatio = 1) {
    const P = [], N = [], rt = r * (topRatio || 1);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const slope = (r - rt) / h;
      const n0 = V3.norm([c0, slope, s0]), n1 = V3.norm([c1, slope, s1]);
      // CCW seen from outside
      const A = [c0 * r, 0, s0 * r], B = [c1 * r, 0, s1 * r], C = [c1 * rt, h, s1 * rt], D = [c0 * rt, h, s0 * rt];
      [[A, n0], [C, n1], [B, n1], [A, n0], [D, n0], [C, n1]].forEach(([p, n]) => { P.push(...p); N.push(...n); });
      P.push(0, h, 0, ...D, ...C); N.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      P.push(0, 0, 0, ...B, ...A); N.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
    }
    return this._upload(P, N);
  }
  _sph(r, seg) {
    const P = [], N = [], st = Math.max(6, seg >> 1);
    const pt = (i, j) => { const th = i / st * Math.PI, ph = j / seg * Math.PI * 2; const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; return [n.map(v => v * r), n]; };
    for (let i = 0; i < st; i++) for (let j = 0; j < seg; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      [a, d, c, a, c, b].forEach(([p, n]) => { P.push(...p); N.push(...n); });
    }
    return this._upload(P, N);
  }
  // ---------- scene graph ----------
  clear() { this.groups.clear(); this.lights = []; this.dirty = true; }
  addGroup(id, opts = {}) {
    const g = Object.assign({ id, x: 0, y: 0, z: 0, rot: 0, sy: 1, visible: true, items: [], kind: 'misc', hl: 0, mat: null, pick: null }, opts);
    this.groups.set(id, g); g.dirtyM = true; this.dirty = true; return g;
  }
  removeGroup(id) { this.groups.delete(id); this.dirty = true; }
  // add drawable to group. p: {geo,x,y,z,ry,rx,rz,color,color2,pattern,patScale,emissive,alpha,shadowOnly,cast,hideWhen}
  part(g, p) {
    const d = Object.assign({ x: 0, y: 0, z: 0, ry: 0, rx: 0, rz: 0, sy: 1, color: '#cccccc', color2: '#999999', pattern: 0, patScale: 1, emissive: '#000000', alpha: 1, cast: true, shadowOnly: false }, p);
    d.local = M4.trs(d.x, d.y, d.z, d.ry, d.sy, d.rx, d.rz);
    d.rgb = hexToRgb(d.color); d.rgb2 = hexToRgb(d.color2); d.erg = hexToRgb(d.emissive);
    g.items.push(d); g.dirtyM = true; this.dirty = true; return d;
  }
  _groupMat(g) {
    if (g.dirtyM || !g.mat) {
      g.mat = M4.trs(g.x, g.y, g.z, g.rot, g.sy);
      g.items.forEach(d => d.world = M4.mul(g.mat, d.local));
      g.dirtyM = false;
    }
  }
  setLights(list) { this.lights = list.slice(0, 16); this.dirty = true; }
  viewProj() {
    const c = this.cam, asp = this.canvas.width / Math.max(1, this.canvas.height);
    return M4.mul(M4.persp(c.fov, asp, c.near, c.far), M4.lookAt(c.pos, c.target, [0, 1, 0]));
  }
  resize() {
    if (this.fixed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.dirty = true; }
  }
  render() {
    const gl = this.gl, env = this.env;
    this.resize();
    this.groups.forEach(g => this._groupMat(g));
    const camY = this.cam.pos[1];
    const visible = (g, d) => g.visible && !(d.hideAbove != null && camY > d.hideAbove) && !(d.showBelow != null && camY > d.showBelow);
    // shadow pass
    const bc = this.bounds.c, R = this.bounds.r;
    const sd = env.sunDir;
    const up = Math.abs(sd[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0];
    const lvp = M4.mul(M4.ortho(-R, R, -R, R, 0.1, R * 4), M4.lookAt(V3.add(bc, V3.scale(sd, R * 2)), bc, up));
    const shadowsOn = env.shadows && sd[1] > 0.02;
    if (shadowsOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.progDepth);
      gl.uniformMatrix4fv(this.uDepth.uLVP, false, lvp);
      gl.disable(gl.CULL_FACE);
      this.groups.forEach(g => { if (!g.visible) return; g.items.forEach(d => {
        if (!d.cast || d.alpha < 0.6) return;
        if (d.hideAbove != null && !d.shadowOnly) return;
        gl.uniformMatrix4fv(this.uDepth.uModel, false, d.world);
        gl.bindVertexArray(d.geo.vao); gl.drawArrays(gl.TRIANGLES, 0, d.geo.count);
      }); });
      gl.enable(gl.CULL_FACE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const cc = hexToRgb(env.clear); gl.clearColor(cc[0], cc[1], cc[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.progMain);
    const U = this.uMain;
    gl.uniformMatrix4fv(U.uVP, false, this.viewProj());
    gl.uniformMatrix4fv(U.uLVP, false, lvp);
    gl.uniform3fv(U.uSunDir, sd); gl.uniform3fv(U.uSunCol, shadowsOn || sd[1] > 0 ? env.sunCol : [0, 0, 0]);
    gl.uniform3fv(U.uSky, hexToRgb(env.sky)); gl.uniform3fv(U.uGround, hexToRgb(env.ground));
    gl.uniform3fv(U.uFogCol, hexToRgb(env.clear)); gl.uniform1f(U.uFog, env.fog);
    gl.uniform3fv(U.uCam, this.cam.pos); gl.uniform1f(U.uAmb, env.amb);
    gl.uniform1i(U.uShadowOn, shadowsOn ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.uniform1i(U.uShadow, 0);
    const L = this.lights, lp = new Float32Array(48), lc = new Float32Array(48), lr = new Float32Array(16);
    L.forEach((l, i) => { lp.set(l.p, i * 3); lc.set(l.c, i * 3); lr[i] = l.r; });
    gl.uniform1i(U.uNL, L.length); gl.uniform3fv(U.uLP, lp); gl.uniform3fv(U.uLC, lc); gl.uniform1fv(U.uLR, lr);
    const trans = [];
    const draw = (g, d) => {
      gl.uniformMatrix4fv(U.uModel, false, d.world);
      gl.uniform3fv(U.uColor, d.rgb); gl.uniform3fv(U.uColor2, d.rgb2); gl.uniform3fv(U.uEmissive, d.erg);
      gl.uniform1f(U.uAlpha, d.alpha); gl.uniform1i(U.uPattern, d.pattern); gl.uniform1f(U.uPatScale, d.patScale);
      gl.uniform1f(U.uHL, g.hl || 0);
      gl.bindVertexArray(d.geo.vao); gl.drawArrays(gl.TRIANGLES, 0, d.geo.count);
    };
    this.groups.forEach(g => g.items.forEach(d => {
      if (d.shadowOnly || !visible(g, d)) return;
      if (d.alpha < 1) { trans.push([g, d]); return; }
      if (d.noCull) gl.disable(gl.CULL_FACE);
      draw(g, d);
      if (d.noCull) gl.enable(gl.CULL_FACE);
    }));
    if (trans.length) {
      const cp = this.cam.pos;
      trans.sort((a, b) => V3.len(V3.sub([b[1].world[12], b[1].world[13], b[1].world[14]], cp)) - V3.len(V3.sub([a[1].world[12], a[1].world[13], a[1].world[14]], cp)));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      trans.forEach(([g, d]) => draw(g, d));
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    }
    gl.bindVertexArray(null);
    this.dirty = false;
  }
  // world point -> screen px (css)
  project(p) {
    const m = this.viewProj();
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    if (w <= 0.01) return null;
    return [(x / w * 0.5 + 0.5) * this.canvas.clientWidth, (1 - (y / w * 0.5 + 0.5)) * this.canvas.clientHeight, w];
  }
  ray(px, py) {
    const c = this.cam, W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const nx = px / W * 2 - 1, ny = 1 - py / H * 2;
    const f = V3.norm(V3.sub(c.target, c.pos)); let r = V3.cross(f, [0, 1, 0]); if (V3.len(r) < 1e-6) r = [1, 0, 0]; r = V3.norm(r);
    const u = V3.cross(r, f), t = Math.tan(c.fov / 2), asp = W / H;
    return { o: c.pos.slice(), d: V3.norm(V3.add(f, V3.add(V3.scale(r, nx * t * asp), V3.scale(u, ny * t)))) };
  }
  // ray vs oriented box (center x,z, base y0, height h, half w/d, rot)
  static rayOBB(ray, b) {
    const ca = Math.cos(b.rot || 0), sa = Math.sin(b.rot || 0);
    const ox = ray.o[0] - b.x, oy = ray.o[1] - (b.y0 + b.h / 2), oz = ray.o[2] - b.z;
    const o = [ox * ca - oz * sa, oy, ox * sa + oz * ca];
    const d = [ray.d[0] * ca - ray.d[2] * sa, ray.d[1], ray.d[0] * sa + ray.d[2] * ca];
    const hx = [b.w / 2, b.h / 2, b.d / 2]; let tmin = -1e9, tmax = 1e9;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (Math.abs(o[i]) > hx[i]) return null; continue; }
      let t1 = (-hx[i] - o[i]) / d[i], t2 = (hx[i] - o[i]) / d[i]; if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return null;
    }
    return tmax < 0 ? null : Math.max(tmin, 0);
  }
  snapshot(w = 480, h = 300) {
    this.render();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); const sw = this.canvas.width, sh = this.canvas.height;
    const s = Math.max(w / sw, h / sh); const dw = sw * s, dh = sh * s;
    ctx.drawImage(this.canvas, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return c.toDataURL('image/jpeg', 0.85);
  }
}

/* ---------- camera controllers ---------- */
class Controls {
  constructor(engine, el) {
    this.e = engine; this.el = el; this.mode = 'orbit';
    this.orbit = { theta: -0.75, phi: 0.95, r: 22, target: [0, 0, 0] };
    this.walk = { pos: [0, 1.6, 0], yaw: 0, pitch: -0.05 };
    this.keys = {}; this.enabled = true; this.anim = null; this.collide = null;
    this.onClick = null; this.onDragStart = null; this.onDrag = null; this.onDragEnd = null; this.onChange = null;
    let down = null, pinch = null;
    const pts = new Map();
    el.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      const r = el.getBoundingClientRect();
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, btn: e.button, shift: e.shiftKey, moved: false, custom: false, px: e.clientX - r.left, py: e.clientY - r.top };
      if (pts.size === 2) { const a = [...pts.values()]; pinch = { d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), r: this.orbit.r }; }
      if (this.onDragStart && e.button === 0 && pts.size === 1 && this.onDragStart(down.px, down.py)) down.custom = true;
    });
    el.addEventListener('pointermove', e => {
      if (!down || !this.enabled) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
      if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4) down.moved = true;
      if (!down.moved) return;
      const r = el.getBoundingClientRect();
      if (down.custom) { this.onDrag && this.onDrag(e.clientX - r.left, e.clientY - r.top); return; }
      if (pinch && pts.size === 2) { const a = [...pts.values()]; const d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); this.orbit.r = Math.max(2, Math.min(80, pinch.r * pinch.d / d)); this.apply(); return; }
      this.stopAnim();
      if (this.mode === 'orbit') {
        if (down.btn === 2 || down.shift || down.btn === 1) this.pan(dx, dy);
        else { this.orbit.theta -= dx * 0.006; this.orbit.phi = Math.max(0.05, Math.min(1.52, this.orbit.phi - dy * 0.005)); }
      } else { this.walk.yaw -= dx * 0.004; this.walk.pitch = Math.max(-1.2, Math.min(1.2, this.walk.pitch - dy * 0.004)); }
      this.apply();
    });
    const up = e => {
      if (!down) return; pts.delete(e.pointerId);
      const r = el.getBoundingClientRect();
      if (down.custom && down.moved) this.onDragEnd && this.onDragEnd();
      else if (!down.moved && this.onClick) this.onClick(e.clientX - r.left, e.clientY - r.top, e);
      else if (down.custom) this.onDragEnd && this.onDragEnd(true);
      if (pts.size < 2) pinch = null;
      if (!pts.size) down = null;
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => {
      if (!this.enabled) return; e.preventDefault(); this.stopAnim();
      if (this.mode === 'orbit') { this.orbit.r = Math.max(2, Math.min(90, this.orbit.r * (1 + Math.sign(e.deltaY) * 0.1))); }
      else { this.move(-Math.sign(e.deltaY) * 0.4, 0); }
      this.apply();
    }, { passive: false });
    window.addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,textarea,select')) return; this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
  }
  pan(dx, dy) {
    const o = this.orbit, s = o.r * 0.0016, c = Math.cos(o.theta), n = Math.sin(o.theta);
    o.target[0] += -c * dx * s - n * dy * s;
    o.target[2] += n * dx * s - c * dy * s;
    this.apply();
  }
  move(fwd, side) {
    const w = this.walk; const f = [-Math.sin(w.yaw), 0, -Math.cos(w.yaw)], r = [Math.cos(w.yaw), 0, -Math.sin(w.yaw)];
    const np = [w.pos[0] + f[0] * fwd + r[0] * side, w.pos[1], w.pos[2] + f[2] * fwd + r[2] * side];
    if (this.collide) { const ok = this.collide(w.pos, np); if (!ok) { const nx = [np[0], w.pos[1], w.pos[2]], nz = [w.pos[0], w.pos[1], np[2]]; if (this.collide(w.pos, nx)) w.pos = nx; else if (this.collide(w.pos, nz)) w.pos = nz; return; } }
    w.pos = np;
  }
  tick(dt) {
    if (this.anim) {
      const a = this.anim; a.t += dt / a.dur; const t = Math.min(1, a.t); const k = a.ease ? a.ease(t) : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      a.step(k); this.e.dirty = true; if (t >= 1) { this.anim = null; a.done && a.done(); }
      return true;
    }
    if (this.mode === 'walk' && this.enabled) {
      const k = this.keys, sp = (k.shift ? 3.2 : 1.8) * dt;
      let f = 0, s = 0;
      if (k.w || k.arrowup) f += sp; if (k.s || k.arrowdown) f -= sp; if (k.a) s -= sp; if (k.d) s += sp;
      if (k.arrowleft) this.walk.yaw += dt * 1.6; if (k.arrowright) this.walk.yaw -= dt * 1.6;
      if (f || s || k.arrowleft || k.arrowright) { this.move(f, s); this.apply(); return true; }
    }
    return false;
  }
  stopAnim() { if (this.anim && !this.anim.locked) this.anim = null; }
  apply() {
    const c = this.e.cam;
    if (this.mode === 'orbit') {
      const o = this.orbit;
      c.pos = [o.target[0] + o.r * Math.sin(o.phi) * Math.sin(o.theta), o.target[1] + o.r * Math.cos(o.phi), o.target[2] + o.r * Math.sin(o.phi) * Math.cos(o.theta)];
      c.target = o.target.slice();
    } else {
      const w = this.walk;
      c.pos = w.pos.slice();
      c.target = [w.pos[0] - Math.sin(w.yaw) * Math.cos(w.pitch), w.pos[1] + Math.sin(w.pitch), w.pos[2] - Math.cos(w.yaw) * Math.cos(w.pitch)];
    }
    this.e.dirty = true; this.onChange && this.onChange();
  }
  // animate camera from current pos/target to given pos/target (free camera), then set controller state
  flyTo(pos, target, dur = 1.4, opts = {}) {
    const c = this.e.cam, p0 = c.pos.slice(), t0 = c.target.slice();
    return new Promise(res => {
      this.anim = {
        t: 0, dur, locked: !!opts.locked, ease: opts.ease,
        step: k => { c.pos = V3.lerp(p0, pos, k); c.target = V3.lerp(t0, target, k); this.onChange && this.onChange(); },
        done: () => { this.syncFromCam(opts.mode); res(); }
      };
    });
  }
  flyPath(points, targets, dur, opts = {}) { // smooth catmull-rom through positions
    const c = this.e.cam; const P = [c.pos.slice(), ...points], T = [c.target.slice(), ...targets];
    const cr = (arr, k) => {
      const n = arr.length - 1, f = k * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
      const p0 = arr[Math.max(0, i - 1)], p1 = arr[i], p2 = arr[i + 1], p3 = arr[Math.min(n, i + 2)];
      return [0, 1, 2].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t));
    };
    return new Promise(res => {
      this.anim = { t: 0, dur, locked: true, ease: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
        step: k => { c.pos = cr(P, k); c.target = cr(T, k); this.onChange && this.onChange(); },
        done: () => { this.syncFromCam(opts.mode); res(); } };
    });
  }
  syncFromCam(mode) {
    const c = this.e.cam;
    if (mode) this.mode = mode;
    if (this.mode === 'orbit') {
      const d = V3.sub(c.pos, c.target), r = V3.len(d);
      this.orbit = { target: c.target.slice(), r, phi: Math.acos(Math.max(-1, Math.min(1, d[1] / r))), theta: Math.atan2(d[0], d[2]) };
    } else {
      const d = V3.norm(V3.sub(c.target, c.pos));
      this.walk = { pos: c.pos.slice(), yaw: Math.atan2(-d[0], -d[2]), pitch: Math.asin(Math.max(-1, Math.min(1, d[1]))) };
    }
  }
}
