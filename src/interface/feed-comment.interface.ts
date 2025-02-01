import type BaseInterface from './base.interface';
import type UserInterface from './user.interface';
export default interface FeedCommentInterface extends BaseInterface {
    userId: number;
    feedId: number;
    __user__?: UserInterface;
    comment: string;
}
