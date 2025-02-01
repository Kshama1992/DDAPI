import type BaseInterface from './base.interface';
import type UserInterface from './user.interface';
import type ApprovalStatus from '@utils/constants/approval-status';
export default interface GroupMemberInterface extends BaseInterface {
    createdById: number;
    status: ApprovalStatus;
    userId: number;
    dateApproved: Date | undefined;
    createdBy?: UserInterface;
    member?: UserInterface;
}
