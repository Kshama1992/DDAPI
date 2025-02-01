import type ApprovalStatus from '@utils/constants/approval-status';
import type BaseInterface from './base.interface';
import type UserInterface from './user.interface';
export default interface CompanyMemberInterface extends BaseInterface {
    createdById: number;
    status: ApprovalStatus;
    userId: number;
    dateApproved: Date | undefined;
    createdBy?: UserInterface;
    member?: UserInterface;
}
