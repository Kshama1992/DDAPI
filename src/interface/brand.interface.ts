export default interface BrandFilter {
    domain?: string;
    searchString?: string;
    limit?: number;
    offset?: number;
    includeIds?: number[];
    name?: string;
}
