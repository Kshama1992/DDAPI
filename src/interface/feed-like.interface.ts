import type BaseInterface from './base.interface';
export default interface FeedLikeInterface extends BaseInterface {
    userId: number;
    feedId: number;
}
