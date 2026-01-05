// src/types/mammoth-browser.d.ts
declare module "mammoth/mammoth.browser" {
  // Tipado mínimo para lo que usamos
  export interface ConvertToHtmlOptions {
    includeDefaultStyleMap?: boolean;
    styleMap?: string[] | string;
  }
  export interface ConvertResult {
    value: string;        // HTML result
    messages: Array<{type: string; message: string}>;
  }
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer } | { path: string },
    options?: ConvertToHtmlOptions
  ): Promise<ConvertResult>;

  const mammoth: {
    convertToHtml: typeof convertToHtml;
  };
  export default mammoth;
}
