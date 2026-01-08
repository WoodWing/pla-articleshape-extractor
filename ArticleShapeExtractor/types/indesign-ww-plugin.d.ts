/// <reference types="types-for-adobe/InDesign/2023" />

export {};

/**
 * The InDesign script API is extended by the WoodWing Studio plugins for InDesign.
 * In the below only those properties that used by our tool are defined.
 */
declare global {
  interface PageItem {
    /**
     * See https://woodwing.github.io/enterprise-integration-guide/1237-elementLabel
     */
    elementLabel?: string;
  }

  interface Document {
    entMetaData: {
      /**
       * See https://woodwing.github.io/enterprise-integration-guide/1223-get
       * 
       * @param {string} key
       * @returns {string}
       */
      get(key);
    }
  }

  interface Application {
    entSession: {
      /**
       * See https://woodwing.github.io/enterprise-integration-guide/1211-getPublication
       * 
       * @param publicationId
       * @returns {BrandInfo}
       */
      getPublication(publicationId);

      /**
       * See https://woodwing.github.io/enterprise-integration-guide/1208-getCategory
       * 
       * @param {string} publicationId
       * @param {string} sectionId
       * @param {string} [issueId]
       * @returns {SectionInfo} 
       */
      getCategory (publicationId, sectionId, issueId);
    }

    /**
     * See https://woodwing.github.io/enterprise-integration-guide/1082-openObject
     * 
     * @param {string} objectId
     * @param {boolean} [checkout]
     * @param {boolean} [withWindow]
     * @param {string} [type]
     * @param {string} [dossierId]
     * @param {string} [server]
     * @returns {Object}
     */
    openObject(objectId, checkout, withWindow, type, dossierId, server);
  }
}
