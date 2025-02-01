import type BaseInterface from './base.interface';
import type FileInterface from './file.interface';
import type VenueInterface from './venue.interface';
import type UserInterface from './user.interface';
import type BrandInterface from './brand.interface';
import type GroupMemberInterface from './group-member.interface';
export default interface GroupInterface extends BaseInterface {
    name: string;
    description: string;
    address: string;
    createdById: number;
    brandId: number;
    photos: FileInterface[];
    venue?: VenueInterface;
    members: GroupMemberInterface[];
    createdBy: UserInterface;
    brand: BrandInterface;
}
