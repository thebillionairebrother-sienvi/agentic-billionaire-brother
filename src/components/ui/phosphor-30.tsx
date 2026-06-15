'use client';

import React, { useEffect, useRef } from 'react';

// Types for component props
interface HeroProps {
  trustBadge?: {
    text: string;
    icons?: string[];
  };
  headline: {
    line1: string;
    line2: string;
  };
  subtitle: string;
  buttons?: {
    primary?: {
      text: string;
      onClick?: () => void;
    };
    secondary?: {
      text: string;
      onClick?: () => void;
    };
  };
  rightContent?: React.ReactNode;
  hideBackground?: boolean;
  className?: string;
}

/* ========= Фрагментный шейдер: Золотой 3D Фрактал ========= */
export const SHADER_SRC = `#version 300 es
precision highp float;

out vec4 fragColor;
in vec2 v_uv;

uniform vec3  iResolution;   // (width, height, dpr)
uniform float iTime;         // seconds
uniform int   iFrame;        // frame counter
uniform vec4  iMouse;        // (x, y, L, R)

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2  r  = iResolution.xy;
    float t  = iTime;
    vec3  FC = vec3(fragCoord, t);
    vec4  o  = vec4(0.0);

    float s = 0.0;
    for (float i = 0.0, z = 0.0, d = 0.0; i++ < 8e1; o += (cos(s + vec4(0.0, 1.0, 8.0, 0.0)) + 1.0) / d)
    {
        vec3 p = z * normalize(FC.rgb * 2.0 - r.xyy);
        vec3 a = normalize(cos(vec3(5.0, 0.0, 1.0) + t - d * 4.0));
        p.z += 3.5;

        a = a * dot(a, p) - cross(a, p);
        for (d = 1.0; d++ < 9.0; )
            a -= sin(a * d + t).zxy / d;

        z += d = 0.1 * abs(length(p) - 3.0) + 0.07 * abs(cos(s = a.y));
    }
    o = tanh(o / 5e3);

    // Map to Gold & Black theme: Red and Green are high, Blue is very low
    vec3 goldColor = vec3(o.r, o.g * 0.72, o.b * 0.08);

    fragColor = vec4(goldColor, 1.0);
}

void main(){
  mainImage(fragColor, gl_FragCoord.xy);
}
`;

/* ========= Вершинный шейдер: fullscreen triangle ========= */
const VERT_SRC = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/* ========= Утилиты ========= */
function safeCompile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS);
  const log = gl.getShaderInfoLog(sh) || "";
  return { shader: ok ? sh : null, log };
}

function safeLink(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  const ok = gl.getProgramParameter(prog, gl.LINK_STATUS);
  const log = gl.getProgramInfoLog(prog) || "";
  return { program: ok ? prog : null, log };
}

function drawError(gl: WebGL2RenderingContext, msg: string) {
  console.error(msg);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clearColor(0.1, 0.08, 0.0, 1); // Gold-tinted dark background for error
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/* ========= WebGL2 Canvas Background Component ========= */
export const ShaderCanvas = React.memo(({
  fragSource,
  pixelRatio,
}: {
  fragSource: string;
  pixelRatio?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0, l: 0, r: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false })!;
    if (!gl) return;

    let disposed = false;
    let vao: WebGLVertexArrayObject | null = null;
    let vbo: WebGLBuffer | null = null;
    let program: WebGLProgram | null = null;
    let ro: ResizeObserver | null = null;
    let resizeScheduled = false;

    let mouseBound = false;
    let ctxBound = false;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current.x = Math.max(0, Math.min(x, rect.width));
      mouseRef.current.y = Math.max(0, Math.min(rect.height - y, rect.height));
    };
    const onDown = (e: MouseEvent) => { if (e.button === 0) mouseRef.current.l = 1; if (e.button === 2) mouseRef.current.r = 1; };
    const onUp   = (e: MouseEvent) => { if (e.button === 0) mouseRef.current.l = 0; if (e.button === 2) mouseRef.current.r = 0; };
    const onCtxMenu = (e: Event) => e.preventDefault();
    const onContextLost = (ev: Event) => { ev.preventDefault(); if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
    const onContextRestored = () => { scheduleSize(); startRef.current = performance.now(); frameRef.current = 0; if (!rafRef.current) rafRef.current = requestAnimationFrame(tick); };

    const getDpr = () => {
      const sys = (window.devicePixelRatio || 1);
      return Math.max(1, Math.min(1.5, pixelRatio ?? sys)); // Cap DPR to 1.5 for performance
    };

    function applySize() {
      resizeScheduled = false;
      if (disposed || !gl) return;
      const dpr = getDpr();
      const cssW = Math.max(1, (canvas.clientWidth | 0));
      const cssH = Math.max(1, (canvas.clientHeight | 0));
      const w = Math.max(1, Math.floor(cssW * dpr));
      const h = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    function scheduleSize() {
      if (resizeScheduled) return;
      resizeScheduled = true;
      requestAnimationFrame(applySize);
    }

    // Geometry
    vao = gl.createVertexArray();
    vbo = gl.createBuffer();
    if (!vao || !vbo) { drawError(gl, "Failed to create VAO/VBO"); return cleanup; }
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Compile shaders
    const { shader: vs, log: vsLog } = safeCompile(gl, gl.VERTEX_SHADER, VERT_SRC);
    if (!vs) { drawError(gl, `Vertex compile error:\n${vsLog}`); return cleanup; }
    const { shader: fs, log: fsLog } = safeCompile(gl, gl.FRAGMENT_SHADER, fragSource);
    if (!fs) { drawError(gl, `Fragment compile error:\n${fsLog}`); gl.deleteShader(vs); return cleanup; }
    const linked = safeLink(gl, vs, fs);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!linked.program) { drawError(gl, `Program link error:\n${linked.log}`); return cleanup; }
    program = linked.program;

    // Uniform locations
    const uResolution = gl.getUniformLocation(program, "iResolution");
    const uTime = gl.getUniformLocation(program, "iTime");
    const uFrame = gl.getUniformLocation(program, "iFrame");
    const uMouse = gl.getUniformLocation(program, "iMouse");

    ro = new ResizeObserver(scheduleSize);
    ro.observe(canvas);
    scheduleSize();

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("contextmenu", onCtxMenu);
    mouseBound = true;

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    ctxBound = true;

    startRef.current = performance.now();
    frameRef.current = 0;

    function tick(now: number) {
      if (disposed) return;
      if (gl.isContextLost()) { rafRef.current = requestAnimationFrame(tick); return; }

      const t = (now - startRef.current) / 1000;
      frameRef.current += 1;

      try {
        if (resizeScheduled) applySize();

        gl.useProgram(program);

        const dpr = getDpr();
        const w = canvas.width, h = canvas.height;

        if (uResolution) gl.uniform3f(uResolution, w, h, dpr);
        if (uTime) gl.uniform1f(uTime, t);
        if (uFrame) gl.uniform1i(uFrame, frameRef.current);
        if (uMouse) {
          const m = mouseRef.current;
          gl.uniform4f(uMouse, m.x * dpr, m.y * dpr, m.l, m.r);
        }

        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } catch (err) {
        drawError(gl, (err as Error)?.message ?? String(err));
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    function cleanup() {
      disposed = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (mouseBound) {
        canvas.removeEventListener("mousemove", onMove);
        canvas.removeEventListener("mousedown", onDown);
        canvas.removeEventListener("mouseup", onUp);
        canvas.removeEventListener("contextmenu", onCtxMenu);
        mouseBound = false;
      }
      if (ctxBound) {
        canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.removeEventListener("webglcontextrestored", onContextRestored);
        ctxBound = false;
      }
      if (ro) { try { ro.disconnect(); } catch {} ro = null; }
      if (gl) {
        if (vbo) { try { gl.deleteBuffer(vbo); } catch {} vbo = null; }
        if (vao) { try { gl.deleteVertexArray(vao); } catch {} vao = null; }
        if (program) { try { gl.deleteProgram(program); } catch {} program = null; }
      }
    }

    return cleanup;
  }, [fragSource, pixelRatio]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
});
ShaderCanvas.displayName = 'ShaderCanvas';

/* ========= Gold Phosphor Hero Component ========= */
export default function PhosphorHero({
  trustBadge,
  headline,
  subtitle,
  buttons,
  rightContent,
  hideBackground = false,
  className = ""
}: HeroProps) {
  return (
    <div className={`hero-container ${className}`} style={{
      position: 'relative',
      width: '100%',
      minHeight: rightContent ? '95vh' : '92vh',
      height: 'auto',
      padding: '120px 0 80px 0',
      overflow: 'hidden',
      backgroundColor: hideBackground ? 'transparent' : '#000',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box',
      zIndex: 5
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hero-fade-in-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes hero-fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .hero-animate-fade-in-down {
          animation: hero-fade-in-down 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .hero-animate-fade-in-up {
          animation: hero-fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        
        .hero-delay-200 {
          animation-delay: 0.2s;
        }
        
        .hero-delay-400 {
          animation-delay: 0.4s;
        }
        
        .hero-delay-600 {
          animation-delay: 0.6s;
        }
        
        .hero-delay-800 {
          animation-delay: 0.8s;
        }

        .hero-btn-primary {
          padding: 16px 36px !important;
          background: linear-gradient(135deg, var(--gold-500), var(--gold-600)) !important;
          color: var(--text-inverse) !important;
          border-radius: var(--radius-md) !important;
          font-weight: 700 !important;
          font-size: 15px !important;
          border: none !important;
          cursor: pointer !important;
          transition: all var(--duration-base) var(--ease-out) !important;
          box-shadow: var(--shadow-glow-gold) !important;
          letter-spacing: 0.03em !important;
          text-transform: uppercase !important;
        }

        .hero-btn-primary:hover {
          background: linear-gradient(135deg, var(--gold-400), var(--gold-500)) !important;
          transform: translateY(-2px) scale(1.03) !important;
          box-shadow: 0 0 50px rgba(234, 179, 8, 0.3) !important;
        }

        .hero-btn-primary:active {
          transform: translateY(0) scale(1) !important;
        }

        .hero-btn-secondary {
          padding: 16px 36px !important;
          backgroundColor: var(--bg-glass) !important;
          border: 1px solid var(--surface-border) !important;
          color: var(--text-primary) !important;
          border-radius: var(--radius-md) !important;
          font-weight: 700 !important;
          font-size: 15px !important;
          cursor: pointer !important;
          transition: all var(--duration-base) var(--ease-out) !important;
          backdrop-filter: blur(8px) !important;
          WebkitBackdropFilter: blur(8px) !important;
          letter-spacing: 0.03em !important;
          text-transform: uppercase !important;
        }

        .hero-btn-secondary:hover {
          background-color: var(--bg-tertiary) !important;
          border-color: var(--surface-border-hover) !important;
          transform: translateY(-2px) scale(1.03) !important;
        }

        .hero-btn-secondary:active {
          transform: translateY(0) scale(1) !important;
        }

        .hero-title-line {
          font-family: inherit;
          font-size: clamp(2rem, 4.5vw, 4rem);
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .hero-content-wrapper {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 40px;
          box-sizing: border-box;
        }

        .hero-left-col {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .hero-right-col {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 100%;
          box-sizing: border-box;
        }

        .hero-buttons-wrapper {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 16px;
        }

        /* Responsive Layout Rules */
        @media (min-width: 769px) {
          .hero-content-wrapper-split {
            flex-direction: row !important;
            justify-content: space-between !important;
            gap: 48px !important;
          }
          .hero-left-col-split {
            flex: 1 1 550px !important;
            align-items: flex-start !important;
            text-align: left !important;
          }
          .hero-right-col-split {
            flex: 0 1 450px !important;
            max-width: 450px !important;
          }
          .hero-buttons-left {
            justify-content: flex-start !important;
          }
        }

        @media (max-width: 768px) {
          .hero-content-wrapper {
            flex-direction: column !important;
            text-align: center !important;
            padding: 0 24px !important;
            gap: 40px !important;
            justify-content: center !important;
          }
          .hero-left-col {
            align-items: center !important;
            text-align: center !important;
            flex: 1 1 auto !important;
          }
          .hero-right-col {
            flex: 1 1 auto !important;
            max-width: 100% !important;
          }
          .hero-buttons-wrapper {
            justify-content: center !important;
          }
        }
      `}} />
      
      {/* WebGL2 Fractal Shader Background */}
      {!hideBackground && <ShaderCanvas fragSource={SHADER_SRC} />}
      
      {/* Dark tint overlay */}
      {!hideBackground && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          zIndex: 2,
          pointerEvents: 'none'
        }} />
      )}
      
      {/* Hero Content Wrapper */}
      <div className={`hero-content-wrapper ${rightContent ? 'hero-content-wrapper-split' : ''}`}>
        
        {/* Left Column (Main Text & Actions) */}
        <div className={`hero-left-col ${rightContent ? 'hero-left-col-split' : ''}`} style={{
          alignItems: rightContent ? undefined : 'center',
          textAlign: rightContent ? undefined : 'center'
        }}>
          {/* Trust Badge */}
          {trustBadge && (
            <div className="hero-animate-fade-in-down" style={{ marginBottom: '28px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                backgroundColor: 'rgba(254, 249, 195, 0.05)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--gold-100)'
              }}>
                {trustBadge.icons && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {trustBadge.icons.map((icon, index) => (
                      <span key={index} style={{ color: 'var(--gold-400)' }}>
                        {icon}
                      </span>
                    ))}
                  </div>
                )}
                <span>{trustBadge.text}</span>
              </div>
            </div>
          )}

          {/* Headings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', width: '100%' }}>
            <h1 className="hero-title-line hero-animate-fade-in-up hero-delay-200" style={{
              color: 'var(--text-primary)',
              margin: 0
            }}>
              {headline.line1}
            </h1>
            <h1 className="hero-title-line hero-animate-fade-in-up hero-delay-400" style={{
              backgroundImage: 'linear-gradient(135deg, var(--gold-300), var(--gold-500))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              {headline.line2}
            </h1>
          </div>
          
          {/* Subtitle */}
          <div className="hero-animate-fade-in-up hero-delay-600" style={{
            maxWidth: rightContent ? '540px' : '680px',
            margin: rightContent ? '0 0 40px 0' : '0 auto 40px auto'
          }}>
            <p style={{
              fontSize: 'clamp(0.95rem, 1.8vw, 1.1rem)',
              color: 'var(--text-secondary)',
              fontWeight: 400,
              lineHeight: 1.6,
              margin: 0
            }}>
              {subtitle}
            </p>
          </div>
          
          {/* Action Buttons */}
          {buttons && (
            <div className={`hero-buttons-wrapper hero-animate-fade-in-up hero-delay-800 ${rightContent ? 'hero-buttons-left' : 'hero-buttons-centered'}`}>
              {buttons.primary && (
                <button 
                  onClick={buttons.primary.onClick}
                  className="hero-btn-primary"
                >
                  {buttons.primary.text}
                </button>
              )}
              {buttons.secondary && (
                <button 
                  onClick={buttons.secondary.onClick}
                  className="hero-btn-secondary"
                >
                  {buttons.secondary.text}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column (Meme Carousel) */}
        {rightContent && (
          <div className="hero-right-col hero-right-col-split hero-animate-fade-in-up hero-delay-600">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
}
