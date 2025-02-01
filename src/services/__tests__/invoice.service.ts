import { faker } from '@faker-js/faker';
import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';
import MainDataSource from '@src/main-data-source';
import UserEntity from '@entity/user.entity';
import { Repository } from 'typeorm/repository/Repository';
import InvoiceEntity from '@entity/invoice.entity';
import InvoiceService from '@services/invoice.service';
import TeamEntity from '@entity/team.entity';
import InvoiceItemType from 'dd-common-blocks/dist/type/InvoiceItemType';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import {
	TestBrandSecond,
	TestReservation,
	TestSpaceMonthly,
	TestSpaceMonthlySecond,
	TestSpaceType,
	TestSubscription,
	TestUserBrandMember,	
	TestUserSuperAdmin,
	instantlyBookableItem,
	spacetem,
	venueItem
} from '@utils/tests/base-data';
import SpaceEntity from '@entity/space.entity';
import ChargeVariant from 'dd-common-blocks/dist/type/ChargeVariant';
import { SpaceStatus } from 'dd-common-blocks';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import VenueEntity from '@entity/venue.entity';
import InvoiceItemEntity from '@entity/invoice-item.entity';
import PackageShow from 'dd-common-blocks/dist/type/PackageShow';
import ChangeInvoiceStatusDto from '@src/dto/change-invoice-status.dto';
import InvoiceStatusEntity from '@src/entity/invoice-status.entity';
import ReservationEntity from '@src/entity/reservation.entity';
import InstantlyBookableConversationEntity from '@src/entity/InstantlyBookable-conversation.entity';
import * as hostApprovalHelper from '@helpers/host-approval-sms.helper';

// @ts-ignore
const reservationItem: ReservationEntity = {
	id: 1,
	createdById: TestUserBrandMember.id,
	updatedById: TestUserBrandMember.id,
	userId: TestUserBrandMember.id,
	venueId: 1,
	spaceId: 1,
	teamId: 1,
	brandId: 1,
	brand: {},
	issuedTo: {},
	// @ts-ignore
	createdBy: {},
	// @ts-ignore
	updatedBy: {},
	// @ts-ignore
	invoice: {},
	// @ts-ignore
};

// @ts-ignore
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
	spaceId: TestSpaceMonthlySecond.id,
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
	brandId: TestBrandSecond.id,
	items: [
		{
			id: 1,
			name: 'any test name',
			creditHours: 0,
			amountRefunded: 0,
			price: 10,
			price2: 10,
			refunded: false,
			paidAmount: 0,
			paid: true,
			tax: 0,
			quantity: 1,
			amenityHoursIncluded: 0,
			startDate: new Date(),
			endDate: new Date(),
			payDate: '2021-10-27 21:00:00.000000 +00:00',
			dateBought: new Date(),
			spaceId: TestSpaceMonthlySecond.id,
			venueId: TestSpaceMonthly.venueId,
			createdById: TestUserBrandMember.id,
			updatedById: TestUserBrandMember.id,
			reservationId: TestReservation.id,
			subscriptionId: TestSubscription.id,
			invoiceId: 1,
			invoiceItemType: InvoiceItemType.SPACE,
			chargeType: ChargeType.HOURLY,
			// @ts-ignore
			space: TestSpaceMonthlySecond,
		},
	],
	_canEdit(user: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isAdmin;
	},
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
};

const newStatusitem: InvoiceEntity = {
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
	spaceId: TestSpaceMonthlySecond.id,
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
	userId: TestUserBrandMember.id,
	brandId: TestBrandSecond.id,
	_canEdit(user: UserEntity | undefined): boolean {
		if (!user) return false;
		return user.isAdmin;
	},
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
};

const paidInvoiceStatusList: InvoiceStatusEntity = {
	name: 'Paid',
	id: 6,
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

const refundInvoiceStatusList: InvoiceStatusEntity = {
	name: 'Refunded',
	id: 6,
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

const changeInvoiceStatusItemForPaid: ChangeInvoiceStatusDto = {
	statusId: 6,
	isSecurityRefund: false,
	refundAmount: 20,
};

const changeInvoiceStatusItemForRefund: ChangeInvoiceStatusDto = {
	statusId: 9,
	isSecurityRefund: false,
	refundAmount: 20,
};

const space: SpaceEntity = {
	...TestSpaceMonthly,
	chargeVariant: ChargeVariant.byTimer,
	createdAt: new Date(),
	customAdditionalTime: 0,
	// @ts-ignore
	eventData: undefined,
	gettingStarted: '',
	invoice: [],
	// @ts-ignore
	lastUsed: undefined,
	providerData: [],
	renewedAt: undefined,
	reservation: [],
	roundHours: 0,
	securityDepositPrice: 0,
	spaceConnectionUser: Promise.resolve([]),
	// @ts-ignore
	spaceType: TestSpaceType,
	packageShow: PackageShow.TEAM_MEMBERSHIP,
	subscription: [],
	updatedAt: new Date(),
	updatedById: 0,
	// @ts-ignore
	venue: undefined,
	quantityUnlimited: true,
	credits2x: false,
	creditsHalf: false,
	notAllowCredit: false,
	usedQuantity: 0,
};

jest.mock('@entity/team.entity');
jest.mock('@entity/space.entity');
jest.mock('typeorm/query-builder/relation-count/RelationCountLoader');

let thisService: InvoiceService;

describe('SERVICE: Invoice Service', () => {
	let repo: Repository<InvoiceEntity>;
	let spaceRepo: Repository<SpaceEntity>;

	beforeAll(() => {
		thisService = new InvoiceService();
	});

	beforeEach(() => {
		repo = MainDataSource.getRepository(InvoiceEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(item);
		spaceRepo = MainDataSource.getRepository(SpaceEntity);
		spaceRepo.createQueryBuilder = CreateQueryBuilderMock(space);
	});

	describe('method "list"', () => {
		beforeAll(() => {
			jest.spyOn(MainDataSource.getRepository(TeamEntity) as any, 'find').mockReturnValue([]);
			jest.spyOn(MainDataSource.getRepository(VenueEntity) as any, 'findOne').mockReturnValue({ photos: [] });
			jest.spyOn(MainDataSource.getRepository(SpaceEntity) as any, 'findOne').mockReturnValue({ photos: [] });
			jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'query').mockReturnValue([item]);
			jest.spyOn(MainDataSource.getRepository(InvoiceItemEntity) as any, 'find').mockReturnValue(item.items);
		});

		it('list all invoices with params', async () => {
			const params = {
				brandId: faker.random.numeric(2),
				teamId: faker.random.numeric(2),
				userId: faker.random.numeric(2),
				venueId: faker.random.numeric(2),
				spaceId: faker.random.numeric(2),
				spaceTypeId: faker.random.numeric(2),
				invoiceStatusIds: [faker.random.numeric(2), faker.random.numeric(2)],
				spaceTypeIds: [faker.random.numeric(2), faker.random.numeric(2)],
				spaceIds: [faker.random.numeric(2), faker.random.numeric(2)],
				venueIds: [faker.random.numeric(2), faker.random.numeric(2)],
				limit: faker.random.numeric(2),
				offset: faker.random.numeric(2),
			};

			await thisService.list(params);

			expect(repo.createQueryBuilder().addSelect).toHaveBeenNthCalledWith(1, 'Invoice.createdAt');
			expect(repo.createQueryBuilder().addSelect).toHaveBeenNthCalledWith(2, 'Invoice.refundDate');
			expect(repo.createQueryBuilder().addSelect).toHaveBeenNthCalledWith(3, 'Invoice.updatedAt');

			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'Invoice.space', 'space');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'Invoice.providerData', 'providerData');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(3, 'space.spaceType', 'spaceType');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(4, 'Invoice.venue', 'venue');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(5, 'Invoice.subscription', 'subscription');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(6, 'Invoice.reservation', 'reservation');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(7, 'Invoice.createdBy', 'createdBy');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(8, 'reservation.createdBy', 'reservationCreatedBy');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(9, 'reservation.reservedTo', 'reservedTo');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(10, 'reservedTo.brand', 'brand');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(11, 'Invoice.invoiceStatus', 'invoiceStatus');

			expect(repo.createQueryBuilder().where).toHaveBeenCalledWith('Invoice.invoiceNumber IS NOT NULL');

			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(1, `Invoice.invoiceStatusId IN (:...invoiceStatusIds)`, {
				invoiceStatusIds: params.invoiceStatusIds,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(2, `space.spaceTypeId IN (:...spaceTypeIds)`, {
				spaceTypeIds: params.spaceTypeIds,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(3, `Invoice.spaceId IN (:...spaceIds)`, {
				spaceIds: params.spaceIds,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(4, `Invoice.venueId IN (:...venueIds)`, {
				venueIds: params.venueIds,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(5, `Invoice.userId = :userId`, {
				userId: params.userId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(6, `space.spaceTypeId = :spaceTypeId`, {
				spaceTypeId: params.spaceTypeId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(7, `Invoice.teamId = :teamId`, {
				teamId: params.teamId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(8, `Invoice.brandId = :brandId`, {
				brandId: params.brandId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(9, `Invoice.venueId = :venueId`, {
				venueId: params.venueId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(10, `Invoice.spaceId = :spaceId`, {
				spaceId: params.spaceId,
			});

			expect(repo.createQueryBuilder().limit).toHaveBeenCalledWith(Number(params.limit));
			expect(repo.createQueryBuilder().offset).toHaveBeenCalledWith(Number(params.offset));
			expect(repo.createQueryBuilder().orderBy).toHaveBeenCalledWith('Invoice.updatedAt', 'DESC');

			expect(repo.createQueryBuilder().getManyAndCount).toHaveBeenCalled();
		});

		it('list all invoices with params sort by reservations', async () => {
			const params = {
				brandId: faker.random.numeric(2),
				teamId: faker.random.numeric(2),
				userId: faker.random.numeric(2),
				venueId: faker.random.numeric(2),
				spaceId: faker.random.numeric(2),
				spaceTypeId: faker.random.numeric(2),
				invoiceStatusIds: [faker.random.numeric(2), faker.random.numeric(2)],
				spaceTypeIds: [faker.random.numeric(2), faker.random.numeric(2)],
				spaceIds: [faker.random.numeric(2), faker.random.numeric(2)],
				venueIds: [faker.random.numeric(2), faker.random.numeric(2)],
				limit: faker.random.numeric(2),
				offset: faker.random.numeric(2),
				sortByReservations: true,
			};

			const genDateOrderBy = (status: string) => `CASE
				WHEN "reservation"."status" = '${status}' AND "reservation"."hoursFrom"::date = CURRENT_DATE::date THEN "reservation"."hoursFrom"
				WHEN "reservation"."status" = '${status}' AND "reservation"."hoursFrom"::timestamp > CURRENT_DATE::timestamp THEN "reservation"."hoursFrom"
			END`;

			const objectWithStripe = jest.spyOn(thisService as any, '_updateObjWithStripeInvoice').mockResolvedValue(() => Promise.resolve(item));

			await thisService.list(params);

			expect(repo.createQueryBuilder().addSelect).toHaveBeenNthCalledWith(1, 'Invoice.createdAt');
			expect(repo.createQueryBuilder().addSelect).toHaveBeenNthCalledWith(2, 'Invoice.refundDate');
			expect(repo.createQueryBuilder().addSelect).toHaveBeenNthCalledWith(3, 'Invoice.updatedAt');

			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'Invoice.space', 'space');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'Invoice.providerData', 'providerData');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(3, 'space.spaceType', 'spaceType');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(4, 'Invoice.venue', 'venue');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(5, 'Invoice.subscription', 'subscription');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(6, 'Invoice.reservation', 'reservation');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(7, 'Invoice.createdBy', 'createdBy');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(8, 'reservation.createdBy', 'reservationCreatedBy');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(9, 'reservation.reservedTo', 'reservedTo');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(10, 'reservedTo.brand', 'brand');
			expect(repo.createQueryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(11, 'Invoice.invoiceStatus', 'invoiceStatus');

			expect(repo.createQueryBuilder().where).toHaveBeenCalledWith('Invoice.invoiceNumber IS NOT NULL');

			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(1, `Invoice.invoiceStatusId IN (:...invoiceStatusIds)`, {
				invoiceStatusIds: params.invoiceStatusIds,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(2, `space.spaceTypeId IN (:...spaceTypeIds)`, {
				spaceTypeIds: params.spaceTypeIds,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(3, `Invoice.spaceId IN (:...spaceIds)`, {
				spaceIds: params.spaceIds,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(4, `Invoice.venueId IN (:...venueIds)`, {
				venueIds: params.venueIds,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(5, `Invoice.userId = :userId`, {
				userId: params.userId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(6, `space.spaceTypeId = :spaceTypeId`, {
				spaceTypeId: params.spaceTypeId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(7, `Invoice.teamId = :teamId`, {
				teamId: params.teamId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(8, `Invoice.brandId = :brandId`, {
				brandId: params.brandId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(9, `Invoice.venueId = :venueId`, {
				venueId: params.venueId,
			});
			expect(repo.createQueryBuilder().queryAndWhere).toHaveBeenNthCalledWith(10, `Invoice.spaceId = :spaceId`, {
				spaceId: params.spaceId,
			});

			expect(repo.createQueryBuilder().limit).toHaveBeenCalledWith(Number(params.limit));
			expect(repo.createQueryBuilder().offset).toHaveBeenCalledWith(Number(params.offset));

			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledWith('Invoice.spaceId IS NOT NULL');
			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledWith('Invoice.reservationId IS NOT NULL');
			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`spaceType.logicType != :infoLogicType`, {
				infoLogicType: SpaceTypeLogicType.INFO,
			});
			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`spaceType.logicType != :monthlyLogicType`, {
				monthlyLogicType: SpaceTypeLogicType.MONTHLY,
			});
			expect(repo.createQueryBuilder().andWhere).toHaveBeenCalledWith(`spaceType.logicType != :eventLogicType`, {
				eventLogicType: SpaceTypeLogicType.EVENT,
			});

			expect(repo.createQueryBuilder().addOrderBy).toHaveBeenCalledWith(`CASE
				WHEN "reservation"."status" = 'active' THEN 1
				WHEN "reservation"."status" != 'active' THEN 2
			END`);

			expect(repo.createQueryBuilder().addOrderBy).toHaveBeenCalledWith(genDateOrderBy('active'));
			expect(repo.createQueryBuilder().addOrderBy).toHaveBeenCalledWith('"reservation"."hoursFrom"', 'DESC');

			expect(repo.createQueryBuilder().getManyAndCount).toHaveBeenCalled();

			expect(objectWithStripe).toHaveBeenNthCalledWith(1, item);
		});
	});

	describe('method "delete"', () => {
		it('cant delete invoice', async () => {
			expect(() => thisService.delete('1')).toThrowError('Insufficient permissions');
		});
	});

	describe('method "_deductSpaceQuantity"', () => {
		it('should ignore operations if space have unlimited quantity', async () => {
			const repoSpaceUpdateSpy = jest
				.spyOn(spaceRepo as any, 'update')
				.mockResolvedValue(() => Promise.resolve({ ...space, quantityUnlimited: true }));
			await thisService._deductSpaceQuantity({ ...space, quantityUnlimited: true });
			expect(repoSpaceUpdateSpy).not.toBeCalled();
		});

		it('should deduct "1" quantity and add "1" to usedQuantity', async () => {
			const repoSpaceUpdateSpy = jest.spyOn(spaceRepo as any, 'update').mockResolvedValue(() => Promise.resolve(space));
			await thisService._deductSpaceQuantity({ ...space, quantityUnlimited: false });
			expect(repoSpaceUpdateSpy).toBeCalledWith(
				space.id,
				expect.objectContaining({ usedQuantity: space.usedQuantity + 1, quantity: space.quantity - 1 })
			);
		});

		it('should change space status to UNPUBLISHED if space quantity === space used quantity', async () => {
			const repoSpaceUpdateSpy = jest.spyOn(spaceRepo as any, 'update').mockResolvedValue(() => Promise.resolve(space));
			await thisService._deductSpaceQuantity({ ...space, quantityUnlimited: false, quantity: 1, usedQuantity: 0 });
			expect(repoSpaceUpdateSpy).toBeCalledWith(
				space.id,
				expect.objectContaining({ usedQuantity: 1, quantity: 0, status: SpaceStatus.UNPUBLISED })
			);
		});
		it('should check if the email is to be sent for booking membership packages', async () => {
			const result =await thisService.sendMembershipEmail('Booking space confirmation' , "monthly","Team Membership", "free");
			expect(result).toEqual(false);
		});
	});

	describe('method "changeStatus"', () => {
		let repo: Repository<InvoiceEntity>;
		let invoiceStatusRepo: Repository<InvoiceStatusEntity>;
		console.log(paidInvoiceStatusList.id)
		console.log(changeInvoiceStatusItemForPaid.refundAmount)
		console.log(refundInvoiceStatusList.id)
		console.log(item.id)



		beforeAll(() => {
			repo = MainDataSource.getRepository(InvoiceEntity);
			invoiceStatusRepo = MainDataSource.getRepository(InvoiceStatusEntity);

			jest.spyOn(MainDataSource.getRepository(TeamEntity) as any, 'find').mockReturnValue([]);
			jest.spyOn(MainDataSource.getRepository(VenueEntity) as any, 'findOne').mockReturnValue({ photos: [] });
			jest.spyOn(MainDataSource.getRepository(SpaceEntity) as any, 'findOne').mockReturnValue({ photos: [] });
		});

		it('calls repository with correct params', async () => {
			try {

				repo = MainDataSource.getRepository(InvoiceEntity);
				repo.createQueryBuilder = CreateQueryBuilderMock(item);

				jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
					return Promise.resolve(item);
				});

				await thisService.changeStatus(item.id, changeInvoiceStatusItemForPaid, TestUserBrandMember);
				const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
					return Promise.resolve(item);
				});
				expect(findOneOrFailSpy).toBeCalled();
				expect(findOneOrFailSpy).toBeCalledWith({
					where: { id: item.id },
					relations: [
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
					],
				});
			} catch (ex: any) {
				expect(ex.message).toEqual('Insufficient permissions');
			}
		});

		it('cant change invoice status if user is a brand member', async () => {
			try {

				repo = MainDataSource.getRepository(InvoiceEntity);
				repo.createQueryBuilder = CreateQueryBuilderMock(item);

				jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
					return Promise.resolve(item);
				});


				await thisService.changeStatus(item.id, changeInvoiceStatusItemForPaid, TestUserBrandMember);
				
			} catch (ex: any) {
				expect(ex.message).toEqual('Insufficient permissions');
			}
		});

		it("Invoice is Payed. Can't edit!", async () => {
			try {

				repo = MainDataSource.getRepository(InvoiceEntity);
				repo.createQueryBuilder = CreateQueryBuilderMock(item);

				jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
					return Promise.resolve(item);
				});


				invoiceStatusRepo = MainDataSource.getRepository(InvoiceStatusEntity);
				invoiceStatusRepo.createQueryBuilder = CreateQueryBuilderMock(paidInvoiceStatusList);

				jest.spyOn(invoiceStatusRepo, 'findOneOrFail').mockImplementation(async () => {
					return Promise.resolve(paidInvoiceStatusList);
				});
				await thisService.changeStatus(item.id, changeInvoiceStatusItemForPaid, TestUserSuperAdmin);
				
			} catch (ex: any) {
				expect(ex.message).toEqual("Invoice is Payed. Can't edit!");
			}
		});

		it('Payment not charged.', async () => {
			try {
				invoiceStatusRepo = MainDataSource.getRepository(InvoiceStatusEntity);
				invoiceStatusRepo.createQueryBuilder = CreateQueryBuilderMock(paidInvoiceStatusList);

				repo = MainDataSource.getRepository(InvoiceEntity);
				repo.createQueryBuilder = CreateQueryBuilderMock(newStatusitem);


				jest.spyOn(invoiceStatusRepo, 'findOneOrFail').mockImplementation(async () => {
					return Promise.resolve(paidInvoiceStatusList);
				});

				jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
					return Promise.resolve(newStatusitem);
				});

				jest.spyOn(thisService, 'processPayment').mockImplementation(async () => {
					return Promise.resolve(false);
				});
				

				await thisService.changeStatus(newStatusitem.id, changeInvoiceStatusItemForRefund, TestUserSuperAdmin);
				
			} catch (ex: any) {
				expect(ex.message).toEqual("Payment not charged.");
			}
		});

	describe('method "sendHostApprovalSMS"', () => {
			beforeAll(() => {
				jest.spyOn(MainDataSource.getRepository(InstantlyBookableConversationEntity) as any, 'findOneOrFail').mockReturnValue([instantlyBookableItem]);
				jest.spyOn(MainDataSource.getRepository(VenueEntity) as any, 'findOneOrFail').mockReturnValue([venueItem]);
				jest.spyOn(MainDataSource.getRepository(SpaceEntity) as any, 'findOneOrFail').mockReturnValue([spacetem]);
				jest.spyOn(MainDataSource.getRepository(ReservationEntity) as any, 'findOneOrFail').mockReturnValue([reservationItem]);
				//jest.spyOn(MainDataSource.getRepository(InvoiceEntity) as any, 'find').mockReturnValue([item]);
			});
	
			it('sendHostRequestSMS', async () => {
	
				const sendHostApprovalSpy = jest.spyOn(hostApprovalHelper, 'sendHostRequestSMS').mockImplementationOnce(jest.fn());

				await thisService.sendHostApprovalSMS(item, TestUserBrandMember);
	
				expect(MainDataSource.getRepository(InstantlyBookableConversationEntity).findOneOrFail).toHaveBeenCalledTimes(1);
				expect(MainDataSource.getRepository(VenueEntity).findOneOrFail).toHaveBeenCalledTimes(1);
				expect(MainDataSource.getRepository(SpaceEntity).findOneOrFail).toHaveBeenCalledTimes(1);
				expect(MainDataSource.getRepository(ReservationEntity).findOneOrFail).toHaveBeenCalledTimes(1);
				expect(sendHostApprovalSpy).toHaveBeenCalledTimes(1);
		});
	});

	});
});
