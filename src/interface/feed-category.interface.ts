import type BaseInterface from './base.interface';
import type BrandInterface from './brand.interface';
export default interface FeedCategoryInterface extends BaseInterface {
    name: string;
    brandId: number;
    brand?: BrandInterface;
}
