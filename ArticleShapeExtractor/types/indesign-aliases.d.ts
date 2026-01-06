declare namespace IDD { 
  type Application = globalThis.Application;
  type Article = globalThis.Article;
  type ArticleMember = globalThis.ArticleMember;
  type Element = globalThis.Element;
  type Document = globalThis.Document;
  type Line = globalThis.Line;
  type Page = globalThis.Page;
  type PageItem = globalThis.PageItem;
  type Preference = globalThis.Preference;
  type TextFrame = globalThis.TextFrame;
}

declare module "indesign" {
  export const app: IDD.Application;
}
