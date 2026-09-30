import React, { useEffect, useRef } from "react";

/**
 * PlasmaHeroBackground
 * 
 * Animated WebGL shader background in the Plasma style with film grain.
 * Generated based on the 21st.dev Shader Builder specification by @silvestrefrigeriopro.
 * 4-color palette:
 *   #101010 (deep dark background)
 *   #3A3A3A (dark slate midtone)
 *   #B0B0B0 (light silver fog)
 *   #F5F5F5 (luminous white highlights)
 */

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec2 iMouse;

  // 4-color deep cosmic palette (matching Noir Housty #070707 and Apple dark guidelines)
  const vec3 color1 = vec3(0.020, 0.020, 0.025); // #050506 - Deepest void
  const vec3 color2 = vec3(0.045, 0.045, 0.055); // #0C0C0E - Dark nebula base
  const vec3 color3 = vec3(0.080, 0.080, 0.100); // #14141A - Subtle slate dust
  const vec3 color4 = vec3(0.140, 0.140, 0.175); // #24242D - Soft celestial mist highlight

  // High-frequency hash for film grain
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec2 p = (gl_FragCoord.xy * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);

    float t = iTime * 0.22;

    // Multi-harmonic plasma field
    float v1 = sin(p.x * 2.0 + t * 0.7);
    float v2 = sin(p.y * 1.8 - t * 0.5);
    float v3 = sin((p.x + p.y) * 1.5 + t * 0.9);
    
    // Rotating vortex component
    vec2 center = p + vec2(sin(t * 0.35) * 0.3, cos(t * 0.25) * 0.3);
    float dist = length(center);
    float v4 = sin(dist * 3.0 - t * 1.1);

    // Subtle mouse interaction warp
    vec2 mouse = (iMouse.xy * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);
    float mouseDist = length(p - mouse);
    float mouseWave = sin(mouseDist * 3.5 - t * 1.8) * exp(-mouseDist * 1.4) * 0.18;

    float v = (v1 + v2 + v3 + v4 + mouseWave) * 0.25; // ~ -1.0 to 1.0
    float n = clamp((v + 1.0) * 0.5, 0.0, 1.0);       // 0.0 to 1.0
    n = pow(n, 1.4); // Quadratic curve: heavily favors deep darks over highlights

    // Smooth spline interpolation across the deep cosmic palette
    vec3 col;
    if (n < 0.33) {
      col = mix(color1, color2, smoothstep(0.0, 0.33, n));
    } else if (n < 0.66) {
      col = mix(color2, color3, smoothstep(0.33, 0.66, n));
    } else {
      col = mix(color3, color4, smoothstep(0.66, 1.0, n));
    }

    // Natural film grain overlay (subtle)
    float grain = (hash(gl_FragCoord.xy + fract(iTime * 17.13) * 1000.0) - 0.5) * 0.035;
    col += grain;

    // Dark ambient vignette around the edges
    float vignette = smoothstep(1.7, 0.35, length(p * 0.75));
    col = mix(color1 * 0.3, col, vignette);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface PlasmaHeroBackgroundProps {
  className?: string;
  opacity?: number;
}

export const PlasmaHeroBackground: React.FC<PlasmaHeroBackgroundProps> = ({
  className = "",
  opacity = 0.95,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("[PlasmaShader] Compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const frag = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[PlasmaShader] Link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Full screen triangle strip
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPosition = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "iResolution");
    const uTime = gl.getUniformLocation(program, "iTime");
    const uMouse = gl.getUniformLocation(program, "iMouse");

    let animId = 0;
    const startTime = performance.now();
    let isRunning = true;

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      mouseRef.current = {
        x: (e.clientX - rect.left) * dpr,
        y: (canvas.clientHeight - (e.clientY - rect.top)) * dpr,
      };
    };

    window.addEventListener("mousemove", handleMouseMove);

    const render = (now: number) => {
      if (!isRunning) return;
      const elapsed = (now - startTime) / 1000;

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (vert) gl.deleteShader(vert);
      if (frag) gl.deleteShader(frag);
      if (program) gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity }}
    />
  );
};

export default PlasmaHeroBackground;
