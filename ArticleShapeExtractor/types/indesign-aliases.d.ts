/// <reference types="types-for-adobe/InDesign/2023" />

export {};

declare global {
  declare namespace IND { 
    type Application = globalThis.Application;
    type Article = globalThis.Article;
    type ArticleMember = globalThis.ArticleMember;
    type ArticleMembers = globalThis.ArticleMembers;
    type Document = globalThis.Document;
    type Element = globalThis.Element;
    type GraphicLine = globalThis.GraphicLine;
    type Line = globalThis.Line;
    type Oval = globalThis.Oval;
    type Page = globalThis.Page;
    type PageItem = globalThis.PageItem;
    type Polygon = globalThis.Polygon;
    type Preference = globalThis.Preference;
    type Rectangle = globalThis.Rectangle;
    type TextFrame = globalThis.TextFrame;

    // enums/constants
    type AutoEnum = typeof AutoEnum;
    type BaselineGridRelativeOption = typeof BaselineGridRelativeOption;
    type ContentType = typeof ContentType;
    type ExportFormat = typeof ExportFormat;
    type JPEGOptionsQuality = typeof JPEGOptionsQuality;
    type JPEGOptionsFormat = typeof JPEGOptionsFormat;
    type JpegColorSpaceEnum = typeof JpegColorSpaceEnum;
    type Leading = typeof Leading;
    type MeasurementUnits = typeof MeasurementUnits;
    type PageSideOptions = typeof PageSideOptions;
    type SaveOptions = typeof SaveOptions;
    type TextWrapModes = typeof TextWrapModes;
  }

  interface Object {
    constructorName: string;
    equals(other: any): boolean;
  }
}
