import { Program } from "ogl";

type ProgramOptions = ConstructorParameters<typeof Program>[1];
type GL = ConstructorParameters<typeof Program>[0];

/* Julian: the site lagged for a first-time visitor (Edge, a MacBook Pro)
   and not for anyone who had been before. Part of that was here: OGL's
   `Program` compiles and links its shaders and asks at once whether that
   worked, and asking makes the page wait for the GPU to finish, 190ms of
   nothing on the main thread in a cold trace, and slower on a Mac
   (Metal). The browser keeps what it compiled, which is why a second
   visit never saw it.

   So the shaders are compiled here the way that does not wait:
   `KHR_parallel_shader_compile` lets the page ask whether they are done
   without blocking, and this asks every 16ms. Then OGL is handed the
   finished program instead of making its own: compiling the same source
   again cost another 20ms a canvas, a cache hit or not. Without the
   extension, OGL compiles as it always did. */
export async function buildProgram(gl: GL, options: ProgramOptions): Promise<Program> {
  const ext = gl.getExtension("KHR_parallel_shader_compile") as {
    COMPLETION_STATUS_KHR: number;
  } | null;
  const vs = ext && gl.createShader(gl.VERTEX_SHADER);
  const fs = ext && gl.createShader(gl.FRAGMENT_SHADER);
  const program = ext && gl.createProgram();
  if (!ext || !vs || !fs || !program || !options?.vertex || !options.fragment)
    return new Program(gl, options);

  gl.shaderSource(vs, options.vertex);
  gl.compileShader(vs);
  gl.shaderSource(fs, options.fragment);
  gl.compileShader(fs);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  await new Promise<void>((resolve) => {
    const poll = () => {
      if (gl.isContextLost() || gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR)) resolve();
      // A timer, not a frame: frames stop in a hidden tab, and so would this.
      else setTimeout(poll, 16);
    };
    poll();
  });

  /* OGL's constructor makes two shaders and a program, fills and links
     them. For the length of that call it gets these ones, already built,
     and filling and linking them again is skipped; what it reads back
     (the logs, the status, the uniforms) is ready and costs nothing. */
  const shaders = [vs, fs];
  const g = gl as unknown as Record<string, unknown>;
  const stand = {
    createShader: () => shaders.shift(),
    createProgram: () => program,
    attachShader: () => {},
    shaderSource: () => {},
    compileShader: () => {},
    linkProgram: () => {},
  };
  Object.assign(g, stand);
  try {
    return new Program(gl, options);
  } finally {
    // Own properties over the prototype's methods: gone, the real ones show.
    for (const k of Object.keys(stand)) delete g[k];
  }
}
