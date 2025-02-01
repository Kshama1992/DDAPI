import type BaseInterface from './base.interface';
import type FileInterface from './file.interface';
import type VenueInterface from './venue.interface';
import type CompanyMemberInterface from './company-member.interface';
import type UserInterface from './user.interface';
import type BrandInterface from './brand.interface';
export default interface CompanyInterface extends BaseInterface {
    name: string;
    about: string;
    website: string;
    email: string;
    createdById: number;
    brandId: number;
    photos: FileInterface[];
    venue?: VenueInterface;
    members: CompanyMemberInterface[];
    createdBy: UserInterface;
    brand: BrandInterface;
    services: string;
}
