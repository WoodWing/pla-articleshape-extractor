// DO NOT CHANGE THIS FILE! See README.md for instructions.

export const uploaderDefaultConfig = {
    // Connection URL to the PLA service.
    plaServiceUrl: "https://service.pla-poc.woodwing.cloud",

    // The brand to work in.
    brandId: "1",

    // For PLA a layout page has a simple grid of rows and columns.
    // The space between the page borders in points divided by the column count
    // gives a rough column width in points to be configured here. Same for rows.
    columnWidth: 112,
    rowHeight: 90,

    // An element label tells the type of a text component. Custom labels may be freely picked 
    // by the customer. Standard labels are the factory defaults provided by the Studio product.
    // 
    // The text components are counted per type for the PLA service so that it can apply a beam
    // kNN search to find similar article shapes. It either needs to know how many text components
    // of a type are provided by an article (e.g. quote_count) or it needs to know to sum of 
    // characters fitted into all components of a certain type (e.g. body_length).
    // In both cases, it needs to know to map custom element labels to standard element labels.
    //
    // The mapping table below allows specifying which custom element labels are used:
    // - On the LHS the factory defaults are listed. Do not change them.
    // - On the RHS the custom labels are listed. Regular expressions are allowed here.
    //
    // For example, the custom could use custom element labels "brood 1", "brood 2", etc which
    // all represent the standard "body" label. This could be configured as follows:
    //    body: '^brood \\d+$',
    // Any backslash (\) used in an expression should be escaped (prefixed with another backslash).
    // For regular expressions, refer to: https://en.wikipedia.org/wiki/Regular_expression
    //
    // Notes on the mappings:
    // - Mappings are made in case insensitive manner. This can not be configured.
    // - For all custom labels there must be a mapping available, otherwise an error is raised.
    // - A null value indicates the default should be used. So no custom mapping is applied.
    // - The 'graphic' element is not listed because that is not a text component.
    //
    elementLabels: {
        body: null,
        breakout: null,
        byline: null,
        caption: null,
        credit: null,
        crosshead: null,
        head: null,
        highlight: null,
        intro: null,
        quote: null,
        subhead: null,
    },

    // Whether to log HTTP communication details (of the PLA service and S3) to the console.
    logNetworkTraffic: false,
}
