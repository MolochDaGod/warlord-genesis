/**
 * Game UI Kit — minimal WebGL "game scene".
 *
 * Single source of truth: imported directly by the in-editor live preview AND
 * emitted verbatim into the `webgl/` export target. Renders an animated gradient
 * behind a DOM kit HUD (the standard production pattern for crisp game UI over a
 * GL canvas). Sizes itself to the canvas's CSS box, so it works full-window in
 * the export and inside a panel in the editor preview alike.
 *
 * Returns a stop() that cancels the animation and detaches the resize listener.
 */
export function startScene(canvas) {
  const gl = canvas.getContext("webgl");
  if (!gl) return () => {};

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  resize();

  const vs = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }";
  const fs = "precision mediump float; uniform vec2 r; uniform float t;" +
    "void main(){ vec2 uv = gl_FragCoord.xy / r;" +
    "vec3 a = vec3(0.04,0.06,0.12), b = vec3(0.10,0.16,0.30);" +
    "float w = 0.5 + 0.5*sin(uv.x*6.0 + t) * sin(uv.y*4.0 - t*0.7);" +
    "gl_FragColor = vec4(mix(a,b,uv.y*0.8 + w*0.15), 1.0); }";
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, "r"), uT = gl.getUniformLocation(prog, "t");

  let raf = 0;
  (function loop(ms) {
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, ms / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(loop);
  })(0);

  return function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  };
}
