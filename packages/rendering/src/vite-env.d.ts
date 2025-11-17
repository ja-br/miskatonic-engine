/// <reference types="vite/client" />

// Vite ?raw import for WGSL shader files
declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

// Vite ?raw import for GLSL shader files
declare module '*.glsl?raw' {
  const content: string;
  export default content;
}

declare module '*.vert?raw' {
  const content: string;
  export default content;
}

declare module '*.frag?raw' {
  const content: string;
  export default content;
}
