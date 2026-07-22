// The blank Boneyard fixture ships as a URL asset; teach TypeScript its shape.
declare module '*.boneyard?url' {
  const url: string
  export default url
}
