/// <reference types="vite/client" />

// WGSL shader module declaration
declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}
