declare module 'mathjax' {
  type MathJaxNode = object;

  interface MathJaxInstance {
    init(options: { loader: { load: string[] } }): Promise<unknown>;
    tex2svg(latex: string, options: { display: boolean }): MathJaxNode;
    tex2svgPromise(latex: string, options: { display: boolean }): Promise<MathJaxNode>;
    startup: {
      adaptor: {
        outerHTML(node: MathJaxNode): string;
      };
    };
  }

  const MathJax: MathJaxInstance;
  export default MathJax;
}
