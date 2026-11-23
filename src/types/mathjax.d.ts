declare module 'mathjax' {
  type MathJaxNode = object;

  interface MathJaxInstance {
    init(options: { loader: { load: string[] } }): Promise<unknown>;
    tex2svg(latex: string, options: { display: boolean }): MathJaxNode;
    startup: {
      adaptor: {
        outerHTML(node: MathJaxNode): string;
      };
    };
  }

  const MathJax: MathJaxInstance;
  export default MathJax;
}
