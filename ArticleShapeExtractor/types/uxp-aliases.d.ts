/// <reference types="@adobe/cc-ext-uxp-types" />

export {};

declare global {
  namespace UXP {  
    namespace storage {
      type Entry = import("uxp").storage.Entry;
      type File = import("uxp").storage.File;
      type FileSystemProvider = import("uxp").storage.FileSystemProvider;
      type Folder = import("uxp").storage.Folder;
    }

    type Path = import("uxp").Path;
    type Headers = globalThis.Headers;
    type Request = globalThis.Request;
    type Response = globalThis.Response;
  }

  const window: {
    path: UXP.Path;
  }
}

