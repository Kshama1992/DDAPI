import { MigrationInterface, QueryRunner } from 'typeorm';
import BrandEntity from '@entity/brand.entity';
import RoleEntity from '@entity/role.entity';
import UserEntity from '@entity/user.entity';
import {
	TestAmenity,
	TestBrand,
	TestBrandSecond,
	TestPackageShow,
	TestRoleAdmin,
	TestRoleMember,
	TestRoleSuperAdmin,
	TestRoleWithoutMembers,
	TestSpaceType,
	TestSpaceTypeSecond,
	TestUserBrandAdmin,
	TestUserBrandAdminSecond,
	TestUserBrandMember,
	TestUserPermission,
	TestUserSuperAdmin,
	TestVenue,
	TestVenueDeleted,
	TestVenueSecond,
	TestVenueType,
	TestVenueTypeSecond,
	TestInvStatusNew,
	TestInvStatusUpcoming,
	TestInvStatusSent,
	TestInvStatusUpcomingHours,
	TestInvStatusVoid,
	TestInvStatusPaid,
	TestInvStatusInactive,
	TestInvStatusPaymentFailed,
	TestInvStatusRefund,
	TestInvStatusPartialRefund,
	TestCompany,
	TestGroup,
	TestEmailTemplateType,
	TestEmailTemplate,
	TestEmailVariable,
	TestFeedCategory,
	TestSpaceMonthly,
	TestAmenitySecond,
	TestSpaceMonthlySecond,
	TestVenueBrandAdmin,
	TestBrandDelete,
	TestFeedItem,
	TestTeam,
	TestSubscription,
	TestReservation,
	TestInvoice,
	TestSpaceAmenity,
	TestSpaceDropIn,
	TestSpaceTypeDropIn,
} from '@utils/tests/base-data';
import AmenityEntity from '@entity/amenity.entity';
import VenueTypeEntity from '@entity/venue-type.entity';
import PackageShowEntity from '@entity/package-show.entity';
import SpaceTypeEntity from '@entity/space-type.entity';
import UserPermissionEntity from '@entity/user-permission.entity';
import VenueEntity from '@entity/venue.entity';
import InvoiceStatusEntity from '@entity/invoice-status.entity';
import CompanyEntity from '@entity/company.entity';
import GroupEntity from '@entity/group.entity';
import EmailTemplateTypeEntity from '@entity/email-template-type.entity';
import EmailTemplateEntity from '../entity/email-template.entity';
import EmailVariableEntity from '@entity/email-variable.entity';
import SpaceEntity from '@entity/space.entity';
import FeedCategoryEntity from '@entity/feed-category.entity';
import FeedEntity from '@entity/feed.entity';
import TeamEntity from '@entity/team.entity';
import SubscriptionEntity from '@entity/subscription.entity';
import ReservationEntity from '@entity/reservation.entity';
import InvoiceEntity from '@entity/invoice.entity';

export class GenerateTestData1640192396662 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		const invoiceStatuses = queryRunner.manager.create(InvoiceStatusEntity, [
			TestInvStatusNew,
			TestInvStatusUpcoming,
			TestInvStatusSent,
			TestInvStatusUpcomingHours,
			TestInvStatusVoid,
			TestInvStatusPaid,
			TestInvStatusInactive,
			TestInvStatusPaymentFailed,
			TestInvStatusRefund,
			TestInvStatusPartialRefund,
		]);
		const newEmailVariables = queryRunner.manager.create(
			EmailVariableEntity,
			[...Array(10).keys()].map((n) => ({ ...TestEmailVariable, name: `${TestEmailVariable.name} ${n}` }))
		);
		const newEmailType = queryRunner.manager.create(EmailTemplateTypeEntity, TestEmailTemplateType);
		const newEmailTemplate = queryRunner.manager.create(EmailTemplateEntity, TestEmailTemplate);
		const newFeedCat = queryRunner.manager.create(FeedCategoryEntity, TestFeedCategory);
		const newFeedItem = queryRunner.manager.create(FeedEntity, TestFeedItem);
		const newBrandSecond = queryRunner.manager.create(BrandEntity, [TestBrand, TestBrandSecond, TestBrandDelete]);

		const newAmenity = queryRunner.manager.create(AmenityEntity, [TestAmenity, TestAmenitySecond]);
		const newSpaceAmenity = queryRunner.manager.create(AmenityEntity, [TestSpaceAmenity]);
		const newVenueType = queryRunner.manager.create(VenueTypeEntity, TestVenueType);
		const newVenueTypeSecond = queryRunner.manager.create(VenueTypeEntity, TestVenueTypeSecond);

		const newSpaceType = queryRunner.manager.create(SpaceTypeEntity, TestSpaceType);
		const newSpaceTypeSecond = queryRunner.manager.create(SpaceTypeEntity, TestSpaceTypeSecond);
		const newSpaceTypeDrop = queryRunner.manager.create(SpaceTypeEntity, TestSpaceTypeDropIn);

		const newPackageShow = queryRunner.manager.create(PackageShowEntity, TestPackageShow);
		const newUserPerms = queryRunner.manager.create(UserPermissionEntity, TestUserPermission);

		const newRoleWithoutMembers = queryRunner.manager.create(RoleEntity, TestRoleWithoutMembers);
		const newRoleAdmin = queryRunner.manager.create(RoleEntity, TestRoleAdmin);
		const newRoleSuperAdmin = queryRunner.manager.create(RoleEntity, TestRoleSuperAdmin);
		const newRole = queryRunner.manager.create(RoleEntity, TestRoleMember);

		const newSuperAdmin = queryRunner.manager.create(UserEntity, TestUserSuperAdmin);
		const newUserAdmin = queryRunner.manager.create(UserEntity, TestUserBrandAdmin);
		const newUserAdminSecond = queryRunner.manager.create(UserEntity, TestUserBrandAdminSecond);
		const newUser = queryRunner.manager.create(UserEntity, TestUserBrandMember);

		const newVenue = queryRunner.manager.create(VenueEntity, [TestVenue, TestVenueSecond, TestVenueDeleted, TestVenueBrandAdmin]);

		const newCompany = queryRunner.manager.create(CompanyEntity, TestCompany);
		const newGroup = queryRunner.manager.create(GroupEntity, TestGroup);
		const newTeam = queryRunner.manager.create(TeamEntity, TestTeam);

		const newSpaces = queryRunner.manager.create(SpaceEntity, [TestSpaceMonthly, TestSpaceMonthlySecond, TestSpaceDropIn]);

		const newSubs = queryRunner.manager.create(SubscriptionEntity, [TestSubscription]);
		const newReservation = queryRunner.manager.create(ReservationEntity, [TestReservation]);
		const newInvoice = queryRunner.manager.create(InvoiceEntity, [
			TestInvoice,
			{ ...TestInvoice, id: 2, brandId: TestBrand.id, userId: TestUserBrandAdmin.id, items: [] },
		]);
		const newReservation1 = queryRunner.manager.create(ReservationEntity, [{ ...TestReservation, invoiceId: TestInvoice.id }]);

		await queryRunner.manager.save(invoiceStatuses);

		await queryRunner.manager.save(newUserPerms);
		await queryRunner.manager.save(newAmenity);
		await queryRunner.manager.save(newBrandSecond);

		await queryRunner.manager.save([newRoleAdmin, newRole, newRoleSuperAdmin, newRoleWithoutMembers]);

		await queryRunner.manager.save([newUserAdmin, newUser, newSuperAdmin, newUserAdminSecond]);

		await queryRunner.manager.save(newFeedCat);
		await queryRunner.manager.save(newFeedItem);

		await queryRunner.manager.save([newSpaceType, newSpaceTypeSecond, newSpaceTypeDrop]);
		await queryRunner.manager.save([newVenueType, newVenueTypeSecond]);

		await queryRunner.manager.save(newPackageShow);

		await queryRunner.manager.save(newCompany);
		await queryRunner.manager.save(newGroup);
		await queryRunner.manager.save(newTeam);

		await queryRunner.manager.save(newVenue);

		await queryRunner.manager.save(newEmailType);
		await queryRunner.manager.save(newEmailVariables);
		await queryRunner.manager.save(newEmailTemplate);

		await queryRunner.manager.save(newSpaces);
		await queryRunner.manager.save(newSpaceAmenity);

		await queryRunner.manager.save(newSubs);
		await queryRunner.manager.save(newReservation);
		await queryRunner.manager.save(newInvoice);
		await queryRunner.manager.save(newReservation1);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {}
}
