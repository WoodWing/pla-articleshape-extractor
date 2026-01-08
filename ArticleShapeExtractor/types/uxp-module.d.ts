/// <reference types="@adobe/cc-ext-uxp-types" />

declare module "uxp" {
    namespace storage {
        export const localFileSystem: UXP.storage.FileSystemProvider;
    }

    export import Path = UXP.Path;
}
