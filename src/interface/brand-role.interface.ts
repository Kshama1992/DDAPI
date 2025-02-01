import type BrandRoleType from '@utils/constants/brand-role-type';
import type BaseInterface from './base.interface';
import type BrandInterface from './brand.interface';
import type UserPermissionsInterface from './user-permission.interface';
import type UserInterface from './user.interface';
export default interface BrandRoleInterface extends BaseInterface {
    name: string;
    brand?: BrandInterface;
    brandId?: number;
    roleType: BrandRoleType;
    permissions?: UserPermissionsInterface[];
    users?: UserInterface[];
}
