import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';
import MainDataSource from '@src/main-data-source';
import { Repository } from 'typeorm/repository/Repository';
import InvoiceEntity from '@entity/invoice.entity';
import SecurityDepositService from '../securitydeposit.refund.service';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import UserEntity from '@src/entity/user.entity';
import { TestBrand, TestReservation, TestSpaceMonthly, TestSubscription, TestUserBrandMember, TestUserSuperAdmin } from '@src/utils/tests/base-data';
import SecurityDepositStatusEntity from '@src/entity/securityDeposit-status.entity';

const newItemWithSameStatus: InvoiceEntity = {
	id: 1,
	createdById: TestUserBrandMember.id,
	updatedById: TestUserBrandMember.id,
	subTotal: 10,
	paidAmount: 10,
	paid: true,
	tax: 2,
	reservationId: TestReservation.id,
	subscriptionId: TestSubscription.id,
	refundedAmount: 0,
	refund: false,
	invoiceNumber: 123,
	spaceId: TestSpaceMonthly.id,
	venueId: TestSpaceMonthly.venueId,
	autoBillable: false,
	autoSendEmail: false,
	invoiceStatusId: 1,
	// @ts-ignore
	invoiceStatus: {
		name: 'Paid',
	},
	// @ts-ignore
	space: {},
	// @ts-ignore
	venue: {},
	userId: TestUserBrandMember.id,
	brandId: TestBrand.id,
	_canEdit(user: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isSuperAdmin();
	},
};

const item: InvoiceEntity = {
	id: 1,
	createdById: TestUserBrandMember.id,
	updatedById: TestUserBrandMember.id,
	subTotal: 10,
	paidAmount: 10,
	paid: true,
	tax: 2,
	reservationId: TestReservation.id,
	subscriptionId: TestSubscription.id,
	refundedAmount: 0,
	refund: false,
	invoiceNumber: 123,
	spaceId: TestSpaceMonthly.id,
	venueId: TestSpaceMonthly.venueId,
	autoBillable: false,
	autoSendEmail: false,
	invoiceStatusId: 1,
	// @ts-ignore
	invoiceStatus: {
		name: 'New',
	},
	// @ts-ignore
	space: {},
	// @ts-ignore
	venue: {},
	userId: 2,
	brandId: TestBrand.id,
	_canEdit(user: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isSuperAdmin();
	},
	providerData: [
		{
			id: 1519,
			invoiceId: 4014,
			provider: PaymentProvider.STRIPE,
			providerInvoiceId: 'in_1NLpeYFeCjhEZ1sMTbAp97K6',
			providerInvoiceNumber: 'DC45B574-0145',
			invoice: newItemWithSameStatus,
		},
		{
			id: 1519,
			invoiceId: 4014,
			provider: PaymentProvider.STRIPE,
			providerInvoiceId: 'in_1NLpeYFeCjhEZ1sMTbAp97K6',
			providerInvoiceNumber: 'DC45B574-0145',
			invoice: newItemWithSameStatus,
		},
	],
};
const securityDepositStatusList: SecurityDepositStatusEntity = {
	name: 'Full Security Refund',
	id: 3,
	_canCreate: function (user?: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isSuperAdmin();
	},
	_canEdit: function (user?: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isSuperAdmin();
	},
	createdAt: new Date(),
	updatedAt: new Date(),
};

let thisService: SecurityDepositService;

describe('SERVICE: Security Deposit Refund Service', () => {
	let repo: Repository<InvoiceEntity>;
	let secRepo: Repository<SecurityDepositStatusEntity>;

	beforeAll(() => {
		thisService = new SecurityDepositService();
	});

	beforeEach(() => {
		repo = MainDataSource.getRepository(InvoiceEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(item);
		secRepo = MainDataSource.getRepository(SecurityDepositStatusEntity);
		secRepo.createQueryBuilder = CreateQueryBuilderMock(securityDepositStatusList);
		jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
			return Promise.resolve(item);
		});
	});

	describe('method "update"', () => {
		it('calls repository with correct params', async () => {
			try {
				const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
					return Promise.resolve(item);
				});

				await thisService.update(item.id, item, TestUserBrandMember);

				expect(findOneOrFailSpy).toBeCalled();
				expect(findOneOrFailSpy).toBeCalledWith({
					where: { id: item.id },
					relations: [
						'providerData',
						'issuedTo',
						'issuedTo.photo',
						'issuedTo.brand',
						'issuedTo.leadingTeams',
						'issuedTo.leadingTeams.subscriptions',
						'space',
						'space.amenities',
						'space.amenities.amenity',
						'space.photos',
						'space.packageBrands',
						'space.packageVenueTypes',
						'space.packageVenues',
						'space.packageSpaceTypes',
						'space.spaceType',
						'space.creditHours',
						'items',
						'venue',
						'venue.logo',
						'venue.photos',
						'venue.createdBy',
						'invoiceStatus',
						'reservation',
						'subscription',
						'paymentData',
						'providerData',
					],
				});
			} catch (ex: any) {
				expect(ex.message).toEqual('Insufficient permissions');
			}
		});

		it('cant Edit invoice if user is a brand member', async () => {

			expect(async () => await thisService.update(item.id, item, TestUserBrandMember)).toMatch

			String('Insufficient permissions');
		});

		it('Refund cant be processed with same invoice status', async () => {

			jest.spyOn(secRepo, 'find').mockImplementation(async () => {
				return Promise.resolve([securityDepositStatusList]);
			});
			expect(async () => await thisService.update(item.id, item, TestUserSuperAdmin)).toMatch

			String('Refund cant be processed');
		});
	});
});
