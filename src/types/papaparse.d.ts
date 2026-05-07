declare module 'papaparse' {
  const Papa: {
    unparse: (data: unknown, options?: { delimiter?: string }) => string;
  };
  export default Papa;
}
